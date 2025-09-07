import React, { useState } from 'react';
import MLPredictionForm from './components/MLPredictionForm';
import PropertyDataVisualization from './components/PropertyDataVisualization';
import DataUploadInterface from './components/DataUploadInterface';
import ResultsDashboard from './components/ResultsDashboard';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const Navigation = () => (
    <nav className="main-navigation">
      <div className="nav-brand">
        <h1>🏠 ML Insights Hub</h1>
      </div>
      <div className="nav-links">
        <button
          className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 Dashboard
        </button>
        <button
          className={`nav-link ${activeTab === 'prediction' ? 'active' : ''}`}
          onClick={() => setActiveTab('prediction')}
        >
          🎯 Predictions
        </button>
        <button
          className={`nav-link ${activeTab === 'visualization' ? 'active' : ''}`}
          onClick={() => setActiveTab('visualization')}
        >
          📈 Visualization
        </button>
        <button
          className={`nav-link ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          📁 Upload Data
        </button>
      </div>
    </nav>
  );

  const renderActiveComponent = () => {
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
        {renderActiveComponent()}
      </main>
    </div>
  );
}

export default App;
