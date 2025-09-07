#!/usr/bin/env python3
"""
Data Generation Script for ML Insights Hub
Generates realistic real estate and ML training datasets
"""

import pandas as pd
import numpy as np
import json
import os
from datetime import datetime, timedelta
import random
from faker import Faker
from sklearn.datasets import make_regression, make_classification
import requests

# Initialize Faker for realistic data generation
fake = Faker()
np.random.seed(42)
random.seed(42)

def create_datasets_directory():
    """Create datasets directory structure"""
    base_dir = '/home/erikwilliams/dev/ml-insights-hub/datasets'
    directories = [
        'real_estate',
        'sample_ml',
        'processed',
        'raw',
        'validation'
    ]
    
    for directory in directories:
        dir_path = os.path.join(base_dir, directory)
        os.makedirs(dir_path, exist_ok=True)
        print(f"Created directory: {dir_path}")

def generate_real_estate_dataset(num_properties=5000):
    """Generate realistic real estate dataset"""
    print("Generating real estate dataset...")
    
    # Property types and their typical characteristics
    property_types = {
        'Single Family': {'bed_range': (2, 6), 'bath_range': (1, 4), 'sqft_range': (1200, 4500)},
        'Condo': {'bed_range': (1, 3), 'bath_range': (1, 3), 'sqft_range': (600, 2500)},
        'Townhouse': {'bed_range': (2, 4), 'bath_range': (1, 3), 'sqft_range': (1000, 3000)},
        'Duplex': {'bed_range': (2, 4), 'bath_range': (1, 3), 'sqft_range': (800, 2800)}
    }
    
    # City data with realistic coordinates and price ranges
    cities = [
        {'name': 'San Francisco', 'lat_range': (37.7, 37.8), 'lng_range': (-122.5, -122.4), 'price_multiplier': 2.5},
        {'name': 'Austin', 'lat_range': (30.2, 30.4), 'lng_range': (-97.8, -97.7), 'price_multiplier': 1.3},
        {'name': 'Denver', 'lat_range': (39.6, 39.8), 'lng_range': (-105.1, -104.9), 'price_multiplier': 1.4},
        {'name': 'Atlanta', 'lat_range': (33.6, 33.9), 'lng_range': (-84.5, -84.3), 'price_multiplier': 1.0},
        {'name': 'Seattle', 'lat_range': (47.5, 47.7), 'lng_range': (-122.4, -122.2), 'price_multiplier': 1.8}
    ]
    
    properties = []
    
    for i in range(num_properties):
        # Select random city and property type
        city = random.choice(cities)
        prop_type = random.choice(list(property_types.keys()))
        type_specs = property_types[prop_type]
        
        # Generate basic property features
        bedrooms = random.randint(*type_specs['bed_range'])
        bathrooms = random.randint(*type_specs['bath_range'])
        sqft = random.randint(*type_specs['sqft_range'])
        
        # Generate year built with realistic distribution
        year_built = np.random.choice(
            range(1950, 2024),
            p=np.exp(np.linspace(-2, 0, 74)) / np.sum(np.exp(np.linspace(-2, 0, 74)))
        )
        
        # Generate coordinates within city bounds
        lat = random.uniform(*city['lat_range'])
        lng = random.uniform(*city['lng_range'])
        
        # Generate neighborhood characteristics
        school_rating = max(1, min(10, np.random.normal(6.5, 2)))
        crime_rate = max(0, np.random.exponential(15))
        walkability_score = max(0, min(100, np.random.normal(65, 20)))
        
        # Calculate base price using realistic factors
        base_price = (
            sqft * 150 +  # Base price per sqft
            bedrooms * 25000 +  # Bedroom premium
            bathrooms * 15000 +  # Bathroom premium
            max(0, (school_rating - 5)) * 20000 +  # School rating bonus
            max(0, (walkability_score - 50)) * 500 +  # Walkability bonus
            max(0, (2024 - year_built)) * -1000  # Age depreciation
        )
        
        # Apply city multiplier and add realistic noise
        actual_price = base_price * city['price_multiplier'] * np.random.normal(1, 0.15)
        actual_price = max(50000, actual_price)  # Minimum price floor
        
        # Listed price is typically 5-15% higher than actual sale price
        listed_price = actual_price * random.uniform(1.05, 1.15)
        
        # Generate dates
        date_listed = fake.date_between(start_date='-2y', end_date='today')
        days_on_market = np.random.geometric(0.1) + 5  # Geometric distribution for days on market
        date_sold = date_listed + timedelta(days=days_on_market)
        
        property_data = {
            'property_id': f"PROP_{i+1:06d}",
            'address': fake.street_address(),
            'city': city['name'],
            'state': 'CA' if city['name'] == 'San Francisco' else 'TX' if city['name'] == 'Austin' else 'CO' if city['name'] == 'Denver' else 'GA' if city['name'] == 'Atlanta' else 'WA',
            'zipcode': fake.zipcode(),
            'latitude': round(lat, 6),
            'longitude': round(lng, 6),
            'bedrooms': bedrooms,
            'bathrooms': bathrooms,
            'sqft': sqft,
            'lot_size': random.randint(2000, 15000),
            'year_built': int(year_built),
            'garage': random.randint(0, 3),
            'property_type': prop_type,
            'condition': random.choice(['Excellent', 'Good', 'Fair', 'Needs Work']),
            'school_rating': round(school_rating, 1),
            'crime_rate': round(crime_rate, 1),
            'walkability_score': round(walkability_score, 1),
            'public_transport_access': random.randint(1, 10),
            'shopping_proximity': random.randint(1, 10),
            'actual_price': round(actual_price),
            'listed_price': round(listed_price),
            'date_listed': date_listed.strftime('%Y-%m-%d'),
            'date_sold': date_sold.strftime('%Y-%m-%d'),
            'days_on_market': days_on_market,
            'data_source': random.choice(['MLS', 'Zillow', 'Realtor.com', 'Direct'])
        }
        
        properties.append(property_data)
        
        if (i + 1) % 1000 == 0:
            print(f"Generated {i + 1} properties...")
    
    # Create DataFrame and save
    df = pd.DataFrame(properties)
    
    # Add some derived features
    df['price_per_sqft'] = df['actual_price'] / df['sqft']
    df['age'] = 2024 - df['year_built']
    df['bed_bath_ratio'] = df['bedrooms'] / df['bathrooms']
    df['total_rooms'] = df['bedrooms'] + df['bathrooms']
    
    # Save dataset
    output_path = '/home/erikwilliams/dev/ml-insights-hub/datasets/real_estate/properties_dataset.csv'
    df.to_csv(output_path, index=False)
    print(f"Real estate dataset saved to: {output_path}")
    
    # Generate summary statistics
    summary = {
        'dataset_name': 'Real Estate Properties Dataset',
        'total_records': len(df),
        'date_generated': datetime.now().isoformat(),
        'columns': list(df.columns),
        'price_statistics': {
            'mean_price': float(df['actual_price'].mean()),
            'median_price': float(df['actual_price'].median()),
            'min_price': float(df['actual_price'].min()),
            'max_price': float(df['actual_price'].max()),
            'std_price': float(df['actual_price'].std())
        },
        'feature_ranges': {
            'bedrooms': f"{df['bedrooms'].min()}-{df['bedrooms'].max()}",
            'bathrooms': f"{df['bathrooms'].min()}-{df['bathrooms'].max()}",
            'sqft': f"{df['sqft'].min()}-{df['sqft'].max()}",
            'year_built': f"{df['year_built'].min()}-{df['year_built'].max()}"
        }
    }
    
    with open('/home/erikwilliams/dev/ml-insights-hub/datasets/real_estate/dataset_summary.json', 'w') as f:
        json.dump(summary, f, indent=2)
    
    return df

def generate_ml_sample_datasets():
    """Generate various ML sample datasets for different algorithms"""
    print("Generating ML sample datasets...")
    
    # 1. Regression Dataset
    print("Creating regression dataset...")
    X_reg, y_reg = make_regression(
        n_samples=2000,
        n_features=10,
        n_informative=7,
        noise=10,
        random_state=42
    )
    
    # Create meaningful feature names
    feature_names = [
        'feature_1', 'feature_2', 'feature_3', 'feature_4', 'feature_5',
        'feature_6', 'feature_7', 'feature_8', 'feature_9', 'feature_10'
    ]
    
    df_reg = pd.DataFrame(X_reg, columns=feature_names)
    df_reg['target'] = y_reg
    df_reg.to_csv('/home/erikwilliams/dev/ml-insights-hub/datasets/sample_ml/regression_dataset.csv', index=False)
    
    # 2. Classification Dataset
    print("Creating classification dataset...")
    X_clf, y_clf = make_classification(
        n_samples=2000,
        n_features=15,
        n_informative=10,
        n_redundant=5,
        n_classes=3,
        random_state=42
    )
    
    clf_feature_names = [f'feature_{i+1}' for i in range(15)]
    df_clf = pd.DataFrame(X_clf, columns=clf_feature_names)
    df_clf['target'] = y_clf
    df_clf.to_csv('/home/erikwilliams/dev/ml-insights-hub/datasets/sample_ml/classification_dataset.csv', index=False)
    
    # 3. Time Series Dataset
    print("Creating time series dataset...")
    dates = pd.date_range('2020-01-01', periods=1000, freq='D')
    trend = np.linspace(100, 200, 1000)
    seasonal = 10 * np.sin(2 * np.pi * np.arange(1000) / 365.25)
    noise = np.random.normal(0, 5, 1000)
    values = trend + seasonal + noise
    
    df_ts = pd.DataFrame({
        'date': dates,
        'value': values,
        'trend': trend,
        'seasonal': seasonal
    })
    df_ts.to_csv('/home/erikwilliams/dev/ml-insights-hub/datasets/sample_ml/timeseries_dataset.csv', index=False)
    
    # 4. Clustering Dataset (for unsupervised learning)
    print("Creating clustering dataset...")
    from sklearn.datasets import make_blobs
    
    X_cluster, y_cluster = make_blobs(
        n_samples=1500,
        centers=4,
        cluster_std=1.5,
        random_state=42
    )
    
    df_cluster = pd.DataFrame(X_cluster, columns=['x1', 'x2'])
    df_cluster['true_cluster'] = y_cluster
    df_cluster.to_csv('/home/erikwilliams/dev/ml-insights-hub/datasets/sample_ml/clustering_dataset.csv', index=False)
    
    print("ML sample datasets created successfully!")

def generate_sample_data_for_upload():
    """Generate sample CSV files that users can upload for testing"""
    print("Creating sample upload files...")
    
    # Sample 1: Small property dataset for quick testing
    small_properties = []
    for i in range(100):
        small_properties.append({
            'bedrooms': random.randint(1, 5),
            'bathrooms': random.randint(1, 3),
            'sqft': random.randint(800, 3000),
            'year_built': random.randint(1980, 2023),
            'lot_size': random.randint(3000, 12000),
            'garage': random.randint(0, 2),
            'school_rating': round(random.uniform(3, 10), 1),
            'crime_rate': round(random.uniform(5, 50), 1),
            'walkability_score': random.randint(20, 100),
            'price': random.randint(200000, 800000)
        })
    
    df_small = pd.DataFrame(small_properties)
    df_small.to_csv('/home/erikwilliams/dev/ml-insights-hub/datasets/sample_ml/sample_upload_properties.csv', index=False)
    
    # Sample 2: Feature importance dataset
    np.random.seed(42)
    n_samples = 500
    
    # Create correlated features
    important_feature_1 = np.random.normal(0, 1, n_samples)
    important_feature_2 = np.random.normal(0, 1, n_samples)
    noise_feature_1 = np.random.normal(0, 1, n_samples)
    noise_feature_2 = np.random.normal(0, 1, n_samples)
    
    # Target is strongly correlated with important features
    target = (2 * important_feature_1 + 
              1.5 * important_feature_2 + 
              0.1 * noise_feature_1 + 
              0.05 * noise_feature_2 + 
              np.random.normal(0, 0.5, n_samples))
    
    df_importance = pd.DataFrame({
        'important_feature_1': important_feature_1,
        'important_feature_2': important_feature_2,
        'noise_feature_1': noise_feature_1,
        'noise_feature_2': noise_feature_2,
        'correlated_feature': important_feature_1 * 0.8 + np.random.normal(0, 0.2, n_samples),
        'target': target
    })
    
    df_importance.to_csv('/home/erikwilliams/dev/ml-insights-hub/datasets/sample_ml/feature_importance_sample.csv', index=False)
    
    print("Sample upload files created!")

def create_data_validation_files():
    """Create datasets with various data quality issues for testing validation"""
    print("Creating data validation test files...")
    
    # Dataset with missing values
    df_missing = pd.DataFrame({
        'feature_1': [1, 2, np.nan, 4, 5, np.nan, 7, 8, 9, 10],
        'feature_2': [10, np.nan, 30, 40, np.nan, 60, 70, 80, np.nan, 100],
        'feature_3': ['A', 'B', 'C', np.nan, 'E', 'F', np.nan, 'H', 'I', 'J'],
        'target': [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
    })
    df_missing.to_csv('/home/erikwilliams/dev/ml-insights-hub/datasets/validation/dataset_with_missing_values.csv', index=False)
    
    # Dataset with outliers
    normal_data = np.random.normal(50, 10, 95)
    outliers = [150, 200, -50, -100, 300]  # Clear outliers
    outlier_data = np.concatenate([normal_data, outliers])
    
    df_outliers = pd.DataFrame({
        'normal_feature': np.random.normal(10, 2, 100),
        'outlier_feature': outlier_data,
        'target': np.random.normal(1000, 100, 100)
    })
    df_outliers.to_csv('/home/erikwilliams/dev/ml-insights-hub/datasets/validation/dataset_with_outliers.csv', index=False)
    
    # Dataset with duplicate rows
    base_data = pd.DataFrame({
        'feature_1': range(50),
        'feature_2': np.random.normal(0, 1, 50),
        'target': np.random.normal(100, 10, 50)
    })
    
    # Add some duplicate rows
    duplicates = base_data.iloc[[5, 10, 15, 20, 25]].copy()
    df_duplicates = pd.concat([base_data, duplicates], ignore_index=True)
    df_duplicates.to_csv('/home/erikwilliams/dev/ml-insights-hub/datasets/validation/dataset_with_duplicates.csv', index=False)
    
    print("Data validation test files created!")

def create_dataset_metadata():
    """Create metadata files for all datasets"""
    print("Creating dataset metadata...")
    
    metadata = {
        'datasets': [
            {
                'name': 'Real Estate Properties',
                'file': 'real_estate/properties_dataset.csv',
                'description': 'Comprehensive real estate dataset with property features, location data, and pricing information',
                'type': 'regression',
                'target_column': 'actual_price',
                'features': ['bedrooms', 'bathrooms', 'sqft', 'year_built', 'school_rating', 'crime_rate', 'walkability_score'],
                'size': '5000 records',
                'use_cases': ['price prediction', 'feature importance analysis', 'market trend analysis']
            },
            {
                'name': 'ML Regression Sample',
                'file': 'sample_ml/regression_dataset.csv',
                'description': 'Synthetic regression dataset for testing ML algorithms',
                'type': 'regression',
                'target_column': 'target',
                'features': ['feature_1', 'feature_2', 'feature_3', 'feature_4', 'feature_5'],
                'size': '2000 records',
                'use_cases': ['algorithm testing', 'regression analysis', 'model comparison']
            },
            {
                'name': 'ML Classification Sample',
                'file': 'sample_ml/classification_dataset.csv',
                'description': 'Multi-class classification dataset for ML testing',
                'type': 'classification',
                'target_column': 'target',
                'features': ['feature_1', 'feature_2', 'feature_3', 'feature_4', 'feature_5'],
                'size': '2000 records',
                'use_cases': ['classification testing', 'feature selection', 'model evaluation']
            },
            {
                'name': 'Time Series Data',
                'file': 'sample_ml/timeseries_dataset.csv',
                'description': 'Time series data with trend and seasonal components',
                'type': 'time_series',
                'target_column': 'value',
                'features': ['date', 'trend', 'seasonal'],
                'size': '1000 records',
                'use_cases': ['time series forecasting', 'trend analysis', 'seasonal decomposition']
            },
            {
                'name': 'Clustering Sample',
                'file': 'sample_ml/clustering_dataset.csv',
                'description': 'Unsupervised learning dataset for clustering algorithms',
                'type': 'clustering',
                'target_column': 'true_cluster',
                'features': ['x1', 'x2'],
                'size': '1500 records',
                'use_cases': ['clustering analysis', 'unsupervised learning', 'pattern discovery']
            }
        ],
        'upload_samples': [
            {
                'name': 'Sample Property Upload',
                'file': 'sample_ml/sample_upload_properties.csv',
                'description': 'Small property dataset for testing upload functionality',
                'size': '100 records'
            },
            {
                'name': 'Feature Importance Sample',
                'file': 'sample_ml/feature_importance_sample.csv',
                'description': 'Dataset designed to test feature importance algorithms',
                'size': '500 records'
            }
        ],
        'validation_datasets': [
            {
                'name': 'Missing Values Test',
                'file': 'validation/dataset_with_missing_values.csv',
                'description': 'Dataset with intentional missing values for testing data cleaning',
                'issues': ['missing_values']
            },
            {
                'name': 'Outliers Test',
                'file': 'validation/dataset_with_outliers.csv',
                'description': 'Dataset with outliers for testing data preprocessing',
                'issues': ['outliers']
            },
            {
                'name': 'Duplicates Test',
                'file': 'validation/dataset_with_duplicates.csv',
                'description': 'Dataset with duplicate rows for testing data deduplication',
                'issues': ['duplicates']
            }
        ]
    }
    
    with open('/home/erikwilliams/dev/ml-insights-hub/datasets/datasets_metadata.json', 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print("Dataset metadata created!")

def main():
    """Main function to generate all required data"""
    print("🚀 Starting ML Insights Hub Data Generation...")
    print("=" * 60)
    
    # Create directory structure
    create_datasets_directory()
    
    # Generate datasets
    print("\n📊 Generating datasets...")
    real_estate_df = generate_real_estate_dataset(5000)
    generate_ml_sample_datasets()
    generate_sample_data_for_upload()
    create_data_validation_files()
    create_dataset_metadata()
    
    print("\n✅ Data generation completed successfully!")
    print("=" * 60)
    print("Generated datasets:")
    print("📁 /datasets/real_estate/ - Real estate property data")
    print("📁 /datasets/sample_ml/ - ML algorithm testing datasets")
    print("📁 /datasets/validation/ - Data quality testing datasets")
    print("📄 /datasets/datasets_metadata.json - Dataset descriptions")
    print("\n🎯 Your ML Insights Hub is now ready with comprehensive data!")

if __name__ == "__main__":
    main()
