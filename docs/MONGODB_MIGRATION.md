# MongoDB DeploymentConfig → StatefulSet Migration Guide

This guide walks you through migrating from the OpenShift DeploymentConfig to a Kubernetes
StatefulSet managed by Helm.

## Overview

**What's Changing:**

- From: OpenShift `DeploymentConfig` (legacy)
- To: Kubernetes `StatefulSet` (modern)
- Data: **Fully preserved** - reusing existing PVC

**Benefits:**

- ✅ Standard Kubernetes approach (works across platforms)
- ✅ Better lifecycle management
- ✅ Easier to version control and review
- ✅ GitHub Actions automation ready
- ✅ Environment-specific configurations

## Prerequisites

Before starting, verify these requirements and create Kubernetes Secrets:

```bash
# Check PVC exists
oc get pvc mongodbdata -n 86cabb-dev
# Should output: mongodbdata  Bound  pv-xxx  10Gi  RWO

# Check current DeploymentConfig
oc get deploymentconfig mongodb -n 86cabb-dev

# Verify MongoDB is accessible
oc rsh -c mongodb deployment/mongodb-6 \
  mongo 127.0.0.1:27017 --eval "db.adminCommand('ping')"

# CREATE KUBERNETES SECRET (REQUIRED!)
# This must be done BEFORE deploying the StatefulSet
oc create secret generic mongodb-secret \
  -n 86cabb-dev \
  --from-literal=mongodb-password='<password>' \
  --from-literal=mongodb-admin-password='<admin-password>'

# Verify Secret was created
oc get secret mongodb-secret -n 86cabb-dev
```

**⚠️ IMPORTANT:** The Secret `mongodb-secret` must exist before you deploy the Helm chart. See
[helm/mongodb/SECRETS.md](../helm/mongodb/SECRETS.md) for more details.

## Pre-Migration Steps

### 1. Backup Your Data (Recommended)

```bash
# Export all collections to a file
NAMESPACE=86cabb-dev
POD=$(oc get pods -n $NAMESPACE -l name=mongodb -o jsonpath='{.items[0].metadata.name}')

oc exec -n $NAMESPACE $POD -- \
  mongodump --uri="mongodb://user54L:tNRXuW8jjV4wnFqm@localhost:27017/prc-prod?authSource=admin" \
  --archive=/tmp/mongodb-backup.archive

# Copy to local
oc cp $NAMESPACE/$POD:/tmp/mongodb-backup.archive ./mongodb-backup-$(date +%Y%m%d).archive

echo "✅ Backup complete: mongodb-backup-$(date +%Y%m%d).archive"
```

### 2. Document Current State

```bash
# Save current DeploymentConfig
oc get deploymentconfig mongodb -n 86cabb-dev -o yaml > mongodb-dc-backup.yaml

# Document statistics
oc exec -n 86cabb-dev $(oc get pods -n 86cabb-dev -l name=mongodb -o jsonpath='{.items[0].metadata.name}') -- \
  mongo 127.0.0.1:27017 --eval "db.stats()" > mongodb-stats.txt
```

### 3. Communicate the Maintenance Window

MongoDB will be briefly unavailable during the transition (~2-5 minutes):

- Alert users
- Set maintenance window message
- Plan for low-traffic time

## Migration Process

### Phase 1: Prepare Helm Chart (Pre-Maintenance Window)

```bash
# Verify Helm chart exists
ls -la helm/mongodb/
# Should show: Chart.yaml, values.yaml, templates/, values-*.yaml
```

### Phase 2: Execute Migration (During Maintenance Window)

**Step 2: Create Kubernetes Secret**

```bash
NAMESPACE=86cabb-dev

# Create Secret with credentials (must be done before Helm deployment)
oc create secret generic mongodb-secret \
  -n $NAMESPACE \
  --from-literal=mongodb-password='<your-password>' \
  --from-literal=mongodb-admin-password='<your-admin-password>'

# Verify Secret created
oc get secret mongodb-secret -n $NAMESPACE -o yaml
```

**Step 3: Deploy StatefulSet with Helm**

```bash
NAMESPACE=86cabb-dev
ENVIRONMENT=dev

# Install the Helm chart
helm install mongodb ./helm/mongodb \
  --namespace $NAMESPACE \
  --values ./helm/mongodb/values-$ENVIRONMENT.yaml \
  --wait \
  --timeout 5m

echo "✅ MongoDB StatefulSet deployed"
```

**Step 4: Verify Deployment**

```bash
NAMESPACE=86cabb-dev

# Watch StatefulSet rollout
kubectl rollout status statefulset mongodb -n $NAMESPACE --timeout=5m

# Check pod is running
kubectl get pods mongodb-0 -n $NAMESPACE

# Check logs
kubectl logs mongodb-0 -n $NAMESPACE | tail -20

# Verify PVC is mounted correctly
kubectl describe pod mongodb-0 -n $NAMESPACE | grep -A 5 "Mounts:"

# Test connection
kubectl exec mongodb-0 -n $NAMESPACE -- \
  mongo 127.0.0.1:27017 --eval "db.adminCommand('ping')"

echo "✅ StatefulSet is operational"
```

**Step 5: Delete Old DeploymentConfig**

```bash
NAMESPACE=86cabb-dev

# Delete DeploymentConfig (PVC remains)
oc delete deploymentconfig mongodb -n $NAMESPACE

# Confirm it's gone
oc get deploymentconfig -n $NAMESPACE | grep mongodb

echo "✅ Old DeploymentConfig removed"
```

**Step 6: Delete Old Deployment Pods** (if using Deployment instead of DC)

```bash
NAMESPACE=86cabb-dev

# If you have a Deployment named 'mongodb', delete it
oc delete deployment mongodb -n $NAMESPACE 2>/dev/null || echo "No Deployment found"

echo "✅ Old deployment cleaned up"
```

**Step 2: Verify PVC is intact**

```bash
# Verify PVC still exists and is available
oc get pvc mongodbdata -n $NAMESPACE

# Should show:
# mongodbdata  Bound  pv-xxx  10Gi  RWO  retain
```

**Step 3: Deploy StatefulSet via Helm**

```bash
NAMESPACE=86cabb-dev
ENVIRONMENT=dev

# Dry-run first (verify what will be created)
helm install mongodb ./helm/mongodb \
  --namespace $NAMESPACE \
  --values ./helm/mongodb/values-$ENVIRONMENT.yaml \
  --dry-run --debug

# If everything looks good, install
helm install mongodb ./helm/mongodb \
  --namespace $NAMESPACE \
  --values ./helm/mongodb/values-$ENVIRONMENT.yaml

echo "✅ StatefulSet deployed"
```

**Step 4: Wait for StatefulSet to be ready**

```bash
NAMESPACE=86cabb-dev

# Watch rollout
oc rollout status statefulset mongodb -n $NAMESPACE --timeout=5m

# Verify pod is running
oc get pods -n $NAMESPACE -l app.kubernetes.io/name=mongodb
```

**Step 5: Verify data integrity**

```bash
NAMESPACE=86cabb-dev
POD=mongodb-0

# Test connection
oc exec -n $NAMESPACE $POD -- \
  mongo 127.0.0.1:27017 --eval "db.adminCommand('ping')"

# Verify database exists
oc exec -n $NAMESPACE $POD -- \
  mongo 127.0.0.1:27017/prc-dev -u user54L -p tNRXuW8jjV4wnFqm \
  --authenticationDatabase admin \
  --eval "print('Collections: ' + Object.keys(db.getCollectionNames()))"

# Count documents (should match pre-migration count)
oc exec -n $NAMESPACE $POD -- \
  mongo 127.0.0.1:27017/prc-dev -u user54L -p tNRXuW8jjV4wnFqm \
  --authenticationDatabase admin \
  --eval "print('Applications count: ' + db.applications.count())"
```

### Phase 3: Clean Up (After Verification)

**Only after confirming data integrity:**

```bash
NAMESPACE=86cabb-dev

# Delete old DeploymentConfig
oc delete deploymentconfig mongodb -n $NAMESPACE

echo "✅ DeploymentConfig removed"

# Verify old RC pods are cleaned up
oc get rc -n $NAMESPACE
# Should not see any mongodb RC entries

# Confirm StatefulSet is the only mongodb resource
oc get all -n $NAMESPACE -l app.kubernetes.io/name=mongodb
# Should only show: StatefulSet, Pod, Secret, Service
```

## Post-Migration Validation

Run these checks to confirm successful migration:

```bash
#!/bin/bash
NAMESPACE=86cabb-dev

echo "=== Post-Migration Validation ==="
echo ""

echo "1. StatefulSet Status"
oc get statefulset mongodb -n $NAMESPACE
echo ""

echo "2. Pod Status"
oc get pods -n $NAMESPACE -l app.kubernetes.io/name=mongodb
echo ""

echo "3. PVC Status"
oc get pvc mongodbdata -n $NAMESPACE
echo ""

echo "4. Service Status"
oc get svc mongodb -n $NAMESPACE
echo ""

echo "5. Secret Status"
oc get secret mongodb-secret -n $NAMESPACE
echo ""

echo "6. MongoDB Connection Test"
oc exec mongodb-0 -n $NAMESPACE -- \
  mongo 127.0.0.1:27017 --eval "print('✅ Connected: ' + new Date())"
echo ""

echo "7. Data Count"
oc exec mongodb-0 -n $NAMESPACE -- \
  mongo 127.0.0.1:27017/prc-$ENVIRONMENT -u user54L -p tNRXuW8jjV4wnFqm \
  --authenticationDatabase admin \
  --eval "print('✅ Applications in database: ' + db.applications.count())"
echo ""

echo "=== All checks passed! Migration successful. ==="
```

## Rollback Plan (If Issues Occur)

If something goes wrong, here's how to rollback:

```bash
NAMESPACE=86cabb-dev

echo "🔄 Rolling back to DeploymentConfig..."

# 1. Delete StatefulSet (keeps PVC intact)
helm uninstall mongodb -n $NAMESPACE

# 2. Redeploy DeploymentConfig from backup
oc apply -f mongodb-dc-backup.yaml

# 3. Wait for pods
oc rollout status deploymentconfig mongodb -n $NAMESPACE --timeout=5m

echo "✅ Rollback complete"
```

## Monitoring & Troubleshooting

### Check Pod Readiness

```bash
oc exec mongodb-0 -n 86cabb-dev -- \
  mongo 127.0.0.1:27017 \
  -u user54L -p tNRXuW8jjV4wnFqm \
  --authenticationDatabase admin \
  --eval "print('Ready: ' + db.adminCommand('ping').ok === 1)"
```

### View StatefulSet Events

```bash
oc describe statefulset mongodb -n 86cabb-dev
```

### View Pod Logs

```bash
oc logs mongodb-0 -n 86cabb-dev
oc logs -f mongodb-0 -n 86cabb-dev  # Follow logs
```

### Check PVC Mounting

```bash
oc exec mongodb-0 -n 86cabb-dev -- df -h /var/lib/mongodb/data
oc exec mongodb-0 -n 86cabb-dev -- ls -la /var/lib/mongodb/data/
```

## Next Steps

After successful migration:

1. ✅ Update documentation to reference StatefulSet
2. ✅ Update runbooks for operations team
3. ✅ Configure GitHub Actions workflow
4. ✅ Test database backup/restore procedures
5. ✅ Document any custom scripts that reference DeploymentConfig
6. ✅ Schedule migration for test and prod environments

## Environment-Specific Migrations

Repeat the above steps for each environment:

### Test Environment (86cabb-test)

```bash
helm install mongodb ./helm/mongodb \
  --namespace 86cabb-test \
  --values ./helm/mongodb/values-test.yaml
```

### Production Environment (86cabb-prod)

```bash
helm install mongodb ./helm/mongodb \
  --namespace 86cabb-prod \
  --values ./helm/mongodb/values-prod.yaml
```

## Support & Questions

If you encounter issues:

1. Check the [helm/mongodb/README.md](../helm/mongodb/README.md) for general troubleshooting
2. Review MongoDB logs: `oc logs mongodb-0 -n <namespace>`
3. Verify PVC: `oc describe pvc mongodbdata -n <namespace>`
4. Check Helm release: `helm status mongodb -n <namespace>`
