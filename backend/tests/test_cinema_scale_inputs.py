"""Unit tests for analysis_utils.compute_cinema_scale_inputs (extracted from
analysis.py Section 14 — cinema-scale prep)."""

from __future__ import annotations

from collections import Counter

import pandas as pd
import pytest

from app.analysis_utils import compute_cinema_scale_inputs


class TestComputeCinemaScaleInputs:
    def test_builds_counters_from_enriched_films(self):
        films_enriched = pd.DataFrame({
            "countries": [["US"], ["US", "FR"], ["JP"]],
            "decade": ["2020s", "2020s", "2010s"],
            "language": ["en", "fr", "ja"],
            "release_date": ["2021-01-01", "2022-01-01", "2015-01-01"],
        })
        genre_counts = Counter({"Drama": 2})
        director_counts = Counter({"Some Director": 3})

        result = compute_cinema_scale_inputs(films_enriched, genre_counts, director_counts)

        assert result["country_counts"] == Counter({"US": 2, "FR": 1, "JP": 1})
        assert result["decade_counts"] == Counter({"2020s": 2, "2010s": 1})
        assert result["language_counts"] == Counter({"en": 1, "fr": 1, "ja": 1})
        assert result["total_films"] == 3
        # genre_counts/director_counts pass through unchanged
        assert result["genre_counts"] is genre_counts
        assert result["director_counts"] is director_counts

    def test_median_release_year_computed_from_release_date(self):
        films_enriched = pd.DataFrame({
            "release_date": ["2010-01-01", "2020-01-01", "2030-01-01"],
        })
        result = compute_cinema_scale_inputs(films_enriched, Counter(), Counter())
        assert result["median_release_year"] == 2020

    def test_missing_columns_default_to_empty_counters_and_none_median(self):
        films_enriched = pd.DataFrame({"title": ["A", "B"]})
        result = compute_cinema_scale_inputs(films_enriched, Counter(), Counter())
        assert result["country_counts"] == Counter()
        assert result["decade_counts"] == Counter()
        assert result["language_counts"] == Counter()
        assert result["median_release_year"] is None
        assert result["total_films"] == 2

    def test_output_is_directly_usable_by_compute_cinema_scale(self):
        from app.analysis_utils import compute_cinema_scale

        films_enriched = pd.DataFrame({
            "countries": [["US"], ["FR"]],
            "decade": ["2020s", "2010s"],
            "language": ["en", "fr"],
            "release_date": ["2021-01-01", "2015-01-01"],
        })
        inputs = compute_cinema_scale_inputs(films_enriched, Counter({"Drama": 2}), Counter({"Dir": 2}))
        result = compute_cinema_scale(**inputs)
        assert 0 <= result["score"] <= 100
        assert result["model_version"] == "cine_v2"
