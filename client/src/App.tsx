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
    <nav className="main-navigation" role="navigation" aria-label="Main navigation">
      <div className="nav-brand">
        <h1>🏠 ML Insights Hub</h1>
      </div>
      <div className="nav-links" role="tablist">
        <button
          className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => handleTabChange('dashboard')}
          role="tab"
          aria-selected={activeTab === 'dashboard'}
          aria-controls="dashboard-panel"
        >
          <span aria-hidden="true">📊</span> Dashboard
        </button>
        <button
          className={`nav-link ${activeTab === 'prediction' ? 'active' : ''}`}
          onClick={() => handleTabChange('prediction')}
          role="tab"
          aria-selected={activeTab === 'prediction'}
          aria-controls="prediction-panel"
        >
          <span aria-hidden="true">🎯</span> Predictions
        </button>
        <button
          className={`nav-link ${activeTab === 'visualization' ? 'active' : ''}`}
          onClick={() => handleTabChange('visualization')}
          role="tab"
          aria-selected={activeTab === 'visualization'}
          aria-controls="visualization-panel"
        >
          <span aria-hidden="true">📈</span> Visualization
        </button>
        <button
          className={`nav-link ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => handleTabChange('upload')}
          role="tab"
          aria-selected={activeTab === 'upload'}
          aria-controls="upload-panel"
        >
          <span aria-hidden="true">📁</span> Upload Data
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
    <div className="App" role="application" aria-label="ML Insights Hub Application">
      <Navigation />
      <main className="main-content" role="main">
        <Suspense fallback={
          <div className="loading-container" role="status" aria-live="polite">
            <div className="spinner" aria-hidden="true"></div>
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
