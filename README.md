# 🚀 NRTS PRC - Consolidated Monorepo

[![MIT License](https://img.shields.io/github/license/bcgov/quickstart-openshift.svg)](/LICENSE)
[![Lifecycle](https://img.shields.io/badge/Lifecycle-Active-339999)](https://github.com/bcgov/repomountie/blob/master/doc/lifecycle-badges.md)

## 📋 Project Overview

This is a consolidated monorepo containing three previously separate applications:

- **nrts-prc-admin** - Angular admin frontend application
- **nrts-prc-public** - Angular public frontend application
- **nrts-prc-api** - Express.js backend API

The applications have been integrated into the following structure:

- **backend/** - Express.js API server (formerly nrts-prc-api)
- **frontend/admin/** - Angular admin application (formerly nrts-prc-admin)
- **frontend/public/** - Angular public application (formerly nrts-prc-public)
- **migrations/** - Database migration scripts
- **charts/** - Helm charts for Kubernetes deployment

## 🏗️ Monorepo Structure:

```
.
├── backend/                      # Express.js API backend
│   ├── api/                      # API controllers, helpers, swagger
│   ├── migrations/               # DB migrations
│   ├── seed/                     # Database seed data
│   ├── data_migration/           # Data migration scripts
│   ├── app.js                    # Express app entry point
│   ├── database.json             # Database configuration
│   ├── package.json              # Backend dependencies
│   └── Dockerfile                # Backend Docker image
│
├── frontend/                     # Angular frontend applications
│   ├── admin/                    # Admin portal
│   │   ├── src/                  # Admin Angular source code
│   │   ├── e2e/                  # End-to-end tests
│   │   ├── angular.json          # Angular CLI config
│   │   ├── package.json          # Admin dependencies
│   │   └── tsconfig.json         # TypeScript config
│   │
│   ├── public/                   # Public portal
│   │   ├── src/                  # Public Angular source code
│   │   ├── e2e/                  # End-to-end tests
│   │   ├── angular.json          # Angular CLI config
│   │   ├── package.json          # Public dependencies
│   │   └── tsconfig.json         # TypeScript config
│   │
│   ├── Dockerfile                # Frontend Docker build
│   └── .dockerignore             # Docker ignore patterns
│
├── migrations/                   # SQL migrations (if using PostgreSQL later)
│   └── sql/                      # SQL migration files
│
├── charts/                       # Kubernetes deployment
│   ├── app/                      # Main application Helm chart
│   └── crunchy/                  # PostgreSQL chart (optional)
│
├── docker-compose.yml            # Local development environment
├── .github/                      # GitHub Actions workflows
│   └── workflows/                # CI/CD pipeline definitions
│
└── README.md                     # This file
```

## 🗄️ Database

**Current:** MongoDB

- Database: `nrts-dev` (configurable)
- Default User: `admin`
- Default Password: `nrts-dev`
- Port: `27017`

## 🏃‍♂️ Quick Start with Docker Compose

### Prerequisites

- Docker Desktop or Docker Engine
- Docker Compose

### Running Locally

```bash
# Clone and navigate to the repo
git clone <repository-url>
cd nr-acrfd-comments

# Start all services (MongoDB, backend, frontend)
docker-compose up

# Access the applications:
# - Admin Frontend: http://localhost:4200/admin
# - Public Frontend: http://localhost:3000
# - API Docs: http://localhost:3000/api/docs
# - MongoDB: mongodb://localhost:27017
```

### Docker Compose Services

- **database** - MongoDB container
- **backend** - Express.js API (port 3000)
- **frontend-admin** - Admin Angular app (port 4200)
- **frontend-public** - Public Angular app (port 3000)

## 🔨 Development Setup

### Backend Development

```bash
cd backend

# Install dependencies
npm install

# Set environment variables
export MONGODB_SERVICE_HOST=localhost
export MONGODB_USERNAME=admin
export MONGODB_PASSWORD=nrts-dev
export MONGODB_DATABASE=nrts-dev

# Start backend server
npm start

# Run tests
npm run tests

# Run linting
npm run lint

# Fix linting issues
npm run lint-fix
```

**Backend Endpoints:**

- API Base: `http://localhost:3000/api`
- Swagger Docs: `http://localhost:3000/api/docs`

### Frontend - Admin App

```bash
cd frontend/admin

# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build

# Run tests
npm run tests

# Lint code
npm run lint
```

**Admin App:**

- Dev Server: `http://localhost:4200`
- Deploy URL: `/admin/`

### Frontend - Public App

```bash
cd frontend/public

# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build

# Run tests
npm run tests

# Lint code
npm run lint
```

**Public App:**

- Dev Server: `http://localhost:3000`
- Deploy URL: `/`

## 🧪 Testing

### Backend Tests

```bash
cd backend
npm run tests           # Run with file watcher
npm run tests-ci        # Run once with coverage
npm run tests-debug     # Debug mode
```

### Frontend Tests

```bash
cd frontend/admin
npm run tests          # Angular test suite

cd frontend/public
npm run tests          # Angular test suite
```

## 🚀 Build & Deployment

### Docker Build

```bash
# Build all images
docker build -t nrts-backend:latest backend/
docker build -t nrts-frontend:latest frontend/

# Or use docker-compose
docker-compose build
```

### Kubernetes/OpenShift Deployment

Helm charts are located in the `charts/` directory:

```bash
# Deploy using Helm
helm install nrts charts/app \
  -n nrts-dev \
  --values charts/app/values.yaml

# Upgrade deployment
helm upgrade nrts charts/app \
  -n nrts-dev \
  --values charts/app/values.yaml
```

## 🔄 CI/CD Pipeline

GitHub Actions workflows are configured in `.github/workflows/`:

- **pr-open.yml** - Triggered on PR open/update: builds, tests, deploys to PR environment
- **pr-close.yml** - Cleans up PR environment
- **pr-validate.yml** - Validates PR (checks commits, titles, etc.)
- **merge.yml** - Triggered on merge to main: deploys to TEST/PROD
- **analysis.yml** - Security and code quality scanning
- **scheduled.yml** - Nightly tests and reports

### Workflow Triggers

| Workflow        | Trigger           | Action                                                       |
| --------------- | ----------------- | ------------------------------------------------------------ |
| PR Build & Test | Pull Request      | Build images, run tests, deploy to `pr-<number>` environment |
| Merge to Main   | Merge to `master` | Deploy to TEST environment                                   |
| Manual Deploy   | Workflow dispatch | Deploy to PROD environment                                   |

## 📝 Git Workflow

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes to backend, frontend, or both
3. Push branch and create a Pull Request
4. GitHub Actions will:
   - Build Docker images
   - Run tests
   - Deploy to ephemeral PR environment
   - Run security scans
5. After approval and merge, deploy to TEST/PROD

## 🔧 Configuration

### Environment Variables

#### Backend

```bash
MONGODB_SERVICE_HOST=localhost
MONGODB_USERNAME=admin
MONGODB_PASSWORD=nrts-dev
MONGODB_DATABASE=nrts-dev
API_HOSTNAME=localhost:3000
NODE_ENV=development
UPLOAD_DIRECTORY=./uploads/
```

#### Frontend

```bash
BACKEND_URL=http://localhost:3000
```

### Database Connection

The backend expects MongoDB connection via:

- `MONGODB_SERVICE_HOST` (default: localhost)
- `MONGODB_USERNAME` (default: admin)
- `MONGODB_PASSWORD` (default: nrts-dev)
- `MONGODB_DATABASE` (default: nrts-dev)

Or legacy env vars:

- `DB_1_PORT_27017_TCP_ADDR`

## 📚 API Documentation

API documentation is available at:

```
http://localhost:3000/api/docs
```

Swagger/OpenAPI spec: `backend/api/swagger/swagger.yaml`

## 🛠️ Tools & Technologies

### Backend

- **Runtime:** Node.js 10+
- **Framework:** Express.js
- **Database:** MongoDB
- **Testing:** Jest
- **Linting:** ESLint, Prettier
- **API Docs:** Swagger/OpenAPI

### Frontend (Admin)

- **Framework:** Angular 6
- **UI Library:** Angular Material, Bootstrap
- **Testing:** Jasmine/Karma
- **Linting:** TSLint, Prettier

### Frontend (Public)

- **Framework:** Angular 6
- **UI Library:** Bootstrap, Leaflet
- **Testing:** Jasmine/Karma
- **Linting:** TSLint, Prettier

### DevOps

- **Containerization:** Docker
- **Orchestration:** Kubernetes/OpenShift
- **Package Manager:** Helm
- **CI/CD:** GitHub Actions

## 📖 Original Repositories

This monorepo consolidates code from:

- https://github.com/bcgov/nrts-prc-admin
- https://github.com/bcgov/nrts-prc-public
- https://github.com/bcgov/nrts-prc-api

## 📄 License

Apache License 2.0 - See [LICENSE](/LICENSE) file

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines

## ⚖️ Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
