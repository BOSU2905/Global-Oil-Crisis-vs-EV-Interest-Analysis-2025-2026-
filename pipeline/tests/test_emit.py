"""Artifact tests: strict JSON, determinism, and the frontend contract.

The frontend will import these files directly, so the contract they encode is
load-bearing: valid JSON with no NaN, stable across runs, and carrying the
metadata that stops the presentation layer from re-introducing an invalid
comparison.
"""

from __future__ import annotations

import json

import pytest

from pipeline import config as cfg
from pipeline.build import run
from pipeline.emit import (
    ARTIFACT_CLAIMS,
    ARTIFACT_COUNTRIES,
    ARTIFACT_MANIFEST,
    ARTIFACT_METRICS,
    ARTIFACT_PANEL,
    dumps,
    write_artifacts,
)


@pytest.fixture(scope="module")
def built():
    return run()


@pytest.fixture(scope="module")
def written(built, tmp_path_factory):
    out = tmp_path_factory.mktemp("generated")
    result = write_artifacts(
        out,
        panel_payload=built.payloads[ARTIFACT_PANEL],
        metrics_payload=built.payloads[ARTIFACT_METRICS],
        countries_payload=built.payloads[ARTIFACT_COUNTRIES],
        claims_payload=built.payloads[ARTIFACT_CLAIMS],
        source_hashes=built.source_hashes,
    )
    return out, result


def load(directory, name):
    return json.loads((directory / name).read_text(encoding="utf-8"))


class TestStrictJson:
    def test_all_artifacts_parse(self, written) -> None:
        out, _ = written
        for name in (
            ARTIFACT_PANEL,
            ARTIFACT_METRICS,
            ARTIFACT_COUNTRIES,
            ARTIFACT_CLAIMS,
            ARTIFACT_MANIFEST,
        ):
            assert load(out, name)

    def test_no_nan_or_infinity_literals(self, written) -> None:
        """json.dump emits bare NaN/Infinity by default, which is invalid JSON
        and would crash JSON.parse in the browser."""
        out, _ = written
        for name in (ARTIFACT_PANEL, ARTIFACT_METRICS, ARTIFACT_CLAIMS):
            text = (out / name).read_text(encoding="utf-8")
            assert "NaN" not in text
            assert "Infinity" not in text
            # Strict parser rejects those literals outright.
            json.loads(text, parse_constant=lambda c: pytest.fail(f"bad constant {c}"))

    def test_non_computable_results_become_null(self, built) -> None:
        payload = built.payloads[ARTIFACT_METRICS]
        for series in payload["series"].values():
            for variant in series["sensitivity"]["variants"]:
                if not variant["computable"]:
                    assert variant["pearson_r"] is None


class TestDeterminism:
    def test_analytical_artifacts_are_byte_stable(self, built) -> None:
        """Two runs must produce identical bytes for everything except the
        manifest timestamp."""
        second = run()
        for name in (ARTIFACT_PANEL, ARTIFACT_METRICS, ARTIFACT_COUNTRIES, ARTIFACT_CLAIMS):
            assert dumps(built.payloads[name]) == dumps(second.payloads[name])

    def test_manifest_timestamp_is_the_only_volatile_field(self, built, tmp_path) -> None:
        def emit(subdir: str):
            return write_artifacts(
                tmp_path / subdir,
                panel_payload=built.payloads[ARTIFACT_PANEL],
                metrics_payload=built.payloads[ARTIFACT_METRICS],
                countries_payload=built.payloads[ARTIFACT_COUNTRIES],
                claims_payload=built.payloads[ARTIFACT_CLAIMS],
                source_hashes=built.source_hashes,
            )

        first, second = emit("a"), emit("b")
        assert first.content_hash == second.content_hash

        a = load(tmp_path / "a", ARTIFACT_MANIFEST)
        b = load(tmp_path / "b", ARTIFACT_MANIFEST)
        assert a.pop("generated_at") is not None
        b.pop("generated_at")
        assert a == b

    def test_generated_at_is_valid_rfc3339_utc(self, written) -> None:
        """Guards against emitting '+00:00Z', which no strict parser accepts."""
        import datetime as dt

        out, _ = written
        stamp = load(out, ARTIFACT_MANIFEST)["generated_at"]
        assert stamp.endswith("Z")
        assert "+00:00" not in stamp
        parsed = dt.datetime.fromisoformat(stamp.replace("Z", "+00:00"))
        assert parsed.tzinfo is not None

    def test_content_hash_covers_the_analytical_artifacts(self, written) -> None:
        out, result = written
        manifest = load(out, ARTIFACT_MANIFEST)
        assert manifest["content_hash"] == result.content_hash
        assert set(manifest["artifacts"]) == {
            ARTIFACT_PANEL,
            ARTIFACT_METRICS,
            ARTIFACT_COUNTRIES,
            ARTIFACT_CLAIMS,
        }


class TestPanelArtifact:
    def test_one_row_per_trends_week(self, written) -> None:
        out, _ = written
        panel = load(out, ARTIFACT_PANEL)
        assert len(panel["rows"]) == 31
        assert panel["coverage"]["trends_weeks"] == 31
        assert panel["coverage"]["oil_weeks"] == 30

    def test_partial_and_missing_weeks_are_marked(self, written) -> None:
        out, _ = written
        panel = load(out, ARTIFACT_PANEL)
        assert panel["coverage"]["partial_weeks"] == ["2026-03-22"]
        assert panel["coverage"]["weeks_without_oil"] == ["2026-03-29"]

        by_week = {row["week_start"]: row for row in panel["rows"]}
        assert by_week["2026-03-22"]["oil"]["is_partial_week"] is True
        assert by_week["2026-03-22"]["oil"]["trading_days"] == 1
        assert by_week["2026-03-29"]["oil"] is None
        assert by_week["2026-03-29"]["interest"]["worldwide"] == 100

    def test_both_units_are_published(self, written) -> None:
        out, _ = written
        panel = load(out, ARTIFACT_PANEL)
        row = next(r for r in panel["rows"] if r["oil"])
        assert row["oil"]["brent_usd_per_barrel"] > 0
        assert row["oil"]["brent_usd_per_litre"] > 0
        assert "not a retail pump price" in panel["units"]["brent_usd_per_litre"].lower() or (
            "NOT a retail pump price" in panel["units"]["brent_usd_per_litre"]
        )

    def test_week_end_is_six_days_after_week_start(self, written) -> None:
        import datetime as dt

        out, _ = written
        for row in load(out, ARTIFACT_PANEL)["rows"]:
            start = dt.date.fromisoformat(row["week_start"])
            end = dt.date.fromisoformat(row["week_end"])
            assert (end - start).days == 6


class TestComparabilityContract:
    def test_normalisation_limitation_is_machine_readable(self, written) -> None:
        out, _ = written
        comparability = load(out, ARTIFACT_COUNTRIES)["comparability"]
        assert comparability["trends_normalisation"] == cfg.TRENDS_NORMALISATION
        assert comparability["forbidden_comparisons"]
        assert "mean_interest" in comparability["series_local_metrics"]
        assert "pearson_r" in comparability["scale_free_metrics"]

    def test_series_local_metrics_are_flagged_in_every_profile(self, written) -> None:
        out, _ = written
        for series in load(out, ARTIFACT_METRICS)["series"].values():
            assert series["profile"]["series_local"]["_comparable_across_series"] is False
            assert series["profile"]["scale_free"]["_comparable_across_series"] is True

    def test_no_ranking_metric_is_emitted(self, written) -> None:
        """There must be no field a frontend could mistake for 'most interested'."""
        out, _ = written
        text = (out / ARTIFACT_METRICS).read_text(encoding="utf-8").lower()
        for forbidden in ("most_enthusiastic", "interest_rank", "enthusiasm_rank"):
            assert forbidden not in text

    def test_registry_ids_are_canonical(self, written) -> None:
        out, _ = written
        ids = {s["id"] for s in load(out, ARTIFACT_COUNTRIES)["series"]}
        assert ids == {"worldwide", "indonesia", "malaysia", "norway", "singapore", "us"}
        labels = {s["id"]: s["label"] for s in load(out, ARTIFACT_COUNTRIES)["series"]}
        assert labels["us"] == "United States"


class TestClaimsArtifact:
    def test_every_claim_has_a_disposition(self, written) -> None:
        out, _ = written
        for claim in load(out, ARTIFACT_CLAIMS)["claims"]:
            assert claim["disposition"] in {
                "retain",
                "rewrite",
                "remove",
                "requires_citation",
            }

    def test_uncited_claims_are_not_publishable(self, written) -> None:
        out, _ = written
        for claim in load(out, ARTIFACT_CLAIMS)["claims"]:
            if not claim["sources"] and not claim["evidence"]:
                assert claim["publishable_as_fact"] is False

    def test_the_synchronised_peak_claim_is_marked_contradicted(self, written) -> None:
        out, _ = written
        claims = {c["id"]: c for c in load(out, ARTIFACT_CLAIMS)["claims"]}
        claim = claims["synchronised_peak_single_month"]
        assert claim["status"] == "contradicted_by_data"
        assert claim["disposition"] == "rewrite"

    def test_the_ranking_claim_is_marked_invalid_method(self, written) -> None:
        out, _ = written
        claims = {c["id"]: c for c in load(out, ARTIFACT_CLAIMS)["claims"]}
        assert claims["most_enthusiastic_market"]["status"] == "invalid_method"
        assert claims["most_enthusiastic_market"]["disposition"] == "remove"

    def test_external_claims_carry_no_invented_sources(self, written) -> None:
        out, _ = written
        for claim in load(out, ARTIFACT_CLAIMS)["claims"]:
            if claim["disposition"] == "requires_citation":
                assert claim["sources"] == []

    def test_summary_counts_match_the_claim_list(self, written) -> None:
        out, _ = written
        payload = load(out, ARTIFACT_CLAIMS)
        assert payload["summary"]["total"] == len(payload["claims"])


class TestManifest:
    def test_records_source_hashes_for_every_input(self, written) -> None:
        out, _ = written
        manifest = load(out, ARTIFACT_MANIFEST)
        expected = {cfg.OIL_RAW_CSV.name} | {s.filename for s in cfg.ALL_SERIES}
        assert set(manifest["source_files"]) == expected
        assert all(len(digest) == 64 for digest in manifest["source_files"].values())

    def test_records_the_analytical_configuration(self, written) -> None:
        out, _ = written
        configuration = load(out, ARTIFACT_MANIFEST)["analytical_configuration"]
        assert configuration["bootstrap_seed"] == cfg.BOOTSTRAP_SEED
        assert configuration["bootstrap_iterations"] == cfg.BOOTSTRAP_ITERATIONS
        assert configuration["primary_lag_weeks"] == cfg.PRIMARY_LAG_WEEKS
        assert configuration["litres_per_barrel"] == cfg.LITRES_PER_BARREL

    def test_documents_both_data_sources(self, written) -> None:
        out, _ = written
        sources = {s["id"] for s in load(out, ARTIFACT_MANIFEST)["sources"]}
        assert sources == {"fred_dcoilbrenteu", "google_trends_electric_car"}
