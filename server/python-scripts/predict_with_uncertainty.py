# Copy the full Python script from the previous artifact
import json
import sys
import numpy as np

def main():
    input_data = json.loads(sys.argv[1])
    
    # Simple mock prediction for testing
    features = input_data['features']
    base_price = 200000 + (features.get('bedrooms', 3) * 25000) + (features.get('sqft', 1800) * 150)
    
    result = {
        'prediction': base_price,
        'lower_bound': base_price * 0.9,
        'upper_bound': base_price * 1.1,
        'confidence_level': 0.95,
        'uncertainty_metrics': {
            'std_deviation': base_price * 0.05,
            'prediction_interval': [base_price * 0.85, base_price * 1.15],
            'quantiles': {
                'q10': base_price * 0.9,
                'q50': base_price,
                'q90': base_price * 1.1
            }
        },
        'feature_importance': [
            {'feature': 'Square Feet', 'importance': 0.3},
            {'feature': 'Bedrooms', 'importance': 0.2}
        ]
    }
    
    print(json.dumps(result))

if __name__ == "__main__":
    main()
