"""
Tests for input_validator.py — InputValidator and MLInputValidator classes.
Covers: JSON parsing, string/number/array/object/enum/boolean validation,
blocked patterns, ML-specific validation, and the safe wrapper.
"""

import json
import pytest
import sys
import os

# Add parent dir to path so we can import the module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from input_validator import (
    InputValidator,
    InputValidationError,
    MLInputValidator,
    validate_input_safe,
)


# =============================================================================
# InputValidationError
# =============================================================================
class TestInputValidationError:
    def test_basic_creation(self):
        err = InputValidationError("bad value")
        assert str(err) == "bad value"
        assert err.message == "bad value"
        assert err.field is None

    def test_creation_with_field(self):
        err = InputValidationError("too long", field="username")
        assert err.field == "username"
        assert err.message == "too long"


# =============================================================================
# validate_json_input
# =============================================================================
class TestValidateJsonInput:
    def test_valid_dict(self):
        result = InputValidator.validate_json_input({"key": "value"})
        assert result == {"key": "value"}

    def test_valid_json_string(self):
        result = InputValidator.validate_json_input('{"a": 1}')
        assert result == {"a": 1}

    def test_invalid_json_string(self):
        with pytest.raises(InputValidationError, match="Invalid JSON"):
            InputValidator.validate_json_input("{bad json")

    def test_non_dict_result_accepted(self):
        # validate_json_input does not enforce dict; it returns parsed JSON as-is
        result = InputValidator.validate_json_input("[1, 2, 3]")
        assert result == [1, 2, 3]

    def test_none_input(self):
        with pytest.raises(InputValidationError):
            InputValidator.validate_json_input(None)

    def test_numeric_input(self):
        with pytest.raises(InputValidationError):
            InputValidator.validate_json_input(42)

    def test_empty_object(self):
        result = InputValidator.validate_json_input("{}")
        assert result == {}


# =============================================================================
# check_blocked_patterns
# =============================================================================
class TestCheckBlockedPatterns:
    def test_safe_string(self):
        # Should not raise
        InputValidator.check_blocked_patterns("hello world", "test_field")

    def test_import_os(self):
        with pytest.raises(InputValidationError, match="Security violation"):
            InputValidator.check_blocked_patterns("import os", "field")

    def test_import_subprocess(self):
        with pytest.raises(InputValidationError, match="Security violation"):
            InputValidator.check_blocked_patterns("import subprocess", "field")

    def test_exec_call(self):
        with pytest.raises(InputValidationError, match="Security violation"):
            InputValidator.check_blocked_patterns("exec('code')", "field")

    def test_eval_call(self):
        with pytest.raises(InputValidationError, match="Security violation"):
            InputValidator.check_blocked_patterns("eval('1+1')", "field")

    def test_path_traversal(self):
        with pytest.raises(InputValidationError, match="Security violation"):
            InputValidator.check_blocked_patterns("../../etc/passwd", "field")

    def test_xss_script_tag(self):
        with pytest.raises(InputValidationError, match="Security violation"):
            InputValidator.check_blocked_patterns("<script>alert(1)</script>", "field")

    def test_non_string_skipped(self):
        # Non-string values should be silently skipped
        InputValidator.check_blocked_patterns(42, "field")
        InputValidator.check_blocked_patterns(None, "field")

    def test_case_insensitive(self):
        with pytest.raises(InputValidationError, match="Security violation"):
            InputValidator.check_blocked_patterns("IMPORT OS", "field")


# =============================================================================
# validate_string
# =============================================================================
class TestValidateString:
    def test_valid_string(self):
        assert InputValidator.validate_string("hello", "name") == "hello"

    def test_required_none_raises(self):
        with pytest.raises(InputValidationError, match="required"):
            InputValidator.validate_string(None, "name", required=True)

    def test_optional_none_returns_none(self):
        assert InputValidator.validate_string(None, "name", required=False) is None

    def test_non_string_type(self):
        with pytest.raises(InputValidationError, match="must be a string"):
            InputValidator.validate_string(123, "name")

    def test_min_length(self):
        with pytest.raises(InputValidationError, match="at least 5"):
            InputValidator.validate_string("hi", "name", min_length=5)

    def test_max_length(self):
        with pytest.raises(InputValidationError, match="exceeds maximum"):
            InputValidator.validate_string("a" * 20, "name", max_length=10)

    def test_default_max_length(self):
        long_string = "a" * (InputValidator.MAX_STRING_LENGTH + 1)
        with pytest.raises(InputValidationError, match="exceeds maximum"):
            InputValidator.validate_string(long_string, "name")

    def test_pattern_match(self):
        assert InputValidator.validate_string("abc123", "code", pattern=r"^[a-z0-9]+$") == "abc123"

    def test_pattern_mismatch(self):
        with pytest.raises(InputValidationError, match="pattern"):
            InputValidator.validate_string("ABC!", "code", pattern=r"^[a-z0-9]+$")

    def test_blocked_pattern_in_string(self):
        with pytest.raises(InputValidationError, match="Security violation"):
            InputValidator.validate_string("import os; do_bad_stuff()", "cmd")


# =============================================================================
# validate_number
# =============================================================================
class TestValidateNumber:
    def test_valid_int(self):
        assert InputValidator.validate_number(42, "age") == 42.0

    def test_valid_float(self):
        assert InputValidator.validate_number(3.14, "pi") == 3.14

    def test_string_number(self):
        assert InputValidator.validate_number("99", "count") == 99.0

    def test_required_none_raises(self):
        with pytest.raises(InputValidationError, match="required"):
            InputValidator.validate_number(None, "val", required=True)

    def test_optional_none(self):
        assert InputValidator.validate_number(None, "val", required=False) is None

    def test_non_numeric_string(self):
        with pytest.raises(InputValidationError, match="must be a number"):
            InputValidator.validate_number("abc", "val")

    def test_min_value(self):
        with pytest.raises(InputValidationError, match="at least"):
            InputValidator.validate_number(5, "val", min_value=10)

    def test_max_value(self):
        with pytest.raises(InputValidationError, match="at most"):
            InputValidator.validate_number(100, "val", max_value=50)

    def test_int_only(self):
        assert InputValidator.validate_number(42, "count", allow_float=False) == 42

    def test_float_truncated_when_int_only(self):
        # int(3.14) truncates to 3 without error
        assert InputValidator.validate_number(3.14, "count", allow_float=False) == 3

    def test_nan_rejected(self):
        with pytest.raises(InputValidationError, match="finite number"):
            InputValidator.validate_number(float("nan"), "val")


# =============================================================================
# validate_array
# =============================================================================
class TestValidateArray:
    def test_valid_list(self):
        result = InputValidator.validate_array([1, 2, 3], "items")
        assert result == [1, 2, 3]

    def test_valid_tuple(self):
        result = InputValidator.validate_array((1, 2), "items")
        assert result == [1, 2]

    def test_required_none(self):
        with pytest.raises(InputValidationError, match="required"):
            InputValidator.validate_array(None, "items", required=True)

    def test_optional_none(self):
        assert InputValidator.validate_array(None, "items", required=False) is None

    def test_non_iterable(self):
        with pytest.raises(InputValidationError, match="must be an array"):
            InputValidator.validate_array("string", "items")

    def test_min_length(self):
        with pytest.raises(InputValidationError, match="at least 3"):
            InputValidator.validate_array([1], "items", min_length=3)

    def test_max_length(self):
        with pytest.raises(InputValidationError, match="exceeds maximum"):
            InputValidator.validate_array([1, 2, 3], "items", max_length=2)

    def test_default_max_length(self):
        big = list(range(InputValidator.MAX_ARRAY_LENGTH + 1))
        with pytest.raises(InputValidationError, match="exceeds maximum"):
            InputValidator.validate_array(big, "items")

    def test_empty_list(self):
        assert InputValidator.validate_array([], "items") == []


# =============================================================================
# validate_object
# =============================================================================
class TestValidateObject:
    def test_valid_dict(self):
        result = InputValidator.validate_object({"a": 1}, "data")
        assert result == {"a": 1}

    def test_required_none(self):
        with pytest.raises(InputValidationError, match="required"):
            InputValidator.validate_object(None, "data", required=True)

    def test_optional_none(self):
        assert InputValidator.validate_object(None, "data", required=False) is None

    def test_non_dict(self):
        with pytest.raises(InputValidationError, match="must be an object"):
            InputValidator.validate_object([1, 2], "data")

    def test_schema_validation(self):
        schema = {
            "name": {
                "required": True,
                "validator": lambda v, f: InputValidator.validate_string(v, f),
            }
        }
        result = InputValidator.validate_object({"name": "Alice"}, "data", schema=schema)
        assert result == {"name": "Alice"}

    def test_schema_missing_required(self):
        schema = {
            "name": {
                "required": True,
            }
        }
        with pytest.raises(InputValidationError, match="Required field"):
            InputValidator.validate_object({}, "data", schema=schema)


# =============================================================================
# validate_enum
# =============================================================================
class TestValidateEnum:
    def test_valid_value(self):
        assert InputValidator.validate_enum("red", "color", ["red", "green", "blue"]) == "red"

    def test_invalid_value(self):
        with pytest.raises(InputValidationError, match="must be one of"):
            InputValidator.validate_enum("yellow", "color", ["red", "green", "blue"])

    def test_required_none(self):
        with pytest.raises(InputValidationError, match="required"):
            InputValidator.validate_enum(None, "color", ["red"], required=True)

    def test_optional_none(self):
        assert InputValidator.validate_enum(None, "color", ["red"], required=False) is None


# =============================================================================
# validate_boolean
# =============================================================================
class TestValidateBoolean:
    def test_true(self):
        assert InputValidator.validate_boolean(True, "flag") is True

    def test_false(self):
        assert InputValidator.validate_boolean(False, "flag") is False

    def test_non_bool(self):
        with pytest.raises(InputValidationError, match="must be a boolean"):
            InputValidator.validate_boolean(1, "flag")

    def test_string_rejected(self):
        with pytest.raises(InputValidationError, match="must be a boolean"):
            InputValidator.validate_boolean("true", "flag")

    def test_required_none(self):
        with pytest.raises(InputValidationError, match="required"):
            InputValidator.validate_boolean(None, "flag", required=True)

    def test_optional_none(self):
        assert InputValidator.validate_boolean(None, "flag", required=False) is None


# =============================================================================
# MLInputValidator
# =============================================================================
class TestMLInputValidator:
    def test_validate_features_valid(self):
        features = {"bedrooms": 3, "sqft": 1500, "city": "Austin"}
        result = MLInputValidator.validate_features(features)
        assert result["bedrooms"] == 3.0
        assert result["sqft"] == 1500.0
        assert result["city"] == "Austin"

    def test_validate_features_bool(self):
        # In Python, bool is a subclass of int, so True hits the numeric branch
        features = {"has_pool": True}
        result = MLInputValidator.validate_features(features)
        assert result["has_pool"] == 1.0

    def test_validate_features_unsupported_type(self):
        with pytest.raises(InputValidationError, match="unsupported type"):
            MLInputValidator.validate_features({"data": [1, 2, 3]})

    def test_validate_features_blocked_key(self):
        with pytest.raises(InputValidationError, match="Security violation"):
            MLInputValidator.validate_features({"import os": 1})

    def test_validate_features_extreme_number(self):
        with pytest.raises(InputValidationError, match="at most"):
            MLInputValidator.validate_features({"price": 1e11})

    def test_validate_training_data(self):
        data = list(range(20))
        result = MLInputValidator.validate_training_data(data)
        assert len(result) == 20

    def test_validate_training_data_too_few(self):
        with pytest.raises(InputValidationError, match="at least 10"):
            MLInputValidator.validate_training_data([1, 2, 3])

    def test_validate_model_config_valid(self):
        config = {"model_type": "random_forest"}
        result = MLInputValidator.validate_model_config(config)
        assert result["model_type"] == "random_forest"

    def test_validate_model_config_invalid_type(self):
        with pytest.raises(InputValidationError, match="must be one of"):
            MLInputValidator.validate_model_config({"model_type": "invalid_model"})

    def test_validate_model_config_none(self):
        result = MLInputValidator.validate_model_config(None)
        assert result == {}

    def test_allowed_model_types(self):
        expected = ["linear_regression", "random_forest", "gradient_boosting", "neural_network", "svm"]
        assert MLInputValidator.ALLOWED_MODEL_TYPES == expected

    def test_allowed_uncertainty_methods(self):
        expected = ["bootstrap", "bayesian", "quantile", "ensemble"]
        assert MLInputValidator.ALLOWED_UNCERTAINTY_METHODS == expected


# =============================================================================
# validate_input_safe wrapper
# =============================================================================
class TestValidateInputSafe:
    def test_valid_input(self):
        success, data, error = validate_input_safe({"key": "value"})
        assert success is True
        assert data == {"key": "value"}
        assert error == ""

    def test_valid_json_string(self):
        success, data, error = validate_input_safe('{"x": 1}')
        assert success is True
        assert data == {"x": 1}

    def test_invalid_json(self):
        success, data, error = validate_input_safe("{bad}")
        assert success is False
        assert data == {}
        assert "Validation error" in error

    def test_non_object_json_accepted(self):
        # validate_json_input does not enforce dict type
        success, data, error = validate_input_safe('{"a": 1}')
        assert success is True
        assert data == {"a": 1}

    def test_none_input(self):
        success, data, error = validate_input_safe(None)
        assert success is False
        assert "error" in error.lower()
