import React, { useState, useEffect, useRef } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    ScatterChart, Scatter, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
    ComposedChart, RadialBarChart, RadialBar, Brush
} from 'recharts';
import { PropertyData } from '../services/api';
import './PropertyDataVisualization.css';

const COLORS = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'];

type ChartType = 'price_distribution' | 'size_vs_price' | 'property_types' | 'trends' |
                 'composed_analysis' | 'radial_metrics' | 'area_trends' | 'heatmap_correlation';

const PropertyDataVisualization: React.FC = () => {
    const [data, setData] = useState<PropertyData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeChart, setActiveChart] = useState<ChartType>('price_distribution');
    const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showAnimations, setShowAnimations] = useState(true);
    const [priceFilter, setPriceFilter] = useState<{ min: number; max: number }>({ min: 0, max: 2000000 });
    const syncId = 'chart-sync';
    const chartContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);

            // For demo purposes, we'll generate some sample data since the API endpoint might not exist yet
            const sampleData: PropertyData[] = Array.from({ length: 100 }, () => ({
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

    // New: Get composed analysis data
    const getComposedAnalysis = () => {
        const filteredData = data.filter(p => p.actual_price >= priceFilter.min && p.actual_price <= priceFilter.max);
        const analysis = filteredData
            .sort((a, b) => a.sqft - b.sqft)
            .reduce((acc, property) => {
                const sqftRange = Math.floor(property.sqft / 500) * 500;
                const key = `${sqftRange}-${sqftRange + 500}`;
                if (!acc[key]) {
                    acc[key] = { range: key, prices: [], ratings: [], counts: 0 };
                }
                acc[key].prices.push(property.actual_price);
                acc[key].ratings.push(property.school_rating);
                acc[key].counts += 1;
                return acc;
            }, {} as Record<string, { range: string; prices: number[]; ratings: number[]; counts: number }>);

        return Object.values(analysis).map(({ range, prices, ratings, counts }) => ({
            range,
            avgPrice: Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length),
            avgRating: parseFloat((ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1)),
            count: counts,
        })).slice(0, 10);
    };

    // New: Get radial metrics data
    const getRadialMetrics = () => {
        const metrics = [
            {
                name: 'Price Score',
                value: Math.round((data.reduce((sum, p) => sum + p.actual_price, 0) / data.length / 10000)),
                fill: '#667eea',
            },
            {
                name: 'School Rating',
                value: Math.round(data.reduce((sum, p) => sum + p.school_rating, 0) / data.length * 10),
                fill: '#764ba2',
            },
            {
                name: 'Walkability',
                value: Math.round(data.reduce((sum, p) => sum + p.walkability_score, 0) / data.length),
                fill: '#f093fb',
            },
            {
                name: 'Size Index',
                value: Math.round(data.reduce((sum, p) => sum + p.sqft, 0) / data.length / 30),
                fill: '#4facfe',
            },
        ];
        return metrics;
    };

    // New: Get area trends with multiple metrics
    const getAreaTrends = () => {
        const sorted = [...data].sort((a, b) => a.year_built - b.year_built);
        const yearGroups = sorted.reduce((acc, property) => {
            const year = property.year_built;
            if (!acc[year]) {
                acc[year] = { year, prices: [], ratings: [], walkability: [] };
            }
            acc[year].prices.push(property.actual_price);
            acc[year].ratings.push(property.school_rating);
            acc[year].walkability.push(property.walkability_score);
            return acc;
        }, {} as Record<number, { year: number; prices: number[]; ratings: number[]; walkability: number[] }>);

        return Object.values(yearGroups).map(({ year, prices, ratings, walkability }) => ({
            year: year.toString(),
            price: Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length / 1000),
            rating: parseFloat((ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1)),
            walkability: Math.round(walkability.reduce((sum, w) => sum + w, 0) / walkability.length),
        })).slice(-20);
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
                                    ? `$${entry.value.toLocaleString()}`
                                    : entry.value}
                            </span>
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    // New: Handle pie chart click
    const handlePieClick = (_data: any, index: number) => {
        setActiveIndex(index);
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

    // New: Export chart data as JSON
    const exportData = () => {
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `property-data-${new Date().toISOString()}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const renderChart = () => {
        const animationDuration = showAnimations ? 1000 : 0;

        switch (activeChart) {
            case 'price_distribution':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={getPriceDistribution()}>
                            <defs>
                                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#667eea" stopOpacity={0.8} />
                                    <stop offset="100%" stopColor="#764ba2" stopOpacity={0.8} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                            <XAxis dataKey="range" stroke="#666" />
                            <YAxis stroke="#666" />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <Bar
                                dataKey="count"
                                fill="url(#barGradient)"
                                radius={[8, 8, 0, 0]}
                                animationDuration={animationDuration}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'size_vs_price':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <ScatterChart data={data.slice(0, 100)}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                            <XAxis
                                dataKey="sqft"
                                name="Square Feet"
                                type="number"
                                stroke="#666"
                                label={{ value: 'Square Feet', position: 'insideBottom', offset: -5 }}
                            />
                            <YAxis
                                dataKey="actual_price"
                                name="Price"
                                type="number"
                                stroke="#666"
                                label={{ value: 'Price ($)', angle: -90, position: 'insideLeft' }}
                            />
                            <Tooltip
                                content={<CustomTooltip />}
                                cursor={{ strokeDasharray: '3 3' }}
                            />
                            <Legend />
                            <Scatter
                                name="Properties"
                                dataKey="actual_price"
                                fill="#764ba2"
                                fillOpacity={0.6}
                                animationDuration={animationDuration}
                            />
                            <Brush dataKey="sqft" height={30} stroke="#667eea" />
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
                                onClick={handlePieClick}
                                animationDuration={animationDuration}
                            >
                                {getPropertyTypeDistribution().map((_entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={COLORS[index % COLORS.length]}
                                        strokeWidth={activeIndex === index ? 3 : 1}
                                        stroke={activeIndex === index ? '#333' : '#fff'}
                                    />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>
                );

            case 'trends':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={getPriceTrends()} syncId={syncId}>
                            <defs>
                                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="#667eea" />
                                    <stop offset="100%" stopColor="#764ba2" />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                            <XAxis dataKey="decade" stroke="#666" />
                            <YAxis stroke="#666" />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="avgPrice"
                                stroke="url(#lineGradient)"
                                strokeWidth={3}
                                dot={{ fill: '#667eea', strokeWidth: 2, r: 6 }}
                                activeDot={{ r: 8 }}
                                animationDuration={animationDuration}
                            />
                            <Brush dataKey="decade" height={30} stroke="#667eea" />
                        </LineChart>
                    </ResponsiveContainer>
                );

            case 'composed_analysis':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <ComposedChart data={getComposedAnalysis()}>
                            <defs>
                                <linearGradient id="composedGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#4facfe" stopOpacity={0.8} />
                                    <stop offset="100%" stopColor="#00f2fe" stopOpacity={0.3} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                            <XAxis dataKey="range" stroke="#666" angle={-15} textAnchor="end" height={80} />
                            <YAxis yAxisId="left" stroke="#667eea" />
                            <YAxis yAxisId="right" orientation="right" stroke="#f093fb" />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Bar
                                yAxisId="left"
                                dataKey="count"
                                fill="#667eea"
                                radius={[8, 8, 0, 0]}
                                animationDuration={animationDuration}
                            />
                            <Area
                                yAxisId="right"
                                type="monotone"
                                dataKey="avgPrice"
                                fill="url(#composedGradient)"
                                stroke="#4facfe"
                                strokeWidth={2}
                                animationDuration={animationDuration}
                            />
                            <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="avgRating"
                                stroke="#f093fb"
                                strokeWidth={3}
                                dot={{ fill: '#f093fb', r: 4 }}
                                animationDuration={animationDuration}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                );

            case 'radial_metrics':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <RadialBarChart
                            cx="50%"
                            cy="50%"
                            innerRadius="10%"
                            outerRadius="90%"
                            data={getRadialMetrics()}
                            startAngle={180}
                            endAngle={0}
                        >
                            <RadialBar
                                label={{ fill: '#666', position: 'insideStart' }}
                                background
                                dataKey="value"
                                animationDuration={animationDuration}
                            />
                            <Legend
                                iconSize={10}
                                layout="vertical"
                                verticalAlign="middle"
                                align="right"
                            />
                            <Tooltip content={<CustomTooltip />} />
                        </RadialBarChart>
                    </ResponsiveContainer>
                );

            case 'area_trends':
                return (
                    <ResponsiveContainer width="100%" height={400}>
                        <AreaChart data={getAreaTrends()} syncId={syncId}>
                            <defs>
                                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#667eea" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#667eea" stopOpacity={0.1} />
                                </linearGradient>
                                <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f093fb" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#f093fb" stopOpacity={0.1} />
                                </linearGradient>
                                <linearGradient id="colorWalk" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#4facfe" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#4facfe" stopOpacity={0.1} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                            <XAxis dataKey="year" stroke="#666" />
                            <YAxis stroke="#666" />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Area
                                type="monotone"
                                dataKey="price"
                                stroke="#667eea"
                                fillOpacity={1}
                                fill="url(#colorPrice)"
                                animationDuration={animationDuration}
                            />
                            <Area
                                type="monotone"
                                dataKey="rating"
                                stroke="#f093fb"
                                fillOpacity={1}
                                fill="url(#colorRating)"
                                animationDuration={animationDuration}
                            />
                            <Area
                                type="monotone"
                                dataKey="walkability"
                                stroke="#4facfe"
                                fillOpacity={1}
                                fill="url(#colorWalk)"
                                animationDuration={animationDuration}
                            />
                            <Brush dataKey="year" height={30} stroke="#667eea" />
                        </AreaChart>
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
                <button
                    className={`chart-tab ${activeChart === 'composed_analysis' ? 'active' : ''}`}
                    onClick={() => setActiveChart('composed_analysis')}
                >
                    🔬 Multi-Metric Analysis
                </button>
                <button
                    className={`chart-tab ${activeChart === 'radial_metrics' ? 'active' : ''}`}
                    onClick={() => setActiveChart('radial_metrics')}
                >
                    🎯 Radial Metrics
                </button>
                <button
                    className={`chart-tab ${activeChart === 'area_trends' ? 'active' : ''}`}
                    onClick={() => setActiveChart('area_trends')}
                >
                    📉 Area Trends
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
                    <button onClick={exportData} className="control-button">
                        📥 Export Data
                    </button>
                </div>
                <div className="control-group price-filter">
                    <label className="filter-label">Price Range:</label>
                    <input
                        type="range"
                        min="0"
                        max="2000000"
                        step="50000"
                        value={priceFilter.max}
                        onChange={(e) => setPriceFilter({ ...priceFilter, max: parseInt(e.target.value) })}
                        className="price-slider"
                    />
                    <span className="filter-value">${(priceFilter.max / 1000).toFixed(0)}K</span>
                </div>
            </div>

            <div className="chart-container" ref={chartContainerRef}>
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
