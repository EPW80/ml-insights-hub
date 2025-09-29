/**
 * Secure Python Bridge - Enhanced version with comprehensive security
 * This replaces the existing pythonBridge.js with secure execution
 */

const { SecurePythonExecutor, PythonSecurityError, PythonExecutionError, PythonTimeoutError } = require('./securePythonExecutor');
const path = require('path');

// Initialize secure executor
const secureExecutor = new SecurePythonExecutor();

// Backward compatibility with existing API
async function runPythonScript(scriptPath, inputData, options = {}) {
  try {
    // Convert relative path to absolute if needed
    if (!path.isAbsolute(scriptPath)) {
      scriptPath = path.resolve(__dirname, '../python-scripts', scriptPath);
    }
    
    // Execute with security
    const result = await secureExecutor.executeSecure(scriptPath, inputData, options);
    return result.data;
    
  } catch (error) {
    // Log security violations
    if (error instanceof PythonSecurityError) {
      console.error(`🚨 Python Security Violation: ${error.message}`, {
        type: error.type,
        timestamp: error.timestamp,
        scriptPath,
        inputSize: JSON.stringify(inputData || {}).length
      });
    }
    
    throw error;
  }
}

// Enhanced ML prediction execution
async function executeMlPrediction(features, modelType = 'random_forest', uncertaintyMethod = 'bootstrap') {
  const inputData = {
    action: 'predict',
    features,
    model_type: modelType,
    uncertainty_method: uncertaintyMethod
  };
  
  try {
    const result = await secureExecutor.executeSecure(
      path.resolve(__dirname, '../python-scripts/predict_property_price.py'),
      inputData,
      {
        timeout: 30000, // 30 seconds for ML operations
        maxRetries: 1
      }
    );
    
    return result.data;
  } catch (error) {
    console.error('ML Prediction failed:', {
      error: error.message,
      features,
      modelType,
      uncertaintyMethod
    });
    throw error;
  }
}

// Secure model training execution
async function executeModelTraining(trainingData, modelConfig) {
  const inputData = {
    action: 'train',
    training_data: trainingData,
    model_config: modelConfig
  };
  
  try {
    const result = await secureExecutor.executeSecure(
      path.resolve(__dirname, '../python-scripts/train_model.py'),
      inputData,
      {
        timeout: 120000, // 2 minutes for training
        maxRetries: 0
      }
    );
    
    return result.data;
  } catch (error) {
    console.error('Model Training failed:', {
      error: error.message,
      dataSize: trainingData ? trainingData.length : 0,
      modelConfig
    });
    throw error;
  }
}

// Data validation execution
async function executeDataValidation(data) {
  const inputData = {
    action: 'validate',
    data: data
  };
  
  try {
    const result = await secureExecutor.executeSecure(
      path.resolve(__dirname, '../python-scripts/validate_data.py'),
      inputData,
      {
        timeout: 15000, // 15 seconds for validation
        maxRetries: 0
      }
    );
    
    return result.data;
  } catch (error) {
    console.error('Data Validation failed:', {
      error: error.message,
      dataSize: data ? JSON.stringify(data).length : 0
    });
    throw error;
  }
}

// Test Python connection securely
async function testPythonConnection() {
  try {
    const result = await secureExecutor.executeSecure(
      path.resolve(__dirname, '../python-scripts/test_connection.py'),
      {},
      {
        timeout: 10000, // 10 seconds
        maxRetries: 0
      }
    );
    
    return result.data;
  } catch (error) {
    console.error('Python Connection Test failed:', error.message);
    throw error;
  }
}

// Get execution statistics
function getExecutionStats() {
  return secureExecutor.getStats();
}

// Utility function to validate Python script before execution
function validateScript(scriptPath) {
  return secureExecutor.validateScriptPath(scriptPath);
}

// Utility function to sanitize input data
function sanitizeInput(inputData) {
  return secureExecutor.sanitizeInput(inputData);
}

// Export error classes for proper error handling
module.exports = {
  // Main functions
  runPythonScript,
  executeMlPrediction,
  executeModelTraining,
  executeDataValidation,
  testPythonConnection,
  
  // Utility functions
  getExecutionStats,
  validateScript,
  sanitizeInput,
  
  // Error classes
  PythonSecurityError,
  PythonExecutionError,
  PythonTimeoutError,
  
  // Legacy compatibility
  PythonParseError: PythonExecutionError // For backward compatibility
};