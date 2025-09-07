const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// Error types for better error categorization
class PythonExecutionError extends Error {
  constructor(message, code, stderr, stdout) {
    super(message);
    this.name = 'PythonExecutionError';
    this.code = code;
    this.stderr = stderr;
    this.stdout = stdout;
    this.timestamp = new Date().toISOString();
  }
}

class PythonTimeoutError extends Error {
  constructor(message, timeout) {
    super(message);
    this.name = 'PythonTimeoutError';
    this.timeout = timeout;
    this.timestamp = new Date().toISOString();
  }
}

class PythonParseError extends Error {
  constructor(message, output) {
    super(message);
    this.name = 'PythonParseError';
    this.output = output;
    this.timestamp = new Date().toISOString();
  }
}

// Enhanced Python script runner with comprehensive error handling
async function runPythonScript(scriptPath, inputData, options = {}) {
  return new Promise((resolve, reject) => {
    const {
      timeout = 300000, // 5 minutes default timeout
      maxOutputSize = 10 * 1024 * 1024, // 10MB max output
      validateInput = true,
      retries = 0,
      onProgress = null
    } = options;

    // Input validation
    if (validateInput) {
      const validation = validatePythonInput(scriptPath, inputData);
      if (!validation.isValid) {
        return reject(new Error(`Input validation failed: ${validation.error}`));
      }
    }

    // Verify script exists
    if (!fs.existsSync(scriptPath)) {
      return reject(new Error(`Python script not found: ${scriptPath}`));
    }

    // Verify Python executable
    const pythonPath = process.env.PYTHON_PATH || "python3";
    
    let attempt = 0;
    const maxAttempts = retries + 1;

    function executeScript() {
      attempt++;
      
      const python = spawn(pythonPath, [scriptPath, JSON.stringify(inputData)], {
        cwd: path.dirname(scriptPath),
        env: { ...process.env, PYTHONPATH: path.dirname(scriptPath) },
        timeout: timeout
      });

      let output = "";
      let error = "";
      let isTimedOut = false;
      let outputSize = 0;

      // Set up timeout
      const timeoutId = setTimeout(() => {
        isTimedOut = true;
        python.kill('SIGKILL');
        reject(new PythonTimeoutError(
          `Python script timed out after ${timeout}ms`, 
          timeout
        ));
      }, timeout);

      python.stdout.on("data", (data) => {
        const chunk = data.toString();
        outputSize += chunk.length;
        
        // Prevent memory issues with large outputs
        if (outputSize > maxOutputSize) {
          python.kill('SIGKILL');
          clearTimeout(timeoutId);
          return reject(new Error(`Output size exceeded maximum limit (${maxOutputSize} bytes)`));
        }
        
        output += chunk;
        
        // Progress callback for streaming operations
        if (onProgress && chunk.trim()) {
          try {
            const lines = chunk.split('\n').filter(line => line.trim());
            lines.forEach(line => {
              if (line.startsWith('PROGRESS:')) {
                onProgress(line.substring(9));
              }
            });
          } catch (e) {
            // Ignore progress parsing errors
          }
        }
      });

      python.stderr.on("data", (data) => {
        const chunk = data.toString();
        error += chunk;
        
        // Log errors in real-time for debugging
        console.error(`Python stderr: ${chunk}`);
      });

      python.on("close", (code) => {
        clearTimeout(timeoutId);
        
        if (isTimedOut) {
          return; // Already handled by timeout
        }

        if (code !== 0) {
          const errorMessage = `Python script exited with code ${code}`;
          const pythonError = new PythonExecutionError(errorMessage, code, error, output);
          
          // Retry logic
          if (attempt < maxAttempts && shouldRetry(code, error)) {
            console.warn(`Python script failed (attempt ${attempt}/${maxAttempts}), retrying...`);
            setTimeout(executeScript, 1000 * attempt); // Exponential backoff
            return;
          }
          
          // Log detailed error information
          console.error('Python Script Error Details:', {
            script: scriptPath,
            code: code,
            stderr: error,
            stdout: output,
            attempt: attempt,
            timestamp: new Date().toISOString()
          });
          
          reject(pythonError);
        } else {
          try {
            // Handle empty output
            if (!output.trim()) {
              return reject(new PythonParseError('Python script produced no output', ''));
            }

            // Try to parse JSON output
            const result = JSON.parse(output);
            
            // Validate result structure
            if (result && typeof result === 'object') {
              resolve(result);
            } else {
              reject(new PythonParseError('Python script output is not a valid object', output));
            }
          } catch (e) {
            // Try to extract JSON from multi-line output
            const lines = output.split('\n');
            let jsonLine = null;
            
            for (const line of lines) {
              try {
                const parsed = JSON.parse(line.trim());
                jsonLine = parsed;
                break;
              } catch (e) {
                continue;
              }
            }
            
            if (jsonLine) {
              resolve(jsonLine);
            } else {
              reject(new PythonParseError(
                `Failed to parse Python output as JSON: ${e.message}`, 
                output
              ));
            }
          }
        }
      });

      python.on("error", (err) => {
        clearTimeout(timeoutId);
        
        if (err.code === 'ENOENT') {
          reject(new Error(`Python executable not found: ${pythonPath}. Please check PYTHON_PATH environment variable.`));
        } else if (err.code === 'EACCES') {
          reject(new Error(`Permission denied executing Python script: ${scriptPath}`));
        } else {
          reject(new Error(`Python process error: ${err.message}`));
        }
      });

      // Send input data to Python script's stdin if it's large
      if (JSON.stringify(inputData).length > 8192) { // 8KB threshold
        try {
          python.stdin.write(JSON.stringify(inputData));
          python.stdin.end();
        } catch (e) {
          console.warn('Failed to write to Python stdin:', e.message);
        }
      }
    }

    executeScript();
  });
}

// Determine if an error is retryable
function shouldRetry(exitCode, stderr) {
  const retryableErrors = [
    'ConnectionError',
    'TimeoutError',
    'TemporaryFailure',
    'ResourceUnavailable',
    'MemoryError' // Sometimes retryable with cleanup
  ];
  
  return retryableErrors.some(error => stderr.includes(error)) || 
         [137, 143].includes(exitCode); // SIGKILL, SIGTERM
}

// Input validation for Python scripts
function validatePythonInput(scriptPath, inputData) {
  try {
    // Check if input data is serializable
    JSON.stringify(inputData);
    
    // Basic size check
    const inputSize = JSON.stringify(inputData).length;
    if (inputSize > 50 * 1024 * 1024) { // 50MB limit
      return { isValid: false, error: 'Input data too large (>50MB)' };
    }
    
    // Check for required fields based on script type
    const scriptName = path.basename(scriptPath);
    if (scriptName.includes('predict') && !inputData.features) {
      return { isValid: false, error: 'Missing required field: features' };
    }
    
    if (scriptName.includes('train') && !inputData.data) {
      return { isValid: false, error: 'Missing required field: data' };
    }
    
    return { isValid: true };
  } catch (error) {
    return { isValid: false, error: `Input validation error: ${error.message}` };
  }
}

async function streamPythonScript(scriptPath, inputData, onData, options = {}) {
  const { timeout = PYTHON_TIMEOUT, maxRetries = 2, onProgress } = options;
  
  // Validate input
  const validation = validatePythonInput(scriptPath, inputData);
  if (!validation.isValid) {
    throw new PythonParseError(validation.error);
  }

  let retryCount = 0;
  const startTime = Date.now();

  async function executeStreamingScript() {
    return new Promise((resolve, reject) => {
      const pythonPath = process.env.PYTHON_PATH || "python3";
      let timeoutId;
      let stdout = '';
      let stderr = '';
      let isResolved = false;
      
      console.log(`[${new Date().toISOString()}] Streaming Python script: ${scriptPath} (attempt ${retryCount + 1})`);
      
      const python = spawn(pythonPath, [scriptPath, JSON.stringify(inputData)], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { 
          ...process.env, 
          PYTHONUNBUFFERED: '1', // Ensure immediate output
          PYTHONIOENCODING: 'utf-8' 
        }
      });

      // Set timeout
      timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          python.kill('SIGTERM');
          setTimeout(() => python.kill('SIGKILL'), 5000);
          reject(new PythonTimeoutError(`Script timeout after ${timeout}ms`, { timeout, retryCount }));
        }
      }, timeout);

      python.stdout.on("data", (data) => {
        try {
          const output = data.toString();
          stdout += output;
          
          // Process line by line for streaming
          const lines = output.split('\n').filter(line => line.trim());
          
          lines.forEach((line) => {
            try {
              // Try to parse as JSON for structured data
              const parsed = JSON.parse(line);
              if (parsed.type === 'progress' && onProgress) {
                onProgress(parsed);
              } else if (parsed.type === 'data' && onData) {
                onData(parsed.data);
              } else if (onData) {
                onData(parsed);
              }
            } catch (parseError) {
              // Handle non-JSON output
              if (line.trim() && onData) {
                onData({ type: 'log', message: line.trim() });
              }
            }
          });
        } catch (error) {
          console.warn('Error processing streaming output:', error.message);
        }
      });

      python.stderr.on("data", (data) => {
        const errorOutput = data.toString();
        stderr += errorOutput;
        console.error(`Python stderr: ${errorOutput}`);
        
        // Send error data to callback if configured
        if (onData) {
          try {
            onData({ type: 'error', message: errorOutput.trim() });
          } catch (e) {
            console.warn('Error sending error data to callback:', e.message);
          }
        }
      });

      python.on("close", (exitCode) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeoutId);
        
        const executionTime = Date.now() - startTime;
        console.log(`Python script completed in ${executionTime}ms with exit code: ${exitCode}`);
        
        if (exitCode === 0) {
          resolve({ success: true, executionTime, stdout: stdout.trim() });
        } else {
          const error = new PythonExecutionError(
            `Script failed with exit code ${exitCode}`,
            { exitCode, stderr: stderr.trim(), stdout: stdout.trim(), executionTime }
          );
          
          if (shouldRetry(exitCode, stderr) && retryCount < maxRetries) {
            console.log(`Retrying streaming script (${retryCount + 1}/${maxRetries})`);
            retryCount++;
            setTimeout(() => {
              executeStreamingScript().then(resolve).catch(reject);
            }, Math.min(1000 * Math.pow(2, retryCount), 10000));
          } else {
            reject(error);
          }
        }
      });

      python.on("error", (err) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeoutId);
        
        if (err.code === 'ENOENT') {
          reject(new Error(`Python executable not found: ${pythonPath}`));
        } else if (err.code === 'EACCES') {
          reject(new Error(`Permission denied executing Python script: ${scriptPath}`));
        } else {
          reject(new Error(`Python process error: ${err.message}`));
        }
      });
    });
  }

  return executeStreamingScript();
}

module.exports = {
  runPythonScript,
  streamPythonScript,
  PythonExecutionError,
  PythonTimeoutError,
  PythonParseError,
};
