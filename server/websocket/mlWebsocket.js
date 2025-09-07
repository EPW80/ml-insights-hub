const {
  streamPythonScript,
  PythonExecutionError,
  PythonTimeoutError,
  PythonParseError,
} = require("../utils/pythonBridge");
const path = require("path");

// Enhanced WebSocket error handling and connection management
class MLWebSocketManager {
  constructor() {
    this.activeConnections = new Map();
    this.activeTrainingJobs = new Map();
    this.heartbeatInterval = 30000; // 30 seconds
  }

  // Initialize WebSocket with comprehensive error handling
  initializeConnection(socket) {
    const connectionId = socket.id;
    const connectionInfo = {
      id: connectionId,
      socket: socket,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      isAlive: true,
      currentJob: null,
    };

    this.activeConnections.set(connectionId, connectionInfo);
    console.log(
      `[${new Date().toISOString()}] Client connected: ${connectionId}`
    );

    // Set up heartbeat mechanism
    this.setupHeartbeat(socket, connectionInfo);

    // Enhanced error handling for socket events
    this.setupSocketErrorHandling(socket, connectionInfo);

    // Set up ML-specific event handlers
    this.setupMLEventHandlers(socket, connectionInfo);

    socket.on("disconnect", (reason) => {
      this.handleDisconnection(connectionId, reason);
    });

    socket.on("error", (error) => {
      this.handleSocketError(connectionId, error);
    });

    // Send connection confirmation
    socket.emit("connection_established", {
      connectionId: connectionId,
      timestamp: new Date().toISOString(),
      features: ["training", "prediction", "analysis", "real_time_updates"],
    });
  }

  // Set up heartbeat mechanism for connection health monitoring
  setupHeartbeat(socket, connectionInfo) {
    const heartbeatTimer = setInterval(() => {
      if (connectionInfo.isAlive) {
        connectionInfo.isAlive = false;
        socket.emit("ping");
      } else {
        console.log(
          `[${new Date().toISOString()}] Heartbeat failed for ${
            socket.id
          }, terminating connection`
        );
        socket.terminate();
        this.cleanupConnection(socket.id);
      }
    }, this.heartbeatInterval);

    socket.on("pong", () => {
      connectionInfo.isAlive = true;
      connectionInfo.lastHeartbeat = new Date();
    });

    socket.on("disconnect", () => {
      clearInterval(heartbeatTimer);
    });
  }

  // Enhanced socket error handling
  setupSocketErrorHandling(socket, connectionInfo) {
    socket.on("error", (error) => {
      console.error(
        `[${new Date().toISOString()}] Socket error for ${socket.id}:`,
        error
      );

      socket.emit("error", {
        type: "socket_error",
        message: "Connection error occurred",
        timestamp: new Date().toISOString(),
        recovery_action: "reconnect",
      });
    });

    // Handle connection timeout
    socket.setTimeout(60000, () => {
      console.log(
        `[${new Date().toISOString()}] Socket timeout for ${socket.id}`
      );
      socket.emit("timeout_warning", {
        message: "Connection timeout detected",
        timestamp: new Date().toISOString(),
      });
    });
  }

  // Set up ML-specific event handlers with error handling
  setupMLEventHandlers(socket, connectionInfo) {
    // Enhanced training event handler
    socket.on("start_training", async (config) => {
      const jobId = `training_${Date.now()}_${socket.id}`;

      try {
        await this.handleTrainingRequest(socket, connectionInfo, config, jobId);
      } catch (error) {
        this.sendErrorToClient(socket, "training_error", error, { jobId });
      }
    });

    // Real-time prediction handler
    socket.on("start_prediction", async (config) => {
      try {
        await this.handlePredictionRequest(socket, connectionInfo, config);
      } catch (error) {
        this.sendErrorToClient(socket, "prediction_error", error);
      }
    });

    // Analysis request handler
    socket.on("start_analysis", async (config) => {
      try {
        await this.handleAnalysisRequest(socket, connectionInfo, config);
      } catch (error) {
        this.sendErrorToClient(socket, "analysis_error", error);
      }
    });

    // Job cancellation handler
    socket.on("cancel_job", (jobId) => {
      this.handleJobCancellation(socket, jobId);
    });
  }

  // Enhanced training request handler with streaming
  async handleTrainingRequest(socket, connectionInfo, config, jobId) {
    const { modelType, datasetId, hyperparameters } = config;

    // Validate training configuration
    if (!modelType || !datasetId) {
      throw new Error(
        "Missing required training parameters: modelType and datasetId"
      );
    }

    console.log(
      `[${new Date().toISOString()}] Starting training job ${jobId} for ${
        socket.id
      }`
    );

    // Store job information
    const jobInfo = {
      id: jobId,
      type: "training",
      startTime: new Date(),
      connectionId: socket.id,
      config: config,
      status: "running",
    };

    this.activeTrainingJobs.set(jobId, jobInfo);
    connectionInfo.currentJob = jobId;

    // Send job started confirmation
    socket.emit("training_started", {
      jobId: jobId,
      message: "Training job initiated",
      timestamp: new Date().toISOString(),
    });

    const inputData = {
      model_type: modelType,
      dataset_id: datasetId,
      hyperparameters: hyperparameters || {},
      job_id: jobId,
    };

    const scriptPath = path.join(__dirname, "../python-scripts/train_model.py");

    try {
      await streamPythonScript(
        scriptPath,
        inputData,
        (data) => {
          // Send real-time training updates
          socket.emit("training_update", {
            jobId: jobId,
            data: data,
            timestamp: new Date().toISOString(),
          });
        },
        {
          timeout: 600000, // 10 minutes for training
          maxRetries: 1,
          onProgress: (progress) => {
            socket.emit("training_progress", {
              jobId: jobId,
              progress: progress,
              timestamp: new Date().toISOString(),
            });
          },
        }
      );

      // Training completed successfully
      jobInfo.status = "completed";
      jobInfo.endTime = new Date();

      socket.emit("training_completed", {
        jobId: jobId,
        message: "Training completed successfully",
        duration: jobInfo.endTime - jobInfo.startTime,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      jobInfo.status = "failed";
      jobInfo.error = error.message;
      throw error;
    } finally {
      // Cleanup job
      this.activeTrainingJobs.delete(jobId);
      connectionInfo.currentJob = null;
    }
  }

  // Enhanced prediction request handler
  async handlePredictionRequest(socket, connectionInfo, config) {
    const { features, modelType } = config;

    if (!features || !modelType) {
      throw new Error(
        "Missing required prediction parameters: features and modelType"
      );
    }

    const inputData = {
      features: features,
      model_type: modelType,
      real_time: true,
    };

    const scriptPath = path.join(
      __dirname,
      "../python-scripts/predict_with_uncertainty.py"
    );

    try {
      await streamPythonScript(
        scriptPath,
        inputData,
        (data) => {
          socket.emit("prediction_result", {
            data: data,
            timestamp: new Date().toISOString(),
          });
        },
        {
          timeout: 30000, // 30 seconds
          maxRetries: 2,
        }
      );
    } catch (error) {
      throw error;
    }
  }

  // Enhanced analysis request handler
  async handleAnalysisRequest(socket, connectionInfo, config) {
    const { datasetId, analysisType, features } = config;

    if (!datasetId || !analysisType) {
      throw new Error(
        "Missing required analysis parameters: datasetId and analysisType"
      );
    }

    const inputData = {
      dataset_id: datasetId,
      analysis_type: analysisType,
      features: features || [],
      real_time: true,
    };

    const scriptPath = path.join(__dirname, "../python-scripts/analysis.py");

    try {
      await streamPythonScript(
        scriptPath,
        inputData,
        (data) => {
          socket.emit("analysis_result", {
            data: data,
            timestamp: new Date().toISOString(),
          });
        },
        {
          timeout: 120000, // 2 minutes
          maxRetries: 2,
        }
      );
    } catch (error) {
      throw error;
    }
  }

  // Handle job cancellation
  handleJobCancellation(socket, jobId) {
    const job = this.activeTrainingJobs.get(jobId);
    if (job && job.connectionId === socket.id) {
      job.status = "cancelled";
      this.activeTrainingJobs.delete(jobId);

      socket.emit("job_cancelled", {
        jobId: jobId,
        message: "Job cancelled successfully",
        timestamp: new Date().toISOString(),
      });
    } else {
      socket.emit("job_cancel_failed", {
        jobId: jobId,
        error: "Job not found or access denied",
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Send structured error messages to client
  sendErrorToClient(socket, eventType, error, metadata = {}) {
    const errorResponse = {
      type: eventType,
      message: error.message || "An unexpected error occurred",
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    // Add specific error details based on error type
    if (error instanceof PythonExecutionError) {
      errorResponse.details = {
        exitCode: error.details.exitCode,
        executionTime: error.details.executionTime,
      };
      errorResponse.category = "execution_error";
    } else if (error instanceof PythonTimeoutError) {
      errorResponse.details = {
        timeout: error.details.timeout,
        retryCount: error.details.retryCount,
      };
      errorResponse.category = "timeout_error";
    } else if (error instanceof PythonParseError) {
      errorResponse.category = "validation_error";
    } else {
      errorResponse.category = "system_error";
    }

    console.error(
      `[${new Date().toISOString()}] WebSocket Error for ${socket.id}:`,
      errorResponse
    );
    socket.emit("error", errorResponse);
  }

  // Handle client disconnection
  handleDisconnection(connectionId, reason) {
    console.log(
      `[${new Date().toISOString()}] Client disconnected: ${connectionId}, reason: ${reason}`
    );

    const connectionInfo = this.activeConnections.get(connectionId);
    if (connectionInfo && connectionInfo.currentJob) {
      // Cancel any active jobs
      const job = this.activeTrainingJobs.get(connectionInfo.currentJob);
      if (job) {
        job.status = "cancelled_disconnection";
        this.activeTrainingJobs.delete(connectionInfo.currentJob);
      }
    }

    this.cleanupConnection(connectionId);
  }

  // Handle socket-level errors
  handleSocketError(connectionId, error) {
    console.error(
      `[${new Date().toISOString()}] Socket error for ${connectionId}:`,
      error
    );
    this.cleanupConnection(connectionId);
  }

  // Clean up connection resources
  cleanupConnection(connectionId) {
    this.activeConnections.delete(connectionId);

    // Cancel any jobs associated with this connection
    for (const [jobId, job] of this.activeTrainingJobs.entries()) {
      if (job.connectionId === connectionId) {
        job.status = "cancelled_cleanup";
        this.activeTrainingJobs.delete(jobId);
      }
    }
  }

  // Get connection statistics
  getConnectionStats() {
    return {
      activeConnections: this.activeConnections.size,
      activeJobs: this.activeTrainingJobs.size,
      connections: Array.from(this.activeConnections.values()).map((conn) => ({
        id: conn.id,
        connectedAt: conn.connectedAt,
        lastHeartbeat: conn.lastHeartbeat,
        currentJob: conn.currentJob,
      })),
    };
  }
}

// Singleton instance
const mlWebSocketManager = new MLWebSocketManager();

function initializeMLWebSocket(io) {
  io.on("connection", (socket) => {
    mlWebSocketManager.initializeConnection(socket);
  });

  // Periodic cleanup of stale connections
  setInterval(() => {
    const stats = mlWebSocketManager.getConnectionStats();
    console.log(`[${new Date().toISOString()}] WebSocket Stats:`, stats);
  }, 60000); // Every minute
}

module.exports = {
  initializeMLWebSocket,
  mlWebSocketManager,
};
