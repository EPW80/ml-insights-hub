#!/usr/bin/env python3
"""
Automated Model Retraining System
Monitors model performance and triggers retraining when thresholds are breached
"""

import sys
import json
import pickle
import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path

try:
    from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


class AutoRetrainManager:
    """Manages automated model retraining based on performance thresholds"""

    def __init__(self, config_dir="/home/erikwilliams/dev/ml-insights-hub/models/retrain_configs"):
        self.config_dir = Path(config_dir)
        self.config_dir.mkdir(parents=True, exist_ok=True)
        self.config_file = self.config_dir / "retrain_config.json"
        self._initialize_config()

    def _initialize_config(self):
        """Initialize or load config file"""
        if not self.config_file.exists():
            config = {
                "models": {},
                "created_at": datetime.now().isoformat()
            }
            with open(self.config_file, 'w') as f:
                json.dump(config, f, indent=2)

    def _load_config(self):
        """Load config from file"""
        with open(self.config_file, 'r') as f:
            return json.load(f)

    def _save_config(self, config):
        """Save config to file"""
        with open(self.config_file, 'w') as f:
            json.dump(config, f, indent=2)

    def configure_model_monitoring(self, model_id, thresholds, monitoring_config):
        """
        Configure monitoring and retraining thresholds for a model

        Args:
            model_id: Unique identifier for the model
            thresholds: Dict of performance thresholds
            monitoring_config: Configuration for monitoring

        Returns:
            dict: Configuration result
        """
        config = self._load_config()

        # Validate thresholds
        valid_threshold_keys = ['min_r2', 'max_rmse', 'max_mae', 'min_accuracy',
                               'max_error_rate', 'performance_degradation_percent']

        for key in thresholds.keys():
            if key not in valid_threshold_keys:
                return {
                    "success": False,
                    "error": f"Invalid threshold key: {key}. Valid keys: {valid_threshold_keys}"
                }

        # Create model monitoring config
        model_config = {
            "model_id": model_id,
            "thresholds": thresholds,
            "monitoring_config": {
                "check_interval_hours": monitoring_config.get("check_interval_hours", 24),
                "min_samples_for_retrain": monitoring_config.get("min_samples_for_retrain", 100),
                "auto_retrain_enabled": monitoring_config.get("auto_retrain_enabled", True),
                "notification_enabled": monitoring_config.get("notification_enabled", True)
            },
            "status": "active",
            "created_at": datetime.now().isoformat(),
            "last_check": None,
            "performance_history": [],
            "retrain_history": []
        }

        # Add to config
        config["models"][model_id] = model_config
        self._save_config(config)

        return {
            "success": True,
            "model_id": model_id,
            "config": model_config
        }

    def check_performance(self, model_id, current_metrics, baseline_metrics=None):
        """
        Check if model performance has degraded below thresholds

        Args:
            model_id: Model identifier
            current_metrics: Current performance metrics
            baseline_metrics: Baseline metrics to compare against

        Returns:
            dict: Performance check result
        """
        config = self._load_config()

        if model_id not in config["models"]:
            return {
                "success": False,
                "error": f"Model {model_id} not configured for monitoring"
            }

        model_config = config["models"][model_id]
        thresholds = model_config["thresholds"]

        # Record current metrics
        performance_record = {
            "timestamp": datetime.now().isoformat(),
            "metrics": current_metrics
        }
        model_config["performance_history"].append(performance_record)
        model_config["last_check"] = datetime.now().isoformat()

        # Keep only last 100 records
        if len(model_config["performance_history"]) > 100:
            model_config["performance_history"] = model_config["performance_history"][-100:]

        # Check thresholds
        threshold_violations = []

        # Check absolute thresholds
        if "min_r2" in thresholds and "r2" in current_metrics:
            if current_metrics["r2"] < thresholds["min_r2"]:
                threshold_violations.append({
                    "metric": "r2",
                    "current": current_metrics["r2"],
                    "threshold": thresholds["min_r2"],
                    "type": "below_minimum"
                })

        if "max_rmse" in thresholds and "rmse" in current_metrics:
            if current_metrics["rmse"] > thresholds["max_rmse"]:
                threshold_violations.append({
                    "metric": "rmse",
                    "current": current_metrics["rmse"],
                    "threshold": thresholds["max_rmse"],
                    "type": "above_maximum"
                })

        if "max_mae" in thresholds and "mae" in current_metrics:
            if current_metrics["mae"] > thresholds["max_mae"]:
                threshold_violations.append({
                    "metric": "mae",
                    "current": current_metrics["mae"],
                    "threshold": thresholds["max_mae"],
                    "type": "above_maximum"
                })

        if "min_accuracy" in thresholds and "accuracy" in current_metrics:
            if current_metrics["accuracy"] < thresholds["min_accuracy"]:
                threshold_violations.append({
                    "metric": "accuracy",
                    "current": current_metrics["accuracy"],
                    "threshold": thresholds["min_accuracy"],
                    "type": "below_minimum"
                })

        # Check performance degradation
        if "performance_degradation_percent" in thresholds and baseline_metrics:
            for metric in ["r2", "accuracy"]:
                if metric in current_metrics and metric in baseline_metrics:
                    degradation = ((baseline_metrics[metric] - current_metrics[metric])
                                 / baseline_metrics[metric] * 100)

                    if degradation > thresholds["performance_degradation_percent"]:
                        threshold_violations.append({
                            "metric": metric,
                            "current": current_metrics[metric],
                            "baseline": baseline_metrics[metric],
                            "degradation_percent": degradation,
                            "threshold": thresholds["performance_degradation_percent"],
                            "type": "performance_degradation"
                        })

        # Determine if retraining is needed
        retrain_needed = len(threshold_violations) > 0

        result = {
            "success": True,
            "model_id": model_id,
            "retrain_needed": retrain_needed,
            "threshold_violations": threshold_violations,
            "current_metrics": current_metrics,
            "baseline_metrics": baseline_metrics,
            "timestamp": datetime.now().isoformat()
        }

        # Save config
        self._save_config(config)

        # Add recommendation
        if retrain_needed:
            result["recommendation"] = self._generate_retrain_recommendation(threshold_violations)

        return result

    def _generate_retrain_recommendation(self, violations):
        """Generate a recommendation based on threshold violations"""
        if not violations:
            return "No retraining needed - performance within acceptable thresholds"

        violation_summaries = []
        for v in violations:
            if v["type"] == "performance_degradation":
                violation_summaries.append(
                    f"{v['metric']} degraded by {v['degradation_percent']:.1f}%"
                )
            elif v["type"] == "below_minimum":
                violation_summaries.append(
                    f"{v['metric']} ({v['current']:.4f}) below threshold ({v['threshold']:.4f})"
                )
            else:
                violation_summaries.append(
                    f"{v['metric']} ({v['current']:.4f}) above threshold ({v['threshold']:.4f})"
                )

        recommendation = (
            f"Retraining recommended due to {len(violations)} threshold violation(s): "
            + "; ".join(violation_summaries)
        )

        return recommendation

    def trigger_retrain(self, model_id, retrain_params):
        """
        Trigger a retraining job

        Args:
            model_id: Model identifier
            retrain_params: Parameters for retraining

        Returns:
            dict: Retraining trigger result
        """
        config = self._load_config()

        if model_id not in config["models"]:
            return {
                "success": False,
                "error": f"Model {model_id} not configured for monitoring"
            }

        model_config = config["models"][model_id]

        # Check if auto-retrain is enabled
        if not model_config["monitoring_config"]["auto_retrain_enabled"]:
            return {
                "success": False,
                "error": "Auto-retraining is not enabled for this model"
            }

        # Record retrain event
        retrain_record = {
            "timestamp": datetime.now().isoformat(),
            "trigger": retrain_params.get("trigger", "manual"),
            "params": retrain_params,
            "status": "triggered"
        }

        model_config["retrain_history"].append(retrain_record)

        # Keep only last 50 retrain records
        if len(model_config["retrain_history"]) > 50:
            model_config["retrain_history"] = model_config["retrain_history"][-50:]

        self._save_config(config)

        return {
            "success": True,
            "model_id": model_id,
            "retrain_triggered": True,
            "retrain_params": retrain_params,
            "timestamp": datetime.now().isoformat(),
            "message": "Retraining job triggered. Monitor training endpoint for progress."
        }

    def get_monitoring_status(self, model_id):
        """
        Get the monitoring status for a model

        Args:
            model_id: Model identifier

        Returns:
            dict: Monitoring status
        """
        config = self._load_config()

        if model_id not in config["models"]:
            return {
                "success": False,
                "error": f"Model {model_id} not configured for monitoring"
            }

        model_config = config["models"][model_id]

        # Calculate statistics
        performance_history = model_config["performance_history"]

        stats = {}
        if performance_history:
            recent_records = performance_history[-10:]  # Last 10 records

            # Calculate trends
            for metric in ["r2", "rmse", "mae", "accuracy"]:
                values = [r["metrics"].get(metric) for r in recent_records
                         if metric in r["metrics"]]

                if len(values) >= 2:
                    # Simple trend: positive if improving
                    trend = "improving" if values[-1] > values[0] else "degrading"
                    if metric in ["rmse", "mae"]:
                        # For error metrics, lower is better
                        trend = "improving" if values[-1] < values[0] else "degrading"

                    stats[metric] = {
                        "current": values[-1],
                        "average": np.mean(values),
                        "trend": trend,
                        "samples": len(values)
                    }

        return {
            "success": True,
            "model_id": model_id,
            "status": model_config["status"],
            "thresholds": model_config["thresholds"],
            "monitoring_config": model_config["monitoring_config"],
            "last_check": model_config["last_check"],
            "performance_stats": stats,
            "total_checks": len(performance_history),
            "total_retrains": len(model_config["retrain_history"])
        }

    def update_monitoring_config(self, model_id, updates):
        """
        Update monitoring configuration for a model

        Args:
            model_id: Model identifier
            updates: Configuration updates

        Returns:
            dict: Update result
        """
        config = self._load_config()

        if model_id not in config["models"]:
            return {
                "success": False,
                "error": f"Model {model_id} not configured for monitoring"
            }

        model_config = config["models"][model_id]

        # Update thresholds
        if "thresholds" in updates:
            model_config["thresholds"].update(updates["thresholds"])

        # Update monitoring config
        if "monitoring_config" in updates:
            model_config["monitoring_config"].update(updates["monitoring_config"])

        # Update status
        if "status" in updates:
            model_config["status"] = updates["status"]

        model_config["updated_at"] = datetime.now().isoformat()

        self._save_config(config)

        return {
            "success": True,
            "model_id": model_id,
            "updated_config": model_config
        }

    def list_monitored_models(self):
        """List all models being monitored"""
        config = self._load_config()

        models_list = []
        for model_id, model_config in config["models"].items():
            models_list.append({
                "model_id": model_id,
                "status": model_config["status"],
                "auto_retrain_enabled": model_config["monitoring_config"]["auto_retrain_enabled"],
                "last_check": model_config["last_check"],
                "total_checks": len(model_config["performance_history"]),
                "total_retrains": len(model_config["retrain_history"])
            })

        return {
            "success": True,
            "models": models_list,
            "total": len(models_list)
        }


def main():
    """Main function for command-line usage"""
    try:
        if len(sys.argv) < 2:
            print(json.dumps({"error": "No input data provided"}))
            sys.exit(1)

        input_data = json.loads(sys.argv[1])
        action = input_data.get("action")

        manager = AutoRetrainManager()

        if action == "configure":
            result = manager.configure_model_monitoring(
                model_id=input_data["model_id"],
                thresholds=input_data["thresholds"],
                monitoring_config=input_data.get("monitoring_config", {})
            )

        elif action == "check_performance":
            result = manager.check_performance(
                model_id=input_data["model_id"],
                current_metrics=input_data["current_metrics"],
                baseline_metrics=input_data.get("baseline_metrics")
            )

        elif action == "trigger_retrain":
            result = manager.trigger_retrain(
                model_id=input_data["model_id"],
                retrain_params=input_data.get("retrain_params", {})
            )

        elif action == "get_status":
            result = manager.get_monitoring_status(
                model_id=input_data["model_id"]
            )

        elif action == "update_config":
            result = manager.update_monitoring_config(
                model_id=input_data["model_id"],
                updates=input_data["updates"]
            )

        elif action == "list_models":
            result = manager.list_monitored_models()

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
            "type": "auto_retrain_error"
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == "__main__":
    main()
