"""
Tests for feature_engineering.py — pure transformation functions.
Requires numpy, pandas, scikit-learn.
"""

import pytest
import sys
import os
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from feature_engineering import (
    create_polynomial_features,
    create_interaction_features,
    apply_log_transform,
    apply_sqrt_transform,
    normalize_features,
    one_hot_encode_features,
)


@pytest.fixture
def sample_df():
    """Simple numeric DataFrame for transformation tests."""
    np.random.seed(42)
    return pd.DataFrame({
        "a": [1.0, 2.0, 3.0, 4.0, 5.0],
        "b": [10.0, 20.0, 30.0, 40.0, 50.0],
    })


@pytest.fixture
def mixed_df():
    """DataFrame with numeric and categorical columns."""
    return pd.DataFrame({
        "price": [100.0, 200.0, 300.0, 400.0],
        "size": [50.0, 60.0, 70.0, 80.0],
        "color": ["red", "blue", "red", "green"],
    })


# =============================================================================
# create_polynomial_features
# =============================================================================
class TestPolynomialFeatures:
    def test_creates_new_columns(self, sample_df):
        result_df, new_features = create_polynomial_features(
            sample_df, ["a", "b"], degree=2
        )
        assert len(new_features) > 0
        assert all(feat in result_df.columns for feat in new_features)

    def test_original_columns_preserved(self, sample_df):
        result_df, _ = create_polynomial_features(sample_df, ["a", "b"], degree=2)
        assert "a" in result_df.columns
        assert "b" in result_df.columns

    def test_row_count_unchanged(self, sample_df):
        result_df, _ = create_polynomial_features(sample_df, ["a", "b"], degree=2)
        assert len(result_df) == len(sample_df)

    def test_interaction_only(self, sample_df):
        result_df, new_features = create_polynomial_features(
            sample_df, ["a", "b"], degree=2, interaction_only=True
        )
        # Should have interaction term but not squared terms
        assert len(new_features) > 0


# =============================================================================
# create_interaction_features
# =============================================================================
class TestInteractionFeatures:
    def test_creates_product(self, sample_df):
        result_df, new_features = create_interaction_features(sample_df, ["a", "b"])
        assert "a_x_b" in new_features
        # Verify the product
        expected = sample_df["a"] * sample_df["b"]
        pd.testing.assert_series_equal(result_df["a_x_b"], expected, check_names=False)

    def test_single_feature_no_interaction(self, sample_df):
        result_df, new_features = create_interaction_features(sample_df, ["a"])
        assert new_features == []


# =============================================================================
# apply_log_transform
# =============================================================================
class TestLogTransform:
    def test_positive_values(self, sample_df):
        result_df, new_features = apply_log_transform(sample_df, ["a", "b"])
        assert "a_log" in new_features
        assert "b_log" in new_features
        np.testing.assert_allclose(result_df["a_log"], np.log(sample_df["a"]))

    def test_non_negative_values_use_log1p(self):
        df = pd.DataFrame({"x": [0.0, 1.0, 2.0, 3.0]})
        result_df, new_features = apply_log_transform(df, ["x"])
        assert "x_log1p" in new_features
        np.testing.assert_allclose(result_df["x_log1p"], np.log1p(df["x"]))

    def test_negative_values_skipped(self):
        df = pd.DataFrame({"x": [-1.0, 0.0, 1.0, 2.0]})
        result_df, new_features = apply_log_transform(df, ["x"])
        assert new_features == []


# =============================================================================
# apply_sqrt_transform
# =============================================================================
class TestSqrtTransform:
    def test_non_negative(self, sample_df):
        result_df, new_features = apply_sqrt_transform(sample_df, ["a", "b"])
        assert "a_sqrt" in new_features
        np.testing.assert_allclose(result_df["a_sqrt"], np.sqrt(sample_df["a"]))

    def test_negative_values_skipped(self):
        df = pd.DataFrame({"x": [-1.0, 0.0, 1.0]})
        result_df, new_features = apply_sqrt_transform(df, ["x"])
        assert new_features == []


# =============================================================================
# normalize_features
# =============================================================================
class TestNormalizeFeatures:
    def test_minmax(self, sample_df):
        result_df, new_features = normalize_features(sample_df, ["a", "b"], method="minmax")
        assert "a_minmax" in new_features
        # MinMax should be in [0, 1]
        assert result_df["a_minmax"].min() >= 0.0
        assert result_df["a_minmax"].max() <= 1.0

    def test_standard(self, sample_df):
        result_df, new_features = normalize_features(sample_df, ["a", "b"], method="standard")
        assert "a_standard" in new_features
        # Standard scaled should have mean ≈ 0
        assert abs(result_df["a_standard"].mean()) < 1e-10


# =============================================================================
# one_hot_encode_features
# =============================================================================
class TestOneHotEncode:
    def test_encodes_categorical(self, mixed_df):
        result_df, new_features = one_hot_encode_features(mixed_df, ["color"])
        assert len(new_features) > 0
        # drop_first=True so should have n-1 dummies
        assert len(new_features) == 2  # red, green, blue minus 1

    def test_numeric_columns_unchanged(self, mixed_df):
        result_df, _ = one_hot_encode_features(mixed_df, ["price"])
        # No categorical in ["price"], so no new features
        assert "price" in result_df.columns
