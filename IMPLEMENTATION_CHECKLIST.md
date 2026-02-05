# 🚀 NRTS PRC Monorepo - Implementation Checklist

**Status:** ✅ Structural Migration Complete - Ready for Testing

## What Has Been Done

### ✅ Code Consolidation

- [x] nrts-prc-api → backend/ (Express.js)
- [x] nrts-prc-admin → frontend/admin/ (Angular)
- [x] nrts-prc-public → frontend/public/ (Angular)
- [x] All source code, tests, and configurations preserved

### ✅ Configuration Updates

- [x] docker-compose.yml (MongoDB backend)
- [x] Backend package.json (Express dependencies)
- [x] Backend Dockerfile (Express build)
- [x] Frontend Dockerfile (dual Angular builds)
- [x] tsconfig.json files cleaned up
- [x] Unnecessary NestJS files removed

### ✅ Documentation

- [x] README.md - Comprehensive monorepo guide
- [x] MIGRATION_SUMMARY.md - Detailed migration report
- [x] Structure diagram in README
- [x] Development setup instructions
- [x] Docker Compose quick start

### ✅ Environment Setup

- [x] MongoDB configuration (docker-compose)
- [x] Backend service configuration
- [x] Frontend services configuration
- [x] Health checks configured
- [x] Volume mounts configured

## Next Steps for Development Team

### Phase 1: Local Testing (Required Before Any Commits)

**1. Verify Docker Setup**

```bash
cd /Users/barrettfalk/Projects/Github/parc/nr-acrfd-comments

# Test docker-compose
docker-compose up

# In another terminal, test endpoints:
curl http://localhost:3000/api/docs  # Backend API docs
curl http://localhost:4200            # Admin app
curl http://localhost:3000            # Public app
curl http://localhost:27017           # MongoDB health
```

**2. Verify Backend**

```bash
cd backend

# Install dependencies
npm install

# Run linting
npm run lint

# Run tests
npm run tests

# Check API startup
npm start
# Should see swagger docs at http://localhost:3000/api/docs
```

**3. Verify Frontend - Admin**

```bash
cd frontend/admin

# Install dependencies
npm install

# Run linting
npm run lint

# Run tests
npm run tests

# Check build
npm run build
```

**4. Verify Frontend - Public**

```bash
cd frontend/public

# Install dependencies
npm install

# Run linting
npm run lint

# Run tests
npm run tests

# Check build
npm run build
```

### Phase 2: CI/CD Pipeline Updates (Required)

**1. GitHub Actions Workflows**

- [ ] Review `.github/workflows/pr-open.yml` - Adjust for Express + Angular
- [ ] Review `.github/workflows/merge.yml` - Verify deployment logic
- [ ] Review `.github/workflows/.deployer.yml` - Update Helm values if needed
- [ ] Update build matrix to reference correct paths
- [ ] Test workflows in a feature branch

**Specific Changes Needed:**

- Update Docker build paths for backend (from `backend/` not `src/`)
- Update test commands (backend uses Jest, not Vitest)
- Update frontend build commands
- Verify image registry paths

**2. Helm Charts**

- [ ] Review `charts/app/values.yaml` - Update for Express backend
- [ ] Update service definitions
- [ ] Verify port mappings
- [ ] Test local Helm deploy

### Phase 3: Deployment Validation (Before Production)

**1. Local Kubernetes / OpenShift**

```bash
# Build and push images
docker build -t nrts-backend:v1 backend/
docker build -t nrts-frontend:v1 frontend/

# Deploy with Helm (after chart updates)
helm install nrts charts/app -n nrts-dev
```

**2. Environment Variable Verification**

- [ ] Verify all MongoDB connection strings
- [ ] Verify API hostname configuration
- [ ] Verify backend URL configuration in frontend
- [ ] Test with OpenShift secrets

**3. Data Migration**

- [ ] Run any pending MongoDB migrations
- [ ] Seed test data if needed
- [ ] Verify data integrity

### Phase 4: Smoke Tests (Before Go-Live)

**1. Backend API**

- [ ] API health check endpoint
- [ ] Swagger documentation loads
- [ ] Core endpoints respond correctly
- [ ] MongoDB connection working
- [ ] Authentication flow working

**2. Admin Frontend**

- [ ] Admin app loads at `/admin/`
- [ ] Login functionality works
- [ ] Admin features accessible
- [ ] API calls to backend work

**3. Public Frontend**

- [ ] Public app loads at `/`
- [ ] Public features work
- [ ] API calls to backend work
- [ ] Map functionality works (if applicable)

### Phase 5: Go-Live Checklist

- [ ] All tests passing
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Team trained on new structure
- [ ] Rollback plan in place
- [ ] Monitoring configured
- [ ] Alerts configured
- [ ] Backup verified

## File Locations Reference

### Key Configuration Files

| Component  | File                           | Purpose                  |
| ---------- | ------------------------------ | ------------------------ |
| Backend    | `backend/package.json`         | Dependencies and scripts |
| Backend    | `backend/app.js`               | Express entry point      |
| Backend    | `backend/database.json`        | MongoDB config           |
| Admin      | `frontend/admin/angular.json`  | Angular CLI config       |
| Admin      | `frontend/admin/package.json`  | Admin dependencies       |
| Public     | `frontend/public/angular.json` | Angular CLI config       |
| Public     | `frontend/public/package.json` | Public dependencies      |
| Docker     | `docker-compose.yml`           | Local development setup  |
| Kubernetes | `charts/app/`                  | Helm deployment config   |

### API Documentation

| Service         | URL                            | Purpose           |
| --------------- | ------------------------------ | ----------------- |
| Backend API     | http://localhost:3000/api      | API base          |
| Swagger Docs    | http://localhost:3000/api/docs | API documentation |
| Admin Frontend  | http://localhost:4200          | Admin app         |
| Public Frontend | http://localhost:3000          | Public app        |
| MongoDB         | localhost:27017                | Database          |

## Known Limitations & Notes

### Current Implementation

1. **Frontend Docker Builds**
   - Both Angular apps are built in Docker Compose but served on different ports
   - This is temporary; consider consolidating to single deployment

2. **GitHub Actions**
   - Workflows still reference NestJS paths
   - Will need updates for Express backend

3. **Helm Charts**
   - `charts/app/` may have PostgreSQL references (from template)
   - Should be verified and updated for MongoDB

4. **Mixed Technology Stack**
   - Backend: Express.js (Node.js)
   - Frontend: Angular 6 (legacy)
   - These should be maintained as-is or gradually modernized

## Quick Reference Commands

```bash
# Local development
cd nr-acrfd-comments
docker-compose up              # Start all services

# Backend development
cd backend
npm install
npm start                       # Start server
npm run tests                   # Run tests
npm run lint                    # Check linting

# Admin frontend development
cd frontend/admin
npm install
npm start                       # Start dev server (port 4200)
npm run tests                   # Run tests

# Public frontend development
cd frontend/public
npm install
npm start                       # Start dev server (port 3000)
npm run tests                   # Run tests

# Docker build
docker-compose build            # Build all images

# Clean everything
docker-compose down             # Stop services
docker system prune             # Clean images/volumes
```

## Documentation Files

- 📖 **README.md** - Main documentation
- 📋 **MIGRATION_SUMMARY.md** - Migration details
- 📝 **IMPLEMENTATION_CHECKLIST.md** - This file
- 🔒 **SECURITY.md** - Security guidelines
- 🤝 **CONTRIBUTING.md** - Contribution guidelines
- ⚖️ **CODE_OF_CONDUCT.md** - Code of conduct
- 📄 **LICENSE** - Apache 2.0

## Support & Questions

1. **Monorepo Structure:** See README.md
2. **Migration Details:** See MIGRATION_SUMMARY.md
3. **Setup Issues:** Check backend/README.md or frontend app READMEs
4. **Original Repos:**
   - https://github.com/bcgov/nrts-prc-api
   - https://github.com/bcgov/nrts-prc-admin
   - https://github.com/bcgov/nrts-prc-public

## Next Immediate Action

👉 **Run `docker-compose up` and test that all services start successfully**

This is the critical first step before proceeding to GitHub Actions updates.

---

**Last Updated:** February 4, 2026  
**Migration Status:** ✅ Complete - Ready for Testing
