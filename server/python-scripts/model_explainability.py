#!/usr/bin/env python3
"""
Model Explainability with SHAP and LIME
Provides interpretable explanations for model predictions
"""

import sys
import json
import pickle
import os
import numpy as np
import pandas as pd
from datetime import datetime
from pathlib import Path

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False

try:
    from lime import lime_tabular
    LIME_AVAILABLE = True
except ImportError:
    LIME_AVAILABLE = False

try:
    from sklearn.metrics import mean_squared_error, r2_score
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


class ModelExplainer:
    """Provides model explanations using SHAP and LIME"""

    def __init__(self, models_dir="/home/erikwilliams/dev/ml-insights-hub/models"):
        self.models_dir = Path(models_dir)

    def _load_model(self, model_path):
        """Load a pickled model"""
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model not found: {model_path}")

        with open(model_path, 'rb') as f:
            model_data = pickle.load(f)

        return model_data

    def explain_with_shap(self, model_path, data, num_samples=100, feature_names=None):
        """
        Generate SHAP explanations for model predictions

        Args:
            model_path: Path to the model file
            data: Data to explain (numpy array or pandas DataFrame)
            num_samples: Number of samples for SHAP background
            feature_names: Optional feature names

        Returns:
            dict: SHAP explanation results
        """
        if not SHAP_AVAILABLE:
            return {
                "success": False,
                "error": "SHAP library not installed. Install with: pip install shap"
            }

        try:
            # Load model
            model_data = self._load_model(model_path)
            model = model_data.get('model')
            scaler = model_data.get('scaler')
            stored_feature_names = model_data.get('feature_names', [])

            if model is None:
                return {
                    "success": False,
                    "error": "Model not found in model file"
                }

            # Convert data to DataFrame if needed
            if isinstance(data, list):
                data = np.array(data)

            if isinstance(data, np.ndarray):
                if feature_names is None:
                    feature_names = stored_feature_names or [f"feature_{i}" for i in range(data.shape[1])]
                data = pd.DataFrame(data, columns=feature_names)

            # Apply scaling if model used it
            data_for_prediction = data.copy()
            if scaler is not None:
                data_for_prediction = pd.DataFrame(
                    scaler.transform(data),
                    columns=data.columns
                )

            # Limit samples for performance
            if len(data) > num_samples:
                sample_indices = np.random.choice(len(data), num_samples, replace=False)
                background_data = data_for_prediction.iloc[sample_indices]
            else:
                background_data = data_for_prediction

            # Create SHAP explainer
            # Try TreeExplainer first (faster for tree-based models)
            explainer = None
            try:
                explainer = shap.TreeExplainer(model)
                shap_values = explainer.shap_values(data_for_prediction)
            except:
                # Fall back to KernelExplainer for other models
                try:
                    explainer = shap.KernelExplainer(
                        model.predict,
                        background_data,
                        link="identity"
                    )
                    shap_values = explainer.shap_values(data_for_prediction)
                except Exception as e:
                    return {
                        "success": False,
                        "error": f"Failed to create SHAP explainer: {str(e)}"
                    }

            # Get base values
            if hasattr(explainer, 'expected_value'):
                if isinstance(explainer.expected_value, np.ndarray):
                    base_value = float(explainer.expected_value[0])
                else:
                    base_value = float(explainer.expected_value)
            else:
                base_value = float(np.mean(model.predict(background_data)))

            # Format SHAP values
            if isinstance(shap_values, list):
                shap_values = shap_values[0]  # For multi-output models, take first output

            # Calculate feature importance
            feature_importance = {}
            mean_abs_shap = np.mean(np.abs(shap_values), axis=0)

            for i, feature_name in enumerate(data.columns):
                feature_importance[feature_name] = float(mean_abs_shap[i])

            # Sort by importance
            feature_importance = dict(sorted(
                feature_importance.items(),
                key=lambda x: x[1],
                reverse=True
            ))

            # Get individual explanations for each prediction
            explanations = []
            for i in range(min(len(data), 10)):  # Limit to 10 examples
                explanation = {
                    "prediction_index": i,
                    "base_value": base_value,
                    "prediction": float(model.predict(data_for_prediction.iloc[i:i+1])[0]),
                    "feature_contributions": {}
                }

                for j, feature_name in enumerate(data.columns):
                    explanation["feature_contributions"][feature_name] = {
                        "value": float(data.iloc[i, j]),
                        "shap_value": float(shap_values[i, j])
                    }

                # Sort by absolute SHAP value
                explanation["feature_contributions"] = dict(sorted(
                    explanation["feature_contributions"].items(),
                    key=lambda x: abs(x[1]["shap_value"]),
                    reverse=True
                ))

                explanations.append(explanation)

            return {
                "success": True,
                "method": "shap",
                "base_value": base_value,
                "feature_importance": feature_importance,
                "explanations": explanations,
                "num_samples": len(data),
                "num_features": len(data.columns)
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"SHAP explanation failed: {str(e)}"
            }

    def explain_with_lime(self, model_path, data, instance_index=0,
                         num_features=10, feature_names=None):
        """
        Generate LIME explanations for a specific prediction

        Args:
            model_path: Path to the model file
            data: Data containing the instance to explain
            instance_index: Index of the instance to explain
            num_features: Number of features to include in explanation
            feature_names: Optional feature names

        Returns:
            dict: LIME explanation results
        """
        if not LIME_AVAILABLE:
            return {
                "success": False,
                "error": "LIME library not installed. Install with: pip install lime"
            }

        try:
            # Load model
            model_data = self._load_model(model_path)
            model = model_data.get('model')
            scaler = model_data.get('scaler')
            stored_feature_names = model_data.get('feature_names', [])

            if model is None:
                return {
                    "success": False,
                    "error": "Model not found in model file"
                }

            # Convert data to DataFrame if needed
            if isinstance(data, list):
                data = np.array(data)

            if isinstance(data, np.ndarray):
                if feature_names is None:
                    feature_names = stored_feature_names or [f"feature_{i}" for i in range(data.shape[1])]
                data = pd.DataFrame(data, columns=feature_names)

            # Check instance index
            if instance_index >= len(data):
                return {
                    "success": False,
                    "error": f"Instance index {instance_index} out of range (max: {len(data)-1})"
                }

            # Prepare prediction function
            def predict_fn(X):
                """Prediction function for LIME"""
                X_df = pd.DataFrame(X, columns=data.columns)
                if scaler is not None:
                    X_scaled = scaler.transform(X_df)
                    X_df = pd.DataFrame(X_scaled, columns=data.columns)
                return model.predict(X_df)

            # Create LIME explainer
            explainer = lime_tabular.LimeTabularExplainer(
                training_data=data.values,
                feature_names=list(data.columns),
                mode='regression',
                verbose=False
            )

            # Get instance to explain
            instance = data.iloc[instance_index].values

            # Generate explanation
            lime_explanation = explainer.explain_instance(
                data_row=instance,
                predict_fn=predict_fn,
                num_features=num_features
            )

            # Extract feature contributions
            feature_contributions = {}
            for feature, weight in lime_explanation.as_list():
                # Parse feature name from LIME format
                feature_name = feature.split(' ')[0] if ' ' in feature else feature
                feature_contributions[feature_name] = {
                    "weight": float(weight),
                    "rule": feature
                }

            # Get prediction
            prediction = float(predict_fn(instance.reshape(1, -1))[0])

            # Get intercept
            intercept = float(lime_explanation.intercept[0]) if hasattr(lime_explanation, 'intercept') else 0.0

            return {
                "success": True,
                "method": "lime",
                "instance_index": instance_index,
                "prediction": prediction,
                "intercept": intercept,
                "feature_contributions": feature_contributions,
                "instance_values": {
                    name: float(value)
                    for name, value in zip(data.columns, instance)
                },
                "num_features_explained": len(feature_contributions)
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"LIME explanation failed: {str(e)}"
            }

    def get_feature_importance_comparison(self, model_path, data, feature_names=None):
        """
        Compare feature importance from different methods

        Args:
            model_path: Path to the model file
            data: Data for analysis
            feature_names: Optional feature names

        Returns:
            dict: Feature importance comparison
        """
        try:
            # Load model
            model_data = self._load_model(model_path)
            model = model_data.get('model')
            stored_feature_names = model_data.get('feature_names', [])

            if feature_names is None:
                feature_names = stored_feature_names

            # Convert data to DataFrame
            if isinstance(data, list):
                data = np.array(data)

            if isinstance(data, np.ndarray):
                data = pd.DataFrame(data, columns=feature_names)

            importance_methods = {}

            # 1. Built-in feature importance (for tree-based models)
            if hasattr(model, 'feature_importances_'):
                importance_methods['model_native'] = {
                    name: float(importance)
                    for name, importance in zip(data.columns, model.feature_importances_)
                }

            # 2. SHAP-based importance
            if SHAP_AVAILABLE:
                shap_result = self.explain_with_shap(model_path, data, num_samples=50, feature_names=feature_names)
                if shap_result["success"]:
                    importance_methods['shap'] = shap_result["feature_importance"]

            # 3. Permutation importance (simple version)
            if SKLEARN_AVAILABLE:
                scaler = model_data.get('scaler')
                data_for_pred = data.copy()

                if scaler is not None:
                    data_for_pred = pd.DataFrame(
                        scaler.transform(data),
                        columns=data.columns
                    )

                # Get baseline performance
                y_pred = model.predict(data_for_pred)
                baseline_score = np.std(y_pred)  # Use std as a simple metric

                permutation_importance = {}
                for col in data.columns:
                    # Permute column
                    data_permuted = data_for_pred.copy()
                    data_permuted[col] = np.random.permutation(data_permuted[col].values)

                    # Get new predictions
                    y_pred_permuted = model.predict(data_permuted)
                    permuted_score = np.std(y_pred_permuted)

                    # Importance is the change in metric
                    importance = abs(permuted_score - baseline_score)
                    permutation_importance[col] = float(importance)

                importance_methods['permutation'] = permutation_importance

            # Normalize all importance scores
            for method_name, importances in importance_methods.items():
                total = sum(importances.values())
                if total > 0:
                    importance_methods[method_name] = {
                        k: v / total for k, v in importances.items()
                    }

            return {
                "success": True,
                "feature_importance_methods": importance_methods,
                "num_features": len(data.columns),
                "num_samples": len(data)
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"Feature importance comparison failed: {str(e)}"
            }


def main():
    """Main function for command-line usage"""
    try:
        if len(sys.argv) < 2:
            print(json.dumps({"error": "No input data provided"}))
            sys.exit(1)

        input_data = json.loads(sys.argv[1])
        action = input_data.get("action")

        explainer = ModelExplainer()

        if action == "shap_explain":
            result = explainer.explain_with_shap(
                model_path=input_data["model_path"],
                data=input_data["data"],
                num_samples=input_data.get("num_samples", 100),
                feature_names=input_data.get("feature_names")
            )

        elif action == "lime_explain":
            result = explainer.explain_with_lime(
                model_path=input_data["model_path"],
                data=input_data["data"],
                instance_index=input_data.get("instance_index", 0),
                num_features=input_data.get("num_features", 10),
                feature_names=input_data.get("feature_names")
            )

        elif action == "compare_importance":
            result = explainer.get_feature_importance_comparison(
                model_path=input_data["model_path"],
                data=input_data["data"],
                feature_names=input_data.get("feature_names")
            )

        else:
            result = {
                "success": False,
                "error": f"Unknown action: {action}"
            }

        print(json.dumps(result))

    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e),
            "type": "explainability_error"
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == "__main__":
    main()
