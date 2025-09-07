#!/usr/bin/env python3
"""
Clustering Analysis Script for ML Insights Hub
Performs various clustering algorithms and analysis
"""

import sys
import json
import pandas as pd
import numpy as np
import os

try:
    from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering, MeanShift
    from sklearn.mixture import GaussianMixture
    from sklearn.preprocessing import StandardScaler
    from sklearn.decomposition import PCA
    from sklearn.metrics import silhouette_score, calinski_harabasz_score, davies_bouldin_score
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

import warnings
warnings.filterwarnings('ignore')

def load_dataset(dataset_id):
    """Load dataset for clustering analysis"""
    try:
        possible_paths = [
            f'/home/erikwilliams/dev/ml-insights-hub/datasets/sample_ml/{dataset_id}',
            f'/home/erikwilliams/dev/ml-insights-hub/datasets/real_estate/{dataset_id}',
            f'/home/erikwilliams/dev/ml-insights-hub/datasets/{dataset_id}',
            dataset_id
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                return pd.read_csv(path)
        
        # Create mock clustering data
        return create_mock_clustering_data()
        
    except Exception as e:
        return create_mock_clustering_data()

def create_mock_clustering_data():
    """Create mock data for clustering when datasets aren't available"""
    np.random.seed(42)
    n_samples = 300
    
    # Create 3 distinct clusters
    cluster1 = np.random.multivariate_normal([2, 2], [[0.5, 0], [0, 0.5]], n_samples//3)
    cluster2 = np.random.multivariate_normal([6, 6], [[0.5, 0], [0, 0.5]], n_samples//3)
    cluster3 = np.random.multivariate_normal([2, 6], [[0.5, 0], [0, 0.5]], n_samples//3)
    
    data = np.vstack([cluster1, cluster2, cluster3])
    
    df = pd.DataFrame(data, columns=['feature_1', 'feature_2'])
    
    # Add some additional features
    df['feature_3'] = df['feature_1'] * 0.5 + np.random.normal(0, 0.1, n_samples)
    df['feature_4'] = df['feature_2'] * 0.3 + np.random.normal(0, 0.1, n_samples)
    
    return df

def prepare_clustering_data(df, features):
    """Prepare data for clustering"""
    # Select specified features or all numeric features
    if features:
        available_features = [f for f in features if f in df.columns]
    else:
        available_features = df.select_dtypes(include=[np.number]).columns.tolist()
    
    if not available_features:
        raise ValueError("No valid numeric features found for clustering")
    
    X = df[available_features].copy()
    
    # Handle missing values
    for col in X.columns:
        X[col] = X[col].fillna(X[col].median())
    
    return X, available_features

def get_clustering_algorithm(algorithm, parameters):
    """Get clustering algorithm with parameters"""
    if not SKLEARN_AVAILABLE:
        return None
    
    algorithms = {
        'kmeans': lambda: KMeans(
            n_clusters=parameters.get('n_clusters', 3),
            random_state=42,
            n_init=10
        ),
        'dbscan': lambda: DBSCAN(
            eps=parameters.get('eps', 0.5),
            min_samples=parameters.get('min_samples', 5)
        ),
        'hierarchical': lambda: AgglomerativeClustering(
            n_clusters=parameters.get('n_clusters', 3),
            linkage=parameters.get('linkage', 'ward')
        ),
        'gaussian_mixture': lambda: GaussianMixture(
            n_components=parameters.get('n_components', 3),
            random_state=42
        ),
        'mean_shift': lambda: MeanShift(
            bandwidth=parameters.get('bandwidth', None)
        )
    }
    
    if algorithm not in algorithms:
        algorithm = 'kmeans'
    
    return algorithms[algorithm]()

def calculate_clustering_metrics(X, labels):
    """Calculate clustering evaluation metrics"""
    if not SKLEARN_AVAILABLE:
        return {}
    
    try:
        # Remove noise points (label -1) for metrics calculation
        mask = labels != -1
        if np.sum(mask) < 2:
            return {"error": "Insufficient valid clusters for metrics calculation"}
        
        X_clean = X[mask]
        labels_clean = labels[mask]
        
        # Check if we have at least 2 clusters
        n_clusters = len(np.unique(labels_clean))
        if n_clusters < 2:
            return {"error": "Need at least 2 clusters for metrics calculation"}
        
        metrics = {
            'silhouette_score': float(silhouette_score(X_clean, labels_clean)),
            'calinski_harabasz_score': float(calinski_harabasz_score(X_clean, labels_clean)),
            'davies_bouldin_score': float(davies_bouldin_score(X_clean, labels_clean)),
            'n_clusters': int(n_clusters),
            'n_noise_points': int(np.sum(labels == -1))
        }
        
        return metrics
    except Exception as e:
        return {"error": f"Error calculating metrics: {str(e)}"}

def perform_dimensionality_reduction(X, method='pca', n_components=2):
    """Perform dimensionality reduction for visualization"""
    if not SKLEARN_AVAILABLE:
        return X.iloc[:, :2].values if X.shape[1] >= 2 else X.values
    
    try:
        if method == 'pca':
            reducer = PCA(n_components=n_components, random_state=42)
            X_reduced = reducer.fit_transform(X)
            explained_variance = reducer.explained_variance_ratio_.tolist()
            return X_reduced, explained_variance
        else:
            # Fallback to first two components
            return X.iloc[:, :n_components].values, [1.0, 0.0]
    except:
        return X.iloc[:, :2].values if X.shape[1] >= 2 else X.values, [1.0, 0.0]

def analyze_clusters(X, labels, feature_names):
    """Analyze cluster characteristics"""
    try:
        unique_labels = np.unique(labels)
        cluster_analysis = {}
        
        for label in unique_labels:
            if label == -1:  # Noise points
                continue
                
            mask = labels == label
            cluster_data = X[mask]
            
            cluster_analysis[f'cluster_{label}'] = {
                'size': int(np.sum(mask)),
                'percentage': float(np.sum(mask) / len(labels) * 100),
                'centroid': cluster_data.mean().to_dict(),
                'std': cluster_data.std().to_dict(),
                'min': cluster_data.min().to_dict(),
                'max': cluster_data.max().to_dict()
            }
        
        return cluster_analysis
    except Exception as e:
        return {"error": f"Error analyzing clusters: {str(e)}"}

def mock_clustering_result(X, algorithm, parameters):
    """Create mock clustering result when sklearn is not available"""
    n_samples = len(X)
    n_clusters = parameters.get('n_clusters', 3)
    
    # Create simple mock clusters
    labels = np.random.choice(n_clusters, n_samples)
    
    # Mock cluster centers
    cluster_centers = []
    for i in range(n_clusters):
        center = X[labels == i].mean().to_dict() if np.sum(labels == i) > 0 else X.mean().to_dict()
        cluster_centers.append(center)
    
    return {
        'clusters': labels.tolist(),
        'cluster_centers': cluster_centers,
        'metrics': {
            'n_clusters': n_clusters,
            'silhouette_score': 0.5,
            'note': 'Mock clustering (scikit-learn not available)'
        },
        'cluster_analysis': {f'cluster_{i}': {'size': int(np.sum(labels == i))} for i in range(n_clusters)},
        'visualization_data': X.iloc[:, :2].values.tolist() if X.shape[1] >= 2 else X.values.tolist()
    }

def perform_clustering(dataset_id, features, algorithm, parameters, analysis_config):
    """Perform clustering analysis"""
    
    # Load and prepare data
    df = load_dataset(dataset_id)
    print(json.dumps({"type": "progress", "message": f"Loaded dataset with {len(df)} records"}))
    
    X, feature_names = prepare_clustering_data(df, features)
    print(json.dumps({"type": "progress", "message": f"Prepared {len(feature_names)} features for clustering"}))
    
    if not SKLEARN_AVAILABLE:
        return mock_clustering_result(X, algorithm, parameters)
    
    # Standardize features if requested
    if analysis_config.get('standardize', True):
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        X_scaled = pd.DataFrame(X_scaled, columns=feature_names, index=X.index)
    else:
        X_scaled = X
    
    print(json.dumps({"type": "progress", "message": f"Performing {algorithm} clustering..."}))
    
    # Get clustering algorithm
    clusterer = get_clustering_algorithm(algorithm, parameters)
    
    # Fit clustering
    if algorithm == 'gaussian_mixture':
        clusterer.fit(X_scaled)
        labels = clusterer.predict(X_scaled)
        cluster_centers = clusterer.means_.tolist() if hasattr(clusterer, 'means_') else []
    else:
        labels = clusterer.fit_predict(X_scaled)
        cluster_centers = clusterer.cluster_centers_.tolist() if hasattr(clusterer, 'cluster_centers_') else []
    
    # Calculate metrics
    metrics = calculate_clustering_metrics(X_scaled.values, labels)
    print(json.dumps({"type": "progress", "message": "Calculating clustering metrics..."}))
    
    # Analyze clusters
    cluster_analysis = analyze_clusters(X, labels, feature_names)
    
    # Dimensionality reduction for visualization
    visualization_data = None
    explained_variance = None
    if analysis_config.get('dimensionality_reduction'):
        print(json.dumps({"type": "progress", "message": "Performing dimensionality reduction..."}))
        X_reduced, explained_variance = perform_dimensionality_reduction(
            X_scaled, 
            method=analysis_config.get('dimensionality_reduction', 'pca'),
            n_components=2
        )
        visualization_data = X_reduced.tolist()
    
    result = {
        'clusters': labels.tolist(),
        'cluster_centers': cluster_centers,
        'metrics': metrics,
        'cluster_analysis': cluster_analysis,
        'data_info': {
            'total_samples': len(X),
            'features_used': feature_names,
            'algorithm': algorithm,
            'parameters': parameters
        },
        'visualization_data': visualization_data,
        'explained_variance': explained_variance
    }
    
    return result

def main():
    """Main clustering function"""
    try:
        if len(sys.argv) < 2:
            print(json.dumps({"error": "No input data provided"}))
            sys.exit(1)
        
        input_data = json.loads(sys.argv[1])
        
        # Extract parameters
        dataset_id = input_data.get('dataset_id', 'clustering_dataset.csv')
        features = input_data.get('features', [])
        algorithm = input_data.get('algorithm', 'kmeans')
        parameters = input_data.get('parameters', {})
        analysis_config = input_data.get('analysis_config', {})
        
        # Perform clustering
        result = perform_clustering(dataset_id, features, algorithm, parameters, analysis_config)
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "error": str(e),
            "type": "clustering_error",
            "sklearn_available": SKLEARN_AVAILABLE
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    main()
