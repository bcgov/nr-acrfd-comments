# Migration Summary: NRTS PRC Monorepo Consolidation

**Date:** February 4, 2026  
**Status:** ✅ Structural Migration Complete

## Overview

Three separate repositories have been successfully consolidated into a single monorepo:

- `nrts-prc-api` → `nr-acrfd-comments/backend/`
- `nrts-prc-admin` → `nr-acrfd-comments/frontend/admin/`
- `nrts-prc-public` → `nr-acrfd-comments/frontend/public/`

## What Changed

### 1. Backend Integration ✅

**From:** `nrts-prc-api` (Express.js Node.js backend)

**To:** `nr-acrfd-comments/backend/`

**Changes:**

- Copied `api/`, `migrations/`, `seed/`, `data_migration/` directories
- Copied `app.js` (Express entry point) and `database.json` (MongoDB config)
- Updated `package.json` with Express dependencies (preserved from original)
- Replaced `Dockerfile` with Express-compatible multi-stage build
- Cleaned up NestJS-specific configs (tsconfig.json, nest-cli.json, etc.)
- Database: **MongoDB** (unchanged)

**Port:** 3000

**Key Files:**

```
backend/
├── api/                  # Controllers, helpers, swagger
├── migrations/           # DB migrations
├── seed/                 # Seed data
├── data_migration/       # Data migration scripts
├── app.js               # Express server
├── database.json        # MongoDB connection config
├── package.json         # Dependencies
└── Dockerfile           # Multi-stage Docker build
```

### 2. Frontend - Admin App ✅

**From:** `nrts-prc-admin` (Angular 6 admin portal)

**To:** `nr-acrfd-comments/frontend/admin/`

**Changes:**

- Copied entire Angular project structure
- Preserved all source code, tests, and configuration
- Angular configuration remains intact
- Deploy URL: `/admin/`

**Port:** 4200 (in docker-compose)

### 3. Frontend - Public App ✅

**From:** `nrts-prc-public` (Angular 6 public portal)

**To:** `nr-acrfd-comments/frontend/public/`

**Changes:**

- Copied entire Angular project structure
- Preserved all source code, tests, and configuration
- Angular configuration remains intact
- Deploy URL: `/` (root)

**Port:** 3000 (in docker-compose)

### 4. Docker Compose Configuration ✅

**Changes:**

- Replaced PostgreSQL with **MongoDB**
- Removed Flyway migrations (for MongoDB)
- Configured three main services:
  - `database` - MongoDB 7
  - `backend` - Express API
  - `frontend-admin` - Admin Angular app
  - `frontend-public` - Public Angular app

**Docker Compose Services:**

```yaml
database: MongoDB (port 27017)
backend: Express API (port 3000)
frontend-admin: Angular admin (port 4200)
frontend-public: Angular public (port 3000)
```

### 5. Documentation ✅

**Changes:**

- Created comprehensive `README.md` with:
  - Monorepo structure explanation
  - Quick start guide (Docker Compose)
  - Development setup instructions for each component
  - CI/CD pipeline overview
  - Configuration guide
  - Technology stack overview

### 6. GitHub Actions ✅

**Status:** Workflows from `nr-acrfd-comments` template are ready to use:

- `pr-open.yml` - Build and test on PR
- `pr-close.yml` - Cleanup on PR close
- `pr-validate.yml` - PR validation
- `merge.yml` - Deploy to TEST/PROD
- `analysis.yml` - Security scans
- `scheduled.yml` - Nightly runs

**Note:** These workflows are designed for the template's NestJS + React stack. They may need
adjustment for the Express + Angular stack.

## Directory Structure

```
nr-acrfd-comments/
├── .backup/                    # Backups of original template code
│   ├── backend/                # Original NestJS backend
│   └── frontend/               # Original React frontend
│
├── backend/                    # Express API (from nrts-prc-api)
│   ├── api/
│   ├── migrations/
│   ├── seed/
│   ├── app.js
│   ├── package.json
│   └── Dockerfile
│
├── frontend/                   # Two Angular apps
│   ├── admin/                  # From nrts-prc-admin
│   │   ├── src/
│   │   ├── e2e/
│   │   ├── angular.json
│   │   └── package.json
│   │
│   ├── public/                 # From nrts-prc-public
│   │   ├── src/
│   │   ├── e2e/
│   │   ├── angular.json
│   │   └── package.json
│   │
│   └── Dockerfile              # Multi-app build for both
│
├── charts/                     # Kubernetes deployment (Helm)
├── migrations/                 # SQL migrations (for reference)
├── docker-compose.yml          # Local development setup
├── README.md                   # Comprehensive documentation
└── .github/workflows/          # CI/CD pipeline
```

## Environment Configuration

### Backend (Express)

```bash
MONGODB_SERVICE_HOST=localhost
MONGODB_USERNAME=admin
MONGODB_PASSWORD=nrts-dev
MONGODB_DATABASE=nrts-dev
API_HOSTNAME=localhost:3000
NODE_ENV=development
UPLOAD_DIRECTORY=./uploads/
```

### Database (MongoDB)

```bash
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=nrts-dev
MONGO_INITDB_DATABASE=nrts-dev
```

## What Remains

### ⚠️ Needs Review/Updates

1. **GitHub Actions Workflows**
   - Current workflows are designed for NestJS + React
   - May need adjustment for Express + Angular setup
   - Build matrix and paths may need tuning

2. **Helm Charts**
   - `charts/app/` may need updating for Express backend
   - Database configuration (still references PostgreSQL in some places)
   - May need to update service definitions

3. **Frontend Dockerfile**
   - Currently builds both Angular apps but serves them on different ports
   - May need refinement for production deployment

4. **Root Configuration Files**
   - ESLint, Prettier configs may need adjustment for mixed Angular + Express codebase
   - Consider creating separate configs for backend and frontend

## Next Steps

### Immediate (Required)

1. **Test docker-compose locally**

   ```bash
   cd nr-acrfd-comments
   docker-compose up
   ```

   Verify all services start and applications are accessible

2. **Update GitHub Actions workflows**
   - Modify `.github/workflows/` to work with Express backend
   - Update build matrix to reference correct paths
   - Adjust test commands

3. **Update Helm charts**
   - Verify `charts/app/` works with Express backend
   - Update service definitions if needed
   - Test deployment to OpenShift

### Medium Term

4. **Install dependencies locally**

   ```bash
   cd backend && npm install
   cd ../frontend/admin && npm install
   cd ../frontend/public && npm install
   ```

5. **Verify applications build**

   ```bash
   # Backend
   cd backend && npm run build

   # Admin frontend
   cd frontend/admin && npm run build

   # Public frontend
   cd frontend/public && npm run build
   ```

6. **Run tests**
   ```bash
   cd backend && npm run tests
   cd ../frontend/admin && npm run tests
   cd ../frontend/public && npm run tests
   ```

### Long Term

7. **Consider technology consolidation** (optional future work)
   - Migrate to React (would require rewriting Angular apps)
   - Migrate to PostgreSQL (optional, MongoDB works fine)
   - Upgrade dependencies

## Backup Information

Original template code has been backed up to:

- `.backup/backend/` - Original NestJS backend
- `.backup/frontend/` - Original React frontend

These can be referenced if needed to restore any template patterns or configurations.

## Files Changed Summary

### New/Modified Files

- `backend/package.json` - Updated with Express dependencies
- `backend/Dockerfile` - Changed to Express multi-stage build
- `backend/tsconfig.json` - Simplified for Express/JavaScript
- `frontend/Dockerfile` - Updated to build both Angular apps
- `docker-compose.yml` - Replaced PostgreSQL with MongoDB
- `README.md` - Complete rewrite with monorepo documentation

### Removed Files

- `backend/nest-cli.json` - NestJS specific
- `backend/tsconfig.build.json` - NestJS specific
- `backend/vitest.config.mts` - NestJS/Vitest specific
- `backend/prisma.config.ts` - NestJS/Prisma specific
- `backend/src/` - NestJS source code
- `backend/test/` - NestJS tests
- `frontend/{original src, e2e, config files}` - Replaced with admin/public structure

## Migration Verification Checklist

- [x] Backend code copied and configured
- [x] Admin frontend copied and configured
- [x] Public frontend copied and configured
- [x] docker-compose.yml updated for MongoDB
- [x] README documentation created
- [x] Directory structure organized
- [x] Unnecessary config files removed
- [ ] Docker-compose tested locally
- [ ] All dependencies install correctly
- [ ] Applications build successfully
- [ ] Tests run successfully
- [ ] GitHub Actions workflows updated
- [ ] Helm charts verified
- [ ] Applications deploy to OpenShift

## Questions & Support

For questions about this migration:

1. Refer to the comprehensive `README.md`
2. Check original repository documentation:
   - https://github.com/bcgov/nrts-prc-api
   - https://github.com/bcgov/nrts-prc-admin
   - https://github.com/bcgov/nrts-prc-public
3. Consult the template documentation:
   - https://github.com/bcgov/quickstart-openshift
