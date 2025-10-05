#!/usr/bin/env python3
"""
A/B Testing Framework for Model Comparison
Enables controlled experiments to compare model performance
"""

import sys
import json
import pickle
import os
import numpy as np
import pandas as pd
from datetime import datetime
from pathlib import Path
from scipy import stats

try:
    from sklearn.metrics import (
        mean_squared_error, r2_score, mean_absolute_error,
        accuracy_score, precision_score, recall_score, f1_score
    )
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


class ABTestingFramework:
    """Framework for A/B testing machine learning models"""

    def __init__(self, experiments_dir="/home/erikwilliams/dev/ml-insights-hub/models/ab_tests"):
        self.experiments_dir = Path(experiments_dir)
        self.experiments_dir.mkdir(parents=True, exist_ok=True)
        self.metadata_file = self.experiments_dir / "experiments_metadata.json"
        self._initialize_metadata()

    def _initialize_metadata(self):
        """Initialize or load metadata file"""
        if not self.metadata_file.exists():
            metadata = {
                "experiments": {},
                "created_at": datetime.now().isoformat()
            }
            with open(self.metadata_file, 'w') as f:
                json.dump(metadata, f, indent=2)

    def _load_metadata(self):
        """Load metadata from file"""
        with open(self.metadata_file, 'r') as f:
            return json.load(f)

    def _save_metadata(self, metadata):
        """Save metadata to file"""
        with open(self.metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)

    def _load_model(self, model_path):
        """Load a pickled model"""
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model not found: {model_path}")

        with open(model_path, 'rb') as f:
            model_data = pickle.load(f)

        return model_data

    def create_experiment(self, experiment_name, model_a_path, model_b_path,
                         description=None, traffic_split=0.5):
        """
        Create a new A/B test experiment

        Args:
            experiment_name: Name of the experiment
            model_a_path: Path to model A (control)
            model_b_path: Path to model B (variant)
            description: Optional description
            traffic_split: Percentage of traffic to model B (0.0 to 1.0)

        Returns:
            dict: Experiment information
        """
        # Load metadata
        metadata = self._load_metadata()

        # Check if experiment already exists
        if experiment_name in metadata["experiments"]:
            return {
                "success": False,
                "error": f"Experiment '{experiment_name}' already exists"
            }

        # Verify models exist
        if not os.path.exists(model_a_path):
            return {
                "success": False,
                "error": f"Model A not found: {model_a_path}"
            }

        if not os.path.exists(model_b_path):
            return {
                "success": False,
                "error": f"Model B not found: {model_b_path}"
            }

        # Create experiment metadata
        experiment_info = {
            "experiment_name": experiment_name,
            "description": description,
            "model_a": {
                "path": model_a_path,
                "name": "control"
            },
            "model_b": {
                "path": model_b_path,
                "name": "variant"
            },
            "traffic_split": traffic_split,
            "status": "active",
            "created_at": datetime.now().isoformat(),
            "results": {
                "model_a": [],
                "model_b": []
            },
            "statistics": None
        }

        # Add to metadata
        metadata["experiments"][experiment_name] = experiment_info
        self._save_metadata(metadata)

        return {
            "success": True,
            "experiment": experiment_info
        }

    def route_request(self, experiment_name):
        """
        Route a request to either model A or B based on traffic split

        Args:
            experiment_name: Name of the experiment

        Returns:
            str: 'model_a' or 'model_b'
        """
        metadata = self._load_metadata()

        if experiment_name not in metadata["experiments"]:
            return {
                "success": False,
                "error": f"Experiment '{experiment_name}' not found"
            }

        experiment = metadata["experiments"][experiment_name]

        if experiment["status"] != "active":
            return {
                "success": False,
                "error": f"Experiment '{experiment_name}' is not active"
            }

        # Route based on traffic split
        traffic_split = experiment["traffic_split"]
        model_choice = "model_b" if np.random.random() < traffic_split else "model_a"

        return {
            "success": True,
            "model_choice": model_choice,
            "model_path": experiment[model_choice]["path"]
        }

    def record_result(self, experiment_name, model_choice, predictions, actuals, metadata_extra=None):
        """
        Record the results of a prediction

        Args:
            experiment_name: Name of the experiment
            model_choice: 'model_a' or 'model_b'
            predictions: Model predictions
            actuals: Actual values
            metadata_extra: Additional metadata

        Returns:
            dict: Recording result
        """
        if not SKLEARN_AVAILABLE:
            return {
                "success": False,
                "error": "scikit-learn not available for metrics calculation"
            }

        metadata = self._load_metadata()

        if experiment_name not in metadata["experiments"]:
            return {
                "success": False,
                "error": f"Experiment '{experiment_name}' not found"
            }

        experiment = metadata["experiments"][experiment_name]

        # Calculate metrics
        predictions = np.array(predictions)
        actuals = np.array(actuals)

        metrics = {
            "timestamp": datetime.now().isoformat(),
            "sample_size": len(predictions),
            "metadata": metadata_extra or {}
        }

        # Determine if regression or classification
        is_regression = len(np.unique(actuals)) > 10

        if is_regression:
            metrics["mse"] = float(mean_squared_error(actuals, predictions))
            metrics["rmse"] = float(np.sqrt(metrics["mse"]))
            metrics["mae"] = float(mean_absolute_error(actuals, predictions))
            metrics["r2"] = float(r2_score(actuals, predictions))
        else:
            # Classification metrics
            predictions_binary = np.round(predictions)
            metrics["accuracy"] = float(accuracy_score(actuals, predictions_binary))
            try:
                metrics["precision"] = float(precision_score(actuals, predictions_binary, average='weighted'))
                metrics["recall"] = float(recall_score(actuals, predictions_binary, average='weighted'))
                metrics["f1"] = float(f1_score(actuals, predictions_binary, average='weighted'))
            except:
                pass

        # Add to experiment results
        experiment["results"][model_choice].append(metrics)

        # Save metadata
        self._save_metadata(metadata)

        return {
            "success": True,
            "experiment_name": experiment_name,
            "model_choice": model_choice,
            "metrics": metrics
        }

    def analyze_experiment(self, experiment_name, confidence_level=0.95):
        """
        Analyze the results of an A/B test

        Args:
            experiment_name: Name of the experiment
            confidence_level: Confidence level for statistical tests

        Returns:
            dict: Analysis results
        """
        metadata = self._load_metadata()

        if experiment_name not in metadata["experiments"]:
            return {
                "success": False,
                "error": f"Experiment '{experiment_name}' not found"
            }

        experiment = metadata["experiments"][experiment_name]

        results_a = experiment["results"]["model_a"]
        results_b = experiment["results"]["model_b"]

        if len(results_a) == 0 or len(results_b) == 0:
            return {
                "success": False,
                "error": "Insufficient data for analysis. Both models need results."
            }

        # Aggregate metrics
        def aggregate_metrics(results):
            """Aggregate metrics from results"""
            if not results:
                return {}

            # Get all metric keys
            metric_keys = set()
            for result in results:
                metric_keys.update(k for k in result.keys()
                                 if k not in ['timestamp', 'metadata', 'sample_size'])

            aggregated = {}
            for key in metric_keys:
                values = [r[key] for r in results if key in r]
                if values:
                    aggregated[key] = {
                        "mean": float(np.mean(values)),
                        "std": float(np.std(values)),
                        "min": float(np.min(values)),
                        "max": float(np.max(values)),
                        "samples": len(values)
                    }

            return aggregated

        metrics_a = aggregate_metrics(results_a)
        metrics_b = aggregate_metrics(results_b)

        # Statistical comparison
        statistical_tests = {}

        # Perform t-tests on common metrics
        for key in metrics_a.keys():
            if key in metrics_b:
                values_a = [r[key] for r in results_a if key in r]
                values_b = [r[key] for r in results_b if key in r]

                if len(values_a) >= 2 and len(values_b) >= 2:
                    t_stat, p_value = stats.ttest_ind(values_a, values_b)

                    # Calculate effect size (Cohen's d)
                    pooled_std = np.sqrt((np.var(values_a) + np.var(values_b)) / 2)
                    cohens_d = (np.mean(values_b) - np.mean(values_a)) / pooled_std if pooled_std > 0 else 0

                    statistical_tests[key] = {
                        "t_statistic": float(t_stat),
                        "p_value": float(p_value),
                        "is_significant": p_value < (1 - confidence_level),
                        "cohens_d": float(cohens_d),
                        "effect_size": self._interpret_cohens_d(cohens_d),
                        "improvement": float(((metrics_b[key]["mean"] - metrics_a[key]["mean"])
                                             / metrics_a[key]["mean"] * 100)) if metrics_a[key]["mean"] != 0 else 0
                    }

        # Determine winner
        winner = None
        primary_metric = None

        # Use RMSE for regression, accuracy for classification
        if "rmse" in statistical_tests:
            primary_metric = "rmse"
            # For RMSE, lower is better
            if statistical_tests["rmse"]["is_significant"] and metrics_b["rmse"]["mean"] < metrics_a["rmse"]["mean"]:
                winner = "model_b"
            elif statistical_tests["rmse"]["is_significant"]:
                winner = "model_a"
        elif "accuracy" in statistical_tests:
            primary_metric = "accuracy"
            # For accuracy, higher is better
            if statistical_tests["accuracy"]["is_significant"] and metrics_b["accuracy"]["mean"] > metrics_a["accuracy"]["mean"]:
                winner = "model_b"
            elif statistical_tests["accuracy"]["is_significant"]:
                winner = "model_a"

        analysis = {
            "success": True,
            "experiment_name": experiment_name,
            "model_a_metrics": metrics_a,
            "model_b_metrics": metrics_b,
            "statistical_tests": statistical_tests,
            "confidence_level": confidence_level,
            "winner": winner,
            "primary_metric": primary_metric,
            "recommendation": self._generate_recommendation(winner, statistical_tests, primary_metric),
            "sample_sizes": {
                "model_a": len(results_a),
                "model_b": len(results_b)
            }
        }

        # Update experiment metadata
        experiment["statistics"] = analysis
        experiment["analyzed_at"] = datetime.now().isoformat()
        self._save_metadata(metadata)

        return analysis

    def _interpret_cohens_d(self, cohens_d):
        """Interpret Cohen's d effect size"""
        abs_d = abs(cohens_d)
        if abs_d < 0.2:
            return "negligible"
        elif abs_d < 0.5:
            return "small"
        elif abs_d < 0.8:
            return "medium"
        else:
            return "large"

    def _generate_recommendation(self, winner, statistical_tests, primary_metric):
        """Generate a recommendation based on test results"""
        if winner is None:
            return "No statistically significant difference found. Continue monitoring or increase sample size."

        if primary_metric and primary_metric in statistical_tests:
            improvement = statistical_tests[primary_metric]["improvement"]
            effect_size = statistical_tests[primary_metric]["effect_size"]

            if winner == "model_b":
                return f"Model B shows statistically significant improvement ({abs(improvement):.2f}% on {primary_metric}, {effect_size} effect). Recommend deploying Model B."
            else:
                return f"Model A (control) performs better ({abs(improvement):.2f}% on {primary_metric}, {effect_size} effect). Recommend keeping Model A."

        return f"Winner: {winner}. Review detailed metrics before deployment."

    def stop_experiment(self, experiment_name):
        """
        Stop an active experiment

        Args:
            experiment_name: Name of the experiment

        Returns:
            dict: Result
        """
        metadata = self._load_metadata()

        if experiment_name not in metadata["experiments"]:
            return {
                "success": False,
                "error": f"Experiment '{experiment_name}' not found"
            }

        experiment = metadata["experiments"][experiment_name]
        experiment["status"] = "stopped"
        experiment["stopped_at"] = datetime.now().isoformat()

        self._save_metadata(metadata)

        return {
            "success": True,
            "experiment_name": experiment_name,
            "status": "stopped"
        }

    def list_experiments(self):
        """List all experiments"""
        metadata = self._load_metadata()

        experiments_list = []
        for name, experiment in metadata["experiments"].items():
            experiments_list.append({
                "experiment_name": name,
                "status": experiment["status"],
                "created_at": experiment["created_at"],
                "results_count": {
                    "model_a": len(experiment["results"]["model_a"]),
                    "model_b": len(experiment["results"]["model_b"])
                }
            })

        return {
            "success": True,
            "experiments": experiments_list,
            "total": len(experiments_list)
        }


def main():
    """Main function for command-line usage"""
    try:
        if len(sys.argv) < 2:
            print(json.dumps({"error": "No input data provided"}))
            sys.exit(1)

        input_data = json.loads(sys.argv[1])
        action = input_data.get("action")

        framework = ABTestingFramework()

        if action == "create_experiment":
            result = framework.create_experiment(
                experiment_name=input_data["experiment_name"],
                model_a_path=input_data["model_a_path"],
                model_b_path=input_data["model_b_path"],
                description=input_data.get("description"),
                traffic_split=input_data.get("traffic_split", 0.5)
            )

        elif action == "route_request":
            result = framework.route_request(
                experiment_name=input_data["experiment_name"]
            )

        elif action == "record_result":
            result = framework.record_result(
                experiment_name=input_data["experiment_name"],
                model_choice=input_data["model_choice"],
                predictions=input_data["predictions"],
                actuals=input_data["actuals"],
                metadata_extra=input_data.get("metadata")
            )

        elif action == "analyze_experiment":
            result = framework.analyze_experiment(
                experiment_name=input_data["experiment_name"],
                confidence_level=input_data.get("confidence_level", 0.95)
            )

        elif action == "stop_experiment":
            result = framework.stop_experiment(
                experiment_name=input_data["experiment_name"]
            )

        elif action == "list_experiments":
            result = framework.list_experiments()

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
            "type": "ab_testing_error"
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == "__main__":
    main()
