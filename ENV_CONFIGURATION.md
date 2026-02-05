# Environment Configuration Guide

This guide explains all environment variables used in the NRTS PRC monorepo.

## Overview

The monorepo uses `.env` files for configuration:

- `.env.example` - Template showing all available variables
- `.env` - Your actual configuration (DO NOT commit this file)

## File Locations

```
nr-acrfd-comments/
├── .env                          # Root level (docker-compose)
├── .env.example                  # Root level template
├── backend/
│   ├── .env                      # Backend configuration
│   └── .env.example              # Backend template
├── frontend/
│   ├── admin/
│   │   ├── .env                  # Admin app config
│   │   └── .env.example          # Admin template
│   └── public/
│       ├── .env                  # Public app config
│       └── .env.example          # Public template
```

## Backend Configuration

### Location: `backend/.env`

**Database Configuration**

```env
MONGODB_SERVICE_HOST=localhost      # MongoDB host
MONGODB_USERNAME=admin              # MongoDB username
MONGODB_PASSWORD=nrts-dev           # MongoDB password
MONGODB_DATABASE=nrts-dev           # Database name
DB_1_PORT_27017_TCP_ADDR=localhost  # Legacy variable (for compatibility)
```

**API Configuration**

```env
NODE_ENV=development                # development | production | test
API_HOSTNAME=localhost:3000         # API server address
API_PORT=3000                       # API port
```

**File Upload**

```env
UPLOAD_DIRECTORY=./uploads/         # Directory for uploaded files
```

**Logging**

```env
LOG_LEVEL=debug                     # debug | info | warn | error
```

### Environment-Specific Values

**Local Development** (default)

```env
MONGODB_SERVICE_HOST=localhost
MONGODB_USERNAME=admin
MONGODB_PASSWORD=nrts-dev
MONGODB_DATABASE=nrts-dev
NODE_ENV=development
API_HOSTNAME=localhost:3000
```

**Docker Compose** (same as above, db hostname changes)

```env
MONGODB_SERVICE_HOST=database       # Use service name instead
```

**OpenShift/Production**

```env
MONGODB_SERVICE_HOST=mongodb-server   # Your MongoDB host
MONGODB_USERNAME=<from-secret>        # Use Kubernetes secrets
MONGODB_PASSWORD=<from-secret>        # Use Kubernetes secrets
MONGODB_DATABASE=nrts-prod
NODE_ENV=production
API_HOSTNAME=api.nrts.gov.bc.ca
```

## Frontend Configuration

### Location: `frontend/admin/.env` and `frontend/public/.env`

Both Angular apps use the same configuration:

```env
BACKEND_URL=http://localhost:3000  # Backend API base URL
API_BASE_PATH=/api                 # API path prefix
API_DOCS_PATH=/api/docs            # Swagger docs path
ENVIRONMENT=development             # development | production
```

### Environment-Specific Values

**Local Development**

```env
BACKEND_URL=http://localhost:3000
ENVIRONMENT=development
```

**Docker Compose**

```env
BACKEND_URL=http://backend:3000    # Use service name
ENVIRONMENT=development
```

**Production**

```env
BACKEND_URL=https://api.nrts.gov.bc.ca
ENVIRONMENT=production
```

## Root Configuration (Docker Compose)

### Location: `.env`

Used by `docker-compose.yml` for service configuration:

```env
MONGODB_USER=admin
MONGODB_PASSWORD=nrts-dev
MONGODB_DATABASE=nrts-dev
NODE_ENV=development
API_HOSTNAME=localhost:3000
UPLOAD_DIRECTORY=./uploads/
BACKEND_URL=http://localhost:3000
```

## Setup Instructions

### 1. Create .env Files from Templates

```bash
# Root level
cp .env.example .env

# Backend
cp backend/.env.example backend/.env

# Frontend - Admin
cp frontend/admin/.env.example frontend/admin/.env

# Frontend - Public
cp frontend/public/.env.example frontend/public/.env
```

### 2. Update Values for Your Environment

Edit each `.env` file and update the values as needed for your setup.

### 3. Verify Configuration

```bash
# Check backend can connect to database
cd backend
npm install
npm start
# Should see: "Connected to MongoDB successfully"

# Check frontend can reach backend
cd frontend/admin
npm install
npm start
# Should load without CORS errors
```

## Important Notes

### Security

- **Never commit `.env` files** - They contain sensitive information
- `.env` files are in `.gitignore` by default
- Use `.env.example` to show what variables are needed
- For production, use Kubernetes Secrets or similar

### Database Credentials

**Local Development**

- User: `admin`
- Password: `nrts-dev`
- Database: `nrts-dev`

**Note:** These are default development credentials. Change them for production!

### API Connectivity

The apps expect the backend to be available at the `BACKEND_URL`:

- Direct requests from browser → `BACKEND_URL` must be accessible
- CORS must be configured to allow requests from frontend origins

### Keycloak / Authentication

If using Keycloak (as mentioned in original code):

```env
# Add to backend/.env
KC_REALM=<your-realm>
KC_CLIENT_ID=<your-client-id>
KC_URL=<keycloak-server-url>
```

## Troubleshooting

### Backend Can't Connect to MongoDB

**Error:** `MongooseError: Cannot connect to MongoDB`

**Solution:**

1. Check `MONGODB_SERVICE_HOST` is correct
2. Check `MONGODB_USERNAME` and `MONGODB_PASSWORD` match
3. Check MongoDB is running: `docker-compose up database`
4. Check port 27017 is accessible

### Frontend Can't Reach Backend

**Error:** `CORS error` or `Network error`

**Solution:**

1. Check `BACKEND_URL` is correct
2. Check backend is running: `npm start` in backend/
3. Check backend and frontend are on same machine or network
4. Check firewall doesn't block port 3000

### Docker Compose Services Won't Start

**Error:** `database exited with code 1`

**Solution:**

1. Check `.env` file exists
2. Check environment variables are set: `docker-compose config`
3. Clean up and restart: `docker-compose down && docker-compose up`

## Production Deployment

For OpenShift/Kubernetes deployment:

1. Create Kubernetes Secrets with actual values
2. Reference secrets in deployment manifests
3. Do NOT include .env files in container images
4. Use environment variables from ConfigMaps and Secrets

Example Kubernetes Secret:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mongodb-credentials
type: Opaque
stringData:
  username: production-user
  password: <secure-password>
  host: mongodb.production.svc.cluster.local
  database: nrts-production
```

## See Also

- [README.md](./README.md) - Main project documentation
- [docker-compose.yml](./docker-compose.yml) - Service definitions
- [backend/app.js](./backend/app.js) - Backend configuration code
