import React, { useState } from 'react';

/**
 * Test component to verify ErrorBoundary functionality
 *
 * Usage:
 * 1. Import this component in App.tsx
 * 2. Add it to one of your tabs temporarily
 * 3. Click the "Trigger Error" button to test the error boundary
 * 4. Verify that the ErrorBoundary catches and displays the error
 *
 * Remove this component after testing
 */

const ErrorBoundaryTest: React.FC = () => {
  const [shouldThrow, setShouldThrow] = useState(false);

  if (shouldThrow) {
    throw new Error('This is a test error to verify ErrorBoundary functionality!');
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Error Boundary Test Component</h2>
      <p>
        This component is used to test the ErrorBoundary implementation.
        Click the button below to trigger an error and verify that the
        ErrorBoundary catches it and displays the fallback UI.
      </p>

      <button
        onClick={() => setShouldThrow(true)}
        style={{
          padding: '1rem 2rem',
          background: '#dc3545',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '1rem',
          fontWeight: 'bold',
          cursor: 'pointer',
          marginTop: '1rem',
        }}
      >
        Trigger Error
      </button>

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
        <h3>Test Instructions:</h3>
        <ol>
          <li>Click the "Trigger Error" button above</li>
          <li>Verify that the ErrorBoundary catches the error</li>
          <li>Verify that the error UI displays properly</li>
          <li>Click "Try Again" to reset the error state</li>
          <li>Verify that you return to this component</li>
          <li>Remove this test component when done</li>
        </ol>
      </div>
    </div>
  );
};

export default ErrorBoundaryTest;
