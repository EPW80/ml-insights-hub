// API Service for ML Insights Hub
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Token storage key
const TOKEN_KEY = "ml_insights_token";

// Token management
export const tokenManager = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  },
};

// Helper to build headers with auth token
function getAuthHeaders(contentType?: string): HeadersInit {
  const headers: HeadersInit = {};
  if (contentType) {
    headers["Content-Type"] = contentType;
  }
  const token = tokenManager.getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

// Auth types
export interface AuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

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
  // Auth - Register
  async register(request: RegisterRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: getAuthHeaders("application/json"),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Registration failed" }));
      throw new Error(
        errorData.error || errorData.details?.[0]?.msg || `Registration failed: ${response.status}`
      );
    }

    const data = await response.json();
    tokenManager.setToken(data.token);
    return data;
  },

  // Auth - Login
  async login(request: LoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: getAuthHeaders("application/json"),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Login failed" }));
      throw new Error(
        errorData.error || `Login failed: ${response.status}`
      );
    }

    const data = await response.json();
    tokenManager.setToken(data.token);
    return data;
  },

  // Auth - Logout
  logout(): void {
    tokenManager.clearToken();
  },

  // ML Prediction
  async makePrediction(
    request: PredictionRequest
  ): Promise<PredictionResponse> {
    const response = await fetch(`${API_BASE_URL}/api/ml/predict`, {
      method: "POST",
      headers: getAuthHeaders("application/json"),
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
      headers: getAuthHeaders(), // No Content-Type for FormData
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
      `${API_BASE_URL}/api/data/properties?limit=${limit}`,
      { headers: getAuthHeaders() }
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
      `${API_BASE_URL}/api/ml/predictions?limit=${limit}`,
      { headers: getAuthHeaders() }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch prediction history: ${response.status}`);
    }

    const data = await response.json();
    return data.predictions || [];
  },

  // Get data summary statistics
  async getDataSummary(): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/data/summary`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch data summary: ${response.status}`);
    }

    return response.json();
  },
};

export default apiService;
