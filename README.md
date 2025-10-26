# 🏠 ML Insights Hub

A comprehensive full-stack machine learning application for real estate price prediction and analysis. This application combines modern web technologies with powerful ML capabilities to provide intelligent insights into property markets.

## 🌟 Features

**Core Functionality**
- 📊 Interactive ML Dashboard with 7 chart types (bar, scatter, pie, line, radar, composed, radial)
- 🎯 Property Price Predictions with 4 ML models and uncertainty quantification
- 📈 Advanced Visualizations (zoom, brush, gradients, synchronized charts)
- 📁 Drag-and-drop data upload with validation
- ⚡ Real-time updates and live predictions

**Security & Infrastructure**
- 🔐 JWT Authentication (512-bit entropy) + API key support
- 🛡️ Sandboxed Python execution with resource limits
- 🚨 Security scoring system (95/100) with startup validation
- 🗄️ MongoDB with auto-reconnection and health monitoring
- 📊 Real-time security event logging and performance metrics

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │    │   Express API   │    │    File System  │
│  (Port 3000)    │◄──►│  (Port 5000)    │◄──►│  CSV/JSON Data  │
│                 │    │                 │    │                 │
│ • TypeScript    │    │ • REST APIs     │    │ • Property Data │
│ • Modern CSS    │    │ • ML Services   │    │ • ML Models     │
│ • Recharts      │    │ • Security Layer│    │ • Datasets      │
│ • Health UI     │    │ • Health Monitor│    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │🔐 Secure Python │    ┌─────────────────┐
                       │   Environment   │◄──►│💓 MongoDB Atlas │
                       │ • scikit-learn  │    │ • Auto-Reconnect│
                       │ • Sandboxed     │    │ • Health Checks │
                       │ • Resource Limit│    │ • Performance   │
                       └─────────────────┘    └─────────────────┘
```

## 🛠️ Tech Stack

**Frontend**: React 19, TypeScript, Recharts, Modern CSS (glassmorphism), React Router, Axios

**Backend**: Node.js, Express.js, MongoDB, JWT, Multer, CORS, Security Middleware

**Machine Learning**: Python, scikit-learn, pandas, numpy (Random Forest, Linear Regression, Neural Networks, Gradient Boosting)

## 📋 Prerequisites

- **Node.js** (v16 or higher)
- **Python** (v3.8 or higher)
- **MongoDB** (local installation or MongoDB Atlas)
- **npm** or **yarn**

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/EPW80/ml-insights-hub.git
cd ml-insights-hub
```

### 2. Setup Python Environment
```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r server/requirements.txt
```

### 3. Setup Backend
```bash
cd server

# Install Node.js dependencies
npm install

# 🔐 IMPORTANT: Generate secure JWT secret
npm run generate-jwt-secret

# ✅ Verify security configuration  
npm run security:audit

# 🧪 Test secure Python bridge
npm run security:test-python

# 🗄️ Test database connection
npm run db:test

# 💓 Monitor database health
npm run db:health
```

### 4. Setup Frontend
```bash
cd ../client

# Install Node.js dependencies
npm install
```

### 5. Run the Application

#### Option A: Run All Services (Recommended)
```bash
# From project root
./start.sh
```

#### Option B: Run Services Separately
```bash
# Terminal 1: Start Frontend
cd client
npm start

# Terminal 2: Start Backend
cd server
npm start

# Make sure Python virtual environment is activated
source venv/bin/activate
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000

## 🔐 Security & Database Configuration

### Database Setup (Required)
Configure your MongoDB connection:

```bash
# Copy environment template
cp server/.env.example server/.env

# Edit .env file with your MongoDB URI
MONGODB_URI=mongodb://localhost:27017/ml-insights-hub

# Test database connection
cd server
npm run db:test
```

### JWT Secret Setup (Required)
Before running the application, you must configure a secure JWT secret:

```bash
# Generate secure JWT secret
cd server
npm run generate-jwt-secret --update-env

# Verify security configuration
npm run security-audit
```

### Security Features
- **🔒 Automatic security validation** on server startup
- **🛡️ Rate limiting** for API endpoints
- **🔐 JWT authentication** with secure secret generation
- **📝 Input validation** and sanitization
- **🚫 CORS protection** with configurable origins
- **⚡ Security headers** via Helmet.js

### Security & Database Commands
```bash
# Security commands
npm run check-security          # Check JWT secret strength
npm run security:audit          # Full security audit
npm run security:test-python    # Test secure Python execution
npm run preproduction          # Pre-production security check

# Database commands
npm run db:test                 # Test database connection
npm run db:health              # Monitor database health (15-second test)
npm run db:stats               # Display database statistics
```

### Health Monitoring Endpoints
The application provides real-time health monitoring:

```bash
# Database health status
GET /api/health/database

# Detailed database statistics
GET /api/health/database/stats

# Database performance metrics
GET /api/health/database/performance

# Force database reconnection (admin)
POST /api/health/database/reconnect
```

For detailed security information, check the built-in security audit: `npm run security:audit`
cd server
npm run dev

# Terminal 3: Activate Python Environment
source venv/bin/activate
```

## 📁 Project Structure

```
ml-insights-hub/
├── client/                    # React Frontend (TypeScript)
│   ├── src/
│   │   ├── components/        # UI Components (Charts, Forms, Dashboard)
│   │   ├── services/          # API & Data Services
│   │   └── hooks/             # Custom React Hooks
│   └── public/                # Static Assets
│
├── server/                    # Node.js Backend
│   ├── routes/                # API Routes & Endpoints
│   ├── middleware/            # Security & Validation (JWT, Rate Limiting)
│   ├── ml-services/           # ML Algorithm Services
│   ├── python-scripts/        # Sandboxed Python ML Execution
│   ├── scripts/               # Automation & Testing Tools
│   └── uploads/               # File Upload Directory
│
└── venv/                      # Python Virtual Environment
```

### Key Features by Component

**Frontend** (`/client/src/components/`)
- 📊 Interactive Charts: 7 chart types with zoom, brush, gradients
- 🎯 ML Predictions: Multi-model support with uncertainty quantification
- 📁 Data Upload: Drag-and-drop with validation
- 💫 Advanced Visualizations: Radar, composed, radial, area charts

**Backend** (`/server/`)
- 🤖 ML Services: Random Forest, Linear Regression, Neural Networks, Gradient Boosting
- 🛡️ Security: JWT auth, rate limiting, input sanitization, sandboxed Python
- 💓 Health Monitoring: Real-time database & system health checks
- 🔧 API Endpoints: Predictions, data management, model training
```bash
npm run check-security
```

#### 3. Security Checklist
- ✅ JWT secret is 256+ bits (64+ hex characters)
- ✅ Rate limiting is enabled
- ✅ Input validation is active
- ✅ MongoDB injection protection enabled
- ✅ Security headers configured
- ✅ HTTPS enabled in production

### Environment Variables

Create a `.env` file in the `server/` directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/ml-insights-hub

# JWT Authentication (CRITICAL - Generate secure secret!)
# Use: npm run generate-jwt-secret
JWT_SECRET=GENERATE_SECURE_SECRET_FOR_PRODUCTION_USE_CRYPTO_RANDOM_BYTES_64_HEX
JWT_EXPIRE=7d

# Python
PYTHON_PATH=../venv/bin/python

# File Upload
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760  # 10MB
```

## 📊 Available ML Models

### Property Price Prediction Models
- **Random Forest** - Ensemble method for robust predictions
- **Linear Regression** - Simple linear relationship modeling
- **Neural Network** - Deep learning for complex patterns
- **Gradient Boosting** - Advanced ensemble technique

### Uncertainty Quantification Methods
- **Bootstrap Sampling** - Statistical confidence intervals
- **Bayesian Approaches** - Probabilistic uncertainty estimation
- **Ensemble Variance** - Model agreement analysis

## 🎯 API Endpoints

### Machine Learning Predictions
- `POST /api/ml/predict` - Make property price predictions
  ```json
  {
    "bedrooms": 3,
    "bathrooms": 2,
    "sqft": 2000,
    "year_built": 2010,
    "lot_size": 8000,
    "school_rating": 8,
    "crime_rate": 2.5,
    "walkability_score": 75
  }
  ```

### Data Management
- `POST /api/data/upload` - Upload property dataset files
- `GET /api/data/properties` - Retrieve property data for visualization
- `POST /api/data/validate` - Validate uploaded data format

### Health Monitoring
- `GET /api/health/database` - Database health status
- `GET /api/health/database/stats` - Database connection statistics
- `GET /api/health/database/performance` - Database performance metrics
- `POST /api/health/database/reconnect` - Force database reconnection

## 🖥️ Application Overview

📊 **Dashboard**: Real-time analytics, 7 chart types, prediction metrics, model performance

🎯 **Predictions**: Multi-model selection, property inputs, uncertainty quantification, instant results

📈 **Visualizations**: Price distribution, correlation charts, property breakdowns, trend analysis

📁 **Data Upload**: Drag-and-drop, CSV/JSON/Excel support, real-time validation

## 🧪 Testing

### Frontend Tests
```bash
cd client
npm test
```

### Backend Tests
```bash
cd server

# Test all functionality
npm test

# Test specific components
npm run security:test-python     # Test secure Python execution
npm run db:test                  # Test database connection
npm run db:health               # Test database health monitoring
npm run security:audit          # Test security configuration
```

### Python Environment Test
```bash
source venv/bin/activate
python -c "import pandas, numpy, sklearn; print('All ML packages installed successfully!')"
```

## 🚀 Deployment

### Production Build
```bash
# Build frontend for production
cd client
npm run build

# The build folder will contain optimized production files
```

### Production Checklist
Before deploying to production, ensure:

1. **Security Configuration**:
   ```bash
   npm run security:audit    # Should score 95/100 or higher
   npm run preproduction     # Run pre-production checks
   ```

2. **Database Configuration**:
   ```bash
   npm run db:test          # Verify database connection
   npm run db:health        # Confirm health monitoring
   ```

3. **Environment Setup**:
   - Set `NODE_ENV=production`
   - Configure secure JWT secret
   - Set up MongoDB connection (local or Atlas)
   - Configure HTTPS
   - Set appropriate file upload limits

4. **Monitoring Setup**:
   - Health endpoints: `/api/health/database`
   - Error logging and monitoring
   - Performance metrics collection

## 🚀 Latest Integrations

**🔐 Security**: 95/100 score, sandboxed Python, JWT (512-bit), input validation, real-time monitoring

**🗄️ Database**: Auto-reconnect (5s→80s), 30s health checks, connection pool (2-10), graceful shutdown

**💓 Monitoring**: `/api/health/*` endpoints, performance metrics, admin tools

**🛠️ Commands**: `npm run db:test`, `npm run db:health`, `npm run security:audit`, `npm run security:test-python`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the ISC License.

## 👥 Authors

- **Erik Williams** - *Project Creator* - [@EPW80](https://github.com/EPW80)

## 🙏 Acknowledgments

- React team for the excellent frontend framework
- scikit-learn team for powerful ML capabilities
- Recharts team for beautiful data visualization
- Open-source community for inspiration and tools

## 📞 Support

For support and questions:
- 📧 Email: erikpw009@gmail.com
- 🐛 Issues: [GitHub Issues](https://github.com/EPW80/ml-insights-hub/issues)
- 📖 Documentation: [Project Wiki](https://github.com/EPW80/ml-insights-hub/wiki)

---

<div align="center">
  <strong>🏠 Built with 💀 for Real Estate Analytics</strong>
  <br>
  <em>Empowering data-driven property decisions with Machine Learning</em>
  <br><br>
  <strong>🔐 Enterprise Security | 🗄️ Robust Database | 💓 Health Monitoring</strong>
  <br>
  <em>Production-ready with 95/100 security score and bulletproof infrastructure</em>
</div>
