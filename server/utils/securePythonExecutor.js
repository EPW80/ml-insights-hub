/**
 * Secure Python Script Executor
 * Implements comprehensive security measures for Python script execution
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const validator = require('validator');

// Security configuration
const SECURITY_CONFIG = {
  // Execution limits
  MAX_EXECUTION_TIME: 30000,      // 30 seconds
  MAX_OUTPUT_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_INPUT_SIZE: 1024 * 1024,     // 1MB
  MAX_CONCURRENT_EXECUTIONS: 3,
  
  // Allowed script patterns
  ALLOWED_SCRIPT_PATTERNS: [
    /^predict_.*\.py$/,
    /^train_.*\.py$/,
    /^analyze_.*\.py$/,
    /^validate_.*\.py$/,
    /^test_connection\.py$/
  ],
  
  // Blocked patterns in input
  BLOCKED_INPUT_PATTERNS: [
    /import\s+os/i,
    /import\s+subprocess/i,
    /import\s+sys/i,
    /__import__/i,
    /exec\s*\(/i,
    /eval\s*\(/i,
    /open\s*\(/i,
    /file\s*\(/i,
    /\.\.\/|\.\.\\/, // Path traversal
    /\/etc\/|\/proc\/|\/dev\//, // System directories
  ],
  
  // Resource limits
  RESOURCE_LIMITS: {
    memory: 512 * 1024 * 1024, // 512MB
    cpu: 80, // 80% CPU usage limit
  }
};

// Error classes
class PythonSecurityError extends Error {
  constructor(message, type = 'SECURITY_VIOLATION') {
    super(message);
    this.name = 'PythonSecurityError';
    this.type = type;
    this.timestamp = new Date().toISOString();
  }
}

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

class SecurePythonExecutor {
  constructor() {
    this.activeExecutions = new Set();
    this.executionCount = 0;
  }

  /**
   * Validate script path for security
   */
  validateScriptPath(scriptPath) {
    const errors = [];
    
    // Check if path is absolute and within allowed directory
    if (!path.isAbsolute(scriptPath)) {
      scriptPath = path.resolve(scriptPath);
    }
    
    // Ensure script is in python-scripts directory
    const allowedDir = path.resolve(__dirname, '../python-scripts');
    if (!scriptPath.startsWith(allowedDir)) {
      errors.push('Script must be in the python-scripts directory');
    }
    
    // Check for path traversal
    if (scriptPath.includes('..')) {
      errors.push('Path traversal detected');
    }
    
    // Validate file extension
    if (!scriptPath.endsWith('.py')) {
      errors.push('Only Python (.py) files are allowed');
    }
    
    // Check against allowed script patterns
    const scriptName = path.basename(scriptPath);
    const isAllowed = SECURITY_CONFIG.ALLOWED_SCRIPT_PATTERNS.some(
      pattern => pattern.test(scriptName)
    );
    
    if (!isAllowed) {
      errors.push(`Script name '${scriptName}' does not match allowed patterns`);
    }
    
    // Verify file exists and is readable
    try {
      fs.accessSync(scriptPath, fs.constants.R_OK);
    } catch (error) {
      errors.push('Script file is not accessible');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      sanitizedPath: scriptPath
    };
  }

  /**
   * Sanitize and validate input data
   */
  sanitizeInput(inputData) {
    const errors = [];
    
    if (!inputData) {
      return { isValid: true, sanitizedData: {}, errors: [] };
    }
    
    // Convert to JSON string for validation
    let jsonString;
    try {
      jsonString = typeof inputData === 'string' ? inputData : JSON.stringify(inputData);
    } catch (error) {
      errors.push('Input data is not serializable to JSON');
      return { isValid: false, errors };
    }
    
    // Check input size
    if (Buffer.byteLength(jsonString, 'utf8') > SECURITY_CONFIG.MAX_INPUT_SIZE) {
      errors.push(`Input size exceeds limit (${SECURITY_CONFIG.MAX_INPUT_SIZE} bytes)`);
    }
    
    // Check for blocked patterns
    for (const pattern of SECURITY_CONFIG.BLOCKED_INPUT_PATTERNS) {
      if (pattern.test(jsonString)) {
        errors.push(`Input contains blocked pattern: ${pattern.source}`);
      }
    }
    
    // Parse and validate JSON structure
    let parsedData;
    try {
      parsedData = JSON.parse(jsonString);
    } catch (error) {
      errors.push('Input is not valid JSON');
      return { isValid: false, errors };
    }
    
    // Recursively sanitize object
    const sanitizedData = this.deepSanitize(parsedData);
    
    return {
      isValid: errors.length === 0,
      sanitizedData,
      errors
    };
  }

  /**
   * Deep sanitization of nested objects
   */
  deepSanitize(obj) {
    if (obj === null || typeof obj !== 'object') {
      return this.sanitizeValue(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepSanitize(item));
    }
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key
      const cleanKey = validator.escape(String(key));
      sanitized[cleanKey] = this.deepSanitize(value);
    }
    
    return sanitized;
  }

  /**
   * Sanitize individual values
   */
  sanitizeValue(value) {
    if (typeof value === 'string') {
      // Remove potentially dangerous characters
      return validator.escape(value);
    }
    
    if (typeof value === 'number') {
      // Ensure number is finite
      return Number.isFinite(value) ? value : 0;
    }
    
    if (typeof value === 'boolean') {
      return Boolean(value);
    }
    
    return value;
  }

  /**
   * Create secure execution environment
   */
  createSecureEnvironment() {
    const baseEnv = {
      // Minimal environment variables
      PATH: '/usr/bin:/bin',
      PYTHONPATH: path.resolve(__dirname, '../python-scripts'),
      PYTHONDONTWRITEBYTECODE: '1',
      PYTHONUNBUFFERED: '1',
      
      // Security restrictions
      PYTHONNOUSERSITE: '1',
      PYTHONHASHSEED: 'random',
      
      // Resource limits (if supported by system)
      RLIMIT_CPU: Math.floor(SECURITY_CONFIG.MAX_EXECUTION_TIME / 1000),
      RLIMIT_AS: SECURITY_CONFIG.RESOURCE_LIMITS.memory,
    };
    
    return baseEnv;
  }

  /**
   * Execute Python script with comprehensive security
   */
  async executeSecure(scriptPath, inputData, options = {}) {
    // Check concurrent execution limit
    if (this.activeExecutions.size >= SECURITY_CONFIG.MAX_CONCURRENT_EXECUTIONS) {
      throw new PythonSecurityError(
        'Maximum concurrent executions exceeded',
        'RATE_LIMIT'
      );
    }
    
    // Generate execution ID for tracking
    const executionId = crypto.randomBytes(16).toString('hex');
    this.activeExecutions.add(executionId);
    
    try {
      // Validate script path
      const pathValidation = this.validateScriptPath(scriptPath);
      if (!pathValidation.isValid) {
        throw new PythonSecurityError(
          `Script validation failed: ${pathValidation.errors.join(', ')}`,
          'SCRIPT_VALIDATION'
        );
      }
      
      // Sanitize input
      const inputValidation = this.sanitizeInput(inputData);
      if (!inputValidation.isValid) {
        throw new PythonSecurityError(
          `Input validation failed: ${inputValidation.errors.join(', ')}`,
          'INPUT_VALIDATION'
        );
      }
      
      // Execute with security measures
      const result = await this.executePython(
        pathValidation.sanitizedPath,
        inputValidation.sanitizedData,
        { ...options, executionId }
      );
      
      return result;
      
    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Core Python execution with sandboxing
   */
  async executePython(scriptPath, inputData, options) {
    return new Promise((resolve, reject) => {
      const {
        timeout = SECURITY_CONFIG.MAX_EXECUTION_TIME,
        executionId
      } = options;
      
      // Get Python executable path
      const pythonPath = process.env.PYTHON_PATH || 'python3';
      
      // Create secure environment
      const secureEnv = this.createSecureEnvironment();
      
      // Prepare arguments securely
      const args = [
        '-S', // Don't add user site packages to sys.path
        '-s', // Don't add user site directory to sys.path
        '-I', // Isolated mode
        scriptPath
      ];
      
      // Spawn process with security restrictions
      const python = spawn(pythonPath, args, {
        cwd: path.dirname(scriptPath),
        env: secureEnv,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
        // Additional security options
        uid: process.getuid ? process.getuid() : undefined,
        gid: process.getgid ? process.getgid() : undefined,
      });
      
      let stdout = '';
      let stderr = '';
      let outputSize = 0;
      let isTimedOut = false;
      
      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        isTimedOut = true;
        this.killProcessTree(python.pid);
        reject(new PythonTimeoutError(
          `Script execution timed out after ${timeout}ms`,
          timeout
        ));
      }, timeout);
      
      // Handle stdout
      python.stdout.on('data', (data) => {
        const chunk = data.toString();
        outputSize += chunk.length;
        
        if (outputSize > SECURITY_CONFIG.MAX_OUTPUT_SIZE) {
          this.killProcessTree(python.pid);
          clearTimeout(timeoutHandle);
          reject(new PythonSecurityError(
            'Output size limit exceeded',
            'OUTPUT_LIMIT'
          ));
          return;
        }
        
        stdout += chunk;
      });
      
      // Handle stderr
      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      // Handle process completion
      python.on('close', (code, signal) => {
        clearTimeout(timeoutHandle);
        
        if (isTimedOut) return; // Already handled
        
        if (signal) {
          reject(new PythonExecutionError(
            `Process killed with signal: ${signal}`,
            code,
            stderr,
            stdout
          ));
          return;
        }
        
        if (code !== 0) {
          reject(new PythonExecutionError(
            `Python script exited with code ${code}`,
            code,
            stderr,
            stdout
          ));
          return;
        }
        
        // Parse output safely
        try {
          const result = JSON.parse(stdout);
          resolve({
            success: true,
            data: result,
            executionId,
            executionTime: Date.now() - this.executionCount,
            outputSize: outputSize
          });
        } catch (error) {
          reject(new PythonExecutionError(
            'Failed to parse Python script output as JSON',
            0,
            stderr,
            stdout
          ));
        }
      });
      
      // Handle process errors
      python.on('error', (error) => {
        clearTimeout(timeoutHandle);
        reject(new PythonExecutionError(
          `Failed to start Python process: ${error.message}`,
          -1,
          error.message,
          ''
        ));
      });
      
      // Send input data to Python script
      try {
        python.stdin.write(JSON.stringify(inputData));
        python.stdin.end();
      } catch (error) {
        this.killProcessTree(python.pid);
        clearTimeout(timeoutHandle);
        reject(new PythonExecutionError(
          `Failed to send input to Python script: ${error.message}`,
          -1,
          error.message,
          ''
        ));
      }
      
      this.executionCount++;
    });
  }

  /**
   * Kill process tree to prevent child processes from surviving
   */
  killProcessTree(pid) {
    try {
      process.kill(-pid, 'SIGTERM');
      
      // Force kill after 5 seconds
      setTimeout(() => {
        try {
          process.kill(-pid, 'SIGKILL');
        } catch (error) {
          // Process already terminated
        }
      }, 5000);
    } catch (error) {
      // Process already terminated or no permission
    }
  }

  /**
   * Get execution statistics
   */
  getStats() {
    return {
      activeExecutions: this.activeExecutions.size,
      totalExecutions: this.executionCount,
      maxConcurrent: SECURITY_CONFIG.MAX_CONCURRENT_EXECUTIONS
    };
  }
}

// Export classes and main executor
module.exports = {
  SecurePythonExecutor,
  PythonSecurityError,
  PythonExecutionError,
  PythonTimeoutError,
  SECURITY_CONFIG
};