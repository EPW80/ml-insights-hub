// API Service for ML Insights Hub
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Types for API responses
export interface PredictionRequest {
  features: {
    bedrooms: number;
    bathrooms: number;
    sqft: number;
    year_built?: number;
    lot_size?: number;
    school_rating?: number;
    crime_rate?: number;
    walkability_score?: number;
  };
  modelType:
    | "linear_regression"
    | "random_forest"
    | "neural_network"
    | "gradient_boosting";
  uncertaintyMethod?: "ensemble" | "bootstrap" | "quantile" | "bayesian";
}

export interface PredictionResponse {
  success: boolean;
  prediction: {
    property_features: any;
    model_type: string;
    prediction: {
      point_estimate: number;
      lower_bound: number;
      upper_bound: number;
      confidence_level: number;
      uncertainty_metrics: any;
    };
    feature_importance: any[];
    _id: string;
    createdAt: string;
    updatedAt: string;
  };
  execution_time: number;
}

export interface PropertyData {
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  year_built: number;
  lot_size: number;
  school_rating: number;
  crime_rate: number;
  walkability_score: number;
  actual_price: number;
  location_zipcode: string;
  property_type: string;
}

// API functions
export const apiService = {
  // ML Prediction
  async makePrediction(
    request: PredictionRequest
  ): Promise<PredictionResponse> {
    const response = await fetch(`${API_BASE_URL}/api/ml/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "Network error" }));
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`
      );
    }

    return response.json();
  },

  // Data Upload
  async uploadData(file: File): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE_URL}/api/data/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "Upload failed" }));
      throw new Error(errorData.error || `Upload failed: ${response.status}`);
    }

    return response.json();
  },

  // Get property data for visualization
  async getPropertyData(limit: number = 100): Promise<PropertyData[]> {
    const response = await fetch(
      `${API_BASE_URL}/api/data/properties?limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch property data: ${response.status}`);
    }

    const data = await response.json();
    return data.properties || [];
  },

  // Get prediction history
  async getPredictionHistory(limit: number = 50): Promise<any[]> {
    const response = await fetch(
      `${API_BASE_URL}/api/ml/predictions?limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch prediction history: ${response.status}`);
    }

    const data = await response.json();
    return data.predictions || [];
  },

  // Get data summary statistics
  async getDataSummary(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/data/summary`);

    if (!response.ok) {
      throw new Error(`Failed to fetch data summary: ${response.status}`);
    }

    return response.json();
  },
};

export default apiService;
