#!/usr/bin/env python3
"""
Prediction with Uncertainty Script for ML Insights Hub
Provides predictions with confidence intervals and uncertainty quantification
"""

import sys
import json
import pandas as pd
import numpy as np
import os
from pathlib import Path

try:
    from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
    from sklearn.linear_model import LinearRegression
    from sklearn.neural_network import MLPRegressor
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler
    from sklearn.metrics import mean_squared_error, r2_score
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

import warnings
warnings.filterwarnings('ignore')

# Import input validation
try:
    from input_validator import (
        InputValidator,
        MLInputValidator,
        InputValidationError,
        validate_input_safe,
        send_error,
        send_success
    )
    VALIDATION_AVAILABLE = True
except ImportError:
    VALIDATION_AVAILABLE = False
    print(json.dumps({"error": "Input validation module not available"}), file=sys.stderr)

# Import persistent model cache so we train each model only once instead of
# retraining on every prediction request (the cause of 30s execution timeouts).
try:
    from model_cache import get_cached_model, cache_model
    CACHE_AVAILABLE = True
except ImportError:
    CACHE_AVAILABLE = False

# Bump this when the cached bundle shape changes, to invalidate stale pickles.
CACHE_VERSION = 1

def load_data(dataset_path=None):
    """Load dataset for training/prediction"""
    try:
        if dataset_path and os.path.exists(dataset_path):
            return pd.read_csv(dataset_path)
        
        # Try to load default real estate dataset using relative path
        from pathlib import Path
        script_dir = Path(__file__).resolve().parent
        project_root = script_dir.parent.parent
        default_path = project_root / 'datasets' / 'real_estate' / 'properties_dataset.csv'
        if default_path.exists():
            return pd.read_csv(default_path)
        
        # If no dataset available, create mock data
        return create_mock_data()
    except Exception as e:
        return create_mock_data()

def create_mock_data():
    """Create mock real estate data for testing"""
    np.random.seed(42)
    n_samples = 1000
    
    data = {
        'bedrooms': np.random.randint(1, 6, n_samples),
        'bathrooms': np.random.randint(1, 4, n_samples),
        'sqft': np.random.randint(800, 4000, n_samples),
        'year_built': np.random.randint(1950, 2024, n_samples),
        'lot_size': np.random.randint(2000, 15000, n_samples),
        'school_rating': np.random.uniform(3, 10, n_samples),
        'crime_rate': np.random.uniform(5, 50, n_samples),
        'walkability_score': np.random.randint(20, 100, n_samples)
    }
    
    # Create realistic price based on features
    df = pd.DataFrame(data)
    df['actual_price'] = (
        df['sqft'] * 150 +
        df['bedrooms'] * 25000 +
        df['bathrooms'] * 15000 +
        (df['school_rating'] - 5) * 10000 +
        (100 - df['crime_rate']) * 1000 +
        df['walkability_score'] * 500 +
        np.random.normal(0, 20000, n_samples)
    )
    df['actual_price'] = np.maximum(df['actual_price'], 50000)  # Minimum price
    
    return df

def simple_prediction(features):
    """Simple rule-based prediction when ML libraries aren't available"""
    base_price = 200000
    
    # Feature-based pricing
    base_price += features.get('bedrooms', 3) * 25000
    base_price += features.get('bathrooms', 2) * 15000
    base_price += features.get('sqft', 1800) * 150
    base_price += max(0, features.get('year_built', 2000) - 1980) * 500
    base_price += features.get('school_rating', 7) * 8000
    base_price -= features.get('crime_rate', 25) * 800
    base_price += features.get('walkability_score', 60) * 300
    
    # Add some realistic variance
    prediction = max(50000, base_price)
    uncertainty = prediction * 0.15  # 15% uncertainty
    
    return {
        'prediction': float(prediction),
        'lower_bound': float(prediction - uncertainty),
        'upper_bound': float(prediction + uncertainty),
        'confidence_level': 0.95,
        'uncertainty_metrics': {
            'method': 'rule_based',
            'std': float(uncertainty / 1.96),
            'relative_uncertainty': 0.15
        },
        'feature_importance': {
            'sqft': 0.35,
            'bedrooms': 0.20,
            'bathrooms': 0.15,
            'school_rating': 0.12,
            'year_built': 0.08,
            'walkability_score': 0.06,
            'crime_rate': 0.04
        },
        'model_type': 'rule_based',
        'features_used': list(features.keys())
    }

def prepare_features(df, feature_columns=None):
    """Prepare features for ML models"""
    if feature_columns is None:
        # Default real estate features
        feature_columns = [
            'bedrooms', 'bathrooms', 'sqft', 'year_built', 'lot_size',
            'school_rating', 'crime_rate', 'walkability_score'
        ]
    
    # Select available features
    available_features = [col for col in feature_columns if col in df.columns]
    X = df[available_features].copy()
    
    # Handle missing values
    for col in X.columns:
        if X[col].dtype in ['float64', 'int64']:
            X[col] = X[col].fillna(X[col].median())
        else:
            X[col] = X[col].fillna(X[col].mode()[0] if not X[col].mode().empty else 0)
    
    return X, available_features

def get_model(model_type, random_state=42):
    """Get ML model based on type"""
    if not SKLEARN_AVAILABLE:
        return None
        
    models = {
        'linear_regression': LinearRegression(),
        'random_forest': RandomForestRegressor(
            n_estimators=100,
            random_state=random_state,
            n_jobs=1  # Limit to single thread for stability
        ),
        'gradient_boosting': GradientBoostingRegressor(
            n_estimators=100,
            random_state=random_state
        ),
        'neural_network': MLPRegressor(
            hidden_layer_sizes=(100, 50),
            random_state=random_state,
            max_iter=500
        )
    }
    
    return models.get(model_type, models['random_forest'])

def calculate_feature_importance(model, feature_names):
    """Calculate feature importance scores"""
    try:
        if hasattr(model, 'feature_importances_'):
            importance_scores = model.feature_importances_
        elif hasattr(model, 'coef_'):
            importance_scores = np.abs(model.coef_)
        else:
            # Equal importance if can't determine
            importance_scores = np.ones(len(feature_names)) / len(feature_names)
        
        importance_dict = dict(zip(feature_names, importance_scores.tolist()))
        # Sort by importance
        importance_dict = dict(sorted(importance_dict.items(), key=lambda x: x[1], reverse=True))
        
        return importance_dict
    except:
        # Fallback to equal importance
        return {name: 1.0/len(feature_names) for name in feature_names}

def train_model_bundle(model_type):
    """Train a model once and return a serializable bundle of everything needed
    to make predictions with uncertainty without retraining. Returns None if the
    data is unusable so callers can fall back to a rule-based prediction."""
    df = load_data()

    target_column = 'actual_price'
    if target_column not in df.columns:
        return None

    y = df[target_column]
    X, feature_names = prepare_features(df)
    if X.empty:
        return None

    # Per-feature medians used to fill any features missing from a request.
    feature_medians = {col: float(X[col].median()) for col in feature_names}

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    model = get_model(model_type)
    if model is None:
        return None

    # Scale features for the neural network; the fitted scaler must be reused
    # at prediction time, so it travels with the bundle.
    scaler = None
    if model_type == 'neural_network':
        scaler = StandardScaler()
        X_train = pd.DataFrame(
            scaler.fit_transform(X_train), columns=feature_names, index=X_train.index
        )
        X_test = pd.DataFrame(
            scaler.transform(X_test), columns=feature_names, index=X_test.index
        )

    model.fit(X_train, y_train)

    # Residual std for residual-based uncertainty (no per-request refitting).
    residuals = y_train - model.predict(X_train)
    residual_std = float(np.std(residuals))

    y_pred_test = model.predict(X_test)
    performance_metrics = {
        'rmse': float(np.sqrt(mean_squared_error(y_test, y_pred_test))),
        'r2_score': float(r2_score(y_test, y_pred_test)),
        'mae': float(np.mean(np.abs(y_test - y_pred_test)))
    }

    return {
        'cache_version': CACHE_VERSION,
        'model': model,
        'scaler': scaler,
        'feature_names': feature_names,
        'feature_medians': feature_medians,
        'residual_std': residual_std,
        'feature_importance': calculate_feature_importance(model, feature_names),
        'performance_metrics': performance_metrics,
        # Bootstrap ensemble is expensive; trained lazily on first bootstrap
        # request and then cached alongside the base model.
        'bootstrap_models': None,
    }


def get_or_train_bundle(model_type):
    """Return a model bundle, loading it from the persistent cache when possible
    and otherwise training (and caching) it once."""
    config = {'cache_version': CACHE_VERSION}

    if CACHE_AVAILABLE:
        try:
            cached = get_cached_model(model_type, config)
            if cached and cached.get('cache_version') == CACHE_VERSION:
                return cached, True
        except Exception:
            pass

    bundle = train_model_bundle(model_type)
    if bundle is not None and CACHE_AVAILABLE:
        try:
            cache_model(model_type, config, bundle,
                        metadata={'source': 'predict_with_uncertainty'})
        except Exception:
            pass
    return bundle, False


def build_prediction_row(bundle, features):
    """Build the single-row feature matrix for a request, filling missing
    features with training medians and applying the cached scaler if present."""
    feature_names = bundle['feature_names']
    medians = bundle['feature_medians']
    row = {name: features.get(name, medians.get(name, 0)) for name in feature_names}
    X_pred = pd.DataFrame([row], columns=feature_names)
    if bundle['scaler'] is not None:
        X_pred = pd.DataFrame(
            bundle['scaler'].transform(X_pred), columns=feature_names
        )
    return X_pred


def ensure_bootstrap_models(bundle, model_type):
    """Train and cache the bootstrap ensemble on first use so subsequent
    bootstrap requests reuse the fitted models instead of refitting."""
    if bundle.get('bootstrap_models'):
        return bundle['bootstrap_models']

    df = load_data()
    y = df['actual_price']
    X, feature_names = prepare_features(df)
    X_train, _, y_train, _ = train_test_split(X, y, test_size=0.2, random_state=42)

    scaler = bundle['scaler']
    if scaler is not None:
        X_train = pd.DataFrame(
            scaler.transform(X_train), columns=feature_names, index=X_train.index
        )

    models = []
    for _ in range(20):  # Reduced count for speed
        sample_idx = np.random.choice(len(X_train), size=int(0.8 * len(X_train)), replace=True)
        temp_model = get_model(model_type)
        temp_model.fit(X_train.iloc[sample_idx], y_train.iloc[sample_idx])
        models.append(temp_model)

    bundle['bootstrap_models'] = models
    if CACHE_AVAILABLE:
        try:
            cache_model(model_type, {'cache_version': CACHE_VERSION}, bundle,
                        metadata={'source': 'predict_with_uncertainty'})
        except Exception:
            pass
    return models


def ml_prediction(features, model_type, uncertainty_method, confidence_level):
    """ML-based prediction with uncertainty quantification.

    Models are trained once and persisted in the model cache; each request only
    loads the cached model and predicts, which keeps execution well under the
    Python executor timeout."""
    try:
        bundle, from_cache = get_or_train_bundle(model_type)
        if bundle is None:
            return simple_prediction(features)

        feature_names = bundle['feature_names']
        X_pred = build_prediction_row(bundle, features)
        prediction = bundle['model'].predict(X_pred)[0]

        # Calculate uncertainty based on method
        if uncertainty_method == 'bootstrap':
            bootstrap_models = ensure_bootstrap_models(bundle, model_type)
            predictions = np.array([m.predict(X_pred)[0] for m in bootstrap_models])
            alpha = (1 - confidence_level) / 2
            lower_bound = np.percentile(predictions, alpha * 100)
            upper_bound = np.percentile(predictions, (1 - alpha) * 100)

            uncertainty_metrics = {
                'method': 'bootstrap',
                'std': float(np.std(predictions)),
                'n_samples': len(predictions)
            }

        else:  # residual-based uncertainty
            residual_std = bundle['residual_std']
            z_score = 1.96 if confidence_level == 0.95 else (2.576 if confidence_level == 0.99 else 1.645)
            margin = z_score * residual_std
            lower_bound = prediction - margin
            upper_bound = prediction + margin

            uncertainty_metrics = {
                'method': 'residual_based',
                'std': float(residual_std),
                'z_score': z_score
            }

        return {
            'prediction': float(prediction),
            'lower_bound': float(lower_bound),
            'upper_bound': float(upper_bound),
            'confidence_level': confidence_level,
            'uncertainty_metrics': uncertainty_metrics,
            'feature_importance': bundle['feature_importance'],
            'model_performance': bundle['performance_metrics'],
            'model_type': model_type,
            'features_used': feature_names,
            'cached_model': from_cache
        }

    except Exception as e:
        # Fallback to simple prediction
        result = simple_prediction(features)
        result['fallback_reason'] = str(e)
        return result

def main():
    """Main prediction function"""
    try:
        # Parse input arguments
        if len(sys.argv) < 2:
            if VALIDATION_AVAILABLE:
                send_error("No input data provided")
            else:
                print(json.dumps({"error": "No input data provided"}))
                sys.exit(1)

        # Validate input if validation is available
        if VALIDATION_AVAILABLE:
            success, validated_data, error_msg = validate_input_safe(sys.argv[1])
            if not success:
                send_error(error_msg)
            input_data = validated_data
        else:
            input_data = json.loads(sys.argv[1])

        # Validate and extract parameters with proper validation
        if VALIDATION_AVAILABLE:
            try:
                features = MLInputValidator.validate_features(
                    input_data.get('features'),
                    field='features'
                )
                model_type = InputValidator.validate_enum(
                    input_data.get('model_type', 'random_forest'),
                    'model_type',
                    MLInputValidator.ALLOWED_MODEL_TYPES,
                    required=False
                ) or 'random_forest'
                uncertainty_method = InputValidator.validate_enum(
                    input_data.get('uncertainty_method', 'ensemble'),
                    'uncertainty_method',
                    MLInputValidator.ALLOWED_UNCERTAINTY_METHODS,
                    required=False
                ) or 'ensemble'
                confidence_level = InputValidator.validate_number(
                    input_data.get('confidence_level', 0.95),
                    'confidence_level',
                    required=False,
                    min_value=0.8,
                    max_value=0.99
                ) or 0.95
            except InputValidationError as e:
                send_error(e.message, e.field)
        else:
            features = input_data.get('features', {})
            model_type = input_data.get('model_type', 'random_forest')
            uncertainty_method = input_data.get('uncertainty_method', 'ensemble')
            confidence_level = input_data.get('confidence_level', 0.95)
        
        if not features:
            print(json.dumps({"error": "No features provided for prediction"}))
            sys.exit(1)
        
        # Generate prediction
        if SKLEARN_AVAILABLE:
            result = ml_prediction(features, model_type, uncertainty_method, confidence_level)
        else:
            result = simple_prediction(features)
            result['note'] = 'Using rule-based prediction (scikit-learn not available)'
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "error": str(e),
            "type": "prediction_error",
            "sklearn_available": SKLEARN_AVAILABLE
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    main()
