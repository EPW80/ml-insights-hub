import React, { lazy, Suspense } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import './App.css';

// Lazy load components for code splitting
const MLPredictionForm = lazy(() => import('./components/MLPredictionForm'));
const PropertyDataVisualization = lazy(() => import('./components/PropertyDataVisualization'));
const DataUploadInterface = lazy(() => import('./components/DataUploadInterface'));
const ResultsDashboard = lazy(() => import('./components/ResultsDashboard'));
const AuthPage = lazy(() => import('./components/AuthPage'));

const LoadingFallback = () => (
  <div className="loading-container" role="status" aria-live="polite">
    <div className="spinner" aria-hidden="true"></div>
    <p>Loading component...</p>
  </div>
);

function App() {
  const { isAuthenticated, user, logout } = useAuth();

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <AuthPage />
      </Suspense>
    );
  }

  return (
    <div className="App" role="application" aria-label="ML Insights Hub Application">
      <nav className="main-navigation" role="navigation" aria-label="Main navigation">
        <div className="nav-brand">
          <h1>🏠 ML Insights Hub</h1>
        </div>
        <div className="nav-links">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span aria-hidden="true">📊</span> Dashboard
          </NavLink>
          <NavLink
            to="/predictions"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <span aria-hidden="true">🎯</span> Predictions
          </NavLink>
          <NavLink
            to="/visualization"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <span aria-hidden="true">📈</span> Visualization
          </NavLink>
          <NavLink
            to="/upload"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <span aria-hidden="true">📁</span> Upload Data
          </NavLink>
        </div>
        <div className="nav-user">
          <span className="nav-username">{user?.username}</span>
          <button className="nav-logout" onClick={logout} aria-label="Sign out">
            Sign Out
          </button>
        </div>
      </nav>
      <main className="main-content" role="main">
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<ResultsDashboard />} />
            <Route path="/predictions" element={<MLPredictionForm />} />
            <Route path="/visualization" element={<PropertyDataVisualization />} />
            <Route path="/upload" element={<DataUploadInterface />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default App;
