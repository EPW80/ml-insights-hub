#!/usr/bin/env python3
"""
Model Versioning System
Tracks model versions, enables rollback, and manages model lifecycle
"""

import sys
import json
import pickle
import os
import shutil
from datetime import datetime
from pathlib import Path
import hashlib

class ModelVersionManager:
    """Manages model versions and enables rollback functionality"""

    def __init__(self, models_dir="/home/erikwilliams/dev/ml-insights-hub/models"):
        self.models_dir = Path(models_dir)
        self.versions_dir = self.models_dir / "versions"
        self.versions_dir.mkdir(parents=True, exist_ok=True)

        # Metadata file for tracking all versions
        self.metadata_file = self.versions_dir / "versions_metadata.json"
        self._initialize_metadata()

    def _initialize_metadata(self):
        """Initialize or load metadata file"""
        if not self.metadata_file.exists():
            metadata = {
                "models": {},
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

    def _calculate_model_hash(self, model_path):
        """Calculate hash of model file for integrity check"""
        sha256_hash = hashlib.sha256()
        with open(model_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def create_version(self, model_id, model_path, version_tag=None, metadata=None):
        """
        Create a new version of a model

        Args:
            model_id: Unique identifier for the model
            model_path: Path to the model file
            version_tag: Optional version tag (e.g., 'v1.0', 'production')
            metadata: Additional metadata about this version

        Returns:
            dict: Version information
        """
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found: {model_path}")

        # Load existing metadata
        all_metadata = self._load_metadata()

        # Initialize model entry if it doesn't exist
        if model_id not in all_metadata["models"]:
            all_metadata["models"][model_id] = {
                "versions": [],
                "current_version": None,
                "created_at": datetime.now().isoformat()
            }

        model_meta = all_metadata["models"][model_id]

        # Generate version number
        version_number = len(model_meta["versions"]) + 1
        version_id = f"v{version_number}"

        # Create version directory
        version_dir = self.versions_dir / model_id / version_id
        version_dir.mkdir(parents=True, exist_ok=True)

        # Copy model file to version directory
        version_model_path = version_dir / f"{model_id}.pkl"
        shutil.copy2(model_path, version_model_path)

        # Calculate model hash for integrity
        model_hash = self._calculate_model_hash(version_model_path)

        # Create version metadata
        version_info = {
            "version_id": version_id,
            "version_number": version_number,
            "version_tag": version_tag,
            "model_path": str(version_model_path),
            "model_hash": model_hash,
            "created_at": datetime.now().isoformat(),
            "metadata": metadata or {},
            "is_active": False
        }

        # Add version to model metadata
        model_meta["versions"].append(version_info)

        # Set as current version if it's the first or explicitly marked
        if version_number == 1 or metadata and metadata.get("set_as_current"):
            model_meta["current_version"] = version_id
            version_info["is_active"] = True

        # Save updated metadata
        self._save_metadata(all_metadata)

        return {
            "success": True,
            "model_id": model_id,
            "version_info": version_info,
            "total_versions": len(model_meta["versions"])
        }

    def list_versions(self, model_id):
        """
        List all versions of a model

        Args:
            model_id: Model identifier

        Returns:
            list: All versions of the model
        """
        metadata = self._load_metadata()

        if model_id not in metadata["models"]:
            return {
                "success": False,
                "error": f"Model {model_id} not found"
            }

        model_meta = metadata["models"][model_id]

        return {
            "success": True,
            "model_id": model_id,
            "current_version": model_meta["current_version"],
            "versions": model_meta["versions"],
            "total_versions": len(model_meta["versions"])
        }

    def get_version(self, model_id, version_id):
        """
        Get specific version of a model

        Args:
            model_id: Model identifier
            version_id: Version identifier (e.g., 'v1', 'v2')

        Returns:
            dict: Version information and model path
        """
        metadata = self._load_metadata()

        if model_id not in metadata["models"]:
            return {
                "success": False,
                "error": f"Model {model_id} not found"
            }

        model_meta = metadata["models"][model_id]

        # Find the requested version
        version_info = None
        for version in model_meta["versions"]:
            if version["version_id"] == version_id:
                version_info = version
                break

        if not version_info:
            return {
                "success": False,
                "error": f"Version {version_id} not found for model {model_id}"
            }

        # Verify model file exists and integrity
        model_path = version_info["model_path"]
        if not os.path.exists(model_path):
            return {
                "success": False,
                "error": f"Model file not found: {model_path}"
            }

        # Verify hash
        current_hash = self._calculate_model_hash(model_path)
        if current_hash != version_info["model_hash"]:
            return {
                "success": False,
                "error": "Model integrity check failed - file may be corrupted"
            }

        return {
            "success": True,
            "model_id": model_id,
            "version_info": version_info
        }

    def rollback(self, model_id, version_id):
        """
        Rollback to a previous version of the model

        Args:
            model_id: Model identifier
            version_id: Version to rollback to

        Returns:
            dict: Rollback result
        """
        # Get the version
        version_result = self.get_version(model_id, version_id)

        if not version_result["success"]:
            return version_result

        version_info = version_result["version_info"]

        # Load metadata
        metadata = self._load_metadata()
        model_meta = metadata["models"][model_id]

        # Deactivate all versions
        for version in model_meta["versions"]:
            version["is_active"] = False

        # Activate the target version
        for version in model_meta["versions"]:
            if version["version_id"] == version_id:
                version["is_active"] = True
                version["rollback_at"] = datetime.now().isoformat()
                break

        # Update current version
        model_meta["current_version"] = version_id

        # Save metadata
        self._save_metadata(metadata)

        # Copy the version model to the main models directory
        version_model_path = version_info["model_path"]
        main_model_path = self.models_dir / f"{model_id}.pkl"
        shutil.copy2(version_model_path, main_model_path)

        return {
            "success": True,
            "model_id": model_id,
            "rolled_back_to": version_id,
            "model_path": str(main_model_path),
            "timestamp": datetime.now().isoformat()
        }

    def compare_versions(self, model_id, version_id_1, version_id_2):
        """
        Compare two versions of a model

        Args:
            model_id: Model identifier
            version_id_1: First version to compare
            version_id_2: Second version to compare

        Returns:
            dict: Comparison results
        """
        v1_result = self.get_version(model_id, version_id_1)
        v2_result = self.get_version(model_id, version_id_2)

        if not v1_result["success"]:
            return v1_result
        if not v2_result["success"]:
            return v2_result

        v1_info = v1_result["version_info"]
        v2_info = v2_result["version_info"]

        comparison = {
            "success": True,
            "model_id": model_id,
            "version_1": {
                "version_id": v1_info["version_id"],
                "created_at": v1_info["created_at"],
                "metadata": v1_info.get("metadata", {}),
                "is_active": v1_info.get("is_active", False)
            },
            "version_2": {
                "version_id": v2_info["version_id"],
                "created_at": v2_info["created_at"],
                "metadata": v2_info.get("metadata", {}),
                "is_active": v2_info.get("is_active", False)
            },
            "differences": {}
        }

        # Compare metadata
        v1_meta = v1_info.get("metadata", {})
        v2_meta = v2_info.get("metadata", {})

        # Compare metrics if available
        if "metrics" in v1_meta and "metrics" in v2_meta:
            metrics_diff = {}
            for key in v1_meta["metrics"]:
                if key in v2_meta["metrics"]:
                    try:
                        v1_val = float(v1_meta["metrics"][key])
                        v2_val = float(v2_meta["metrics"][key])
                        metrics_diff[key] = {
                            "version_1": v1_val,
                            "version_2": v2_val,
                            "difference": v2_val - v1_val,
                            "percent_change": ((v2_val - v1_val) / v1_val * 100) if v1_val != 0 else 0
                        }
                    except (ValueError, TypeError):
                        pass

            comparison["differences"]["metrics"] = metrics_diff

        return comparison

    def delete_version(self, model_id, version_id):
        """
        Delete a specific version (cannot delete active version)

        Args:
            model_id: Model identifier
            version_id: Version to delete

        Returns:
            dict: Deletion result
        """
        metadata = self._load_metadata()

        if model_id not in metadata["models"]:
            return {
                "success": False,
                "error": f"Model {model_id} not found"
            }

        model_meta = metadata["models"][model_id]

        # Check if trying to delete active version
        if model_meta["current_version"] == version_id:
            return {
                "success": False,
                "error": "Cannot delete active version. Rollback to another version first."
            }

        # Find and remove version
        version_found = False
        version_path = None

        for i, version in enumerate(model_meta["versions"]):
            if version["version_id"] == version_id:
                version_path = version["model_path"]
                model_meta["versions"].pop(i)
                version_found = True
                break

        if not version_found:
            return {
                "success": False,
                "error": f"Version {version_id} not found"
            }

        # Delete version directory
        if version_path:
            version_dir = Path(version_path).parent
            if version_dir.exists():
                shutil.rmtree(version_dir)

        # Save updated metadata
        self._save_metadata(metadata)

        return {
            "success": True,
            "model_id": model_id,
            "deleted_version": version_id,
            "remaining_versions": len(model_meta["versions"])
        }


def main():
    """Main function for command-line usage"""
    try:
        if len(sys.argv) < 2:
            print(json.dumps({"error": "No input data provided"}))
            sys.exit(1)

        input_data = json.loads(sys.argv[1])
        action = input_data.get("action")

        manager = ModelVersionManager()

        if action == "create_version":
            result = manager.create_version(
                model_id=input_data["model_id"],
                model_path=input_data["model_path"],
                version_tag=input_data.get("version_tag"),
                metadata=input_data.get("metadata")
            )

        elif action == "list_versions":
            result = manager.list_versions(
                model_id=input_data["model_id"]
            )

        elif action == "get_version":
            result = manager.get_version(
                model_id=input_data["model_id"],
                version_id=input_data["version_id"]
            )

        elif action == "rollback":
            result = manager.rollback(
                model_id=input_data["model_id"],
                version_id=input_data["version_id"]
            )

        elif action == "compare_versions":
            result = manager.compare_versions(
                model_id=input_data["model_id"],
                version_id_1=input_data["version_id_1"],
                version_id_2=input_data["version_id_2"]
            )

        elif action == "delete_version":
            result = manager.delete_version(
                model_id=input_data["model_id"],
                version_id=input_data["version_id"]
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
            "type": "versioning_error"
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == "__main__":
    main()
