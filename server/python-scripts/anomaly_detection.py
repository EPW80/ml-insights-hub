#!/usr/bin/env python3
"""
Anomaly Detection Script for ML Insights Hub
Identify outliers and anomalies in datasets
"""

import sys
import json
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.svm import OneClassSVM
from sklearn.neighbors import LocalOutlierFactor
from sklearn.covariance import EllipticEnvelope
from sklearn.preprocessing import StandardScaler
from scipy import stats
import warnings
warnings.filterwarnings('ignore')

def load_data(dataset_id):
    """Load dataset from storage"""
    try:
        # In production, this would load from actual database/storage
        # For now, generate sample data with some outliers
        np.random.seed(42)
        n_samples = 1000

        # Generate normal data
        normal_data = {
            'feature1': np.random.normal(0, 1, int(n_samples * 0.95)),
            'feature2': np.random.normal(5, 2, int(n_samples * 0.95)),
            'feature3': np.random.exponential(2, int(n_samples * 0.95)),
            'feature4': np.random.uniform(0, 10, int(n_samples * 0.95))
        }

        # Add some outliers
        n_outliers = n_samples - int(n_samples * 0.95)
        outlier_data = {
            'feature1': np.random.normal(10, 1, n_outliers),  # Far from normal distribution
            'feature2': np.random.normal(-5, 1, n_outliers),  # Far from normal distribution
            'feature3': np.random.exponential(20, n_outliers),  # Much higher values
            'feature4': np.random.uniform(20, 30, n_outliers)  # Outside normal range
        }

        # Combine normal and outlier data
        data = {}
        for key in normal_data.keys():
            data[key] = np.concatenate([normal_data[key], outlier_data[key]])

        # Add categorical features
        categories = ['A'] * int(n_samples * 0.95) + ['OUTLIER'] * n_outliers
        data['category'] = np.random.permutation(categories)

        # Add target variable
        data['target'] = np.random.normal(10, 3, n_samples)

        df = pd.DataFrame(data)
        return df.sample(frac=1).reset_index(drop=True)  # Shuffle the data

    except Exception as e:
        raise ValueError(f"Error loading dataset {dataset_id}: {str(e)}")

def detect_isolation_forest(df, features, contamination=0.1, n_estimators=100, max_samples='auto'):
    """Detect anomalies using Isolation Forest"""
    try:
        numeric_features = df[features].select_dtypes(include=[np.number]).columns
        if len(numeric_features) == 0:
            raise ValueError("No numeric features found for Isolation Forest")

        # Prepare data
        X = df[numeric_features].fillna(df[numeric_features].median())
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # Fit Isolation Forest
        iso_forest = IsolationForest(
            contamination=contamination,
            n_estimators=n_estimators,
            max_samples=max_samples,
            random_state=42
        )

        # Predict anomalies (-1 for outliers, 1 for inliers)
        anomaly_labels = iso_forest.fit_predict(X_scaled)
        anomaly_scores = iso_forest.score_samples(X_scaled)

        # Convert to boolean (True for anomalies)
        is_anomaly = anomaly_labels == -1

        return {
            'anomaly_labels': is_anomaly.tolist(),
            'anomaly_scores': anomaly_scores.tolist(),
            'algorithm_params': {
                'contamination': contamination,
                'n_estimators': n_estimators,
                'max_samples': max_samples
            }
        }

    except Exception as e:
        raise ValueError(f"Error in Isolation Forest: {str(e)}")

def detect_one_class_svm(df, features, contamination=0.1, kernel='rbf', gamma='scale'):
    """Detect anomalies using One-Class SVM"""
    try:
        numeric_features = df[features].select_dtypes(include=[np.number]).columns
        if len(numeric_features) == 0:
            raise ValueError("No numeric features found for One-Class SVM")

        # Prepare data
        X = df[numeric_features].fillna(df[numeric_features].median())
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # Calculate nu parameter (approximates contamination)
        nu = min(0.5, max(0.01, contamination))

        # Fit One-Class SVM
        oc_svm = OneClassSVM(nu=nu, kernel=kernel, gamma=gamma)
        anomaly_labels = oc_svm.fit_predict(X_scaled)

        # Get decision scores (distance to separating hyperplane)
        decision_scores = oc_svm.decision_function(X_scaled)

        # Convert to boolean (True for anomalies)
        is_anomaly = anomaly_labels == -1

        return {
            'anomaly_labels': is_anomaly.tolist(),
            'anomaly_scores': decision_scores.ravel().tolist(),
            'algorithm_params': {
                'nu': nu,
                'kernel': kernel,
                'gamma': gamma
            }
        }

    except Exception as e:
        raise ValueError(f"Error in One-Class SVM: {str(e)}")

def detect_local_outlier_factor(df, features, contamination=0.1, n_neighbors=20):
    """Detect anomalies using Local Outlier Factor"""
    try:
        numeric_features = df[features].select_dtypes(include=[np.number]).columns
        if len(numeric_features) == 0:
            raise ValueError("No numeric features found for LOF")

        # Prepare data
        X = df[numeric_features].fillna(df[numeric_features].median())
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # Adjust n_neighbors if necessary
        n_neighbors = min(n_neighbors, len(X) - 1)

        # Fit LOF
        lof = LocalOutlierFactor(
            n_neighbors=n_neighbors,
            contamination=contamination
        )

        anomaly_labels = lof.fit_predict(X_scaled)
        anomaly_scores = lof.negative_outlier_factor_

        # Convert to boolean (True for anomalies)
        is_anomaly = anomaly_labels == -1

        return {
            'anomaly_labels': is_anomaly.tolist(),
            'anomaly_scores': anomaly_scores.tolist(),
            'algorithm_params': {
                'contamination': contamination,
                'n_neighbors': n_neighbors
            }
        }

    except Exception as e:
        raise ValueError(f"Error in Local Outlier Factor: {str(e)}")

def detect_elliptic_envelope(df, features, contamination=0.1, support_fraction=None):
    """Detect anomalies using Elliptic Envelope (Robust Covariance)"""
    try:
        numeric_features = df[features].select_dtypes(include=[np.number]).columns
        if len(numeric_features) == 0:
            raise ValueError("No numeric features found for Elliptic Envelope")

        # Prepare data
        X = df[numeric_features].fillna(df[numeric_features].median())
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        # Fit Elliptic Envelope
        elliptic_env = EllipticEnvelope(
            contamination=contamination,
            support_fraction=support_fraction,
            random_state=42
        )

        anomaly_labels = elliptic_env.fit_predict(X_scaled)
        decision_scores = elliptic_env.decision_function(X_scaled)

        # Convert to boolean (True for anomalies)
        is_anomaly = anomaly_labels == -1

        return {
            'anomaly_labels': is_anomaly.tolist(),
            'anomaly_scores': decision_scores.tolist(),
            'algorithm_params': {
                'contamination': contamination,
                'support_fraction': support_fraction
            }
        }

    except Exception as e:
        raise ValueError(f"Error in Elliptic Envelope: {str(e)}")

def detect_statistical_outliers(df, features, method='zscore', threshold=3):
    """Detect outliers using statistical methods"""
    try:
        numeric_features = df[features].select_dtypes(include=[np.number]).columns
        if len(numeric_features) == 0:
            raise ValueError("No numeric features found for statistical outlier detection")

        X = df[numeric_features].fillna(df[numeric_features].median())
        is_anomaly = np.zeros(len(X), dtype=bool)
        anomaly_scores = np.zeros(len(X))

        if method == 'zscore':
            # Z-score method
            z_scores = np.abs(stats.zscore(X, axis=0))
            # Consider a point anomalous if any feature has |z-score| > threshold
            is_anomaly = np.any(z_scores > threshold, axis=1)
            anomaly_scores = np.max(z_scores, axis=1)

        elif method == 'iqr':
            # Interquartile Range method
            Q1 = X.quantile(0.25)
            Q3 = X.quantile(0.75)
            IQR = Q3 - Q1

            # Define outliers as points outside Q1 - 1.5*IQR and Q3 + 1.5*IQR
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR

            outlier_mask = (X < lower_bound) | (X > upper_bound)
            is_anomaly = outlier_mask.any(axis=1)

            # Calculate anomaly scores based on distance from IQR bounds
            distance_lower = np.maximum(0, lower_bound - X)
            distance_upper = np.maximum(0, X - upper_bound)
            anomaly_scores = np.maximum(distance_lower, distance_upper).max(axis=1)

        return {
            'anomaly_labels': is_anomaly.tolist(),
            'anomaly_scores': anomaly_scores.tolist(),
            'algorithm_params': {
                'method': method,
                'threshold': threshold
            }
        }

    except Exception as e:
        raise ValueError(f"Error in statistical outlier detection: {str(e)}")

def analyze_anomalies(df, features, anomaly_labels, anomaly_scores):
    """Analyze detected anomalies to provide insights"""
    try:
        anomaly_indices = np.where(anomaly_labels)[0]
        normal_indices = np.where(~np.array(anomaly_labels))[0]

        if len(anomaly_indices) == 0:
            return {
                'anomaly_count': 0,
                'anomaly_percentage': 0.0,
                'anomaly_summary': "No anomalies detected"
            }

        numeric_features = df[features].select_dtypes(include=[np.number]).columns
        analysis = {
            'anomaly_count': len(anomaly_indices),
            'anomaly_percentage': (len(anomaly_indices) / len(df)) * 100,
            'anomaly_indices': anomaly_indices.tolist()[:50],  # Limit for response size
            'feature_analysis': {}
        }

        # Analyze each numeric feature
        for feature in numeric_features:
            if feature in df.columns:
                anomaly_values = df.loc[anomaly_indices, feature]
                normal_values = df.loc[normal_indices, feature]

                feature_analysis = {
                    'anomaly_mean': float(anomaly_values.mean()) if len(anomaly_values) > 0 else None,
                    'normal_mean': float(normal_values.mean()) if len(normal_values) > 0 else None,
                    'anomaly_std': float(anomaly_values.std()) if len(anomaly_values) > 0 else None,
                    'normal_std': float(normal_values.std()) if len(normal_values) > 0 else None,
                    'anomaly_min': float(anomaly_values.min()) if len(anomaly_values) > 0 else None,
                    'anomaly_max': float(anomaly_values.max()) if len(anomaly_values) > 0 else None
                }

                analysis['feature_analysis'][feature] = feature_analysis

        # Score statistics
        analysis['score_statistics'] = {
            'mean_anomaly_score': float(np.mean([anomaly_scores[i] for i in anomaly_indices])) if anomaly_indices.size > 0 else None,
            'mean_normal_score': float(np.mean([anomaly_scores[i] for i in normal_indices])) if normal_indices.size > 0 else None,
            'min_anomaly_score': float(np.min([anomaly_scores[i] for i in anomaly_indices])) if anomaly_indices.size > 0 else None,
            'max_anomaly_score': float(np.max([anomaly_scores[i] for i in anomaly_indices])) if anomaly_indices.size > 0 else None
        }

        return analysis

    except Exception as e:
        return {'error': f"Error analyzing anomalies: {str(e)}"}

def detect_anomalies(dataset_id, features, algorithm, parameters, config):
    """Main anomaly detection function"""
    try:
        # Load data
        df = load_data(dataset_id)

        # Validate features exist
        missing_features = [f for f in features if f not in df.columns]
        if missing_features:
            raise ValueError(f"Features not found in dataset: {missing_features}")

        # Get algorithm parameters
        contamination = config.get('contamination', 0.1)

        # Detect anomalies based on selected algorithm
        if algorithm == 'isolation_forest':
            result = detect_isolation_forest(
                df, features,
                contamination=contamination,
                n_estimators=config.get('n_estimators', 100),
                max_samples=config.get('max_samples', 'auto')
            )
        elif algorithm == 'one_class_svm':
            result = detect_one_class_svm(
                df, features,
                contamination=contamination,
                kernel=parameters.get('kernel', 'rbf'),
                gamma=parameters.get('gamma', 'scale')
            )
        elif algorithm == 'local_outlier_factor':
            result = detect_local_outlier_factor(
                df, features,
                contamination=contamination,
                n_neighbors=parameters.get('n_neighbors', 20)
            )
        elif algorithm == 'elliptic_envelope':
            result = detect_elliptic_envelope(
                df, features,
                contamination=contamination,
                support_fraction=parameters.get('support_fraction')
            )
        elif algorithm in ['statistical_outliers', 'zscore', 'iqr']:
            method = 'iqr' if algorithm == 'iqr' else 'zscore'
            result = detect_statistical_outliers(
                df, features,
                method=method,
                threshold=config.get('threshold', 3)
            )
        else:
            raise ValueError(f"Unknown algorithm: {algorithm}")

        # Analyze the detected anomalies
        anomaly_analysis = analyze_anomalies(
            df, features,
            result['anomaly_labels'],
            result['anomaly_scores']
        )

        # Prepare sample of anomalous data points
        anomaly_indices = np.where(result['anomaly_labels'])[0]
        anomaly_samples = []
        if len(anomaly_indices) > 0:
            sample_indices = anomaly_indices[:min(10, len(anomaly_indices))]  # Limit samples
            for idx in sample_indices:
                sample = {}
                for feature in features:
                    if feature in df.columns:
                        value = df.loc[idx, feature]
                        sample[feature] = float(value) if pd.api.types.is_numeric_dtype(df[feature]) else str(value)
                sample['anomaly_score'] = float(result['anomaly_scores'][idx])
                sample['index'] = int(idx)
                anomaly_samples.append(sample)

        return {
            "anomalies": result['anomaly_labels'],
            "anomaly_scores": result['anomaly_scores'],
            "summary": anomaly_analysis,
            "anomaly_samples": anomaly_samples,
            "algorithm_info": {
                "algorithm": algorithm,
                "parameters": result.get('algorithm_params', {}),
                "features_used": features,
                "total_samples": len(df),
                "anomalies_detected": sum(result['anomaly_labels'])
            },
            "data_overview": {
                "dataset_shape": df.shape,
                "feature_types": {col: str(df[col].dtype) for col in features if col in df.columns}
            }
        }

    except Exception as e:
        raise Exception(f"Anomaly detection failed: {str(e)}")

def main():
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())

        # Extract parameters
        dataset_id = input_data.get('dataset_id')
        features = input_data.get('features', [])
        algorithm = input_data.get('algorithm', 'isolation_forest')
        parameters = input_data.get('parameters', {})
        config = input_data.get('config', {})

        # Validate required parameters
        if not dataset_id:
            raise ValueError("dataset_id is required")
        if not features:
            raise ValueError("features list is required")

        # Perform anomaly detection
        result = detect_anomalies(dataset_id, features, algorithm, parameters, config)

        # Output result
        print(json.dumps(result, default=str))

    except Exception as e:
        error_result = {
            "error": str(e),
            "type": "anomaly_detection_error"
        }
        print(json.dumps(error_result), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()