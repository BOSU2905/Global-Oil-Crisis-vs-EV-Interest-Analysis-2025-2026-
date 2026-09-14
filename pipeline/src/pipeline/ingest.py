"""Reading and validating the immutable source data.

Nothing in this module writes to disk. ``data/raw`` and the committed Google
Trends exports are opened read-only.

The central fix in this module is :func:`read_trends_csv`. The original
notebook used ``pd.read_csv(..., skiprows=2)``, a hard-coded row count that
happened to match Google's two-line export preamble but did NOT match the
already-cleaned files committed to this repository. Applied to a file with a
single header row it consumed the header *and* the first data row, and
promoted the second data row to be the header -- silently destroying two
observations. Here we detect the header instead of assuming its position.
"""

from __future__ import annotations

import csv
import datetime as dt
import hashlib
from dataclasses import dataclass, field
from pathlib import Path

from .config import Series, week_start


class SchemaError(ValueError):
    """Raised when a source file does not match its expected schema.

    Deliberately loud: a silent fallback is what produced the original data
    loss. If the shape of a source file changes, the pipeline stops.
    """


# ---------------------------------------------------------------------------
# Oil (FRED DCOILBRENTEU)
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class OilObservation:
    date: dt.date
    usd_per_barrel: float
    is_imputed: bool
    """True when the source row was empty (a market holiday) and the value was
    carried forward from the previous trading day."""


@dataclass(frozen=True, slots=True)
class OilSeries:
    observations: list[OilObservation]
    source_path: Path
    source_sha256: str
    imputed_count: int
    first_date: dt.date
    last_date: dt.date

    def __len__(self) -> int:
        return len(self.observations)

    def since(self, start: dt.date) -> list[OilObservation]:
        return [o for o in self.observations if o.date >= start]


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_oil_csv(path: Path) -> OilSeries:
    """Read the FRED daily Brent series.

    Missing values (market holidays, present as empty cells) are forward-filled
    and flagged. Forward fill is the appropriate choice for a price level: the
    last traded price remains the best estimate of the price on a day with no
    trading.
    """
    with path.open(newline="", encoding="utf-8-sig") as handle:
        rows = [row for row in csv.reader(handle) if row and any(cell.strip() for cell in row)]

    if not rows:
        raise SchemaError(f"{path.name}: file is empty")

    header = [cell.strip() for cell in rows[0]]
    if len(header) != 2 or header[0].lower() not in {"observation_date", "date"}:
        raise SchemaError(
            f"{path.name}: expected a 2-column header starting with "
            f"'observation_date', got {header!r}"
        )

    observations: list[OilObservation] = []
    last_value: float | None = None
    imputed = 0

    for line_number, row in enumerate(rows[1:], start=2):
        if len(row) != 2:
            raise SchemaError(f"{path.name}:{line_number}: expected 2 fields, got {len(row)}")

        raw_date, raw_value = row[0].strip(), row[1].strip()
        try:
            date = dt.date.fromisoformat(raw_date)
        except ValueError as exc:
            raise SchemaError(f"{path.name}:{line_number}: bad date {raw_date!r}") from exc

        if raw_value == "" or raw_value == ".":
            # FRED writes '.' for missing in some export variants.
            if last_value is None:
                raise SchemaError(
                    f"{path.name}:{line_number}: series begins with a missing value, "
                    "nothing to forward-fill from"
                )
            observations.append(OilObservation(date, last_value, True))
            imputed += 1
            continue

        try:
            value = float(raw_value)
        except ValueError as exc:
            raise SchemaError(f"{path.name}:{line_number}: bad value {raw_value!r}") from exc
        if value <= 0:
            raise SchemaError(f"{path.name}:{line_number}: non-positive price {value}")

        last_value = value
        observations.append(OilObservation(date, value, False))

    dates = [o.date for o in observations]
    if dates != sorted(dates):
        raise SchemaError(f"{path.name}: dates are not in ascending order")
    if len(set(dates)) != len(dates):
        raise SchemaError(f"{path.name}: duplicate dates present")

    return OilSeries(
        observations=observations,
        source_path=path,
        source_sha256=sha256_of(path),
        imputed_count=imputed,
        first_date=dates[0],
        last_date=dates[-1],
    )


# ---------------------------------------------------------------------------
# Google Trends
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class TrendsObservation:
    week_start: dt.date
    value: float


@dataclass(frozen=True, slots=True)
class TrendsSeries:
    series_id: str
    label: str
    observations: list[TrendsObservation]
    source_path: Path
    source_sha256: str
    header_row_index: int
    """0-based index of the detected header row. The original code assumed this
    was always 2; for the committed files it is 0."""
    preamble_rows: list[list[str]] = field(default_factory=list)
    detected_header: list[str] = field(default_factory=list)
    sub_one_count: int = 0
    """Google writes '<1' for non-zero interest below 1% of peak."""

    def __len__(self) -> int:
        return len(self.observations)

    @property
    def dates(self) -> list[dt.date]:
        return [o.week_start for o in self.observations]

    @property
    def values(self) -> list[float]:
        return [o.value for o in self.observations]


def _looks_like_data_row(row: list[str]) -> bool:
    """True when a row's first cell is an ISO date and second cell is numeric."""
    if len(row) < 2:
        return False
    first = row[0].strip().strip('"').strip()
    second = row[1].strip().strip('"').strip()
    try:
        dt.date.fromisoformat(first)
    except ValueError:
        return False
    if second in {"<1", "<%1"}:
        return True
    try:
        float(second)
    except ValueError:
        return False
    return True


def read_trends_csv(path: Path, series: Series) -> TrendsSeries:
    """Read a Google Trends weekly export, detecting the header robustly.

    Handles all of these shapes:

        Category: All categories          <- variable-length preamble
        <blank>
        Week,electric car: (Worldwide)    <- header
        2025-08-31,60

        "Time","Electric Car"             <- single header row (this repo)
        "2025-08-31",60

        2025-08-31,60                     <- no header at all

    Strategy: find the first row that *is* a data row, treat everything above
    it as preamble plus (optionally) a header. This never depends on a
    hard-coded row offset, so it cannot silently eat observations.
    """
    with path.open(newline="", encoding="utf-8-sig") as handle:
        rows = [row for row in csv.reader(handle) if row and any(cell.strip() for cell in row)]

    if not rows:
        raise SchemaError(f"{path.name}: file is empty")

    first_data_index: int | None = next(
        (i for i, row in enumerate(rows) if _looks_like_data_row(row)), None
    )
    if first_data_index is None:
        raise SchemaError(
            f"{path.name}: no row matched the expected Google Trends data shape "
            "(ISO date in column 1, numeric interest score in column 2)"
        )

    header_index = first_data_index - 1 if first_data_index > 0 else -1
    detected_header = (
        [cell.strip().strip('"') for cell in rows[header_index]] if header_index >= 0 else []
    )
    preamble = [list(row) for row in rows[:header_index]] if header_index > 0 else []

    observations: list[TrendsObservation] = []
    sub_one = 0

    for offset, row in enumerate(rows[first_data_index:]):
        line_number = first_data_index + offset + 1
        if not _looks_like_data_row(row):
            raise SchemaError(
                f"{path.name}:{line_number}: unexpected row inside the data block: {row!r}"
            )

        raw_date = row[0].strip().strip('"').strip()
        raw_value = row[1].strip().strip('"').strip()
        date = dt.date.fromisoformat(raw_date)

        if raw_value in {"<1", "<%1"}:
            # Documented Google convention: non-zero but below 1% of the peak.
            # Mapped to 0.5 as the midpoint of the (0, 1) interval it denotes.
            value = 0.5
            sub_one += 1
        else:
            value = float(raw_value)

        if not 0.0 <= value <= 100.0:
            raise SchemaError(
                f"{path.name}:{line_number}: interest score {value} outside the "
                "0-100 range that Google Trends guarantees"
            )
        observations.append(TrendsObservation(date, value))

    _validate_weekly_grid(path, observations)

    return TrendsSeries(
        series_id=series.id,
        label=series.label,
        observations=observations,
        source_path=path,
        source_sha256=sha256_of(path),
        header_row_index=header_index,
        preamble_rows=preamble,
        detected_header=detected_header,
        sub_one_count=sub_one,
    )


def _validate_weekly_grid(path: Path, observations: list[TrendsObservation]) -> None:
    """Assert the Trends weekly key convention we rely on for joining."""
    if len(observations) < 3:
        raise SchemaError(f"{path.name}: only {len(observations)} observations, expected a series")

    dates = [o.week_start for o in observations]
    if dates != sorted(dates):
        raise SchemaError(f"{path.name}: week dates are not ascending")
    if len(set(dates)) != len(dates):
        raise SchemaError(f"{path.name}: duplicate week dates")

    # The join in transform.py is only valid if Trends labels weeks by their
    # first day and that day is a Sunday. Verify rather than trust.
    offenders = [d.isoformat() for d in dates if week_start(d) != d]
    if offenders:
        raise SchemaError(
            f"{path.name}: expected every week key to be a Sunday (Google Trends "
            f"labels weeks by their first day); offending dates: {offenders[:5]}"
        )

    gaps = [
        (dates[i - 1].isoformat(), dates[i].isoformat())
        for i in range(1, len(dates))
        if (dates[i] - dates[i - 1]).days != 7
    ]
    if gaps:
        raise SchemaError(f"{path.name}: non-contiguous weekly grid at {gaps[:5]}")


def read_all_trends(processed_dir: Path, all_series: tuple[Series, ...]) -> dict[str, TrendsSeries]:
    """Read every Trends export and assert they share one weekly grid."""
    loaded = {s.id: read_trends_csv(processed_dir / s.filename, s) for s in all_series}

    grids = {sid: tuple(series.dates) for sid, series in loaded.items()}
    reference_id, reference_grid = next(iter(grids.items()))
    for sid, grid in grids.items():
        if grid != reference_grid:
            raise SchemaError(
                f"Trends series '{sid}' spans {grid[0]}..{grid[-1]} ({len(grid)} weeks) but "
                f"'{reference_id}' spans {reference_grid[0]}..{reference_grid[-1]} "
                f"({len(reference_grid)} weeks); all exports must share one weekly grid"
            )
    return loaded
