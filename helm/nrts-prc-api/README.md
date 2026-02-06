# NRTS PRC API Helm Chart

Helm chart for deploying the NRTS PRC API with the update-shapes CronJob.

## Overview

This chart deploys:

- **NRTS PRC API** - Main API service connected to MongoDB
- **Update Shapes CronJob** - Scheduled job to sync shapes data (runs daily at 2:01 AM)

## Prerequisites

- Kubernetes 1.18+
- Helm 3+
- MongoDB StatefulSet running (see ../mongodb for MongoDB Helm chart)
- Secret `ttls-api-test` or `ttls-api-prod` existing in namespace (for WEBADE_PASSWORD)

## Installation

### Deploy API with CronJob

All environment-specific configuration (API_HOST, AUTH_ENDPOINT, NOTIFICATION_URL, secret names,
etc.) should be managed through pre-defined OpenShift secrets per environment. Use the single
values.yaml for all environments:

```bash
helm install nrts-prc-api ./helm/nrts-prc-api \
  -n 86cabb-dev \
  --set updateShapesCronJob.env.API_PASSWORD='<password>' \
  --set updateShapesCronJob.env.API_HOST='<api-host>' \
  --set updateShapesCronJob.env.AUTH_ENDPOINT='<auth-endpoint>' \
  --set updateShapesCronJob.env.NOTIFICATION_URL='<webhook-url>' \
  --set updateShapesCronJob.webadePasswordSecret.name='<secret-name>'
```

Or supply all values through a custom values file for each environment.

## Configuration

### API Deployment

Configure the API deployment:

```yaml
replicaCount: 1

image:
  repository: image-registry.openshift-image-registry.svc:5000/nrts-prc-tools/nrts-prc-api
  tag: 'master'
  pullPolicy: Always

service:
  port: 3001
  targetPort: 3001

resources:
  limits:
    cpu: '1'
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi
```

### Update Shapes CronJob

Control the CronJob:

```yaml
updateShapesCronJob:
  enabled: true
  schedule: '1 2 * * *' # 2:01 AM daily
  concurrencyPolicy: Forbid # Don't allow concurrent jobs
  startingDeadlineSeconds: 999
  suspend: false # Set to true to disable
```

#### CronJob Schedule Format

The `schedule` field uses standard cron syntax:

```
┌─────────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌─────────── day of month (1 - 31)
│ │ │ ┌───────── month (1 - 12)
│ │ │ │ ┌─────── day of week (0 - 6, 0 is Sunday)
│ │ │ │ │
│ │ │ │ │
* * * * *
```

**Examples:**

- `1 2 * * *` - Every day at 2:01 AM
- `0 */6 * * *` - Every 6 hours
- `0 0 1 * *` - First day of each month at midnight
- `0 10 * * 1-5` - Weekdays at 10 AM

## Required Secrets

The CronJob requires existing secrets for `WEBADE_PASSWORD`:

- **Secret Name:** `ttls-api-test` (for dev/test) or `ttls-api-prod` (for prod)
- **Key:** `apikey`

These secrets should already exist in your OpenShift namespaces.

## Environment Variables

The CronJob uses these environment variables (mostly hardcoded):

| Variable               | Purpose                                                      |
| ---------------------- | ------------------------------------------------------------ |
| `API_USERNAME`         | API authentication username                                  |
| `API_PASSWORD`         | API authentication password (override per environment)       |
| `API_PROTOCOL`         | API protocol (https)                                         |
| `API_HOST`             | API hostname (override per environment)                      |
| `API_PORT`             | API port (443)                                               |
| `CLIENT_ID`            | OAuth client ID                                              |
| `GRANT_TYPE`           | OAuth grant type                                             |
| `AUTH_ENDPOINT`        | OAuth authentication endpoint (override per environment)     |
| `WEBADE_AUTH_ENDPOINT` | WebADE authentication endpoint                               |
| `WEBADE_USERNAME`      | WebADE username                                              |
| `WEBADE_PASSWORD`      | WebADE password (from secret)                                |
| `TTLS_API_ENDPOINT`    | TTLS API endpoint                                            |
| `JSON_PAYLOAD`         | Success notification message                                 |
| `JSON_PAYLOAD_FAIL`    | Failure notification message                                 |
| `NOTIFICATION_URL`     | Webhook URL for job notifications (override per environment) |

## Verification

### Check API Deployment

```bash
# View deployment
kubectl get deployment -n 86cabb-dev

# Check pod status
kubectl get pods -l app.kubernetes.io/name=nrts-prc-api -n 86cabb-dev

# View logs
kubectl logs -f deployment/nrts-prc-api -n 86cabb-dev

# Test API
kubectl port-forward svc/nrts-prc-api 3001:3001 -n 86cabb-dev
curl http://localhost:3001/api/public/application
```

### Check CronJob

```bash
# View CronJob
kubectl get cronjob -n 86cabb-dev

# View CronJob details
kubectl describe cronjob nrts-prc-api-update-shapes -n 86cabb-dev

# View past job runs
kubectl get jobs -l app.kubernetes.io/component=cronjob -n 86cabb-dev

# View logs from last job
kubectl logs -l app.kubernetes.io/component=cronjob -n 86cabb-dev --tail=50
```

### Monitor Next Run

```bash
# Check when CronJob will run next
kubectl get cronjob nrts-prc-api-update-shapes -n 86cabb-dev -o jsonpath='{.status.lastScheduleTime}'

# Watch for new jobs
kubectl get jobs -w -l app.kubernetes.io/component=cronjob -n 86cabb-dev
```

## Common Tasks

### Disable CronJob

```bash
helm upgrade nrts-prc-api ./helm/nrts-prc-api \
  --set updateShapesCronJob.suspend=true \
  -n 86cabb-dev
```

### Enable CronJob

```bash
helm upgrade nrts-prc-api ./helm/nrts-prc-api \
  --set updateShapesCronJob.suspend=false \
  -n 86cabb-dev
```

### Change Schedule

```bash
helm upgrade nrts-prc-api ./helm/nrts-prc-api \
  --set updateShapesCronJob.schedule='0 3 * * *' \
  -n 86cabb-dev
```

### Update API Image

```bash
helm upgrade nrts-prc-api ./helm/nrts-prc-api \
  --set image.tag=v1.2.3 \
  -n 86cabb-dev
```

### View Current Configuration

```bash
helm get values nrts-prc-api -n 86cabb-dev
```

## Troubleshooting

### CronJob Not Running

```bash
# Check if CronJob is suspended
kubectl get cronjob nrts-prc-api-update-shapes -n 86cabb-dev -o jsonpath='{.spec.suspend}'

# If suspended, enable it
helm upgrade nrts-prc-api ./helm/nrts-prc-api \
  --set updateShapesCronJob.suspend=false \
  -n 86cabb-dev

# Check CronJob logs
kubectl logs -f $(kubectl get pods -l app.kubernetes.io/component=cronjob -n 86cabb-dev -o jsonpath='{.items[-1].metadata.name}') -n 86cabb-dev
```

### Secret Not Found

```bash
# Verify Secret exists
kubectl get secret ttls-api-test -n 86cabb-dev

# Check secret key exists
kubectl get secret ttls-api-test -n 86cabb-dev -o jsonpath='{.data.apikey}' | base64 -d
```

### Job Failing

```bash
# Get failed job details
kubectl describe job <job-name> -n 86cabb-dev

# View job logs
kubectl logs job/<job-name> -n 86cabb-dev

# Check for error messages
kubectl logs job/<job-name> -n 86cabb-dev --tail=100
```

## Uninstall

```bash
helm uninstall nrts-prc-api -n 86cabb-dev
```

Note: This removes the API deployment and CronJob but keeps any persistent data.

## Reference

- [Kubernetes CronJob Documentation](https://kubernetes.io/docs/tasks/job/automated-tasks-with-cron-jobs/)
- [CronJob Syntax Reference](https://en.wikipedia.org/wiki/Cron)
- [Helm Values Documentation](https://helm.sh/docs/chart_template_guide/values/)
