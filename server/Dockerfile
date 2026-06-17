# Multi-stage Dockerfile for ML Insights Hub Backend
#
# All stages share a Debian/glibc base so the Python venv (built in the
# python-builder stage) and its compiled ML wheels run unchanged in the
# production stage. The previous Alpine/musl production stage could not
# execute the glibc venv -> `spawn /app/venv/bin/python ENOENT`.

# Stage 1: Node Builder (Debian/glibc, matches production)
FROM node:26-bookworm-slim AS builder

WORKDIR /app

# Build deps in case any dependency compiles a native addon (node-gyp needs python3)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Python Environment (Debian/glibc)
FROM python:3.11-slim AS python-builder

WORKDIR /app

# Install Python build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libffi-dev \
    libssl-dev \
    gfortran \
    libopenblas-dev \
    liblapack-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file
COPY requirements.txt ./

# Create virtual environment and install Python dependencies
RUN python -m venv /app/venv && \
    /app/venv/bin/pip install --upgrade pip && \
    /app/venv/bin/pip install --no-cache-dir -r requirements.txt

# Stage 3: Production (python:3.11-slim so the venv interpreter + wheels are native)
FROM python:3.11-slim

WORKDIR /app

# Runtime libs for the ML wheels (xgboost needs libgomp; openblas/lapack for scipy stack)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    libopenblas0 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -m -s /bin/bash nodejs

# Bring in the Node.js runtime (no npm needed at runtime; CMD runs `node`)
COPY --from=builder /usr/local/bin/node /usr/local/bin/node

# Copy Node modules from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy Python virtual environment from python-builder
COPY --from=python-builder --chown=nodejs:nodejs /app/venv /app/venv

# Copy application code
COPY --chown=nodejs:nodejs . .

# Create necessary directories
RUN mkdir -p uploads logs models datasets && \
    chown -R nodejs:nodejs uploads logs models datasets

# Switch to non-root user
USER nodejs

# Environment variables
ENV NODE_ENV=production \
    PYTHON_PATH=/app/venv/bin/python

# Start server
CMD ["node", "server.js"]
