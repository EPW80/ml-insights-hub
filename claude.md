# ML Insights Hub - Claude Context

## Project Overview

ML Insights Hub is a production-ready, full-stack machine learning application for real estate price prediction and analysis. The application combines modern web technologies with powerful ML capabilities, enterprise-grade security, and robust DevOps practices.

## Recent Major Updates (Latest Commit)

### DevOps & Infrastructure Improvements
- **Docker Support**: Multi-stage builds for client (React + nginx) and server (Node.js + Python)
- **Container Orchestration**: Three Docker Compose configurations (standard, dev, prod)
- **CI/CD Pipeline**: GitHub Actions workflows for automated testing, linting, and Docker image publishing
- **Dependency Management**: Dependabot configuration for automated updates

### Code Quality & Development Tools
- **Linting**: ESLint configurations for both client (TypeScript/React) and server (Node.js)
- **Formatting**: Prettier with comprehensive ignore rules
- **Git Hooks**: Husky pre-commit hooks with lint-staged
- **Editor Config**: Consistent editor settings across team

### Logging & Monitoring
- **Winston Logger**: Structured logging with file rotation and multiple transports
- **Request Logging**: Comprehensive HTTP request/response logging middleware
- **Environment-specific Logs**: Different log levels for dev/production

### Configuration Management
- **Environment Templates**: Comprehensive .env.example with all required variables
- **Version Pinning**: .node-version, .nvmrc, .python-version for consistency
- **MCP Configuration**: MongoDB MCP server setup

## Architecture

### Frontend (client/)
- **Framework**: React 19 with TypeScript
- **Styling**: Modern CSS with glassmorphism effects
- **Charts**: Recharts (7 chart types: bar, scatter, pie, line, radar, composed, radial)
- **Features**:
  - Interactive ML dashboard
  - Real-time predictions with uncertainty quantification
  - Drag-and-drop data upload with validation
  - Advanced visualizations (zoom, brush, gradients)

### Backend (server/)
- **Runtime**: Node.js with Express.js
- **Database**: MongoDB with auto-reconnection and health monitoring
- **Security**:
  - JWT authentication (512-bit entropy)
  - API key support
  - Rate limiting
  - Input validation and sanitization
  - Sandboxed Python execution
  - Security scoring (95/100)
- **ML Integration**: Python bridge for scikit-learn models
- **Logging**: Winston-based structured logging
- **Middleware**:
  - Request logging (requestLogger.js)
  - Authentication (mlAuth.js)
  - Security headers
  - CORS protection

### Machine Learning (Python)
- **Models**: Random Forest, Linear Regression, Neural Networks, Gradient Boosting
- **Features**:
  - Property price prediction
  - Uncertainty quantification (Bootstrap, Bayesian, Ensemble Variance)
  - Feature engineering
  - Model validation
- **Execution**: Sandboxed with resource limits

### Database (MongoDB)
- **Connection**: Auto-reconnection with exponential backoff (5s→80s)
- **Monitoring**: 30-second health checks
- **Pool**: 2-10 connections
- **Features**: Graceful shutdown, performance metrics

## Key Directories & Files

### Root Configuration
- `.github/workflows/`: CI/CD pipelines (ci.yml, docker-publish.yml)
- `.husky/`: Git hooks (pre-commit)
- `docker-compose.yml`: Standard orchestration
- `docker-compose.dev.yml`: Development environment
- `docker-compose.prod.yml`: Production environment
- `.env.example`: Environment variable template
- `package.json`: Root workspace with lint/format scripts

### Client (client/)
- `src/components/`: React components (DataUploadInterface, MLPredictionForm, PropertyDataVisualization, ResultsDashboard)
- `src/services/api.ts`: API client
- `Dockerfile`: Multi-stage build with nginx
- `nginx.conf`: Production server configuration
- `.eslintrc.js`: TypeScript/React linting rules

### Server (server/)
- `routes/`: API endpoints (ML predictions, data management, health)
- `middleware/`: Auth, logging, security
- `config/logger.js`: Winston logger configuration
- `ml-services/`: ML algorithm services
- `python-scripts/`: Sandboxed Python ML execution
- `scripts/`: Automation and testing tools
- `Dockerfile`: Node.js + Python environment
- `.eslintrc.js`: Node.js linting rules

## API Endpoints

### Machine Learning
- `POST /api/ml/predict` - Property price predictions
- `POST /api/ml/analyze/feature-engineering` - Feature engineering analysis
- `POST /api/ml/analyze/anomaly-detection` - Outlier detection
- `POST /api/ml/analyze/ensemble` - Ensemble model analysis
- `POST /api/ml/analyze/cross-validation` - Model validation

### Data Management
- `POST /api/data/upload` - Upload datasets (CSV/JSON/Excel)
- `GET /api/data/properties` - Retrieve property data
- `POST /api/data/validate` - Validate data format

### Health & Monitoring
- `GET /api/health/database` - Database status
- `GET /api/health/database/stats` - Connection statistics
- `GET /api/health/database/performance` - Performance metrics
- `POST /api/health/database/reconnect` - Force reconnection (admin)

## Development Workflow

### Starting Services
```bash
# All services
./start.sh

# Or individually
docker-compose -f docker-compose.dev.yml up
```

### Code Quality
```bash
npm run lint          # Lint all code
npm run format        # Format all code
npm run format:check  # Check formatting
```

### Security & Database
```bash
npm run security:audit       # Security audit
npm run security:test-python # Test Python sandbox
npm run db:test             # Test database
npm run db:health           # Monitor health
```

### Testing
```bash
cd server
npm test                    # All tests
npm run security:audit      # Security tests
cd ../client
npm test                   # Frontend tests
```

## Environment Variables

### Critical Variables
- `MONGODB_URI`: Database connection string
- `JWT_SECRET`: 512-bit JWT secret (generate with `npm run generate-jwt-secret`)
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 5000)

### Optional Variables
- `PYTHON_PATH`: Path to Python interpreter
- `UPLOAD_PATH`: File upload directory
- `MAX_FILE_SIZE`: Upload size limit
- `SKIP_AUTH`: Skip authentication (dev only)

## Security Features

### Authentication & Authorization
- JWT-based authentication
- API key support
- Role-based access control (user/admin)
- Per-user rate limiting

### Input Validation
- Comprehensive Node.js validation
- Python input validation module
- Type, range, length, pattern validation
- Malicious pattern blocking (code injection, path traversal)

### Execution Safety
- Sandboxed Python execution
- Resource limits (CPU, memory, time)
- No shell access
- Restricted file system access

### Monitoring
- Real-time security event logging
- Performance metrics
- Health check endpoints
- Automated security scoring

## Common Tasks

### Adding New ML Models
1. Create Python script in `server/python-scripts/`
2. Add input validation
3. Create route in `server/routes/`
4. Add authentication middleware
5. Update API client in `client/src/services/api.ts`
6. Add UI component in `client/src/components/`

### Updating Dependencies
1. Dependabot creates PR automatically
2. Review changes
3. Run tests: `npm test`
4. Merge if passing

### Deploying to Production
1. Run pre-production checks: `npm run preproduction`
2. Build containers: `docker-compose -f docker-compose.prod.yml build`
3. Deploy: `docker-compose -f docker-compose.prod.yml up -d`
4. Monitor: `docker-compose logs -f`

## Known Issues & Warnings

### Non-Critical Warnings
- Webpack dev server middleware deprecation (client) - Will be fixed in future react-scripts update
- ESLint TypeScript `any` types (client) - Code quality warnings, not errors
- ESLint v9 config format - Pre-commit hooks use --no-verify until migration

### Security Considerations
- Development mode has relaxed security (warnings expected)
- Production requires: secure JWT secret, HTTPS, proper CORS configuration
- Python sandbox is robust but should run in isolated container

## Performance Notes

### Frontend
- Webpack bundle optimization via multi-stage Docker build
- nginx gzip compression in production
- Code splitting and lazy loading for charts

### Backend
- MongoDB connection pooling (2-10 connections)
- Request caching where appropriate
- Efficient Python process spawning
- Winston async logging

### Database
- Indexed queries for property data
- Health monitoring every 30 seconds
- Auto-reconnection with backoff
- Connection pool management

## Contact & Support

- **Author**: Erik Williams (@EPW80)
- **Email**: erikpw009@gmail.com
- **Issues**: https://github.com/EPW80/ml-insights-hub/issues
- **Repository**: https://github.com/EPW80/ml-insights-hub

## Project Status

**Current State**: Production-ready with comprehensive DevOps infrastructure

**Security Score**: 95/100

**Latest Features**:
- Docker containerization
- CI/CD pipelines
- Structured logging
- Code quality automation
- Automated dependency updates

**Next Steps**:
- Kubernetes deployment configurations (optional)
- Advanced monitoring with Prometheus/Grafana (optional)
- Enhanced ML model versioning (optional)
