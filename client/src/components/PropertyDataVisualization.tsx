import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { PropertyData } from '../services/api';
import './PropertyDataVisualization.css';

const COLORS = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'];

const PropertyDataVisualization: React.FC = () => {
    const [data, setData] = useState<PropertyData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeChart, setActiveChart] = useState<'price_distribution' | 'size_vs_price' | 'property_types' | 'trends'>('price_distribution');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            // For demo purposes, we'll generate some sample data since the API endpoint might not exist yet
            const sampleData: PropertyData[] = Array.from({ length: 100 }, (_, i) => ({
                bedrooms: Math.floor(Math.random() * 5) + 1,
                bathrooms: Math.floor(Math.random() * 4) + 1,
                sqft: Math.floor(Math.random() * 3000) + 800,
                year_built: Math.floor(Math.random() * 50) + 1970,
                lot_size: Math.floor(Math.random() * 10000) + 3000,
                school_rating: Math.random() * 5 + 5,
                crime_rate: Math.random() * 5 + 1,
                walkability_score: Math.floor(Math.random() * 40) + 60,
                actual_price: Math.floor(Math.random() * 800000) + 300000,
                location_zipcode: `${Math.floor(Math.random() * 99999) + 10000}`,
                property_type: ['Single Family', 'Condo', 'Townhouse'][Math.floor(Math.random() * 3)],
            }));

            setData(sampleData);

            // Uncomment this when the API endpoint is available
            // const fetchedData = await apiService.getPropertyData(200);
            // setData(fetchedData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const getPriceDistribution = () => {
        const ranges = [
            { range: '$200K-$400K', min: 200000, max: 400000 },
            { range: '$400K-$600K', min: 400000, max: 600000 },
            { range: '$600K-$800K', min: 600000, max: 800000 },
            { range: '$800K-$1M', min: 800000, max: 1000000 },
            { range: '$1M+', min: 1000000, max: Infinity },
        ];

        return ranges.map(({ range, min, max }) => ({
            range,
            count: data.filter(p => p.actual_price >= min && p.actual_price < max).length,
        }));
    };

    const getPropertyTypeDistribution = () => {
        const types = data.reduce((acc, property) => {
            acc[property.property_type] = (acc[property.property_type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(types).map(([name, value]) => ({ name, value }));
    };

    const getPriceTrends = () => {
        const trends = data
            .sort((a, b) => a.year_built - b.year_built)
            .reduce((acc, property) => {
                const decade = Math.floor(property.year_built / 10) * 10;
                const key = `${decade}s`;
                if (!acc[key]) {
                    acc[key] = { decade: key, prices: [] };
                }
                acc[key].prices.push(property.actual_price);
                return acc;
            }, {} as Record<string, { decade: string; prices: number[] }>);

        return Object.values(trends).map(({ decade, prices }) => ({
            decade,
            avgPrice: Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length),
            count: prices.length,
        }));
    };

    const renderChart = () => {
        switch (activeChart) {
            case 'price_distribution':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={getPriceDistribution()}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="range" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="count" fill="#667eea" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'size_vs_price':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <ScatterChart data={data.slice(0, 50)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="sqft" name="Square Feet" />
                            <YAxis dataKey="actual_price" name="Price" />
                            <Tooltip cursor={{ strokeDasharray: '3 3' }}
                                formatter={(value, name) => [
                                    name === 'actual_price' ? `$${value.toLocaleString()}` : value,
                                    name === 'actual_price' ? 'Price' : 'Square Feet'
                                ]}
                            />
                            <Scatter dataKey="actual_price" fill="#764ba2" />
                        </ScatterChart>
                    </ResponsiveContainer>
                );

            case 'property_types':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <PieChart>
                            <Pie
                                data={getPropertyTypeDistribution()}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={120}
                                label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                            >
                                {getPropertyTypeDistribution().map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                );

            case 'trends':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={getPriceTrends()}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="decade" />
                            <YAxis />
                            <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, 'Average Price']} />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="avgPrice"
                                stroke="#667eea"
                                strokeWidth={3}
                                dot={{ fill: '#667eea', strokeWidth: 2, r: 6 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                );

            default:
                return null;
        }
    };

    if (loading) {
        return (
            <div className="visualization-container">
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>Loading property data...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="visualization-container">
                <div className="error-state">
                    <h3>❌ Error Loading Data</h3>
                    <p>{error}</p>
                    <button onClick={loadData} className="retry-button">
                        🔄 Retry
                    </button>
                </div>
            </div>
        );
    }

    const stats = {
        totalProperties: data.length,
        avgPrice: Math.round(data.reduce((sum, p) => sum + p.actual_price, 0) / data.length),
        avgSqft: Math.round(data.reduce((sum, p) => sum + p.sqft, 0) / data.length),
        avgSchoolRating: (data.reduce((sum, p) => sum + p.school_rating, 0) / data.length).toFixed(1),
    };

    return (
        <div className="visualization-container">
            <div className="visualization-header">
                <h2>📊 Property Data Insights</h2>
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-value">{stats.totalProperties}</div>
                        <div className="stat-label">Total Properties</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">${stats.avgPrice.toLocaleString()}</div>
                        <div className="stat-label">Average Price</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{stats.avgSqft.toLocaleString()}</div>
                        <div className="stat-label">Average Sq Ft</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{stats.avgSchoolRating}/10</div>
                        <div className="stat-label">Avg School Rating</div>
                    </div>
                </div>
            </div>

            <div className="chart-controls">
                <button
                    className={`chart-tab ${activeChart === 'price_distribution' ? 'active' : ''}`}
                    onClick={() => setActiveChart('price_distribution')}
                >
                    📈 Price Distribution
                </button>
                <button
                    className={`chart-tab ${activeChart === 'size_vs_price' ? 'active' : ''}`}
                    onClick={() => setActiveChart('size_vs_price')}
                >
                    📏 Size vs Price
                </button>
                <button
                    className={`chart-tab ${activeChart === 'property_types' ? 'active' : ''}`}
                    onClick={() => setActiveChart('property_types')}
                >
                    🏠 Property Types
                </button>
                <button
                    className={`chart-tab ${activeChart === 'trends' ? 'active' : ''}`}
                    onClick={() => setActiveChart('trends')}
                >
                    📊 Price Trends
                </button>
            </div>

            <div className="chart-container">
                {renderChart()}
            </div>

            <div className="refresh-section">
                <button onClick={loadData} className="refresh-button">
                    🔄 Refresh Data
                </button>
            </div>
        </div>
    );
};

export default PropertyDataVisualization;
