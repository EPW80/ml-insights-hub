import React, { useState, FormEvent } from 'react';
import { usePrediction } from '../hooks/usePrediction';
import { PredictionRequest } from '../services/api';
import './MLPredictionForm.css';

const MLPredictionForm: React.FC = () => {
    const { makePrediction, loading, error, clearError } = usePrediction();

    const [formData, setFormData] = useState({
        bedrooms: 3,
        bathrooms: 2,
        sqft: 1500,
        year_built: 2000,
        lot_size: 6000,
        school_rating: 7.5,
        crime_rate: 3.2,
        walkability_score: 75,
        modelType: 'random_forest' as const,
        uncertaintyMethod: 'bootstrap' as const,
    });

    const [displayValues, setDisplayValues] = useState<Record<string, string>>({
        bedrooms: '3',
        bathrooms: '2',
        sqft: '1500',
        year_built: '2000',
        lot_size: '6000',
        school_rating: '7.5',
        crime_rate: '3.2',
        walkability_score: '75',
    });

    const [result, setResult] = useState<any>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;

        if (name === 'modelType' || name === 'uncertaintyMethod') {
            setFormData(prev => ({ ...prev, [name]: value }));
            return;
        }

        // Always update display so the user can type freely
        setDisplayValues(prev => ({ ...prev, [name]: value }));

        // Only sync to numeric formData when the value is a valid number
        const parsed = parseFloat(value);
        if (!Number.isNaN(parsed)) {
            setFormData(prev => ({ ...prev, [name]: parsed }));
        }
    };

    const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const parsed = parseFloat(value);
        // On blur, snap back to the last valid numeric value if field is empty/invalid
        if (Number.isNaN(parsed)) {
            setDisplayValues(prev => ({
                ...prev,
                [name]: String(formData[name as keyof typeof formData]),
            }));
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        clearError();

        try {
            const request: PredictionRequest = {
                features: {
                    bedrooms: formData.bedrooms,
                    bathrooms: formData.bathrooms,
                    sqft: formData.sqft,
                    year_built: formData.year_built,
                    lot_size: formData.lot_size,
                    school_rating: formData.school_rating,
                    crime_rate: formData.crime_rate,
                    walkability_score: formData.walkability_score,
                },
                modelType: formData.modelType,
                uncertaintyMethod: formData.uncertaintyMethod,
            };

            const prediction = await makePrediction(request);
            setResult(prediction);
        } catch (err) {
            console.error('Prediction failed:', err);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    return (
        <div className="ml-prediction-form">
            <div className="form-container">
                <h2><span aria-hidden="true">🏠</span> Property Price Prediction</h2>

                <form onSubmit={handleSubmit} className="prediction-form" aria-label="Property price prediction form">
                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="bedrooms">Bedrooms</label>
                            <input
                                type="number"
                                id="bedrooms"
                                name="bedrooms"
                                value={displayValues.bedrooms}
                                onChange={handleInputChange}
                                onBlur={handleInputBlur}
                                min="1"
                                max="10"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="bathrooms">Bathrooms</label>
                            <input
                                type="number"
                                id="bathrooms"
                                name="bathrooms"
                                value={displayValues.bathrooms}
                                onChange={handleInputChange}
                                onBlur={handleInputBlur}
                                min="1"
                                max="10"
                                step="0.5"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="sqft">Square Feet</label>
                            <input
                                type="number"
                                id="sqft"
                                name="sqft"
                                value={displayValues.sqft}
                                onChange={handleInputChange}
                                onBlur={handleInputBlur}
                                min="500"
                                max="10000"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="year_built">Year Built</label>
                            <input
                                type="number"
                                id="year_built"
                                name="year_built"
                                value={displayValues.year_built}
                                onChange={handleInputChange}
                                onBlur={handleInputBlur}
                                min="1900"
                                max="2024"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="lot_size">Lot Size (sq ft)</label>
                            <input
                                type="number"
                                id="lot_size"
                                name="lot_size"
                                value={displayValues.lot_size}
                                onChange={handleInputChange}
                                onBlur={handleInputBlur}
                                min="1000"
                                max="50000"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="school_rating">School Rating (1-10)</label>
                            <input
                                type="number"
                                id="school_rating"
                                name="school_rating"
                                value={displayValues.school_rating}
                                onChange={handleInputChange}
                                onBlur={handleInputBlur}
                                min="1"
                                max="10"
                                step="0.1"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="crime_rate">Crime Rate (1-10)</label>
                            <input
                                type="number"
                                id="crime_rate"
                                name="crime_rate"
                                value={displayValues.crime_rate}
                                onChange={handleInputChange}
                                onBlur={handleInputBlur}
                                min="1"
                                max="10"
                                step="0.1"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="walkability_score">Walkability Score (0-100)</label>
                            <input
                                type="number"
                                id="walkability_score"
                                name="walkability_score"
                                value={displayValues.walkability_score}
                                onChange={handleInputChange}
                                onBlur={handleInputBlur}
                                min="0"
                                max="100"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="modelType">ML Model</label>
                            <select
                                id="modelType"
                                name="modelType"
                                value={formData.modelType}
                                onChange={handleInputChange}
                                required
                            >
                                <option value="random_forest">Random Forest</option>
                                <option value="linear_regression">Linear Regression</option>
                                <option value="neural_network">Neural Network</option>
                                <option value="gradient_boosting">Gradient Boosting</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="uncertaintyMethod">Uncertainty Method</label>
                            <select
                                id="uncertaintyMethod"
                                name="uncertaintyMethod"
                                value={formData.uncertaintyMethod}
                                onChange={handleInputChange}
                            >
                                <option value="bootstrap">Bootstrap</option>
                                <option value="ensemble">Ensemble</option>
                                <option value="quantile">Quantile</option>
                                <option value="bayesian">Bayesian</option>
                            </select>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="predict-button"
                        disabled={loading}
                        aria-busy={loading}
                    >
                        {loading ? <><span aria-hidden="true">🔄</span> Predicting...</> : <><span aria-hidden="true">🎯</span> Get Price Prediction</>}
                    </button>
                </form>

                {error && (
                    <div className="error-message" role="alert" aria-live="assertive">
                        <span><span aria-hidden="true">❌</span> {error}</span>
                        <button onClick={clearError} className="close-error" aria-label="Close error message">×</button>
                    </div>
                )}
            </div>

            {result && (
                <div className="results-container" role="region" aria-label="Prediction results" aria-live="polite">
                    <h3><span aria-hidden="true">📊</span> Prediction Results</h3>
                    <div className="results-grid">
                        <div className="result-card main-prediction">
                            <h4><span aria-hidden="true">💰</span> Estimated Price</h4>
                            <div className="price-estimate" aria-label={`Estimated price: ${formatCurrency(result.prediction.prediction.point_estimate)}`}>
                                {formatCurrency(result.prediction.prediction.point_estimate)}
                            </div>
                            <div className="confidence-interval">
                                Confidence Interval (95%): {formatCurrency(result.prediction.prediction.lower_bound)} - {formatCurrency(result.prediction.prediction.upper_bound)}
                            </div>
                        </div>

                        <div className="result-card">
                            <h4><span aria-hidden="true">🤖</span> Model Used</h4>
                            <p>{result.prediction.model_type.replace('_', ' ').toUpperCase()}</p>
                        </div>

                        <div className="result-card">
                            <h4><span aria-hidden="true">⏱️</span> Execution Time</h4>
                            <p>{result.execution_time}ms</p>
                        </div>

                        <div className="result-card">
                            <h4><span aria-hidden="true">📈</span> Confidence Level</h4>
                            <p>{(result.prediction.prediction.confidence_level * 100).toFixed(1)}%</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MLPredictionForm;
