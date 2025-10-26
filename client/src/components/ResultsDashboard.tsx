import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, AreaChart, Area, ComposedChart, Brush, ReferenceLine, RadarChart,
    PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
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
    const [activeMetric, setActiveMetric] = useState<'predictions' | 'accuracy' | 'models' | 'performance'>('predictions');
    const syncId = 'dashboard-sync';
    const [showAnimations, setShowAnimations] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const chartContainerRef = useRef<HTMLDivElement>(null);

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

    // New: Get performance radar data
    const getPerformanceRadar = () => {
        if (!dashboardData) return [];

        const modelTypes = ['Random Forest', 'Linear Regression', 'Neural Network'];
        return modelTypes.map(model => ({
            model,
            accuracy: 75 + Math.random() * 20,
            speed: 60 + Math.random() * 30,
            reliability: 70 + Math.random() * 25,
            efficiency: 65 + Math.random() * 30,
        }));
    };

    // New: Custom tooltip component
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="custom-tooltip">
                    <p className="tooltip-label">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={index} className="tooltip-entry" style={{ color: entry.color }}>
                            <span className="tooltip-name">{entry.name}:</span>{' '}
                            <span className="tooltip-value">
                                {entry.name.includes('Price') || entry.name.includes('avgPrice')
                                    ? `$${Number(entry.value).toLocaleString()}`
                                    : entry.value}
                            </span>
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    // New: Toggle fullscreen
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            chartContainerRef.current?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    // New: Export dashboard data
    const exportDashboardData = () => {
        if (!dashboardData) return;
        const dataStr = JSON.stringify(dashboardData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dashboard-data-${new Date().toISOString()}.json`;
        link.click();
        URL.revokeObjectURL(url);
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
                    <button
                        className={`metric-btn ${activeMetric === 'performance' ? 'active' : ''}`}
                        onClick={() => setActiveMetric('performance')}
                    >
                        ⚡ Performance
                    </button>
                </div>

                <div className="interactive-controls">
                    <div className="control-group">
                        <label className="control-label">
                            <input
                                type="checkbox"
                                checked={showAnimations}
                                onChange={(e) => setShowAnimations(e.target.checked)}
                            />
                            <span>Animations</span>
                        </label>
                    </div>
                    <div className="control-group">
                        <button onClick={toggleFullscreen} className="control-button">
                            {isFullscreen ? '⤓' : '⤢'} Fullscreen
                        </button>
                    </div>
                    <div className="control-group">
                        <button onClick={exportDashboardData} className="control-button">
                            📥 Export Data
                        </button>
                    </div>
                </div>

                <div className="chart-container" ref={chartContainerRef}>
                    {activeMetric === 'predictions' && (
                        <ResponsiveContainer width="100%" height={400}>
                            <AreaChart data={dashboardData.trends} syncId={syncId}>
                                <defs>
                                    <linearGradient id="predGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#667eea" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#667eea" stopOpacity={0.1} />
                                    </linearGradient>
                                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f093fb" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#f093fb" stopOpacity={0.1} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                <XAxis dataKey="date" stroke="#666" angle={-15} textAnchor="end" height={80} />
                                <YAxis stroke="#666" />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                <Area
                                    type="monotone"
                                    dataKey="predictions"
                                    stroke="#667eea"
                                    fill="url(#predGradient)"
                                    animationDuration={showAnimations ? 1000 : 0}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="avgPrice"
                                    stroke="#f093fb"
                                    fill="url(#priceGradient)"
                                    animationDuration={showAnimations ? 1000 : 0}
                                />
                                <Brush dataKey="date" height={30} stroke="#667eea" />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}

                    {activeMetric === 'accuracy' && (
                        <ResponsiveContainer width="100%" height={400}>
                            <ComposedChart data={getAccuracyTrends()} syncId={syncId}>
                                <defs>
                                    <linearGradient id="accuracyGradient" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#764ba2" />
                                        <stop offset="100%" stopColor="#667eea" />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                <XAxis dataKey="prediction" stroke="#666" />
                                <YAxis domain={[70, 100]} stroke="#666" />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                <ReferenceLine y={85} stroke="#f5576c" strokeDasharray="3 3" label="Target" />
                                <Line
                                    type="monotone"
                                    dataKey="confidence"
                                    stroke="url(#accuracyGradient)"
                                    strokeWidth={3}
                                    dot={{ fill: '#764ba2', strokeWidth: 2, r: 6 }}
                                    activeDot={{ r: 8, stroke: '#667eea', strokeWidth: 2 }}
                                    animationDuration={showAnimations ? 1000 : 0}
                                />
                                <Bar
                                    dataKey="confidence"
                                    fill="#667eea"
                                    fillOpacity={0.3}
                                    radius={[8, 8, 0, 0]}
                                    animationDuration={showAnimations ? 1000 : 0}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    )}

                    {activeMetric === 'models' && (
                        <ResponsiveContainer width="100%" height={400}>
                            <BarChart data={getModelUsageData()}>
                                <defs>
                                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#f093fb" stopOpacity={0.8} />
                                        <stop offset="100%" stopColor="#f5576c" stopOpacity={0.8} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                                <XAxis dataKey="model" stroke="#666" />
                                <YAxis stroke="#666" />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                <Bar
                                    dataKey="count"
                                    fill="url(#barGradient)"
                                    radius={[8, 8, 0, 0]}
                                    animationDuration={showAnimations ? 1000 : 0}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    )}

                    {activeMetric === 'performance' && (
                        <ResponsiveContainer width="100%" height={400}>
                            <RadarChart data={getPerformanceRadar()}>
                                <PolarGrid stroke="#e0e0e0" />
                                <PolarAngleAxis dataKey="model" stroke="#666" />
                                <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#666" />
                                <Radar
                                    name="Accuracy"
                                    dataKey="accuracy"
                                    stroke="#667eea"
                                    fill="#667eea"
                                    fillOpacity={0.6}
                                    animationDuration={showAnimations ? 1000 : 0}
                                />
                                <Radar
                                    name="Speed"
                                    dataKey="speed"
                                    stroke="#f093fb"
                                    fill="#f093fb"
                                    fillOpacity={0.6}
                                    animationDuration={showAnimations ? 1000 : 0}
                                />
                                <Radar
                                    name="Reliability"
                                    dataKey="reliability"
                                    stroke="#4facfe"
                                    fill="#4facfe"
                                    fillOpacity={0.6}
                                    animationDuration={showAnimations ? 1000 : 0}
                                />
                                <Legend />
                                <Tooltip content={<CustomTooltip />} />
                            </RadarChart>
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
