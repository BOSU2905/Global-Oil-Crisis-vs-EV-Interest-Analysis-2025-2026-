"""Phase 2A: bug-for-bug reproduction of the original notebook.

Purpose: establish that the port is *faithful* before anything is corrected, so
that every difference in the corrected output is attributable to a deliberate,
documented decision rather than to a migration mistake.

This module intentionally reproduces four defects. Do not "fix" anything here;
the corrected implementations live in ingest.py / transform.py.

  1. ``skiprows=2`` on the worldwide Trends export, which consumes the header
     *and* the first data row and promotes the second data row to be the
     header -- destroying the 2025-08-31 and 2025-09-07 observations. The five
     country exports are read without ``skiprows``, so only the worldwide
     series is truncated.
  2. ``resample('W-SUN')``, which labels each weekly bin by the Sunday that
     ENDS it, then joins that key to a Trends key meaning "week starting
     Sunday" -- an accidental one-week lag.
  3. Division by the rounded constant 159 rather than 158.987294928.
  4. ``round(2)`` applied to $/litre before analysis, quantising the variable.

Verified against the committed ``data/processed/final_data.csv`` byte-for-byte
by tests/test_legacy_reproduction.py.
"""

from __future__ import annotations

import csv
import datetime as dt
from dataclasses import dataclass
from pathlib import Path

from .config import LEGACY_LITRES_PER_BARREL, PROCESSED_DIR, Series
from .statistics import mean

LEGACY_START_DATE = dt.date(2025, 1, 1)
"""The notebook filtered the oil series to >= 2025-01-01 *after* forward-filling
the full 2021-2026 history."""

LEGACY_COLUMN_ORDER = (
    "Observation Date",
    "Worldwide Trends",
    "Price($)/Litre",
    "Indonesia EV Trends",
    "Malaysia EV Trends",
    "Norway EV Trends",
    "Singapore EV Trends",
    "USA EV Trends",
)


def legacy_week_label(day: dt.date) -> dt.date:
    """Reproduce pandas ``resample('W-SUN')`` labelling: the Sunday that ENDS
    the bin, where the bin spans Monday..Sunday."""
    return day + dt.timedelta(days=(6 - day.weekday()) % 7)


@dataclass(frozen=True, slots=True)
class LegacyResult:
    header: tuple[str, ...]
    rows: list[dict[str, object]]

    def __len__(self) -> int:
        return len(self.rows)

    def to_csv_text(self) -> str:
        """Render exactly as ``DataFrame.to_csv(index=False)`` would."""
        lines = [",".join(self.header)]
        for row in self.rows:
            cells = []
            for column in self.header:
                value = row[column]
                if isinstance(value, dt.date):
                    cells.append(value.isoformat())
                elif isinstance(value, int):
                    cells.append(str(value))
                else:
                    # str() of a Python float matches pandas' default
                    # float_format=None repr: 0.42 -> "0.42", 0.60 -> "0.6".
                    cells.append(str(value))
            lines.append(",".join(cells))
        return "\n".join(lines) + "\n"


def _read_legacy_oil_weekly(raw_oil_csv: Path) -> dict[dt.date, float]:
    """Forward-fill the full daily series, filter to 2025+, resample W-SUN."""
    with raw_oil_csv.open(newline="", encoding="utf-8-sig") as handle:
        rows = [r for r in csv.reader(handle) if r and any(c.strip() for c in r)]

    filled: list[tuple[dt.date, float]] = []
    last: float | None = None
    for raw_date, raw_value in ((r[0].strip(), r[1].strip()) for r in rows[1:]):
        if raw_value == "":
            if last is None:
                continue
            value = last
        else:
            value = float(raw_value)
            last = value
        filled.append((dt.date.fromisoformat(raw_date), value))

    buckets: dict[dt.date, list[float]] = {}
    for day, value in filled:
        if day < LEGACY_START_DATE:
            continue
        buckets.setdefault(legacy_week_label(day), []).append(value)

    return {label: mean(values) for label, values in sorted(buckets.items())}


def _read_legacy_trends(path: Path, *, skiprows: int) -> dict[dt.date, int]:
    """Read a Trends export the way the notebook did, including ``skiprows``."""
    with path.open(newline="", encoding="utf-8-sig") as handle:
        rows = [r for r in csv.reader(handle) if r and any(c.strip() for c in r)]

    body = rows[skiprows:]
    if not body:
        return {}
    # pandas treats the first surviving row as the header; the notebook then
    # overwrote the column names positionally, discarding that row's data.
    data_rows = body[1:]

    out: dict[dt.date, int] = {}
    for row in data_rows:
        raw_date = row[0].strip().strip('"')
        out[dt.date.fromisoformat(raw_date)] = int(float(row[1].strip().strip('"')))
    return out


def reproduce_legacy_final_data(
    raw_oil_csv: Path,
    processed_dir: Path = PROCESSED_DIR,
    countries: tuple[Series, ...] = (),
    worldwide: Series | None = None,
) -> LegacyResult:
    """Rebuild ``final_data.csv`` exactly as the original notebook produced it."""
    if worldwide is None or not countries:
        raise ValueError("worldwide series and country registry are required")

    oil_weekly = _read_legacy_oil_weekly(raw_oil_csv)

    # Defect 1: skiprows=2 for worldwide, 0 for the countries.
    worldwide_scores = _read_legacy_trends(processed_dir / worldwide.filename, skiprows=2)
    country_scores = {
        country.id: _read_legacy_trends(processed_dir / country.filename, skiprows=0)
        for country in countries
    }

    # Defects 2-4: join on the end-labelled key, divide by 159, round to 2 dp.
    price_by_week = {
        week: round(value / LEGACY_LITRES_PER_BARREL, 2)
        for week, value in oil_weekly.items()
        if week in worldwide_scores
    }

    # Inner join across every frame, preserving the notebook's column order.
    keys = sorted(
        week
        for week in worldwide_scores
        if week in price_by_week and all(week in scores for scores in country_scores.values())
    )

    rows: list[dict[str, object]] = []
    for week in keys:
        row: dict[str, object] = {
            "Observation Date": week,
            "Worldwide Trends": worldwide_scores[week],
            "Price($)/Litre": price_by_week[week],
        }
        for country in countries:
            row[country.legacy_column] = country_scores[country.id][week]
        rows.append(row)

    return LegacyResult(header=LEGACY_COLUMN_ORDER, rows=rows)
