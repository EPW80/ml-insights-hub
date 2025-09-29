#!/usr/bin/env python3
"""
Feature Engineering Script for ML Insights Hub
Automated feature creation and transformation
"""

import sys
import json
import numpy as np
import pandas as pd
from sklearn.preprocessing import (
    PolynomialFeatures, StandardScaler, MinMaxScaler,
    LabelEncoder, OneHotEncoder, KBinsDiscretizer
)
from sklearn.feature_selection import (
    SelectKBest, f_classif, f_regression, VarianceThreshold,
    mutual_info_classif, mutual_info_regression
)
from sklearn.decomposition import PCA
from sklearn.model_selection import cross_val_score
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
import warnings
warnings.filterwarnings('ignore')

def load_data(dataset_id):
    """Load dataset from storage"""
    try:
        # In production, this would load from actual database/storage
        # For now, generate sample data
        np.random.seed(42)
        n_samples = 1000

        data = {
            'feature1': np.random.normal(0, 1, n_samples),
            'feature2': np.random.normal(5, 2, n_samples),
            'feature3': np.random.exponential(2, n_samples),
            'feature4': np.random.uniform(0, 10, n_samples),
            'category1': np.random.choice(['A', 'B', 'C'], n_samples),
            'category2': np.random.choice(['X', 'Y'], n_samples),
            'target': np.random.normal(10, 3, n_samples)
        }

        return pd.DataFrame(data)
    except Exception as e:
        raise ValueError(f"Error loading dataset {dataset_id}: {str(e)}")

def create_polynomial_features(df, features, degree=2, interaction_only=False):
    """Create polynomial features"""
    try:
        numeric_features = df[features].select_dtypes(include=[np.number]).columns
        if len(numeric_features) == 0:
            return df, []

        poly = PolynomialFeatures(degree=degree, interaction_only=interaction_only, include_bias=False)
        poly_features = poly.fit_transform(df[numeric_features])

        # Get feature names
        feature_names = poly.get_feature_names_out(numeric_features)

        # Create new dataframe with polynomial features
        poly_df = pd.DataFrame(poly_features, columns=feature_names, index=df.index)

        # Remove original features to avoid duplication
        original_features = list(numeric_features)
        new_features = [col for col in feature_names if col not in original_features]

        result_df = df.copy()
        for col in new_features:
            result_df[col] = poly_df[col]

        return result_df, new_features
    except Exception as e:
        raise ValueError(f"Error creating polynomial features: {str(e)}")

def create_interaction_features(df, features):
    """Create interaction features between numeric variables"""
    try:
        numeric_features = df[features].select_dtypes(include=[np.number]).columns
        new_features = []
        result_df = df.copy()

        for i, feat1 in enumerate(numeric_features):
            for feat2 in numeric_features[i+1:]:
                interaction_name = f"{feat1}_x_{feat2}"
                result_df[interaction_name] = df[feat1] * df[feat2]
                new_features.append(interaction_name)

        return result_df, new_features
    except Exception as e:
        raise ValueError(f"Error creating interaction features: {str(e)}")

def apply_log_transform(df, features):
    """Apply log transformation to skewed features"""
    try:
        numeric_features = df[features].select_dtypes(include=[np.number]).columns
        new_features = []
        result_df = df.copy()

        for feature in numeric_features:
            if df[feature].min() > 0:  # Only apply to positive values
                log_name = f"{feature}_log"
                result_df[log_name] = np.log(df[feature])
                new_features.append(log_name)
            elif df[feature].min() >= 0:  # Apply log1p for non-negative values
                log_name = f"{feature}_log1p"
                result_df[log_name] = np.log1p(df[feature])
                new_features.append(log_name)

        return result_df, new_features
    except Exception as e:
        raise ValueError(f"Error applying log transform: {str(e)}")

def apply_sqrt_transform(df, features):
    """Apply square root transformation"""
    try:
        numeric_features = df[features].select_dtypes(include=[np.number]).columns
        new_features = []
        result_df = df.copy()

        for feature in numeric_features:
            if df[feature].min() >= 0:  # Only apply to non-negative values
                sqrt_name = f"{feature}_sqrt"
                result_df[sqrt_name] = np.sqrt(df[feature])
                new_features.append(sqrt_name)

        return result_df, new_features
    except Exception as e:
        raise ValueError(f"Error applying sqrt transform: {str(e)}")

def normalize_features(df, features, method='minmax'):
    """Normalize features using MinMax or Standard scaling"""
    try:
        numeric_features = df[features].select_dtypes(include=[np.number]).columns
        new_features = []
        result_df = df.copy()

        if method == 'minmax':
            scaler = MinMaxScaler()
        else:
            scaler = StandardScaler()

        scaled_data = scaler.fit_transform(df[numeric_features])

        for i, feature in enumerate(numeric_features):
            scaled_name = f"{feature}_{method}"
            result_df[scaled_name] = scaled_data[:, i]
            new_features.append(scaled_name)

        return result_df, new_features
    except Exception as e:
        raise ValueError(f"Error normalizing features: {str(e)}")

def create_binned_features(df, features, n_bins=5, strategy='uniform'):
    """Create binned categorical features from numeric ones"""
    try:
        numeric_features = df[features].select_dtypes(include=[np.number]).columns
        new_features = []
        result_df = df.copy()

        discretizer = KBinsDiscretizer(n_bins=n_bins, encode='ordinal', strategy=strategy)

        for feature in numeric_features:
            binned_name = f"{feature}_binned"
            binned_data = discretizer.fit_transform(df[[feature]])
            result_df[binned_name] = binned_data.ravel()
            new_features.append(binned_name)

        return result_df, new_features
    except Exception as e:
        raise ValueError(f"Error creating binned features: {str(e)}")

def one_hot_encode_features(df, features):
    """Apply one-hot encoding to categorical features"""
    try:
        categorical_features = df[features].select_dtypes(include=['object', 'category']).columns
        new_features = []
        result_df = df.copy()

        for feature in categorical_features:
            # Get dummies
            dummies = pd.get_dummies(df[feature], prefix=feature, drop_first=True)
            result_df = pd.concat([result_df, dummies], axis=1)
            new_features.extend(dummies.columns.tolist())

        return result_df, new_features
    except Exception as e:
        raise ValueError(f"Error applying one-hot encoding: {str(e)}")

def create_statistical_features(df, features):
    """Create statistical features (rolling means, etc.)"""
    try:
        numeric_features = df[features].select_dtypes(include=[np.number]).columns
        new_features = []
        result_df = df.copy()

        for feature in numeric_features:
            # Rolling statistics (if data has temporal order)
            if len(df) > 10:
                roll_mean_name = f"{feature}_rolling_mean"
                roll_std_name = f"{feature}_rolling_std"

                result_df[roll_mean_name] = df[feature].rolling(window=min(5, len(df)//4)).mean()
                result_df[roll_std_name] = df[feature].rolling(window=min(5, len(df)//4)).std()

                # Fill NaN values with original values
                result_df[roll_mean_name] = result_df[roll_mean_name].fillna(df[feature])
                result_df[roll_std_name] = result_df[roll_std_name].fillna(0)

                new_features.extend([roll_mean_name, roll_std_name])

        return result_df, new_features
    except Exception as e:
        raise ValueError(f"Error creating statistical features: {str(e)}")

def apply_feature_selection(df, features, target_col=None, k=10, method='variance'):
    """Apply feature selection to reduce dimensionality"""
    try:
        if method == 'variance':
            # Variance threshold
            selector = VarianceThreshold(threshold=0.01)
            numeric_features = df[features].select_dtypes(include=[np.number]).columns
            if len(numeric_features) > 0:
                selected_data = selector.fit_transform(df[numeric_features])
                selected_features = numeric_features[selector.get_support()].tolist()
                return df[selected_features], selected_features

        elif method == 'univariate' and target_col and target_col in df.columns:
            # Univariate feature selection
            numeric_features = df[features].select_dtypes(include=[np.number]).columns
            if len(numeric_features) > 0:
                # Determine if regression or classification
                is_classification = df[target_col].dtype == 'object' or df[target_col].nunique() < 10

                if is_classification:
                    selector = SelectKBest(score_func=f_classif, k=min(k, len(numeric_features)))
                else:
                    selector = SelectKBest(score_func=f_regression, k=min(k, len(numeric_features)))

                selected_data = selector.fit_transform(df[numeric_features], df[target_col])
                selected_features = numeric_features[selector.get_support()].tolist()
                return df[selected_features], selected_features

        return df[features], features
    except Exception as e:
        raise ValueError(f"Error applying feature selection: {str(e)}")

def create_pca_features(df, features, n_components=5):
    """Create PCA features"""
    try:
        numeric_features = df[features].select_dtypes(include=[np.number]).columns
        if len(numeric_features) < 2:
            return df, []

        pca = PCA(n_components=min(n_components, len(numeric_features)))
        pca_data = pca.fit_transform(df[numeric_features])

        new_features = []
        result_df = df.copy()

        for i in range(pca_data.shape[1]):
            pca_name = f"pca_component_{i+1}"
            result_df[pca_name] = pca_data[:, i]
            new_features.append(pca_name)

        return result_df, new_features
    except Exception as e:
        raise ValueError(f"Error creating PCA features: {str(e)}")

def engineer_features(dataset_id, features, engineering_methods, parameters, config):
    """Main feature engineering function"""
    try:
        # Load data
        df = load_data(dataset_id)

        # Validate features exist
        missing_features = [f for f in features if f not in df.columns]
        if missing_features:
            raise ValueError(f"Features not found in dataset: {missing_features}")

        # Track all new features
        all_new_features = []
        transformation_info = {}
        result_df = df.copy()

        # Apply each engineering method
        for method in engineering_methods:
            try:
                if method == "polynomial_features":
                    result_df, new_feats = create_polynomial_features(
                        result_df, features,
                        degree=config.get('polynomial_degree', 2),
                        interaction_only=config.get('interaction_only', False)
                    )
                    all_new_features.extend(new_feats)
                    transformation_info[method] = {"new_features": new_feats, "count": len(new_feats)}

                elif method == "interaction_features":
                    result_df, new_feats = create_interaction_features(result_df, features)
                    all_new_features.extend(new_feats)
                    transformation_info[method] = {"new_features": new_feats, "count": len(new_feats)}

                elif method == "log_transform":
                    result_df, new_feats = apply_log_transform(result_df, features)
                    all_new_features.extend(new_feats)
                    transformation_info[method] = {"new_features": new_feats, "count": len(new_feats)}

                elif method == "sqrt_transform":
                    result_df, new_feats = apply_sqrt_transform(result_df, features)
                    all_new_features.extend(new_feats)
                    transformation_info[method] = {"new_features": new_feats, "count": len(new_feats)}

                elif method == "normalization":
                    result_df, new_feats = normalize_features(result_df, features, method='minmax')
                    all_new_features.extend(new_feats)
                    transformation_info[method] = {"new_features": new_feats, "count": len(new_feats)}

                elif method == "standardization":
                    result_df, new_feats = normalize_features(result_df, features, method='standard')
                    all_new_features.extend(new_feats)
                    transformation_info[method] = {"new_features": new_feats, "count": len(new_feats)}

                elif method == "binning":
                    result_df, new_feats = create_binned_features(result_df, features)
                    all_new_features.extend(new_feats)
                    transformation_info[method] = {"new_features": new_feats, "count": len(new_feats)}

                elif method == "one_hot_encoding":
                    result_df, new_feats = one_hot_encode_features(result_df, features)
                    all_new_features.extend(new_feats)
                    transformation_info[method] = {"new_features": new_feats, "count": len(new_feats)}

                elif method == "statistical_features":
                    result_df, new_feats = create_statistical_features(result_df, features)
                    all_new_features.extend(new_feats)
                    transformation_info[method] = {"new_features": new_feats, "count": len(new_feats)}

                elif method == "pca_features":
                    result_df, new_feats = create_pca_features(result_df, features)
                    all_new_features.extend(new_feats)
                    transformation_info[method] = {"new_features": new_feats, "count": len(new_feats)}

                elif method == "feature_selection":
                    target_col = parameters.get('target_column')
                    k_features = config.get('feature_selection_k', 10)
                    selected_df, selected_feats = apply_feature_selection(
                        result_df, features, target_col, k_features
                    )
                    transformation_info[method] = {
                        "selected_features": selected_feats,
                        "count": len(selected_feats),
                        "original_count": len(features)
                    }

            except Exception as e:
                print(f"Warning: Failed to apply {method}: {str(e)}", file=sys.stderr)
                transformation_info[method] = {"error": str(e)}

        # Prepare final feature matrix
        all_feature_names = features + all_new_features
        final_features = [col for col in all_feature_names if col in result_df.columns]

        # Handle infinite values and NaN
        result_df = result_df.replace([np.inf, -np.inf], np.nan)
        result_df = result_df.fillna(result_df.median(numeric_only=True))

        # Feature summary statistics
        feature_stats = {}
        for feature in final_features:
            if result_df[feature].dtype in ['int64', 'float64']:
                feature_stats[feature] = {
                    "mean": float(result_df[feature].mean()),
                    "std": float(result_df[feature].std()),
                    "min": float(result_df[feature].min()),
                    "max": float(result_df[feature].max()),
                    "missing_count": int(result_df[feature].isna().sum())
                }

        return {
            "engineered_features": result_df[final_features].to_dict('records')[:100],  # Limit for response size
            "feature_names": final_features,
            "new_features": all_new_features,
            "original_feature_count": len(features),
            "final_feature_count": len(final_features),
            "transformation_info": transformation_info,
            "feature_statistics": feature_stats,
            "data_shape": result_df.shape,
            "methods_applied": engineering_methods
        }

    except Exception as e:
        raise Exception(f"Feature engineering failed: {str(e)}")

def main():
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())

        # Extract parameters
        dataset_id = input_data.get('dataset_id')
        features = input_data.get('features', [])
        engineering_methods = input_data.get('engineering_methods', [])
        parameters = input_data.get('parameters', {})
        config = input_data.get('config', {})

        # Validate required parameters
        if not dataset_id:
            raise ValueError("dataset_id is required")
        if not features:
            raise ValueError("features list is required")
        if not engineering_methods:
            raise ValueError("engineering_methods list is required")

        # Perform feature engineering
        result = engineer_features(dataset_id, features, engineering_methods, parameters, config)

        # Output result
        print(json.dumps(result, default=str))

    except Exception as e:
        error_result = {
            "error": str(e),
            "type": "feature_engineering_error"
        }
        print(json.dumps(error_result), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()