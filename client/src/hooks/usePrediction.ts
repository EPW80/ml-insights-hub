import { useState, useCallback } from "react";
import {
  apiService,
  PredictionRequest,
  PredictionResponse,
} from "../services/api";

export interface UsePredictionState {
  prediction: PredictionResponse | null;
  loading: boolean;
  error: string | null;
  history: PredictionResponse[];
}

export const usePrediction = () => {
  const [state, setState] = useState<UsePredictionState>({
    prediction: null,
    loading: false,
    error: null,
    history: [],
  });

  const makePrediction = useCallback(async (request: PredictionRequest) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const result = await apiService.makePrediction(request);
      setState((prev) => ({
        ...prev,
        prediction: result,
        loading: false,
        history: [result, ...prev.history].slice(0, 10), // Keep last 10 predictions
      }));
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Prediction failed";
      setState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const clearHistory = useCallback(() => {
    setState((prev) => ({ ...prev, history: [] }));
  }, []);

  return {
    ...state,
    makePrediction,
    clearError,
    clearHistory,
  };
};

export default usePrediction;
