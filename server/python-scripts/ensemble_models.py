#!/usr/bin/env python3
"""
Ensemble Models Script for ML Insights Hub
Combine multiple models for better accuracy
"""

import sys
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import (
    RandomForestClassifier, RandomForestRegressor,
    GradientBoostingClassifier, GradientBoostingRegressor,
    VotingClassifier, VotingRegressor,
    BaggingClassifier, BaggingRegressor
)
from sklearn.svm import SVC, SVR
from sklearn.linear_model import LogisticRegression, LinearRegression, Ridge, Lasso
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.neural_network import MLPClassifier, MLPRegressor
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    mean_squared_error, mean_absolute_error, r2_score,
    classification_report, confusion_matrix
)
import warnings
warnings.filterwarnings('ignore')

def load_data(dataset_id):
    """Load dataset from storage"""
    try:
        # In production, this would load from actual database/storage
        # For now, generate sample data for both classification and regression
        np.random.seed(42)
        n_samples = 1000

        # Generate feature data
        data = {
            'feature1': np.random.normal(0, 1, n_samples),
            'feature2': np.random.normal(5, 2, n_samples),
            'feature3': np.random.exponential(2, n_samples),
            'feature4': np.random.uniform(0, 10, n_samples),
            'feature5': np.random.normal(2, 1.5, n_samples)
        }

        # Generate target variable (classification example)
        # Create a target based on features for more realistic relationships
        target_continuous = (
            0.5 * data['feature1'] +
            0.3 * data['feature2'] +
            0.2 * data['feature3'] +
            np.random.normal(0, 0.5, n_samples)
        )

        # For classification: convert to classes
        target_classes = pd.cut(target_continuous, bins=3, labels=['Low', 'Medium', 'High']).astype(str)

        data['target_classification'] = target_classes
        data['target_regression'] = target_continuous

        return pd.DataFrame(data)

    except Exception as e:
        raise ValueError(f"Error loading dataset {dataset_id}: {str(e)}")

def get_base_models(task_type='classification'):
    """Get base models for ensemble"""
    if task_type == 'classification':
        return {
            'random_forest': RandomForestClassifier(n_estimators=100, random_state=42),
            'gradient_boosting': GradientBoostingClassifier(n_estimators=100, random_state=42),
            'svm': SVC(probability=True, random_state=42),
            'logistic_regression': LogisticRegression(random_state=42, max_iter=1000),
            'naive_bayes': GaussianNB(),
            'knn': KNeighborsClassifier(n_neighbors=5),
            'decision_tree': DecisionTreeClassifier(random_state=42),
            'neural_network': MLPClassifier(hidden_layer_sizes=(100,), random_state=42, max_iter=500)
        }
    else:  # regression
        return {
            'random_forest': RandomForestRegressor(n_estimators=100, random_state=42),
            'gradient_boosting': GradientBoostingRegressor(n_estimators=100, random_state=42),
            'svm': SVR(),
            'linear_regression': LinearRegression(),
            'ridge': Ridge(random_state=42),
            'lasso': Lasso(random_state=42),
            'knn': KNeighborsRegressor(n_neighbors=5),
            'decision_tree': DecisionTreeRegressor(random_state=42),
            'neural_network': MLPRegressor(hidden_layer_sizes=(100,), random_state=42, max_iter=500)
        }

def determine_task_type(target_series):
    """Determine if the task is classification or regression"""
    if target_series.dtype == 'object' or target_series.nunique() < 10:
        return 'classification'
    else:
        return 'regression'

def create_voting_ensemble(models, task_type='classification', voting='soft'):
    """Create a voting ensemble"""
    try:
        model_list = [(name, model) for name, model in models.items()]

        if task_type == 'classification':
            # For soft voting, all models must support predict_proba
            if voting == 'soft':
                # Filter out models that don't support predict_proba
                valid_models = []
                for name, model in model_list:
                    if hasattr(model, 'predict_proba') or hasattr(model, 'decision_function'):
                        valid_models.append((name, model))
                model_list = valid_models

            ensemble = VotingClassifier(estimators=model_list, voting=voting)
        else:
            ensemble = VotingRegressor(estimators=model_list)

        return ensemble
    except Exception as e:
        raise ValueError(f"Error creating voting ensemble: {str(e)}")

def create_bagging_ensemble(base_model, n_estimators=10, task_type='classification'):
    """Create a bagging ensemble"""
    try:
        if task_type == 'classification':
            ensemble = BaggingClassifier(
                base_estimator=base_model,
                n_estimators=n_estimators,
                random_state=42
            )
        else:
            ensemble = BaggingRegressor(
                base_estimator=base_model,
                n_estimators=n_estimators,
                random_state=42
            )
        return ensemble
    except Exception as e:
        raise ValueError(f"Error creating bagging ensemble: {str(e)}")

def create_stacking_ensemble(models, task_type='classification'):
    """Create a stacking ensemble (simplified version using cross-validation)"""
    try:
        # This is a simplified stacking implementation
        # In practice, you'd use StackingClassifier/StackingRegressor from sklearn
        from sklearn.ensemble import StackingClassifier, StackingRegressor
        from sklearn.linear_model import LogisticRegression, LinearRegression

        model_list = [(name, model) for name, model in models.items()]

        if task_type == 'classification':
            meta_learner = LogisticRegression(random_state=42, max_iter=1000)
            ensemble = StackingClassifier(
                estimators=model_list,
                final_estimator=meta_learner,
                cv=3
            )
        else:
            meta_learner = LinearRegression()
            ensemble = StackingRegressor(
                estimators=model_list,
                final_estimator=meta_learner,
                cv=3
            )

        return ensemble
    except Exception as e:
        raise ValueError(f"Error creating stacking ensemble: {str(e)}")

def optimize_ensemble_weights(models, X_train, y_train, X_val, y_val, task_type='classification'):
    """Optimize ensemble weights using validation data"""
    try:
        from scipy.optimize import minimize

        # Get predictions from each model
        predictions = {}
        for name, model in models.items():
            model.fit(X_train, y_train)
            if task_type == 'classification':
                pred = model.predict_proba(X_val)[:, 1] if hasattr(model, 'predict_proba') else model.predict(X_val)
            else:
                pred = model.predict(X_val)
            predictions[name] = pred

        pred_matrix = np.column_stack(list(predictions.values()))

        def objective(weights):
            weights = weights / weights.sum()  # Normalize weights
            ensemble_pred = np.dot(pred_matrix, weights)

            if task_type == 'classification':
                # Convert probabilities to predictions for classification
                if len(np.unique(y_val)) == 2:  # Binary classification
                    binary_pred = (ensemble_pred > 0.5).astype(int)
                    return -accuracy_score(y_val, binary_pred)
                else:
                    # For multiclass, this is simplified
                    return -accuracy_score(y_val, ensemble_pred.round())
            else:
                return mean_squared_error(y_val, ensemble_pred)

        # Initial weights (equal)
        n_models = len(models)
        initial_weights = np.ones(n_models) / n_models

        # Constraints: weights sum to 1 and are non-negative
        constraints = {'type': 'eq', 'fun': lambda w: w.sum() - 1}
        bounds = [(0, 1) for _ in range(n_models)]

        result = minimize(objective, initial_weights, method='SLSQP',
                         bounds=bounds, constraints=constraints)

        if result.success:
            optimal_weights = result.x / result.x.sum()
            return dict(zip(predictions.keys(), optimal_weights))
        else:
            # If optimization fails, return equal weights
            return dict(zip(predictions.keys(), initial_weights))

    except Exception as e:
        print(f"Warning: Weight optimization failed: {str(e)}", file=sys.stderr)
        # Return equal weights as fallback
        equal_weight = 1.0 / len(models)
        return {name: equal_weight for name in models.keys()}

def evaluate_models(models, X_test, y_test, task_type='classification'):
    """Evaluate individual models and return scores"""
    scores = {}

    for name, model in models.items():
        try:
            y_pred = model.predict(X_test)

            if task_type == 'classification':
                scores[name] = {
                    'accuracy': float(accuracy_score(y_test, y_pred)),
                    'precision': float(precision_score(y_test, y_pred, average='weighted', zero_division=0)),
                    'recall': float(recall_score(y_test, y_pred, average='weighted', zero_division=0)),
                    'f1': float(f1_score(y_test, y_pred, average='weighted', zero_division=0))
                }
            else:
                scores[name] = {
                    'mse': float(mean_squared_error(y_test, y_pred)),
                    'mae': float(mean_absolute_error(y_test, y_pred)),
                    'r2': float(r2_score(y_test, y_pred))
                }
        except Exception as e:
            print(f"Warning: Error evaluating model {name}: {str(e)}", file=sys.stderr)
            scores[name] = {'error': str(e)}

    return scores

def build_ensemble_models(dataset_id, features, target, models, ensemble_method, parameters, config):
    """Main ensemble building function"""
    try:
        # Load data
        df = load_data(dataset_id)

        # Validate features and target exist
        missing_features = [f for f in features if f not in df.columns]
        if missing_features:
            raise ValueError(f"Features not found in dataset: {missing_features}")

        if target not in df.columns:
            raise ValueError(f"Target column '{target}' not found in dataset")

        # Prepare data
        X = df[features].copy()
        y = df[target].copy()

        # Handle missing values
        numeric_features = X.select_dtypes(include=[np.number]).columns
        categorical_features = X.select_dtypes(include=['object', 'category']).columns

        # Fill missing values
        X[numeric_features] = X[numeric_features].fillna(X[numeric_features].median())
        for col in categorical_features:
            X[col] = X[col].fillna(X[col].mode()[0] if not X[col].mode().empty else 'Unknown')

        # Encode categorical features
        label_encoders = {}
        for col in categorical_features:
            le = LabelEncoder()
            X[col] = le.fit_transform(X[col].astype(str))
            label_encoders[col] = le

        # Determine task type
        task_type = determine_task_type(y)

        # Encode target if classification
        target_encoder = None
        if task_type == 'classification' and y.dtype == 'object':
            target_encoder = LabelEncoder()
            y = target_encoder.fit_transform(y)

        # Split data
        test_size = config.get('test_size', 0.2)
        random_state = config.get('random_state', 42)
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state, stratify=y if task_type == 'classification' else None
        )

        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)

        # Get base models
        available_models = get_base_models(task_type)
        selected_models = {name: available_models[name] for name in models if name in available_models}

        if not selected_models:
            raise ValueError(f"No valid models found. Available models: {list(available_models.keys())}")

        # Train individual models
        trained_models = {}
        for name, model in selected_models.items():
            try:
                # Some models need scaled data, others don't
                if name in ['svm', 'neural_network', 'knn']:
                    model.fit(X_train_scaled, y_train)
                    trained_models[name] = (model, True)  # True indicates scaled data needed
                else:
                    model.fit(X_train, y_train)
                    trained_models[name] = (model, False)  # False indicates original data
            except Exception as e:
                print(f"Warning: Failed to train model {name}: {str(e)}", file=sys.stderr)

        if not trained_models:
            raise ValueError("No models were successfully trained")

        # Create ensemble
        ensemble_model = None
        ensemble_score = None
        model_weights = None

        if ensemble_method == 'voting':
            voting_type = parameters.get('voting', 'soft' if task_type == 'classification' else None)
            models_for_voting = {name: model for name, (model, _) in trained_models.items()}
            ensemble_model = create_voting_ensemble(models_for_voting, task_type, voting_type)

        elif ensemble_method == 'bagging':
            # Use the first available model as base
            base_model_name = list(trained_models.keys())[0]
            base_model = get_base_models(task_type)[base_model_name]
            n_estimators = parameters.get('n_estimators', 10)
            ensemble_model = create_bagging_ensemble(base_model, n_estimators, task_type)

        elif ensemble_method == 'stacking':
            models_for_stacking = {name: model for name, (model, _) in trained_models.items()}
            ensemble_model = create_stacking_ensemble(models_for_stacking, task_type)

        elif ensemble_method == 'weighted_average' and config.get('optimize_weights', True):
            # Split training data for weight optimization
            X_train_opt, X_val_opt, y_train_opt, y_val_opt = train_test_split(
                X_train, y_train, test_size=0.2, random_state=random_state
            )

            models_for_weighting = {}
            for name, (model, needs_scaling) in trained_models.items():
                # Retrain on optimization training set
                if needs_scaling:
                    X_train_opt_scaled = scaler.fit_transform(X_train_opt)
                    X_val_opt_scaled = scaler.transform(X_val_opt)
                    model.fit(X_train_opt_scaled, y_train_opt)
                else:
                    model.fit(X_train_opt, y_train_opt)
                models_for_weighting[name] = model

            # Optimize weights
            model_weights = optimize_ensemble_weights(
                models_for_weighting, X_train_opt, y_train_opt,
                X_val_opt_scaled if needs_scaling else X_val_opt, y_val_opt, task_type
            )

        # Evaluate ensemble if we have one
        if ensemble_model is not None:
            # Fit ensemble on full training data
            if ensemble_method in ['voting', 'stacking']:
                ensemble_model.fit(X_train, y_train)
                y_pred_ensemble = ensemble_model.predict(X_test)
            elif ensemble_method == 'bagging':
                ensemble_model.fit(X_train, y_train)
                y_pred_ensemble = ensemble_model.predict(X_test)

            # Calculate ensemble score
            if task_type == 'classification':
                ensemble_score = {
                    'accuracy': float(accuracy_score(y_test, y_pred_ensemble)),
                    'precision': float(precision_score(y_test, y_pred_ensemble, average='weighted', zero_division=0)),
                    'recall': float(recall_score(y_test, y_pred_ensemble, average='weighted', zero_division=0)),
                    'f1': float(f1_score(y_test, y_pred_ensemble, average='weighted', zero_division=0))
                }
            else:
                ensemble_score = {
                    'mse': float(mean_squared_error(y_test, y_pred_ensemble)),
                    'mae': float(mean_absolute_error(y_test, y_pred_ensemble)),
                    'r2': float(r2_score(y_test, y_pred_ensemble))
                }

        # Evaluate individual models
        models_for_eval = {}
        for name, (model, needs_scaling) in trained_models.items():
            models_for_eval[name] = model

        individual_scores = evaluate_models(models_for_eval, X_test, y_test, task_type)

        # Cross-validation scores
        cv_folds = config.get('cv_folds', 5)
        cv_scores = {}
        scoring = config.get('scoring', 'accuracy' if task_type == 'classification' else 'r2')

        for name, (model, needs_scaling) in trained_models.items():
            try:
                X_cv = X_train_scaled if needs_scaling else X_train
                scores = cross_val_score(model, X_cv, y_train, cv=cv_folds, scoring=scoring)
                cv_scores[name] = {
                    'mean': float(scores.mean()),
                    'std': float(scores.std()),
                    'scores': scores.tolist()
                }
            except Exception as e:
                cv_scores[name] = {'error': str(e)}

        return {
            "ensemble_score": ensemble_score,
            "individual_scores": individual_scores,
            "cross_validation_scores": cv_scores,
            "model_weights": model_weights,
            "ensemble_info": {
                "method": ensemble_method,
                "models_used": list(trained_models.keys()),
                "task_type": task_type,
                "features_used": features,
                "target": target,
                "data_split": {
                    "train_size": len(X_train),
                    "test_size": len(X_test),
                    "total_size": len(df)
                }
            },
            "model_details": {
                "feature_encoders": {col: list(le.classes_) for col, le in label_encoders.items()},
                "target_encoder": list(target_encoder.classes_) if target_encoder else None,
                "scaling_required": any(needs_scaling for _, needs_scaling in trained_models.values())
            }
        }

    except Exception as e:
        raise Exception(f"Ensemble model building failed: {str(e)}")

def main():
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())

        # Extract parameters
        dataset_id = input_data.get('dataset_id')
        features = input_data.get('features', [])
        target = input_data.get('target')
        models = input_data.get('models', ['random_forest', 'gradient_boosting'])
        ensemble_method = input_data.get('ensemble_method', 'voting')
        parameters = input_data.get('parameters', {})
        config = input_data.get('config', {})

        # Validate required parameters
        if not dataset_id:
            raise ValueError("dataset_id is required")
        if not features:
            raise ValueError("features list is required")
        if not target:
            raise ValueError("target is required")

        # Build ensemble models
        result = build_ensemble_models(dataset_id, features, target, models, ensemble_method, parameters, config)

        # Output result
        print(json.dumps(result, default=str))

    except Exception as e:
        error_result = {
            "error": str(e),
            "type": "ensemble_models_error"
        }
        print(json.dumps(error_result), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()