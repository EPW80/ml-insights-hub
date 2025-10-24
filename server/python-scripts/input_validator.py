#!/usr/bin/env python3
"""
Input Validation Module for Python Scripts
Provides comprehensive input validation and sanitization for all ML scripts
"""

import json
import sys
import re
from typing import Any, Dict, List, Union, Optional


class InputValidationError(Exception):
    """Raised when input validation fails"""
    def __init__(self, message: str, field: str = None):
        self.message = message
        self.field = field
        super().__init__(self.message)


class InputValidator:
    """Comprehensive input validator for ML scripts"""

    # Security constraints
    MAX_STRING_LENGTH = 1000
    MAX_ARRAY_LENGTH = 10000
    MAX_NESTED_DEPTH = 10

    # Blocked patterns for security
    BLOCKED_PATTERNS = [
        r'import\s+os',
        r'import\s+subprocess',
        r'import\s+sys',
        r'__import__',
        r'exec\s*\(',
        r'eval\s*\(',
        r'compile\s*\(',
        r'\.\./|\.\.\\',  # Path traversal
        r'/etc/|/proc/|/dev/',  # System directories
        r'<script',  # XSS attempt
        r'javascript:',  # XSS attempt
    ]

    @staticmethod
    def validate_json_input(input_data: Union[str, Dict]) -> Dict:
        """Validate and parse JSON input"""
        try:
            if isinstance(input_data, str):
                data = json.loads(input_data)
            elif isinstance(input_data, dict):
                data = input_data
            else:
                raise InputValidationError(
                    f"Input must be JSON string or dict, got {type(input_data).__name__}"
                )

            return data
        except json.JSONDecodeError as e:
            raise InputValidationError(f"Invalid JSON: {str(e)}")

    @staticmethod
    def check_blocked_patterns(value: str, field: str = "input") -> None:
        """Check for blocked security patterns"""
        if not isinstance(value, str):
            return

        for pattern in InputValidator.BLOCKED_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                raise InputValidationError(
                    f"Security violation: blocked pattern detected in {field}",
                    field=field
                )

    @staticmethod
    def validate_string(
        value: Any,
        field: str,
        required: bool = True,
        min_length: int = 0,
        max_length: int = None,
        pattern: str = None
    ) -> Optional[str]:
        """Validate string field"""
        if value is None:
            if required:
                raise InputValidationError(f"Field '{field}' is required", field=field)
            return None

        if not isinstance(value, str):
            raise InputValidationError(
                f"Field '{field}' must be a string, got {type(value).__name__}",
                field=field
            )

        # Check length
        if len(value) < min_length:
            raise InputValidationError(
                f"Field '{field}' must be at least {min_length} characters",
                field=field
            )

        max_len = max_length or InputValidator.MAX_STRING_LENGTH
        if len(value) > max_len:
            raise InputValidationError(
                f"Field '{field}' exceeds maximum length of {max_len} characters",
                field=field
            )

        # Check pattern
        if pattern and not re.match(pattern, value):
            raise InputValidationError(
                f"Field '{field}' does not match required pattern",
                field=field
            )

        # Security check
        InputValidator.check_blocked_patterns(value, field)

        return value

    @staticmethod
    def validate_number(
        value: Any,
        field: str,
        required: bool = True,
        min_value: float = None,
        max_value: float = None,
        allow_float: bool = True
    ) -> Optional[Union[int, float]]:
        """Validate numeric field"""
        if value is None:
            if required:
                raise InputValidationError(f"Field '{field}' is required", field=field)
            return None

        # Try to convert to number
        try:
            if allow_float:
                num_value = float(value)
            else:
                num_value = int(value)
        except (ValueError, TypeError):
            raise InputValidationError(
                f"Field '{field}' must be a number",
                field=field
            )

        # Check if finite
        if not isinstance(num_value, (int, float)) or num_value != num_value:  # NaN check
            raise InputValidationError(
                f"Field '{field}' must be a finite number",
                field=field
            )

        # Check range
        if min_value is not None and num_value < min_value:
            raise InputValidationError(
                f"Field '{field}' must be at least {min_value}",
                field=field
            )

        if max_value is not None and num_value > max_value:
            raise InputValidationError(
                f"Field '{field}' must be at most {max_value}",
                field=field
            )

        return num_value

    @staticmethod
    def validate_array(
        value: Any,
        field: str,
        required: bool = True,
        min_length: int = 0,
        max_length: int = None,
        item_validator: callable = None
    ) -> Optional[List]:
        """Validate array field"""
        if value is None:
            if required:
                raise InputValidationError(f"Field '{field}' is required", field=field)
            return None

        if not isinstance(value, (list, tuple)):
            raise InputValidationError(
                f"Field '{field}' must be an array",
                field=field
            )

        # Check length
        if len(value) < min_length:
            raise InputValidationError(
                f"Field '{field}' must have at least {min_length} items",
                field=field
            )

        max_len = max_length or InputValidator.MAX_ARRAY_LENGTH
        if len(value) > max_len:
            raise InputValidationError(
                f"Field '{field}' exceeds maximum length of {max_len} items",
                field=field
            )

        # Validate items if validator provided
        if item_validator:
            validated_items = []
            for i, item in enumerate(value):
                try:
                    validated_items.append(item_validator(item, f"{field}[{i}]"))
                except InputValidationError:
                    raise

        return list(value)

    @staticmethod
    def validate_object(
        value: Any,
        field: str,
        required: bool = True,
        schema: Dict = None
    ) -> Optional[Dict]:
        """Validate object field with optional schema"""
        if value is None:
            if required:
                raise InputValidationError(f"Field '{field}' is required", field=field)
            return None

        if not isinstance(value, dict):
            raise InputValidationError(
                f"Field '{field}' must be an object",
                field=field
            )

        # Validate against schema if provided
        if schema:
            validated = {}
            for key, validator_config in schema.items():
                if key in value:
                    validator = validator_config.get('validator')
                    if validator:
                        validated[key] = validator(value[key], f"{field}.{key}")
                    else:
                        validated[key] = value[key]
                elif validator_config.get('required', False):
                    raise InputValidationError(
                        f"Required field '{field}.{key}' is missing",
                        field=f"{field}.{key}"
                    )

            return validated

        return value

    @staticmethod
    def validate_enum(
        value: Any,
        field: str,
        allowed_values: List,
        required: bool = True
    ) -> Optional[Any]:
        """Validate enum/choice field"""
        if value is None:
            if required:
                raise InputValidationError(f"Field '{field}' is required", field=field)
            return None

        if value not in allowed_values:
            raise InputValidationError(
                f"Field '{field}' must be one of: {', '.join(map(str, allowed_values))}",
                field=field
            )

        return value

    @staticmethod
    def validate_boolean(
        value: Any,
        field: str,
        required: bool = True
    ) -> Optional[bool]:
        """Validate boolean field"""
        if value is None:
            if required:
                raise InputValidationError(f"Field '{field}' is required", field=field)
            return None

        if not isinstance(value, bool):
            raise InputValidationError(
                f"Field '{field}' must be a boolean",
                field=field
            )

        return value


class MLInputValidator(InputValidator):
    """Specialized validator for ML-specific inputs"""

    ALLOWED_MODEL_TYPES = [
        'linear_regression',
        'random_forest',
        'gradient_boosting',
        'neural_network',
        'svm'
    ]

    ALLOWED_UNCERTAINTY_METHODS = [
        'bootstrap',
        'bayesian',
        'quantile',
        'ensemble'
    ]

    @staticmethod
    def validate_features(features: Any, field: str = "features") -> Dict:
        """Validate ML feature input"""
        features = InputValidator.validate_object(features, field, required=True)

        # Validate common feature types
        validated = {}
        for key, value in features.items():
            # Check key is safe
            InputValidator.check_blocked_patterns(key, f"{field}.{key}")

            # Validate numeric features
            if isinstance(value, (int, float)):
                validated[key] = InputValidator.validate_number(
                    value,
                    f"{field}.{key}",
                    min_value=-1e10,
                    max_value=1e10
                )
            elif isinstance(value, str):
                validated[key] = InputValidator.validate_string(
                    value,
                    f"{field}.{key}",
                    max_length=100
                )
            elif isinstance(value, bool):
                validated[key] = value
            else:
                raise InputValidationError(
                    f"Feature '{key}' has unsupported type: {type(value).__name__}",
                    field=f"{field}.{key}"
                )

        return validated

    @staticmethod
    def validate_training_data(data: Any, field: str = "training_data") -> List:
        """Validate training dataset"""
        return InputValidator.validate_array(
            data,
            field,
            required=True,
            min_length=10,  # Minimum samples for training
            max_length=100000  # Maximum dataset size
        )

    @staticmethod
    def validate_model_config(config: Any, field: str = "model_config") -> Dict:
        """Validate model configuration"""
        config = InputValidator.validate_object(config, field, required=False) or {}

        validated = {}

        # Validate model type
        if 'model_type' in config:
            validated['model_type'] = InputValidator.validate_enum(
                config['model_type'],
                f"{field}.model_type",
                MLInputValidator.ALLOWED_MODEL_TYPES,
                required=False
            )

        # Validate hyperparameters (if present)
        if 'hyperparameters' in config:
            validated['hyperparameters'] = InputValidator.validate_object(
                config['hyperparameters'],
                f"{field}.hyperparameters",
                required=False
            )

        return validated


def validate_input_safe(input_data: Union[str, Dict]) -> tuple[bool, Dict, str]:
    """
    Safe validation wrapper that returns (success, data, error_message)

    Args:
        input_data: JSON string or dict to validate

    Returns:
        Tuple of (success: bool, validated_data: dict, error_message: str)
    """
    try:
        data = InputValidator.validate_json_input(input_data)
        return True, data, ""
    except InputValidationError as e:
        return False, {}, f"Validation error: {e.message}"
    except Exception as e:
        return False, {}, f"Unexpected validation error: {str(e)}"


def send_error(message: str, field: str = None):
    """Send standardized error response"""
    error_response = {
        "success": False,
        "error": message,
        "field": field,
        "timestamp": json.dumps({"$date": {"$numberLong": str(int(1000 * __import__('time').time()))}})
    }
    print(json.dumps(error_response))
    sys.exit(1)


def send_success(data: Dict):
    """Send standardized success response"""
    success_response = {
        "success": True,
        "data": data,
        "timestamp": json.dumps({"$date": {"$numberLong": str(int(1000 * __import__('time').time()))}})
    }
    print(json.dumps(success_response))
    sys.exit(0)


# Example usage
if __name__ == "__main__":
    # Test the validator
    test_input = {
        "action": "predict",
        "features": {
            "bedrooms": 3,
            "sqft": 1500,
            "year_built": 2020
        },
        "model_type": "random_forest"
    }

    success, data, error = validate_input_safe(test_input)
    if success:
        print(f"✅ Validation passed: {data}")
    else:
        print(f"❌ Validation failed: {error}")
