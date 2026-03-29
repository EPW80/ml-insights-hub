# Multi-stage Dockerfile for ML Insights Hub Backend
# Stage 1: Builder
FROM node:22-alpine AS builder

WORKDIR /app

# Install Python and build dependencies
RUN apk add --no-cache \
    python3 \
    python3-dev \
    py3-pip \
    g++ \
    make \
    gcc \
    musl-dev \
    linux-headers \
    libffi-dev \
    openssl-dev

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Python Environment
FROM python:3.14-alpine AS python-builder

WORKDIR /app

# Install Python build dependencies
RUN apk add --no-cache \
    gcc \
    g++ \
    musl-dev \
    linux-headers \
    libffi-dev \
    openssl-dev \
    gfortran \
    openblas-dev \
    lapack-dev

# Copy requirements file
COPY requirements.txt ./

# Create virtual environment and install Python dependencies
RUN python -m venv /app/venv && \
    /app/venv/bin/pip install --upgrade pip && \
    /app/venv/bin/pip install --no-cache-dir -r requirements.txt

# Stage 3: Production
FROM node:22-alpine

WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache \
    python3 \
    py3-pip \
    openblas \
    lapack \
    libstdc++

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

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

# Expose port
EXPOSE 5000

# Environment variables
ENV NODE_ENV=production \
    PORT=5000 \
    PYTHON_PATH=/app/venv/bin/python

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5000/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Start server
CMD ["node", "server.js"]
