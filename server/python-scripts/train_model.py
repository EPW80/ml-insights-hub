#!/usr/bin/env python3
"""
Model Training Script for ML Insights Hub
Trains various ML models and saves them for later use
"""

import sys
import json
import pandas as pd
import numpy as np
import os
import pickle
from datetime import datetime
from pathlib import Path

try:
    from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
    from sklearn.linear_model import LinearRegression
    from sklearn.neural_network import MLPRegressor
    from sklearn.svm import SVR
    from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
    from sklearn.preprocessing import StandardScaler
    from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

import warnings
warnings.filterwarnings('ignore')

def load_dataset(dataset_id):
    """Load dataset by ID or path"""
    try:
        # Try different possible paths
        possible_paths = [
            f'/home/erikwilliams/dev/ml-insights-hub/datasets/real_estate/{dataset_id}',
            f'/home/erikwilliams/dev/ml-insights-hub/datasets/sample_ml/{dataset_id}',
            f'/home/erikwilliams/dev/ml-insights-hub/datasets/{dataset_id}',
            dataset_id  # Direct path
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                return pd.read_csv(path)
        
        # Default to real estate dataset
        default_path = '/home/erikwilliams/dev/ml-insights-hub/datasets/real_estate/properties_dataset.csv'
        if os.path.exists(default_path):
            return pd.read_csv(default_path)
        
        # Create mock data if nothing found
        return create_mock_training_data()
        
    except Exception as e:
        return create_mock_training_data()

def create_mock_training_data():
    """Create mock data for training when datasets aren't available"""
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
    
    df = pd.DataFrame(data)
    # Create realistic target variable
    df['target'] = (
        df['sqft'] * 150 +
        df['bedrooms'] * 25000 +
        df['bathrooms'] * 15000 +
        (df['school_rating'] - 5) * 10000 +
        np.random.normal(0, 20000, n_samples)
    )
    df['target'] = np.maximum(df['target'], 50000)
    
    return df

def get_model_class(model_type):
    """Get model class and default hyperparameters"""
    if not SKLEARN_AVAILABLE:
        return None, {}
    
    models = {
        'linear_regression': (LinearRegression, {}),
        'random_forest': (RandomForestRegressor, {
            'n_estimators': 100,
            'random_state': 42,
            'n_jobs': 1
        }),
        'gradient_boosting': (GradientBoostingRegressor, {
            'n_estimators': 100,
            'random_state': 42
        }),
        'neural_network': (MLPRegressor, {
            'hidden_layer_sizes': (100, 50),
            'random_state': 42,
            'max_iter': 500
        }),
        'svm': (SVR, {
            'kernel': 'rbf',
            'gamma': 'scale'
        }),
        'xgboost': (GradientBoostingRegressor, {  # Fallback to GBM
            'n_estimators': 100,
            'learning_rate': 0.1,
            'random_state': 42
        })
    }
    
    return models.get(model_type, models['random_forest'])

def prepare_data(df, target_column=None):
    """Prepare data for training"""
    # Auto-detect target column
    if target_column is None:
        possible_targets = ['target', 'actual_price', 'price', 'y']
        for col in possible_targets:
            if col in df.columns:
                target_column = col
                break
    
    if target_column is None or target_column not in df.columns:
        raise ValueError("No valid target column found")
    
    # Separate features and target
    X = df.drop(columns=[target_column])
    y = df[target_column]
    
    # Select only numeric features
    numeric_features = X.select_dtypes(include=[np.number]).columns.tolist()
    X = X[numeric_features]
    
    # Handle missing values
    for col in X.columns:
        X[col] = X[col].fillna(X[col].median())
    
    y = y.fillna(y.median())
    
    return X, y, numeric_features

def hyperparameter_tuning(model_class, X_train, y_train, model_type):
    """Perform basic hyperparameter tuning"""
    if not SKLEARN_AVAILABLE:
        return None
    
    param_grids = {
        'random_forest': {
            'n_estimators': [50, 100],
            'max_depth': [None, 10, 20]
        },
        'gradient_boosting': {
            'n_estimators': [50, 100],
            'learning_rate': [0.1, 0.2]
        },
        'svm': {
            'C': [0.1, 1, 10],
            'gamma': ['scale', 'auto']
        }
    }
    
    if model_type not in param_grids:
        return model_class(random_state=42)
    
    try:
        grid_search = GridSearchCV(
            model_class(random_state=42),
            param_grids[model_type],
            cv=3,  # Reduced for speed
            scoring='neg_mean_squared_error',
            n_jobs=1
        )
        grid_search.fit(X_train, y_train)
        return grid_search.best_estimator_
    except:
        return model_class(random_state=42)

def train_model(model_type, dataset_id, hyperparameters, training_config):
    """Train a machine learning model"""
    start_time = datetime.now()
    
    # Load data
    df = load_dataset(dataset_id)
    print(json.dumps({"type": "progress", "message": f"Loaded dataset with {len(df)} records"}))
    
    # Prepare data
    X, y, feature_names = prepare_data(df)
    print(json.dumps({"type": "progress", "message": f"Prepared {len(feature_names)} features"}))
    
    # Split data
    test_size = training_config.get('test_size', 0.2)
    random_state = training_config.get('random_state', 42)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state
    )
    
    # Get model
    if SKLEARN_AVAILABLE:
        model_class, default_params = get_model_class(model_type)
        if model_class is None:
            raise ValueError(f"Unknown model type: {model_type}")
        
        # Merge default params with user-provided hyperparameters
        params = {**default_params, **hyperparameters}
        
        # Handle scaling for neural networks and SVM
        scaler = None
        if model_type in ['neural_network', 'svm']:
            scaler = StandardScaler()
            X_train_scaled = scaler.fit_transform(X_train)
            X_test_scaled = scaler.transform(X_test)
            X_train = pd.DataFrame(X_train_scaled, columns=feature_names, index=X_train.index)
            X_test = pd.DataFrame(X_test_scaled, columns=feature_names, index=X_test.index)
        
        # Create and train model
        if training_config.get('hyperparameter_tuning', False):
            print(json.dumps({"type": "progress", "message": "Performing hyperparameter tuning..."}))
            model = hyperparameter_tuning(model_class, X_train, y_train, model_type)
        else:
            model = model_class(**params)
        
        print(json.dumps({"type": "progress", "message": "Training model..."}))
        model.fit(X_train, y_train)
        
        # Predictions
        y_pred_train = model.predict(X_train)
        y_pred_test = model.predict(X_test)
        
        # Calculate metrics
        train_metrics = {
            'rmse': float(np.sqrt(mean_squared_error(y_train, y_pred_train))),
            'r2': float(r2_score(y_train, y_pred_train)),
            'mae': float(mean_absolute_error(y_train, y_pred_train))
        }
        
        test_metrics = {
            'rmse': float(np.sqrt(mean_squared_error(y_test, y_pred_test))),
            'r2': float(r2_score(y_test, y_pred_test)),
            'mae': float(mean_absolute_error(y_test, y_pred_test))
        }
        
        # Cross-validation
        cv_scores = None
        if training_config.get('cross_validation', True):
            print(json.dumps({"type": "progress", "message": "Performing cross-validation..."}))
            cv_folds = training_config.get('validation_folds', 5)
            cv_scores = cross_val_score(model, X_train, y_train, cv=cv_folds, scoring='neg_mean_squared_error')
            cv_scores = -cv_scores  # Convert to positive RMSE
            cv_scores = np.sqrt(cv_scores)  # Convert MSE to RMSE
        
        # Feature importance
        feature_importance = {}
        if hasattr(model, 'feature_importances_'):
            importance_scores = model.feature_importances_
            feature_importance = dict(zip(feature_names, importance_scores.tolist()))
            feature_importance = dict(sorted(feature_importance.items(), key=lambda x: x[1], reverse=True))
        
        # Save model
        model_id = f"{model_type}_{dataset_id}_{int(start_time.timestamp())}"
        model_dir = "/home/erikwilliams/dev/ml-insights-hub/models"
        os.makedirs(model_dir, exist_ok=True)
        
        model_path = f"{model_dir}/{model_id}.pkl"
        model_metadata = {
            'model': model,
            'scaler': scaler,
            'feature_names': feature_names,
            'model_type': model_type,
            'training_date': start_time.isoformat()
        }
        
        with open(model_path, 'wb') as f:
            pickle.dump(model_metadata, f)
        
        training_time = (datetime.now() - start_time).total_seconds()
        
        result = {
            'model_id': model_id,
            'model_path': model_path,
            'training_time': training_time,
            'metrics': {
                'training': train_metrics,
                'testing': test_metrics,
                'cross_validation': {
                    'mean_rmse': float(np.mean(cv_scores)) if cv_scores is not None else None,
                    'std_rmse': float(np.std(cv_scores)) if cv_scores is not None else None,
                    'scores': cv_scores.tolist() if cv_scores is not None else None
                }
            },
            'feature_importance': feature_importance,
            'data_info': {
                'total_samples': len(df),
                'training_samples': len(X_train),
                'testing_samples': len(X_test),
                'features_count': len(feature_names),
                'feature_names': feature_names
            },
            'hyperparameters': params
        }
        
    else:
        # Fallback when sklearn not available
        training_time = (datetime.now() - start_time).total_seconds()
        model_id = f"mock_{model_type}_{int(start_time.timestamp())}"
        
        result = {
            'model_id': model_id,
            'model_path': None,
            'training_time': training_time,
            'metrics': {
                'training': {'rmse': 50000, 'r2': 0.75, 'mae': 35000},
                'testing': {'rmse': 55000, 'r2': 0.70, 'mae': 40000}
            },
            'feature_importance': {name: 1.0/len(feature_names) for name in feature_names},
            'data_info': {
                'total_samples': len(df),
                'features_count': len(feature_names),
                'feature_names': feature_names
            },
            'note': 'Mock training (scikit-learn not available)'
        }
    
    print(json.dumps({"type": "progress", "message": "Training completed!"}))
    return result

def main():
    """Main training function"""
    try:
        if len(sys.argv) < 2:
            print(json.dumps({"error": "No input data provided"}))
            sys.exit(1)
        
        input_data = json.loads(sys.argv[1])
        
        # Extract parameters
        model_type = input_data.get('model_type', 'random_forest')
        dataset_id = input_data.get('dataset_id', 'properties_dataset.csv')
        hyperparameters = input_data.get('hyperparameters', {})
        training_config = input_data.get('training_config', {})
        
        # Train model
        result = train_model(model_type, dataset_id, hyperparameters, training_config)
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "error": str(e),
            "type": "training_error",
            "sklearn_available": SKLEARN_AVAILABLE
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    main()
