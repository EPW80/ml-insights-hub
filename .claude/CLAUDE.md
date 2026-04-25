# ML Insights Hub

Full-stack real estate ML prediction app. React 19 + TypeScript frontend, Node.js/Express backend, Python scikit-learn ML layer, MongoDB Atlas, Redis, Railway deployment target.

## Stack

- **Frontend**: React 19 + TypeScript → nginx:alpine, port 3000
- **Backend**: Node.js/Express → port 5000; JWT auth, rate limiting via Redis
- **ML**: Python 3.11 venv; sandboxed scripts in `server/python-scripts/`
- **DB**: MongoDB Atlas; Redis for rate limiting (in-memory fallback)
- **CI/CD**: GitHub Actions (`ci.yml` lint+test, `docker-publish.yml` on `v*.*.*` tags → GHCR)

## Key Files

| File                                   | Purpose                                                   |
| -------------------------------------- | --------------------------------------------------------- |
| `server/server.js`                     | Entry point — middleware, DB, socket.io, routes           |
| `server/middleware/security.js`        | Rate limiters, security headers, mongo sanitize           |
| `server/utils/securePythonExecutor.js` | Python sandbox — reads `PYTHON_PATH` env var (L316)       |
| `server/routes/data/index.js`          | Upload route — multer disk storage (ephemeral on Railway) |
| `server/models/Dataset.js`             | Dataset schema — `file_path` stores upload location       |
| `client/nginx.conf`                    | nginx SPA config — security headers, gzip, cache          |
| `server/requirements.txt`              | Python deps — `~=` (unpinned, needs fixing)               |
| `server/config/logger.js`              | Winston — file transports on when `NODE_ENV=production`   |

## Commands

```bash
# Dev
docker-compose -f docker-compose.dev.yml up

# Tests
cd server && npm test
cd client && npm test

# Lint / format
npm run lint
npm run format

# Security
npm run security:audit
npm run db:health
```

## Active Work: Pre-Deployment Fixes

Complete these in order before Railway deploy. Run `cd server && npm test` after each phase.

### Phase 1 — server/server.js (no new deps)

- [x] **Guard PYTHON_PATH override** (L24): wrap in `if (!process.env.PYTHON_PATH)` and fix path from `../venv` → `venv` (container `__dirname` is `/app`)
- [x] **Socket.IO CORS multi-origin** (L41–46): split `FRONTEND_URL` on commas → array, so a Railway custom domain requires only an env var change
- [x] **Raise mlLimiter max** in `server/middleware/security.js` (L63): `10` → `30` per 5 minutes

### Phase 2 — client/nginx.conf

- [x] **Add Content-Security-Policy** after existing headers: `default-src 'self'`, `script-src 'self' 'unsafe-inline'` (CRA requires it), `connect-src 'self' <RAILWAY_BACKEND_URL>`, `img-src 'self' data:`, `font-src 'self' data:`

### Phase 3 — server/requirements.txt

- [x] **Pin exact versions**: replace all `~=` with `==` (numpy==1.24.4, pandas==2.0.3, scikit-learn==1.3.2, xgboost==1.7.6, scipy==1.11.4, statsmodels==0.14.1, shap==0.42.1, matplotlib==3.7.5, joblib==1.3.2, lime==0.2.0.1, pytest==7.4.4)

### Phase 4 — AWS S3 for uploads _(use claude-opus for this phase)_

- [x] `npm install @aws-sdk/client-s3` in `server/`
- [x] Switch multer from `diskStorage` → `memoryStorage()` in `server/routes/data/index.js`
- [x] Stream `req.file.buffer` to S3; store the S3 key/URL in `Dataset.file_path`
- [x] Update any route reading files back from disk to fetch from S3 instead _(audit: no readers exist — Python scripts resolve paths by dataset id, not via Dataset.file_path)_
- [x] Add Railway env vars: `AWS_S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

### Phase 5 — Request correlation IDs

- [x] Add `X-Request-ID` middleware in `server/server.js` before routes — use `crypto.randomUUID()` (no new dep); attach to Winston log context

## IMPORTANT: Railway env var rules

- **DO NOT** set `ENABLE_FILE_LOGGING=true` — console transport already feeds Railway's log stream
- **DO NOT** set `SKIP_AUTH=true` — blocked at startup when `NODE_ENV=production`
- **DO NOT** set `MONGO_ROOT_USER` / `MONGO_ROOT_PASSWORD` — Atlas only needs `MONGODB_URI`

## Conventions

- All route files live in `server/routes/<domain>/index.js`
- Python scripts MUST be in `server/python-scripts/` and match allowed name patterns in `securePythonExecutor.js`
- Never add `SKIP_AUTH=true` to any production config
- File uploads path changes require updating both `multer` storage config AND `Dataset` model
