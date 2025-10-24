"""
Model caching system to avoid retraining models.
Implements pickle-based model persistence with metadata tracking.
"""

import os
import pickle
import hashlib
import json
from datetime import datetime, timedelta
from typing import Any, Dict, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cache configuration
CACHE_DIR = os.path.join(os.path.dirname(__file__), '../cache/models')
CACHE_METADATA_FILE = os.path.join(CACHE_DIR, 'metadata.json')
DEFAULT_CACHE_TTL_HOURS = 24  # Cache models for 24 hours by default


class ModelCache:
    """Persistent cache for trained machine learning models."""

    def __init__(self, cache_dir: str = CACHE_DIR, ttl_hours: int = DEFAULT_CACHE_TTL_HOURS):
        """
        Initialize model cache.

        Args:
            cache_dir: Directory to store cached models
            ttl_hours: Time-to-live for cached models in hours
        """
        self.cache_dir = cache_dir
        self.ttl_hours = ttl_hours
        self.metadata_file = CACHE_METADATA_FILE

        # Create cache directory if it doesn't exist
        os.makedirs(cache_dir, exist_ok=True)

        # Load or initialize metadata
        self.metadata = self._load_metadata()

    def _load_metadata(self) -> Dict:
        """Load cache metadata from disk."""
        if os.path.exists(self.metadata_file):
            try:
                with open(self.metadata_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load metadata: {e}")
                return {}
        return {}

    def _save_metadata(self):
        """Save cache metadata to disk."""
        try:
            with open(self.metadata_file, 'w') as f:
                json.dump(self.metadata, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save metadata: {e}")

    def _generate_cache_key(self, model_type: str, config: Dict) -> str:
        """
        Generate a unique cache key based on model type and configuration.

        Args:
            model_type: Type of model (e.g., 'linear_regression', 'random_forest')
            config: Model configuration parameters

        Returns:
            SHA256 hash as cache key
        """
        # Sort config to ensure consistent hashing
        config_str = json.dumps(config, sort_keys=True)
        key_string = f"{model_type}:{config_str}"
        return hashlib.sha256(key_string.encode()).hexdigest()

    def _get_cache_path(self, cache_key: str) -> str:
        """Get file path for cached model."""
        return os.path.join(self.cache_dir, f"{cache_key}.pkl")

    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached model is still valid (not expired)."""
        if cache_key not in self.metadata:
            return False

        cached_time = datetime.fromisoformat(self.metadata[cache_key]['timestamp'])
        expiry_time = cached_time + timedelta(hours=self.ttl_hours)

        return datetime.now() < expiry_time

    def get(self, model_type: str, config: Dict) -> Optional[Any]:
        """
        Retrieve a cached model if available and valid.

        Args:
            model_type: Type of model
            config: Model configuration

        Returns:
            Cached model or None if not found/expired
        """
        cache_key = self._generate_cache_key(model_type, config)
        cache_path = self._get_cache_path(cache_key)

        # Check if cache exists and is valid
        if not os.path.exists(cache_path):
            logger.info(f"Cache miss: Model not found in cache")
            return None

        if not self._is_cache_valid(cache_key):
            logger.info(f"Cache expired: Removing stale cache")
            self._remove_cache(cache_key)
            return None

        # Load and return cached model
        try:
            with open(cache_path, 'rb') as f:
                model = pickle.load(f)

            logger.info(f"Cache hit: Loaded model from cache (key: {cache_key[:8]}...)")

            # Update access time
            self.metadata[cache_key]['last_accessed'] = datetime.now().isoformat()
            self._save_metadata()

            return model
        except Exception as e:
            logger.error(f"Failed to load cached model: {e}")
            self._remove_cache(cache_key)
            return None

    def set(self, model_type: str, config: Dict, model: Any, metadata: Optional[Dict] = None):
        """
        Cache a trained model.

        Args:
            model_type: Type of model
            config: Model configuration
            model: Trained model object
            metadata: Optional metadata to store with the model
        """
        cache_key = self._generate_cache_key(model_type, config)
        cache_path = self._get_cache_path(cache_key)

        try:
            # Save model to disk
            with open(cache_path, 'wb') as f:
                pickle.dump(model, f)

            # Update metadata
            self.metadata[cache_key] = {
                'model_type': model_type,
                'config': config,
                'timestamp': datetime.now().isoformat(),
                'last_accessed': datetime.now().isoformat(),
                'file_size': os.path.getsize(cache_path),
                'metadata': metadata or {}
            }
            self._save_metadata()

            logger.info(f"Model cached successfully (key: {cache_key[:8]}...)")
        except Exception as e:
            logger.error(f"Failed to cache model: {e}")

    def _remove_cache(self, cache_key: str):
        """Remove a cached model and its metadata."""
        cache_path = self._get_cache_path(cache_key)

        # Remove cache file
        if os.path.exists(cache_path):
            os.remove(cache_path)

        # Remove metadata entry
        if cache_key in self.metadata:
            del self.metadata[cache_key]
            self._save_metadata()

    def clear_expired(self):
        """Remove all expired cached models."""
        expired_keys = [
            key for key in self.metadata.keys()
            if not self._is_cache_valid(key)
        ]

        for key in expired_keys:
            self._remove_cache(key)
            logger.info(f"Removed expired cache: {key[:8]}...")

        return len(expired_keys)

    def clear_all(self):
        """Clear all cached models."""
        count = 0
        for key in list(self.metadata.keys()):
            self._remove_cache(key)
            count += 1

        logger.info(f"Cleared {count} cached models")
        return count

    def get_stats(self) -> Dict:
        """Get cache statistics."""
        total_models = len(self.metadata)
        total_size = sum(m.get('file_size', 0) for m in self.metadata.values())

        valid_models = sum(1 for key in self.metadata.keys() if self._is_cache_valid(key))
        expired_models = total_models - valid_models

        return {
            'total_models': total_models,
            'valid_models': valid_models,
            'expired_models': expired_models,
            'total_size_bytes': total_size,
            'total_size_mb': round(total_size / (1024 * 1024), 2),
            'cache_dir': self.cache_dir,
            'ttl_hours': self.ttl_hours
        }


# Global cache instance
_cache = ModelCache()


def get_cache() -> ModelCache:
    """Get the global model cache instance."""
    return _cache


# Example usage functions
def cache_model(model_type: str, config: Dict, model: Any, metadata: Optional[Dict] = None):
    """Cache a trained model."""
    _cache.set(model_type, config, model, metadata)


def get_cached_model(model_type: str, config: Dict) -> Optional[Any]:
    """Retrieve a cached model."""
    return _cache.get(model_type, config)


if __name__ == '__main__':
    # Example usage
    import sys

    if len(sys.argv) > 1:
        command = sys.argv[1]

        if command == 'stats':
            stats = _cache.get_stats()
            print(json.dumps(stats, indent=2))

        elif command == 'clear-expired':
            count = _cache.clear_expired()
            print(json.dumps({'cleared': count}))

        elif command == 'clear-all':
            count = _cache.clear_all()
            print(json.dumps({'cleared': count}))

        else:
            print(json.dumps({'error': f'Unknown command: {command}'}))
    else:
        # Default: show stats
        stats = _cache.get_stats()
        print(json.dumps(stats, indent=2))
