import React, { useState, useCallback, lazy, Suspense } from 'react';
import './App.css';

// Lazy load components for code splitting
const MLPredictionForm = lazy(() => import('./components/MLPredictionForm'));
const PropertyDataVisualization = lazy(() => import('./components/PropertyDataVisualization'));
const DataUploadInterface = lazy(() => import('./components/DataUploadInterface'));
const ResultsDashboard = lazy(() => import('./components/ResultsDashboard'));

// Define proper types for tab navigation
type TabType = 'dashboard' | 'prediction' | 'visualization' | 'upload';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  const Navigation = () => (
    <nav className="main-navigation">
      <div className="nav-brand">
        <h1>🏠 ML Insights Hub</h1>
      </div>
      <div className="nav-links">
        <button
          className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => handleTabChange('dashboard')}
        >
          📊 Dashboard
        </button>
        <button
          className={`nav-link ${activeTab === 'prediction' ? 'active' : ''}`}
          onClick={() => handleTabChange('prediction')}
        >
          🎯 Predictions
        </button>
        <button
          className={`nav-link ${activeTab === 'visualization' ? 'active' : ''}`}
          onClick={() => handleTabChange('visualization')}
        >
          📈 Visualization
        </button>
        <button
          className={`nav-link ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => handleTabChange('upload')}
        >
          📁 Upload Data
        </button>
      </div>
    </nav>
  );

  const renderActiveComponent = (): React.JSX.Element => {
    switch (activeTab) {
      case 'dashboard':
        return <ResultsDashboard />;
      case 'prediction':
        return <MLPredictionForm />;
      case 'visualization':
        return <PropertyDataVisualization />;
      case 'upload':
        return <DataUploadInterface />;
      default:
        return <ResultsDashboard />;
    }
  };

  return (
    <div className="App">
      <Navigation />
      <main className="main-content">
        <Suspense fallback={
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading component...</p>
          </div>
        }>
          {renderActiveComponent()}
        </Suspense>
      </main>
    </div>
  );
}

export default App;
