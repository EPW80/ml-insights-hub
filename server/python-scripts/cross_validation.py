#!/usr/bin/env python3
"""
Cross-Validation Script for ML Insights Hub
More robust model evaluation with various CV strategies
"""

import sys
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import (
    KFold, StratifiedKFold, LeaveOneOut, LeavePOut,
    ShuffleSplit, StratifiedShuffleSplit, TimeSeriesSplit,
    GroupKFold, cross_val_score, cross_validate,
    learning_curve, validation_curve
)
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.svm import SVC, SVR
from sklearn.linear_model import LogisticRegression, LinearRegression, Ridge, Lasso, ElasticNet
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.neural_network import MLPClassifier, MLPRegressor
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import make_scorer, accuracy_score, precision_score, recall_score, f1_score, mean_squared_error, mean_absolute_error, r2_score
import warnings
warnings.filterwarnings('ignore')

def load_data(dataset_id):
    """Load dataset from storage"""
    try:
        # In production, this would load from actual database/storage
        # For now, generate sample data
        np.random.seed(42)
        n_samples = 1000

        # Generate feature data with some correlation structure
        data = {
            'feature1': np.random.normal(0, 1, n_samples),
            'feature2': np.random.normal(5, 2, n_samples),
            'feature3': np.random.exponential(2, n_samples),
            'feature4': np.random.uniform(0, 10, n_samples),
            'feature5': np.random.normal(2, 1.5, n_samples)
        }

        # Create target with realistic relationships
        target_continuous = (
            0.4 * data['feature1'] +
            0.3 * data['feature2'] +
            0.2 * data['feature3'] +
            0.1 * data['feature4'] +
            np.random.normal(0, 1, n_samples)
        )

        # For classification: convert to classes
        target_classes = pd.cut(target_continuous, bins=3, labels=['Low', 'Medium', 'High']).astype(str)

        data['target_classification'] = target_classes
        data['target_regression'] = target_continuous

        # Add time-based features for time series CV
        data['time_index'] = range(n_samples)
        data['group'] = np.random.choice(['A', 'B', 'C', 'D'], n_samples)

        return pd.DataFrame(data)

    except Exception as e:
        raise ValueError(f"Error loading dataset {dataset_id}: {str(e)}")

def get_model(model_name, task_type='classification'):
    """Get model instance by name"""
    models = {
        'classification': {
            'random_forest': RandomForestClassifier(n_estimators=100, random_state=42),
            'gradient_boosting': GradientBoostingClassifier(n_estimators=100, random_state=42),
            'svm': SVC(random_state=42),
            'logistic_regression': LogisticRegression(random_state=42, max_iter=1000),
            'naive_bayes': GaussianNB(),
            'knn': KNeighborsClassifier(n_neighbors=5),
            'decision_tree': DecisionTreeClassifier(random_state=42),
            'neural_network': MLPClassifier(hidden_layer_sizes=(100,), random_state=42, max_iter=500)
        },
        'regression': {
            'random_forest': RandomForestRegressor(n_estimators=100, random_state=42),
            'gradient_boosting': GradientBoostingRegressor(n_estimators=100, random_state=42),
            'svm': SVR(),
            'linear_regression': LinearRegression(),
            'ridge': Ridge(random_state=42),
            'lasso': Lasso(random_state=42),
            'elastic_net': ElasticNet(random_state=42),
            'knn': KNeighborsRegressor(n_neighbors=5),
            'decision_tree': DecisionTreeRegressor(random_state=42),
            'neural_network': MLPRegressor(hidden_layer_sizes=(100,), random_state=42, max_iter=500)
        }
    }

    if model_name not in models[task_type]:
        available_models = list(models[task_type].keys())
        raise ValueError(f"Model '{model_name}' not available for {task_type}. Available models: {available_models}")

    return models[task_type][model_name]

def determine_task_type(target_series):
    """Determine if the task is classification or regression"""
    if target_series.dtype == 'object' or target_series.nunique() < 10:
        return 'classification'
    else:
        return 'regression'

def get_cv_strategy(cv_method, cv_folds=5, shuffle=True, random_state=42, groups=None, **kwargs):
    """Get cross-validation strategy"""
    strategies = {
        'k_fold': KFold(n_splits=cv_folds, shuffle=shuffle, random_state=random_state),
        'stratified_k_fold': StratifiedKFold(n_splits=cv_folds, shuffle=shuffle, random_state=random_state),
        'leave_one_out': LeaveOneOut(),
        'leave_p_out': LeavePOut(p=kwargs.get('p', 2)),
        'shuffle_split': ShuffleSplit(n_splits=cv_folds, test_size=kwargs.get('test_size', 0.2), random_state=random_state),
        'time_series_split': TimeSeriesSplit(n_splits=cv_folds),
        'group_k_fold': GroupKFold(n_splits=cv_folds)
    }

    if cv_method not in strategies:
        available_methods = list(strategies.keys())
        raise ValueError(f"CV method '{cv_method}' not available. Available methods: {available_methods}")

    return strategies[cv_method]

def get_scoring_metrics(task_type='classification', scoring=None):
    """Get scoring metrics for evaluation"""
    if scoring is None:
        if task_type == 'classification':
            scoring = ['accuracy', 'precision_weighted', 'recall_weighted', 'f1_weighted']
        else:
            scoring = ['neg_mean_squared_error', 'neg_mean_absolute_error', 'r2']
    elif isinstance(scoring, str):
        scoring = [scoring]

    return scoring

def perform_cross_validation(model, X, y, cv_strategy, scoring, return_train_score=True, groups=None):
    """Perform cross-validation with specified strategy"""
    try:
        # Perform cross-validation
        cv_results = cross_validate(
            model, X, y, cv=cv_strategy, scoring=scoring,
            return_train_score=return_train_score, groups=groups,
            n_jobs=-1, error_score='raise'
        )

        # Process results
        results = {}
        for metric in scoring:
            test_key = f'test_{metric}'
            train_key = f'train_{metric}'

            if test_key in cv_results:
                results[metric] = {
                    'test_scores': cv_results[test_key].tolist(),
                    'test_mean': float(cv_results[test_key].mean()),
                    'test_std': float(cv_results[test_key].std())
                }

                if return_train_score and train_key in cv_results:
                    results[metric]['train_scores'] = cv_results[train_key].tolist()
                    results[metric]['train_mean'] = float(cv_results[train_key].mean())
                    results[metric]['train_std'] = float(cv_results[train_key].std())

        # Add timing information
        results['fit_time'] = {
            'mean': float(cv_results['fit_time'].mean()),
            'std': float(cv_results['fit_time'].std()),
            'scores': cv_results['fit_time'].tolist()
        }
        results['score_time'] = {
            'mean': float(cv_results['score_time'].mean()),
            'std': float(cv_results['score_time'].std()),
            'scores': cv_results['score_time'].tolist()
        }

        return results

    except Exception as e:
        raise ValueError(f"Error performing cross-validation: {str(e)}")

def plot_learning_curve(model, X, y, cv_strategy, scoring, train_sizes=None):
    """Generate learning curve data"""
    try:
        if train_sizes is None:
            train_sizes = np.linspace(0.1, 1.0, 10)

        # Get primary scoring metric
        primary_score = scoring[0] if isinstance(scoring, list) else scoring

        train_sizes_abs, train_scores, validation_scores = learning_curve(
            model, X, y, cv=cv_strategy, scoring=primary_score,
            train_sizes=train_sizes, n_jobs=-1
        )

        return {
            'train_sizes': train_sizes_abs.tolist(),
            'train_scores_mean': train_scores.mean(axis=1).tolist(),
            'train_scores_std': train_scores.std(axis=1).tolist(),
            'validation_scores_mean': validation_scores.mean(axis=1).tolist(),
            'validation_scores_std': validation_scores.std(axis=1).tolist(),
            'scoring_metric': primary_score
        }

    except Exception as e:
        print(f"Warning: Could not generate learning curve: {str(e)}", file=sys.stderr)
        return None

def analyze_cv_results(cv_results, task_type):
    """Analyze cross-validation results and provide insights"""
    try:
        analysis = {
            'summary': {},
            'insights': [],
            'recommendations': []
        }

        # Get primary metric based on task type
        if task_type == 'classification':
            primary_metrics = ['accuracy', 'f1_weighted']
        else:
            primary_metrics = ['r2', 'neg_mean_squared_error']

        # Find the best performing metric
        best_metric = None
        best_score = None

        for metric in primary_metrics:
            if metric in cv_results:
                score = cv_results[metric]['test_mean']
                if best_metric is None or (
                    (task_type == 'classification' and score > best_score) or
                    (task_type == 'regression' and metric == 'r2' and score > best_score) or
                    (task_type == 'regression' and metric.startswith('neg_') and score > best_score)
                ):
                    best_metric = metric
                    best_score = score

        if best_metric:
            analysis['summary']['best_metric'] = best_metric
            analysis['summary']['best_score'] = best_score
            analysis['summary']['score_std'] = cv_results[best_metric]['test_std']

            # Analyze variance
            std_ratio = cv_results[best_metric]['test_std'] / abs(best_score) if best_score != 0 else 0
            if std_ratio > 0.1:
                analysis['insights'].append("High variance detected across folds - model may be overfitting")
                analysis['recommendations'].append("Consider regularization or simpler model")
            elif std_ratio < 0.05:
                analysis['insights'].append("Low variance across folds - consistent performance")

            # Analyze train vs validation scores if available
            if 'train_mean' in cv_results[best_metric]:
                train_score = cv_results[best_metric]['train_mean']
                test_score = cv_results[best_metric]['test_mean']

                if task_type == 'classification':
                    gap = train_score - test_score
                    if gap > 0.1:
                        analysis['insights'].append("Large train-validation gap - possible overfitting")
                        analysis['recommendations'].append("Reduce model complexity or add regularization")
                elif task_type == 'regression':
                    if best_metric == 'r2':
                        gap = train_score - test_score
                        if gap > 0.1:
                            analysis['insights'].append("Large train-validation gap - possible overfitting")

        # Analyze timing
        if 'fit_time' in cv_results:
            avg_fit_time = cv_results['fit_time']['mean']
            if avg_fit_time > 60:  # More than 1 minute
                analysis['insights'].append("Model training is slow")
                analysis['recommendations'].append("Consider faster algorithms for large datasets")

        return analysis

    except Exception as e:
        return {'error': f"Error analyzing results: {str(e)}"}

def perform_model_cross_validation(dataset_id, features, target, model, cv_method, parameters, config):
    """Main cross-validation function"""
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

        # Get model
        model_instance = get_model(model, task_type)

        # Scale features if needed
        needs_scaling = model in ['svm', 'neural_network', 'knn']
        if needs_scaling:
            scaler = StandardScaler()
            X = scaler.fit_transform(X)

        # Get cross-validation strategy
        cv_folds = config.get('cv_folds', 5)
        shuffle = config.get('shuffle', True)
        random_state = config.get('random_state', 42)

        # Prepare groups for GroupKFold if needed
        groups = None
        if cv_method == 'group_k_fold':
            if 'group' in df.columns:
                groups = df['group']
                le_group = LabelEncoder()
                groups = le_group.fit_transform(groups)
            else:
                # Fall back to regular k-fold if no group column
                cv_method = 'k_fold'
                print("Warning: No 'group' column found, falling back to k_fold", file=sys.stderr)

        cv_strategy = get_cv_strategy(
            cv_method, cv_folds=cv_folds, shuffle=shuffle,
            random_state=random_state, **parameters
        )

        # Handle stratification for classification
        if task_type == 'classification' and cv_method == 'k_fold':
            cv_strategy = StratifiedKFold(n_splits=cv_folds, shuffle=shuffle, random_state=random_state)

        # Get scoring metrics
        scoring = get_scoring_metrics(task_type, config.get('scoring'))

        # Perform cross-validation
        return_train_score = config.get('return_train_score', True)
        cv_results = perform_cross_validation(
            model_instance, X, y, cv_strategy, scoring,
            return_train_score=return_train_score, groups=groups
        )

        # Generate learning curve if requested
        learning_curve_data = None
        if config.get('plot_learning_curve', True):
            learning_curve_data = plot_learning_curve(
                model_instance, X, y, cv_strategy, scoring
            )

        # Analyze results
        analysis = analyze_cv_results(cv_results, task_type)

        # Calculate additional statistics
        primary_metric = scoring[0] if isinstance(scoring, list) else scoring
        if primary_metric in cv_results:
            test_scores = cv_results[primary_metric]['test_scores']
            additional_stats = {
                'min_score': float(min(test_scores)),
                'max_score': float(max(test_scores)),
                'median_score': float(np.median(test_scores)),
                'score_range': float(max(test_scores) - min(test_scores)),
                'confidence_interval_95': [
                    float(np.percentile(test_scores, 2.5)),
                    float(np.percentile(test_scores, 97.5))
                ]
            }
            cv_results[primary_metric].update(additional_stats)

        return {
            "cv_scores": cv_results,
            "mean_score": cv_results.get(primary_metric, {}).get('test_mean'),
            "std_score": cv_results.get(primary_metric, {}).get('test_std'),
            "learning_curve": learning_curve_data,
            "analysis": analysis,
            "cv_info": {
                "method": cv_method,
                "folds": cv_folds if hasattr(cv_strategy, 'n_splits') else 'variable',
                "model": model,
                "task_type": task_type,
                "features_used": features,
                "target": target,
                "data_size": len(df),
                "scoring_metrics": scoring
            },
            "model_details": {
                "feature_encoders": {col: list(le.classes_) for col, le in label_encoders.items()},
                "target_encoder": list(target_encoder.classes_) if target_encoder else None,
                "scaling_applied": needs_scaling
            }
        }

    except Exception as e:
        raise Exception(f"Cross-validation failed: {str(e)}")

def main():
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())

        # Extract parameters
        dataset_id = input_data.get('dataset_id')
        features = input_data.get('features', [])
        target = input_data.get('target')
        model = input_data.get('model')
        cv_method = input_data.get('cv_method', 'k_fold')
        parameters = input_data.get('parameters', {})
        config = input_data.get('config', {})

        # Validate required parameters
        if not dataset_id:
            raise ValueError("dataset_id is required")
        if not features:
            raise ValueError("features list is required")
        if not target:
            raise ValueError("target is required")
        if not model:
            raise ValueError("model is required")

        # Perform cross-validation
        result = perform_model_cross_validation(dataset_id, features, target, model, cv_method, parameters, config)

        # Output result
        print(json.dumps(result, default=str))

    except Exception as e:
        error_result = {
            "error": str(e),
            "type": "cross_validation_error"
        }
        print(json.dumps(error_result), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()