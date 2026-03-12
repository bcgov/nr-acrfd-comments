# MongoDB 3.6 → 7.0 Migration Guide

## Overview

This guide documents the automated migration process from MongoDB 3.6 to 7.0 using Helm and
Kubernetes.

## What's Happening

When you deploy MongoDB 7.0 with the existing PVC from MongoDB 3.6:

1. **MongoDB 7.0 container starts** → Opens the 3.6 data files
2. **Migration Job runs** (post-deploy hook) → Automatically upgrades Feature Compatibility Version
3. **Data validation** → Checks database integrity

## Key Points

### Safe Upgrade Path

MongoDB 3.6 → 7.0 is a **single safe jump**. The storage format is compatible when FCV is upgraded
properly.

```
MongoDB 3.6 (FCV 3.6)
     ↓
MongoDB 7.0 (with FCV 3.6 initially)
     ↓
[Migration Job Runs]
     ↓
MongoDB 7.0 (with FCV 7.0)
```

### Automatic FCV Upgrade

The migration happens **automatically** via a Kubernetes Job that:

- Waits for MongoDB to be ready
- Checks current FCV
- Upgrades to target FCV (7.0) if needed
- Validates successful migration
- Reports collection counts and document counts

### Configuration

In `helm/mongodb/values.yaml`:

```yaml
migration:
  enabled: true # Enable FCV upgrade
  targetFCV: '7.0' # Target version
```

The migration Job only runs if `enabled: true`. To skip (if already migrated):

```yaml
migration:
  enabled: false
```

## Deployment Process

### For PR Deployments (Dev)

```bash
# Automatically triggered by GitHub Actions
# 1. Builds all containers (backend, frontend, MongoDB)
# 2. Deploys MongoDB with migration job
# 3. Migration job auto-runs and upgrades FCV
# 4. Tests run against MongoDB 7.0
```

### For Production Deployments (Test/Prod)

```bash
# Manual trigger via workflow_dispatch
# Same process, but requires environment approval

# Or direct helm deployment:
helm upgrade --install mongodb ./helm/mongodb \
  --namespace production \
  --values ./helm/mongodb/values.yaml \
  --wait
```

## Validation

After deployment, verify the migration:

```bash
# Check migration job status
kubectl get jobs -l app.kubernetes.io/component=migration

# View migration logs
kubectl logs -l app.kubernetes.io/name=mongodb,app.kubernetes.io/component=migration

# Verify MongoDB is running MongoDB 7.0
kubectl exec mongodb-0 -- mongosh --eval "db.version()"

# Check FCV
kubectl exec mongodb-0 -- mongosh -u admin -p "$MONGODB_PASSWORD" admin \
  --eval "db.adminCommand({getParameter: 'featureCompatibilityVersion'})"
```

## Rollback (if needed)

If migration fails:

1. **Check migration job logs** for specific error
2. **Common issues:**
   - MongoDB not ready yet → Wait and retry
   - Network issues → Check DNS/connectivity
   - Authorization issues → Verify credentials in secret

3. **Manual FCV upgrade** (if needed):

```bash
kubectl exec mongodb-0 -- mongosh -u admin -p "$PASSWORD" admin \
  --eval "db.adminCommand({setFeatureCompatibilityVersion: '7.0'})"
```

## Performance Considerations

- Migration adds ~5-10 minutes to deployment
- No data loss (only FCV metadata upgrade)
- PVC reused (no data re-initialization)
- Zero-downtime for new deployments (container stays up)

## Disabling Migration

If you later upgrade to 8.0 or higher, you'd update:

```yaml
migration:
  enabled: false # FCV already at 7.0, skip
  targetFCV: '8.0' # (example for future upgrade)
```

## Related Documentation

- [MongoDB Feature Compatibility Version](https://docs.mongodb.com/manual/reference/command/setFeatureCompatibilityVersion/)
- [MongoDB Upgrade Paths](https://docs.mongodb.com/manual/release-notes/upgrading/)
- [Helm Post-Install Hooks](https://helm.sh/docs/topics/charts_hooks/)
