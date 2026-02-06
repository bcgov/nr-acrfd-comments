# Docker Compose Local Development Setup

This project uses Docker Compose to run all services locally for development.

## Features

### ✅ Automatic MongoDB Seeding

Test data is automatically seeded **only when using Docker Compose for local development**:

- **MongoDB Init Script** (`docker/mongo-init.js`): Mounted in docker-compose.yml and runs once
  during MongoDB container initialization (first startup only)
- Creates a test application record automatically for development
- Does not affect OpenShift or production deployments

Test application details:

- **ID**: 69850c237f00b0a3ef284d0c
- **Agency**: Ministry of Example
- **Area**: 150.5 hectares
- **Tags**: `[["public"]]` (visible to public API)
- **Status**: Active
- **Location**: British Columbia
- **Centroid**: [-120.5, 49.5] (longitude, latitude)

### ✅ Health Checks

- **Database**: MongoDB health check enabled (pings admin command)
- **Backend & Frontend**: No health checks required (services respond immediately to requests)

For local development, minimal health checks are sufficient since services start quickly. In
production (OpenShift), more comprehensive health checks are configured separately.

## Starting the Stack

```bash
# Build and start all services
docker compose up --build

# Or just start (if already built)
docker compose up

# Start in background
docker compose up -d
```

## Services

| Service         | Port  | URL                       | Purpose                   |
| --------------- | ----- | ------------------------- | ------------------------- |
| MongoDB         | 27017 | -                         | Database (internal only)  |
| Backend API     | 3001  | http://localhost:3001/api | REST API                  |
| Frontend Public | 3000  | http://localhost:3000     | Public-facing Angular app |
| Frontend Admin  | 4200  | http://localhost:4200     | Admin Angular app         |

## Credentials

- **MongoDB**: `admin` / `nrts-dev`
- **Database**: `nrts-dev`

## Environment Variables

Override defaults via `.env` file:

- `KEYCLOAK_ENABLED=false` (default - disable for local dev)
- `SECRET=` (API secret)
- `SSO_ISSUER=` (Keycloak issuer URL)
- `SSO_JWKSURI=` (Keycloak JWKS URL)

## Database

The MongoDB volume is persisted in Docker named volume `nr-acrfd-comments_mongodb_data`. To reset:

```bash
# Stop services
docker compose down

# Remove data volume
docker volume rm nr-acrfd-comments_mongodb_data

# Start fresh (will reseed test data)
docker compose up --build
```

## Troubleshooting

### Apps show as "unhealthy" but are working

Health checks in Docker can take time to pass. The apps are working correctly even if the status
shows "unhealthy" or "health: starting". This is purely informational for Docker orchestration.

### MongoDB connection fails

Ensure MongoDB container is healthy:

```bash
docker logs database
```

The connection string requires `authSource=admin` parameter to authenticate against the admin
database.

### Frontend API calls failing

Verify the backend is responding:

```bash
curl http://localhost:3001/api/public/application
```

Check that the frontend is using the correct API port (3001, not 3000).

## Notes

- This Docker Compose setup is **for local development only**
- OpenShift deployments use separate configurations (not docker-compose)
- All services run on a shared Docker network for inter-service communication
- The frontend volumes mount source code for live development (no hot reload - requires rebuild)
