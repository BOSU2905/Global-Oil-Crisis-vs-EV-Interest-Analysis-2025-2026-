"""Shared fixtures.

The real source files are read read-only. Synthetic files are written to pytest
tmp directories, never into the repository.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path

import pytest

from pipeline import config as cfg
from pipeline.ingest import OilSeries, TrendsSeries, read_all_trends, read_oil_csv
from pipeline.transform import Panel, aggregate_oil_weekly, build_panel


@pytest.fixture(scope="session")
def oil_series() -> OilSeries:
    return read_oil_csv(cfg.OIL_RAW_CSV)


@pytest.fixture(scope="session")
def trends() -> dict[str, TrendsSeries]:
    return read_all_trends(cfg.PROCESSED_DIR, cfg.ALL_SERIES)


@pytest.fixture(scope="session")
def panel(oil_series: OilSeries, trends: dict[str, TrendsSeries]) -> Panel:
    start = min(series.dates[0] for series in trends.values())
    return build_panel(aggregate_oil_weekly(oil_series.since(start)), trends)


@pytest.fixture
def write_csv(tmp_path: Path):
    """Write a CSV with explicit content and return its path."""

    def _write(name: str, content: str) -> Path:
        path = tmp_path / name
        path.write_text(content, encoding="utf-8")
        return path

    return _write


def sundays(start: str, count: int) -> list[dt.date]:
    """``count`` consecutive Sundays beginning at ``start``."""
    first = dt.date.fromisoformat(start)
    assert first.weekday() == 6, f"{start} is not a Sunday"
    return [first + dt.timedelta(weeks=i) for i in range(count)]
