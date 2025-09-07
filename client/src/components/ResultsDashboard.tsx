import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, AreaChart, Area } from 'recharts';
import { usePrediction } from '../hooks/usePrediction';
import './ResultsDashboard.css';

interface DashboardData {
    predictions: Array<{
        id: string;
        timestamp: string;
        modelType: string;
        prediction: number;
        confidence: number;
        features: any;
    }>;
    summary: {
        totalPredictions: number;
        avgPrediction: number;
        avgConfidence: number;
        mostUsedModel: string;
    };
    trends: Array<{
        date: string;
        predictions: number;
        avgPrice: number;
    }>;
}

const ResultsDashboard: React.FC = () => {
    const { history, loading, error } = usePrediction();
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
    const [activeMetric, setActiveMetric] = useState<'predictions' | 'accuracy' | 'models'>('predictions');

    const generateDashboardData = useCallback(() => {
        // Generate demo data for the dashboard
        const now = new Date();
        const demoData: DashboardData = {
            predictions: Array.from({ length: 20 }, (_, i) => ({
                id: `pred_${i}`,
                timestamp: new Date(now.getTime() - i * 3600000).toISOString(),
                modelType: ['random_forest', 'linear_regression', 'neural_network'][Math.floor(Math.random() * 3)],
                prediction: Math.floor(Math.random() * 500000) + 300000,
                confidence: Math.random() * 0.3 + 0.7,
                features: {
                    bedrooms: Math.floor(Math.random() * 4) + 2,
                    bathrooms: Math.floor(Math.random() * 3) + 1,
                    sqft: Math.floor(Math.random() * 2000) + 1000,
                }
            })),
            summary: {
                totalPredictions: 1247,
                avgPrediction: 587450,
                avgConfidence: 0.847,
                mostUsedModel: 'Random Forest',
            },
            trends: Array.from({ length: 30 }, (_, i) => ({
                date: new Date(now.getTime() - i * 24 * 3600000).toLocaleDateString(),
                predictions: Math.floor(Math.random() * 50) + 10,
                avgPrice: Math.floor(Math.random() * 100000) + 500000,
            })).reverse(),
        };

        // Add actual prediction history if available
        if (history.length > 0) {
            const actualPredictions = history.map((pred, i) => ({
                id: `actual_${i}`,
                timestamp: new Date().toISOString(),
                modelType: pred.prediction.model_type,
                prediction: pred.prediction.prediction.point_estimate,
                confidence: pred.prediction.prediction.confidence_level,
                features: pred.prediction.property_features,
            }));

            demoData.predictions = [...actualPredictions, ...demoData.predictions].slice(0, 20);
            demoData.summary.totalPredictions += history.length;
        }

        setDashboardData(demoData);
    }, [history]);

    useEffect(() => {
        generateDashboardData();
    }, [generateDashboardData, timeRange]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const formatTimestamp = (timestamp: string) => {
        return new Date(timestamp).toLocaleString();
    };

    const getModelUsageData = () => {
        if (!dashboardData) return [];

        const usage = dashboardData.predictions.reduce((acc, pred) => {
            acc[pred.modelType] = (acc[pred.modelType] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(usage).map(([model, count]) => ({
            model: model.replace('_', ' ').toUpperCase(),
            count,
        }));
    };

    const getAccuracyTrends = () => {
        if (!dashboardData) return [];

        return dashboardData.predictions.slice(0, 10).map((pred, i) => ({
            prediction: i + 1,
            confidence: (pred.confidence * 100).toFixed(1),
        })).reverse();
    };

    if (loading) {
        return (
            <div className="dashboard-container">
                <div className="loading-state">
                    <div className="spinner"></div>
                    <p>Loading dashboard data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="dashboard-container">
                <div className="error-state">
                    <h3>❌ Dashboard Error</h3>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    if (!dashboardData) {
        return (
            <div className="dashboard-container">
                <div className="empty-state">
                    <h3>📊 No Data Available</h3>
                    <p>Start making predictions to see your dashboard!</p>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <h2>📊 Results Dashboard</h2>
                <div className="dashboard-controls">
                    <div className="time-range-selector">
                        <button
                            className={`time-btn ${timeRange === '24h' ? 'active' : ''}`}
                            onClick={() => setTimeRange('24h')}
                        >
                            24H
                        </button>
                        <button
                            className={`time-btn ${timeRange === '7d' ? 'active' : ''}`}
                            onClick={() => setTimeRange('7d')}
                        >
                            7D
                        </button>
                        <button
                            className={`time-btn ${timeRange === '30d' ? 'active' : ''}`}
                            onClick={() => setTimeRange('30d')}
                        >
                            30D
                        </button>
                    </div>
                </div>
            </div>

            <div className="summary-cards">
                <div className="summary-card">
                    <div className="card-icon">🎯</div>
                    <div className="card-content">
                        <div className="card-value">{dashboardData.summary.totalPredictions}</div>
                        <div className="card-label">Total Predictions</div>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="card-icon">💰</div>
                    <div className="card-content">
                        <div className="card-value">{formatCurrency(dashboardData.summary.avgPrediction)}</div>
                        <div className="card-label">Avg Prediction</div>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="card-icon">📈</div>
                    <div className="card-content">
                        <div className="card-value">{(dashboardData.summary.avgConfidence * 100).toFixed(1)}%</div>
                        <div className="card-label">Avg Confidence</div>
                    </div>
                </div>

                <div className="summary-card">
                    <div className="card-icon">🤖</div>
                    <div className="card-content">
                        <div className="card-value">{dashboardData.summary.mostUsedModel}</div>
                        <div className="card-label">Top Model</div>
                    </div>
                </div>
            </div>

            <div className="chart-section">
                <div className="chart-controls">
                    <button
                        className={`metric-btn ${activeMetric === 'predictions' ? 'active' : ''}`}
                        onClick={() => setActiveMetric('predictions')}
                    >
                        📊 Prediction Trends
                    </button>
                    <button
                        className={`metric-btn ${activeMetric === 'accuracy' ? 'active' : ''}`}
                        onClick={() => setActiveMetric('accuracy')}
                    >
                        🎯 Accuracy Trends
                    </button>
                    <button
                        className={`metric-btn ${activeMetric === 'models' ? 'active' : ''}`}
                        onClick={() => setActiveMetric('models')}
                    >
                        🤖 Model Usage
                    </button>
                </div>

                <div className="chart-container">
                    {activeMetric === 'predictions' && (
                        <ResponsiveContainer width="100%" height={400}>
                            <AreaChart data={dashboardData.trends}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip
                                    formatter={(value, name) => [
                                        name === 'avgPrice' ? formatCurrency(Number(value)) : value,
                                        name === 'avgPrice' ? 'Avg Price' : 'Predictions'
                                    ]}
                                />
                                <Legend />
                                <Area
                                    type="monotone"
                                    dataKey="predictions"
                                    stackId="1"
                                    stroke="#667eea"
                                    fill="#667eea"
                                    fillOpacity={0.6}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}

                    {activeMetric === 'accuracy' && (
                        <ResponsiveContainer width="100%" height={400}>
                            <LineChart data={getAccuracyTrends()}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="prediction" />
                                <YAxis domain={[70, 100]} />
                                <Tooltip formatter={(value) => [`${value}%`, 'Confidence']} />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="confidence"
                                    stroke="#764ba2"
                                    strokeWidth={3}
                                    dot={{ fill: '#764ba2', strokeWidth: 2, r: 5 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}

                    {activeMetric === 'models' && (
                        <ResponsiveContainer width="100%" height={400}>
                            <BarChart data={getModelUsageData()}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="model" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="count" fill="#f093fb" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            <div className="recent-predictions">
                <h3>🕐 Recent Predictions</h3>
                <div className="predictions-table">
                    <div className="table-header">
                        <div className="header-cell">Timestamp</div>
                        <div className="header-cell">Model</div>
                        <div className="header-cell">Prediction</div>
                        <div className="header-cell">Confidence</div>
                        <div className="header-cell">Property</div>
                    </div>
                    <div className="table-body">
                        {dashboardData.predictions.slice(0, 8).map((pred) => (
                            <div key={pred.id} className="table-row">
                                <div className="table-cell">
                                    {formatTimestamp(pred.timestamp)}
                                </div>
                                <div className="table-cell">
                                    <span className="model-badge">{pred.modelType.replace('_', ' ')}</span>
                                </div>
                                <div className="table-cell prediction-value">
                                    {formatCurrency(pred.prediction)}
                                </div>
                                <div className="table-cell">
                                    <div className="confidence-bar">
                                        <div
                                            className="confidence-fill"
                                            style={{ width: `${pred.confidence * 100}%` }}
                                        ></div>
                                        <span className="confidence-text">
                                            {(pred.confidence * 100).toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                                <div className="table-cell">
                                    {pred.features.bedrooms}BR/{pred.features.bathrooms}BA, {pred.features.sqft?.toLocaleString()}sq ft
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResultsDashboard;
