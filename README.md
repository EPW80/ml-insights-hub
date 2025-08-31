# 🧠 ML Insights Hub

A full-stack machine learning application that combines modern web technologies with powerful ML capabilities for data analysis, model training, and intelligent insights.

## 🌟 Features

- **🎯 Interactive ML Dashboard** - Real-time data visualization and model insights
- **🤖 Multiple ML Algorithms** - Support for supervised, unsupervised, and uncertainty quantification
- **📊 Data Management** - Upload, process, and analyze datasets
- **🔮 Real-time Predictions** - Live model predictions with uncertainty estimates
- **📈 Visualization Tools** - Interactive charts and graphs using Recharts
- **🔄 WebSocket Integration** - Real-time updates and notifications
- **🔐 User Authentication** - Secure user management and authorization

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │    │   Express API   │    │    MongoDB      │
│  (Port 3000)    │◄──►│  (Port 5000)    │◄──►│  (Port 27017)   │
│                 │    │                 │    │                 │
│ • TypeScript    │    │ • REST APIs     │    │ • User Data     │
│ • Tailwind CSS  │    │ • ML Services   │    │ • ML Models     │
│ • React Query   │    │ • Python Bridge │    │ • Predictions   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ Python ML Env   │
                       │                 │
                       │ • TensorFlow    │
                       │ • scikit-learn  │
                       │ • pandas/numpy  │
                       └─────────────────┘
```

## 🛠️ Tech Stack

### Frontend
- **React 19** with TypeScript
- **Tailwind CSS** for styling
- **React Query** for data fetching
- **React Router** for navigation
- **Recharts** for data visualization
- **Socket.io Client** for real-time communication
- **React Hook Form** for form management
- **Lucide React** for icons

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose ODM
- **Socket.io** for WebSocket connections
- **JWT** for authentication
- **Multer** for file uploads
- **Python Bridge** for ML integration

### Machine Learning
- **TensorFlow** for deep learning
- **scikit-learn** for traditional ML
- **XGBoost** for gradient boosting
- **pandas & numpy** for data manipulation
- **matplotlib & seaborn** for visualization
- **SHAP** for model explainability

## 📋 Prerequisites

- **Node.js** (v16 or higher)
- **Python** (v3.8 or higher)
- **MongoDB** (v4.4 or higher)
- **npm** or **yarn**

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/ml-insights-hub.git
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

# Create environment file
cp .env.example .env
# Edit .env with your configuration
```

### 4. Setup Frontend
```bash
cd ../client

# Install Node.js dependencies
npm install
```

### 5. Start MongoDB
```bash
# On Ubuntu/Debian
sudo systemctl start mongod
sudo systemctl enable mongod

# On macOS with Homebrew
brew services start mongodb-community

# On Windows
net start MongoDB
```

### 6. Run the Application

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
npm run dev

# Terminal 3: Activate Python Environment
source venv/bin/activate
```

## 📁 Project Structure

```
ml-insights-hub/
├── 📁 client/                    # React frontend
│   ├── src/
│   │   ├── components/           # React components
│   │   ├── hooks/               # Custom React hooks
│   │   ├── services/            # API services
│   │   └── utils/               # Utility functions
│   ├── public/                  # Static assets
│   └── package.json             # Frontend dependencies
├── 📁 server/                    # Node.js backend
│   ├── config/                  # Server configuration
│   ├── middleware/              # Express middleware
│   ├── ml-services/             # ML service modules
│   │   ├── supervised/          # Supervised learning
│   │   ├── uncertainty/         # Uncertainty quantification
│   │   └── unsupervised/        # Unsupervised learning
│   ├── models/                  # Database schemas
│   ├── python-scripts/          # Python ML scripts
│   ├── routes/                  # API routes
│   ├── uploads/                 # File upload storage
│   ├── utils/                   # Backend utilities
│   ├── websocket/               # WebSocket handlers
│   └── requirements.txt         # Python dependencies
├── 📁 datasets/                  # ML datasets storage
├── 📁 models/                    # Trained ML models
├── 📁 venv/                      # Python virtual environment
├── .gitignore                   # Git ignore rules
├── start.sh                     # Startup script
└── README.md                    # This file
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the `server/` directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/ml-insights-hub

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRE=7d

# Python
PYTHON_PATH=../venv/bin/python

# File Upload
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760  # 10MB
```

## 📊 Available ML Services

### Supervised Learning
- **Linear Regression** - For continuous target prediction
- **Random Forest** - For classification and regression
- **XGBoost** - For high-performance gradient boosting
- **Neural Networks** - For complex pattern recognition

### Unsupervised Learning
- **K-Means Clustering** - For data segmentation
- **PCA** - For dimensionality reduction
- **DBSCAN** - For density-based clustering

### Uncertainty Quantification
- **Bayesian Neural Networks** - For uncertainty estimation
- **Ensemble Methods** - For prediction confidence
- **Conformal Prediction** - For prediction intervals

## 🎯 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile

### Data Management
- `POST /api/data/upload` - Upload dataset
- `GET /api/data/datasets` - List datasets
- `DELETE /api/data/:id` - Delete dataset

### Machine Learning
- `POST /api/ml/train` - Train ML model
- `POST /api/ml/predict` - Make predictions
- `GET /api/ml/models` - List trained models
- `POST /api/ml/analyze` - Analyze data patterns

## 🧪 Testing

### Backend Tests
```bash
cd server
npm test
```

### Frontend Tests
```bash
cd client
npm test
```

### Python Tests
```bash
source venv/bin/activate
python -m pytest server/python-scripts/tests/
```

## 🚀 Deployment

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up --build
```

### Manual Deployment
1. Set `NODE_ENV=production` in server `.env`
2. Build frontend: `cd client && npm run build`
3. Configure reverse proxy (nginx/Apache)
4. Set up process manager (PM2)
5. Configure SSL certificates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- **Your Name** - *Initial work* - [YourGitHub](https://github.com/yourusername)

## 🙏 Acknowledgments

- React team for the amazing framework
- TensorFlow team for ML capabilities
- MongoDB team for the database
- All open-source contributors

## 📞 Support

For support and questions:
- 📧 Email: erikpw009@gmail.com
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/ml-insights-hub/issues)
- 📖 Docs: [Project Wiki](https://github.com/yourusername/ml-insights-hub/wiki)

---

<div align="center">
  <strong>Built with 💀 for the ML community</strong>
</div>
