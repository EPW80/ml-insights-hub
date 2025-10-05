#!/bin/bash

# ML Insights Hub Startup Script
echo "🚀 Starting ML Insights Hub..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Start frontend in background
echo "📱 Starting React frontend..."
cd "$SCRIPT_DIR/client"
npm start &
FRONTEND_PID=$!

# Wait a moment
sleep 3

# Start backend in background
echo "⚙️  Starting Node.js backend..."
cd "$SCRIPT_DIR/server"
npm run dev &
BACKEND_PID=$!

# Activate Python environment
echo "🐍 Python environment ready..."
cd "$SCRIPT_DIR"
source venv/bin/activate

echo "✅ ML Insights Hub is starting up!"
echo "📱 Frontend: http://localhost:3000"
echo "⚙️  Backend: http://localhost:5000"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for user to stop
wait
