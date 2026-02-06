# Pre-Deployment Checklist

Use this checklist before deploying MongoDB with Helm in each environment.

## ✓ Prerequisites

- [ ] Kubernetes/OpenShift cluster access (`kubectl` or `oc` installed and authenticated)
- [ ] Helm 3+ installed (`helm version`)
- [ ] Existing PVC `mongodbdata` exists in target namespace
- [ ] Backup of MongoDB data completed (recommended)

## ✓ Secrets Setup

### Development

```bash
# Create secret
kubectl create secret generic mongodb-secret -n 86cabb-dev \
  --from-literal=mongodb-password='<dev-password>' \
  --from-literal=mongodb-admin-password='<dev-admin-password>'

# Verify
kubectl get secret mongodb-secret -n 86cabb-dev
```

- [ ] Secret created
- [ ] Secret contains both keys (mongodb-password, mongodb-admin-password)
- [ ] Passwords are secure (min 16 chars, mixed case, numbers, symbols)

### Test

```bash
# Create secret
kubectl create secret generic mongodb-secret -n 86cabb-test \
  --from-literal=mongodb-password='<test-password>' \
  --from-literal=mongodb-admin-password='<test-admin-password>'

# Verify
kubectl get secret mongodb-secret -n 86cabb-test
```

- [ ] Secret created
- [ ] Secret contains both keys
- [ ] Different passwords than dev

### Production

```bash
# Create secret
kubectl create secret generic mongodb-secret -n 86cabb-prod \
  --from-literal=mongodb-password='<prod-password>' \
  --from-literal=mongodb-admin-password='<prod-admin-password>'

# Verify
kubectl get secret mongodb-secret -n 86cabb-prod
```

- [ ] Secret created
- [ ] Secret contains both keys
- [ ] Different passwords than dev/test
- [ ] Passwords stored securely (vault/password manager)

## ✓ Configuration Review

- [ ] Reviewed `helm/mongodb/values.yaml` (default config)
- [ ] Reviewed `helm/mongodb/values-dev.yaml` (dev overrides)
- [ ] Reviewed `helm/mongodb/values-test.yaml` (test overrides)
- [ ] Reviewed `helm/mongodb/values-prod.yaml` (prod overrides)
- [ ] Confirmed `persistence.existingClaim: mongodbdata` in all values files
- [ ] Confirmed no passwords in any values files

## ✓ Helm Chart Validation

```bash
# Validate chart syntax
helm lint ./helm/mongodb

# Check values
helm get values mongodb -f ./helm/mongodb/values-dev.yaml

# Dry-run to see what will be deployed
helm install --dry-run --debug mongodb ./helm/mongodb \
  -f ./helm/mongodb/values-dev.yaml
```

- [ ] Helm lint passes (no errors)
- [ ] Chart syntax is valid
- [ ] Values files have correct structure

## ✓ Development Deployment

```bash
# Install MongoDB
helm install mongodb ./helm/mongodb \
  -n 86cabb-dev \
  -f ./helm/mongodb/values-dev.yaml \
  --wait \
  --timeout 5m
```

- [ ] Helm chart installed successfully
- [ ] StatefulSet created
- [ ] Pod is running

```bash
# Verify deployment
kubectl get statefulset mongodb -n 86cabb-dev
kubectl get pods mongodb-0 -n 86cabb-dev
kubectl logs mongodb-0 -n 86cabb-dev
```

- [ ] StatefulSet shows 1/1 ready
- [ ] Pod mongodb-0 is Running
- [ ] Logs show successful startup (no errors)
- [ ] No authentication errors in logs

```bash
# Test connectivity
kubectl exec mongodb-0 -n 86cabb-dev -- \
  mongo 127.0.0.1:27017 --eval "db.adminCommand('ping')"
```

- [ ] Ping command succeeds
- [ ] MongoDB responds

```bash
# Verify data
kubectl exec mongodb-0 -n 86cabb-dev -- \
  mongo 127.0.0.1:27017/prc-dev \
  -u user54L \
  --eval "db.applications.count()"
```

- [ ] Can connect to database
- [ ] Application documents exist
- [ ] Document count is correct

## ✓ Test Environment Deployment

Repeat the steps above for test environment:

```bash
helm install mongodb ./helm/mongodb \
  -n 86cabb-test \
  -f ./helm/mongodb/values-test.yaml \
  --wait \
  --timeout 5m
```

- [ ] Helm chart installed
- [ ] Pod is running
- [ ] Logs show successful startup
- [ ] Ping succeeds
- [ ] Data verified

## ✓ Production Deployment

### Pre-Production Checks

- [ ] Change management approval obtained
- [ ] Maintenance window scheduled and communicated
- [ ] Team lead notified
- [ ] Runbook reviewed
- [ ] Rollback plan understood

### Deployment

```bash
helm install mongodb ./helm/mongodb \
  -n 86cabb-prod \
  -f ./helm/mongodb/values-prod.yaml \
  --wait \
  --timeout 5m
```

- [ ] Helm chart installed
- [ ] Pod is running (no restart loops)
- [ ] Logs show successful startup
- [ ] No error messages in logs
- [ ] Affinity rules applied (prod only)

### Post-Deployment Verification

```bash
# Check pod is stable (no recent restarts)
kubectl get pods mongodb-0 -n 86cabb-prod -o wide

# Verify connections
kubectl exec mongodb-0 -n 86cabb-prod -- \
  mongo 127.0.0.1:27017 --eval "db.adminCommand('ping')"

# Check data integrity
kubectl exec mongodb-0 -n 86cabb-prod -- \
  mongo 127.0.0.1:27017/prc-prod -u user54L \
  --eval "db.applications.count()"
```

- [ ] Pod has 0 restarts (stable)
- [ ] Ping command succeeds
- [ ] Data count matches expected
- [ ] No errors in logs
- [ ] Applications can connect

### Cleanup

- [ ] Delete old DeploymentConfig if migration from DC
- [ ] Verify no old MongoDB pods running
- [ ] Document metrics (pod uptime, resources used)

## ✓ Monitoring & Maintenance

### Weekly Checks

- [ ] MongoDB pod is running
- [ ] No recent pod restarts
- [ ] Logs don't show errors
- [ ] Disk usage is normal
- [ ] Connections are stable

### Monthly Tasks

- [ ] Review storage usage
- [ ] Check for slow queries
- [ ] Verify backup/snapshot still works
- [ ] Review security (passwords unchanged)

### Quarterly Tasks

- [ ] Consider password rotation
- [ ] Review resource allocation
- [ ] Check for MongoDB version updates
- [ ] Validate disaster recovery plan

## ✓ Documentation

- [ ] README.md reviewed and understood
- [ ] SECRETS.md reviewed (credential management)
- [ ] MONGODB_MIGRATION.md archived for reference
- [ ] This checklist printed/saved
- [ ] Team trained on new deployment method
- [ ] Runbook updated with new procedures

## ✓ Rollback Plan

In case of issues, understand the rollback:

```bash
# Delete StatefulSet (keeps data in PVC)
helm uninstall mongodb -n 86cabb-dev

# Data is preserved - PVC still has all data
kubectl get pvc mongodbdata -n 86cabb-dev

# Redeploy old DeploymentConfig if available
oc create -f mongodb-dc-backup.yaml -n 86cabb-dev

# Or reinstall Helm chart
helm install mongodb ./helm/mongodb -n 86cabb-dev -f values-dev.yaml
```

- [ ] Backup DeploymentConfig saved (if migrating from DC)
- [ ] Rollback procedure understood by team
- [ ] Team knows how to restore from backup if needed

## Sign-Off

| Role          | Name   | Date   | Signature |
| ------------- | ------ | ------ | --------- |
| DevOps Lead   | **\_** | **\_** | **\_**    |
| Operations    | **\_** | **\_** | **\_**    |
| Product Owner | **\_** | **\_** | **\_**    |

---

**Notes:**
