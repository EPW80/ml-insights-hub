# 🏠 ML Insights Hub

A comprehensive full-stack machine learning application for real estate price prediction and analysis. This application combines modern web technologies with powerful ML capabilities to provide intelligent insights into property markets.

## 🌟 Features

- **📊 Interactive ML Dashboard** - Real-time analytics with comprehensive charts and metrics
- **🎯 Property Price Predictions** - Multiple ML models for accurate price forecasting
- **📈 Data Visualization** - Interactive charts including scatter plots, bar charts, and trend analysis
- **📁 Data Upload Interface** - Drag-and-drop file upload with validation and progress tracking
- **🤖 Multiple ML Algorithms** - Random Forest, Linear Regression, Neural Networks, and Gradient Boosting
- **🎲 Uncertainty Quantification** - Confidence intervals and prediction reliability metrics
- **🎨 Modern UI/UX** - Glass morphism design with responsive layout
- **⚡ Real-time Updates** - Live predictions and dashboard updates
- **🔐 Enterprise Security** - Comprehensive security infrastructure with JWT, input validation, and Python sandboxing
- **🗄️ Robust Database Management** - Enterprise-grade MongoDB connection with automatic reconnection and health monitoring
- **💓 Health Monitoring** - Real-time database and system health checks with performance metrics
- **🛡️ Secure Python Execution** - Sandboxed ML execution with resource limits and security validation

## 🔒 Security & Infrastructure Features

- **🛡️ Secure Python Execution** - Sandboxed Python environment with resource limits and input validation
- **🔑 JWT Authentication** - Cryptographically secure token generation (512-bit entropy)
- **🚨 Security Auditing** - Comprehensive security scoring system (95/100 current score)
- **⚠️ Input Sanitization** - Advanced pattern detection for malicious inputs
- **📊 Security Monitoring** - Real-time security event logging and alerts
- **🔄 Startup Validation** - Automatic security checks on server startup
- **🗄️ MongoDB Connection Management** - Enterprise-grade database connection with automatic reconnection
- **💓 Health Monitoring** - Real-time database and system health checks
- **🔧 Connection Recovery** - Exponential backoff reconnection strategy (5s → 80s)
- **📈 Performance Metrics** - Database response times and connection statistics

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

### Frontend
- **React 19** with TypeScript
- **Modern CSS** with glass morphism effects
- **Recharts** for interactive data visualization
- **React Router DOM** for navigation
- **Axios** for API communication
- **React Hook Form** for form management

### Backend
- **Node.js** with Express.js
- **🔐 Secure Python Bridge** for ML integration with sandboxing
- **🛡️ Security Middleware** (JWT, rate limiting, input validation)
- **🗄️ Enhanced MongoDB Connection** with automatic reconnection and health monitoring
- **💓 Database Health Endpoints** for real-time monitoring
- **Multer** for file uploads
- **CORS** for cross-origin requests
- **🚨 Security Auditing** system

### Machine Learning
- **scikit-learn** for ML algorithms
- **pandas & numpy** for data manipulation
- **faker** for synthetic data generation
- **Random Forest, Linear Regression, Neural Networks** for predictions
- **Uncertainty quantification** methods

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
├── 📁 client/                       # React frontend application
│   ├── src/
│   │   ├── components/              # React UI components
│   │   │   ├── MLPredictionForm.tsx           # Property prediction interface
│   │   │   ├── PropertyDataVisualization.tsx # Interactive charts and graphs
│   │   │   ├── DataUploadInterface.tsx       # File upload with validation
│   │   │   ├── ResultsDashboard.tsx          # Analytics dashboard
│   │   │   └── *.css                         # Component styling
│   │   ├── hooks/                   # Custom React hooks
│   │   │   └── usePrediction.ts              # Prediction state management
│   │   ├── services/                # API communication layer
│   │   │   └── api.ts                        # REST API service
│   │   ├── utils/                   # Utility functions
│   │   └── App.tsx                  # Main application component
│   ├── public/                      # Static assets
│   └── package.json                 # Frontend dependencies
├── 📁 server/                       # Node.js backend
│   ├── config/                      # Server configuration
│   │   └── database.js              # Enhanced MongoDB connection manager
│   ├── middleware/                  # Express middleware
│   │   └── security.js              # Security middleware (rate limiting, validation)
│   ├── ml-services/                 # ML service modules
│   │   ├── supervised/              # Supervised learning algorithms
│   │   ├── uncertainty/             # Uncertainty quantification
│   │   └── unsupervised/            # Unsupervised learning
│   ├── models/                      # Data models and schemas
│   ├── python-scripts/              # Python ML scripts
│   ├── routes/                      # API endpoint definitions
│   │   ├── auth/                    # Authentication routes
│   │   ├── data/                    # Data management routes
│   │   ├── health/                  # Health monitoring endpoints
│   │   └── ml/                      # Machine learning routes
│   ├── scripts/                     # Management and testing scripts
│   │   ├── security-audit.js        # Comprehensive security auditing
│   │   ├── test-database-connection.js # Database connection testing
│   │   ├── database-health-check.js    # Database health monitoring
│   │   └── database-stats.js        # Database statistics collection
│   ├── uploads/                     # File upload storage
│   ├── utils/                       # Backend utilities
│   │   ├── securePythonBridge.js    # Secure Python script executor
│   │   ├── securePythonExecutor.js  # Core Python security engine
│   │   └── startupSecurity.js       # Startup security validation
│   ├── server.js                    # Main server file
│   └── requirements.txt             # Python dependencies
├── 📁 datasets/                     # Generated sample datasets
├── 📁 models/                       # Trained ML models storage
├── 📁 venv/                         # Python virtual environment
├── .gitignore                       # Git ignore rules
├── start.sh                         # Application startup script
└── README.md                        # Project documentation
```

## 🎯 Key Components

### Frontend Components

#### � Results Dashboard
- **Real-time analytics** with interactive charts
- **Summary metrics** for predictions and model performance
- **Trend analysis** with configurable time ranges
- **Recent predictions table** with detailed information

#### 🎯 ML Prediction Form
- **Property feature inputs** (bedrooms, bathrooms, sqft, etc.)
- **Multiple ML models** selection (Random Forest, Linear Regression, Neural Network, Gradient Boosting)
- **Uncertainty quantification** with confidence intervals
- **Real-time predictions** with immediate results

#### 📈 Property Data Visualization
- **Interactive charts**: Bar charts, scatter plots, pie charts, line graphs
- **Market analysis**: Price distribution, size vs price correlation
- **Property insights**: Type breakdown and trend analysis
- **Responsive design** with hover effects and tooltips

#### 📁 Data Upload Interface
- **Drag-and-drop** file upload functionality
- **File validation** (CSV/JSON/Excel support, size limits)
- **Progress tracking** with visual feedback
- **Upload results** display with data validation

### Backend Services

#### 🤖 ML Services
- **Supervised Learning**: Property price prediction models
- **Uncertainty Quantification**: Confidence interval calculation
- **Data Processing**: Feature engineering and validation
- **Model Training**: Dynamic model creation and updates

#### 🔗 API Endpoints
- **Prediction API**: Real-time property price predictions
- **Data Management**: File upload and dataset handling
- **Model Services**: Model training and evaluation
- **Health Monitoring**: Database and system health checks
- **Security Auditing**: Real-time security status and metrics
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

## 🖥️ Application Screenshots

### 📊 Dashboard Overview
The main dashboard provides comprehensive analytics and insights:
- Real-time prediction metrics and statistics
- Interactive charts showing market trends
- Recent predictions with confidence levels
- Model performance comparisons

### 🎯 Prediction Interface
Make accurate property price predictions:
- Input property features (bedrooms, bathrooms, square footage, etc.)
- Select from multiple ML models
- Choose uncertainty quantification methods
- Get instant predictions with confidence intervals

### 📈 Data Visualization
Explore property market insights:
- Price distribution analysis
- Size vs price correlation charts
- Property type breakdowns
- Market trend analysis over time

### 📁 Data Upload
Easy data management:
- Drag-and-drop file upload
- Support for CSV, JSON, and Excel formats
- Real-time validation and progress tracking
- Data quality assessment and feedback

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

### 🔐 Enterprise Security Infrastructure
- **Security Score**: 95/100 with comprehensive auditing
- **Secure Python Execution**: Sandboxed environment with resource limits
- **JWT Authentication**: 512-bit entropy cryptographically secure tokens
- **Input Validation**: Advanced pattern detection for malicious inputs
- **Real-time Monitoring**: Security event logging and alerts

### 🗄️ Enhanced Database Management
- **Auto-Reconnection**: Exponential backoff strategy (5s → 80s)
- **Health Monitoring**: Continuous 30-second health checks
- **Performance Metrics**: Real-time database response times
- **Connection Pooling**: Optimized for concurrent requests (min: 2, max: 10)
- **Graceful Shutdown**: Proper cleanup on application termination

### 💓 Health Monitoring System
- **Real-time Endpoints**: `/api/health/database` for live status
- **Performance Testing**: Response time measurement and analysis
- **Statistics Collection**: Comprehensive connection and usage metrics
- **Administrative Tools**: Force reconnection and maintenance capabilities

### 🛠️ Management Tools
- **Database Testing**: `npm run db:test` for connection validation
- **Health Monitoring**: `npm run db:health` for 15-second health tests
- **Security Auditing**: `npm run security:audit` for comprehensive checks
- **Python Security**: `npm run security:test-python` for execution validation

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
  <strong>🏠 Built with ❤️ for Real Estate Analytics</strong>
  <br>
  <em>Empowering data-driven property decisions with Machine Learning</em>
  <br><br>
  <strong>🔐 Enterprise Security | 🗄️ Robust Database | 💓 Health Monitoring</strong>
  <br>
  <em>Production-ready with 95/100 security score and bulletproof infrastructure</em>
</div>
