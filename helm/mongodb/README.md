# MongoDB Helm Chart

Helm chart for deploying MongoDB as a StatefulSet in OpenShift, reusing existing PVC to preserve
data.

## Overview

This chart deploys MongoDB 3.6 as a Kubernetes StatefulSet while preserving your existing MongoDB
data by referencing the existing PVC (`mongodbdata`).

**Key Features:**

- ✅ StatefulSet deployment with stable Pod identity
- ✅ Reuses existing PVC - **zero data loss**
- ✅ Configurable via values files
- ✅ Environment-specific configurations (dev/test/prod)
- ✅ Readiness and liveness probes
- ✅ Secrets management for credentials
- ✅ Resource limits and requests

## Prerequisites

- Kubernetes 1.18+
- Helm 3+
- Existing MongoDB PVC named `mongodbdata` with your data
- OpenShift (uses OpenShift's built-in MongoDB image)

## Prerequisites - Secrets Management

**Important:** Before installing, create the `mongodb-secret` in your namespace with credentials.

```bash
# Create the Secret with your passwords
kubectl create secret generic mongodb-secret \
  -n 86cabb-dev \
  --from-literal=mongodb-password='your-password' \
  --from-literal=mongodb-admin-password='your-admin-password'

# Verify it was created
kubectl get secret mongodb-secret -n 86cabb-dev
```

See [SECRETS.md](./SECRETS.md) for detailed credential management options.

## Installation

### Basic Installation (using existing PVC)

```bash
helm install mongodb ./helm/mongodb \
  --namespace 86cabb-dev \
  --values ./helm/mongodb/values-dev.yaml
```

### Installation with GitHub Actions

```yaml
- name: Create MongoDB Secret
  run: |
    kubectl create secret generic mongodb-secret \
      -n ${{ env.NAMESPACE }} \
      --from-literal=mongodb-password='${{ secrets.MONGODB_PASSWORD }}' \
      --from-literal=mongodb-admin-password='${{ secrets.MONGODB_ADMIN_PASSWORD }}' \
      --dry-run=client -o yaml | kubectl apply -f -

- name: Deploy MongoDB with Helm
  run: |
    helm install mongodb ./helm/mongodb \
      --namespace ${{ env.NAMESPACE }} \
      --values ./helm/mongodb/values-${{ env.ENVIRONMENT }}.yaml
```

## Upgrading from DeploymentConfig

### Pre-Migration Checklist

1. ✅ Verify PVC `mongodbdata` exists and has data
2. ✅ Back up your MongoDB data (export or snapshot)
3. ✅ Schedule downtime (brief - less than 5 minutes)
4. ✅ Test in dev first

### Migration Steps

```bash
# 1. Delete old DeploymentConfig (keeps PVC intact)
oc delete deploymentconfig mongodb -n 86cabb-dev

# 2. Install new StatefulSet via Helm
helm install mongodb ./helm/mongodb \
  --namespace 86cabb-dev \
  --values ./helm/mongodb/values-dev.yaml

# 3. Verify StatefulSet is running
kubectl get statefulset mongodb -n 86cabb-dev
kubectl get pods mongodb-0 -n 86cabb-dev

# 4. Check logs
kubectl logs mongodb-0 -n 86cabb-dev

# 5. Verify connection
kubectl exec mongodb-0 -n 86cabb-dev -- \
  mongo 127.0.0.1:27017/prc-dev -u user54L -p <password> --eval "db.adminCommand('ping')"
```

## Configuration

### Using Environment-Specific Values

```bash
# Development
helm install mongodb ./helm/mongodb -f values-dev.yaml

# Test
helm install mongodb ./helm/mongodb -f values-test.yaml

# Production
helm install mongodb ./helm/mongodb -f values-prod.yaml
```

### Customizing Values

Edit the respective `values-*.yaml` file:

```yaml
mongodb:
  username: user54L
  # password: DO NOT SET - use Kubernetes Secrets
  # adminPassword: DO NOT SET - use Kubernetes Secrets
  database: prc-prod

persistence:
  existingClaim: mongodbdata # Your existing PVC name

resources:
  limits:
    cpu: '2'
    memory: 4Gi
  requests:
    cpu: 500m
    memory: 2Gi
```

## Security: Credentials Management

**Passwords are NOT stored in values files** - they are managed separately as Kubernetes Secrets.

### Creating Secrets

Create the `mongodb-secret` before deploying:

```bash
kubectl create secret generic mongodb-secret \
  -n <namespace> \
  --from-literal=mongodb-password='<password>' \
  --from-literal=mongodb-admin-password='<admin-password>'
```

### Updating Passwords

```bash
# Option 1: Update secret and restart pod
kubectl patch secret mongodb-secret \
  -n <namespace> \
  -p '{"data":{"mongodb-password":"'$(echo -n 'new-password' | base64)'"}}'

kubectl delete pod mongodb-0 -n <namespace>  # Restart to pick up new password

# Option 2: Delete and recreate secret
kubectl delete secret mongodb-secret -n <namespace>
kubectl create secret generic mongodb-secret \
  -n <namespace> \
  --from-literal=mongodb-password='<new-password>' \
  --from-literal=mongodb-admin-password='<new-admin-password>'
```

**See [SECRETS.md](./SECRETS.md)** for complete credential management guide, vault integration, and
best practices.

## Important Notes

### Data Preservation

⚠️ **Critical:** The chart references your existing PVC:

```yaml
persistence:
  enabled: true
  existingClaim: mongodbdata # Preserves your data
```

If you change this or set `existingClaim: null`, a new PVC will be created and your data will be
lost.

### Resource Sizing

Adjust resources based on your workload:

```yaml
resources:
  limits:
    cpu: '2' # Maximum CPU
    memory: 4Gi # Maximum memory
  requests:
    cpu: 500m # Guaranteed CPU
    memory: 2Gi # Guaranteed memory
```

## Monitoring & Troubleshooting

### Check StatefulSet Status

```bash
kubectl get statefulset mongodb -n 86cabb-dev
kubectl describe statefulset mongodb -n 86cabb-dev
```

### Check Pod Status

```bash
kubectl get pods mongodb-0 -n 86cabb-dev
kubectl describe pod mongodb-0 -n 86cabb-dev
```

### View Logs

```bash
kubectl logs mongodb-0 -n 86cabb-dev
kubectl logs -f mongodb-0 -n 86cabb-dev  # Follow logs
```

### Test MongoDB Connection

```bash
kubectl exec -it mongodb-0 -n 86cabb-dev -- \
  mongo 127.0.0.1:27017/prc-dev -u user54L -p <password>
```

### Verify Data After Migration

```bash
kubectl exec mongodb-0 -n 86cabb-dev -- \
  mongo 127.0.0.1:27017/prc-dev -u user54L -p <password> \
  --eval "db.applications.count()"
```

## Scaling

For single-replica setup (recommended for single PVC):

```yaml
replicaCount: 1
```

To scale to multiple replicas (requires multiple PVCs):

```yaml
replicaCount: 3
```

Note: If scaling beyond 1, you'll need to create additional PVCs or use `volumeClaimTemplate`.

## Uninstalling

⚠️ **Warning:** Uninstalling does NOT delete the PVC (to protect your data):

```bash
helm uninstall mongodb -n 86cabb-dev
```

To also delete the PVC:

```bash
helm uninstall mongodb -n 86cabb-dev
kubectl delete pvc mongodbdata -n 86cabb-dev
```

## Related Documentation

- [MongoDB Official Docs](https://docs.mongodb.com/manual/reference/configuration-options/)
- [Kubernetes StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)
- [Helm Chart Best Practices](https://helm.sh/docs/chart_best_practices/)
- [OpenShift MongoDB Image](https://docs.openshift.com/container-platform/latest/openshift_images/templates-ruby-on-rails.html)
