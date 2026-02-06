# MongoDB Secrets Management

This document explains how to securely manage MongoDB credentials using Kubernetes Secrets.

## Security Best Practices

**IMPORTANT:** MongoDB passwords should **NEVER** be stored in Git, values files, or committed to
source control.

- ✅ Store passwords in Kubernetes Secrets (managed separately per environment)
- ✅ Store passwords in a secure vault (HashiCorp Vault, Azure Key Vault, etc.)
- ✅ Manage passwords through your CI/CD system's secret management
- ❌ Never commit passwords to Git
- ❌ Never include passwords in values-\*.yaml files
- ❌ Never pass passwords as command-line arguments (visible in process lists)

## Creating Secrets Before Deployment

The Secret `mongodb-secret` must be created in your OpenShift namespace **before** deploying the
Helm chart.

### Method 1: Using kubectl (Manual)

```bash
# Create the Secret in your namespace
kubectl create secret generic mongodb-secret \
  -n <namespace> \
  --from-literal=mongodb-password='<password>' \
  --from-literal=mongodb-admin-password='<admin-password>'

# Verify it was created
kubectl get secret mongodb-secret -n <namespace>
```

### Method 2: Using OpenShift CLI

```bash
# Create the Secret using oc
oc create secret generic mongodb-secret \
  -n <namespace> \
  --from-literal=mongodb-password='<password>' \
  --from-literal=mongodb-admin-password='<admin-password>'

# Verify
oc get secret mongodb-secret -n <namespace>
```

### Method 3: Using a Kubernetes manifest (GitOps)

Create a `secret.yaml` file (kept in a private repository or secret store):

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mongodb-secret
  namespace: <namespace>
type: Opaque
stringData:
  mongodb-password: '<password>'
  mongodb-admin-password: '<admin-password>'
```

Apply it:

```bash
kubectl apply -f secret.yaml
```

### Method 4: Using GitHub Actions (CI/CD)

In your GitHub Actions workflow, create the Secret before Helm deployment:

```yaml
- name: Create MongoDB Secret
  run: |
    kubectl create secret generic mongodb-secret \
      -n ${{ env.NAMESPACE }} \
      --from-literal=mongodb-password='${{ secrets.MONGODB_PASSWORD }}' \
      --from-literal=mongodb-admin-password='${{ secrets.MONGODB_ADMIN_PASSWORD }}' \
      --dry-run=client -o yaml | kubectl apply -f -
```

This approach:

- Gets password from GitHub Actions secret (never visible in logs)
- Uses `--dry-run=client` with `kubectl apply` to safely update existing secrets
- Works for both initial creation and updates

## Updating Secrets

### Update an existing Secret

```bash
# Replace the Secret (deletes and recreates)
kubectl delete secret mongodb-secret -n <namespace>
kubectl create secret generic mongodb-secret \
  -n <namespace> \
  --from-literal=mongodb-password='<new-password>' \
  --from-literal=mongodb-admin-password='<new-admin-password>'

# Pods will continue running with old password until restarted
# Force pod restart to pick up new credentials:
kubectl delete pod mongodb-0 -n <namespace>
```

### Patch an existing Secret

```bash
# Update just the password (base64 encoded)
kubectl patch secret mongodb-secret \
  -n <namespace> \
  -p '{"data":{"mongodb-password":"'$(echo -n 'new-password' | base64)'"}}'

# Update admin password
kubectl patch secret mongodb-secret \
  -n <namespace> \
  -p '{"data":{"mongodb-admin-password":"'$(echo -n 'new-admin-password' | base64)'"}}'
```

### View Secret contents

```bash
# View Secret metadata (not values)
kubectl get secret mongodb-secret -n <namespace>

# View Secret in YAML (base64 encoded)
kubectl get secret mongodb-secret -n <namespace> -o yaml

# Decode and view actual values
kubectl get secret mongodb-secret -n <namespace> -o jsonpath='{.data.mongodb-password}' | base64 -d
kubectl get secret mongodb-secret -n <namespace> -o jsonpath='{.data.mongodb-admin-password}' | base64 -d
```

## Per-Environment Credentials

Different credentials should be used for each environment:

### Development

```bash
kubectl create secret generic mongodb-secret \
  -n 86cabb-dev \
  --from-literal=mongodb-password='<dev-password>' \
  --from-literal=mongodb-admin-password='<dev-admin-password>'
```

### Test

```bash
kubectl create secret generic mongodb-secret \
  -n 86cabb-test \
  --from-literal=mongodb-password='<test-password>' \
  --from-literal=mongodb-admin-password='<test-admin-password>'
```

### Production

```bash
kubectl create secret generic mongodb-secret \
  -n 86cabb-prod \
  --from-literal=mongodb-password='<prod-password>' \
  --from-literal=mongodb-admin-password='<prod-admin-password>'
```

## Integration with Vault/Key Management

For enhanced security, integrate with external secret management:

### Azure Key Vault (recommended for BC Gov)

```bash
# Store secrets in Azure Key Vault
az keyvault secret set \
  --vault-name <vault-name> \
  --name mongodb-password-dev \
  --value '<password>'

# Retrieve and create Kubernetes Secret
PASSWORD=$(az keyvault secret show \
  --vault-name <vault-name> \
  --name mongodb-password-dev \
  --query value -o tsv)

kubectl create secret generic mongodb-secret \
  -n 86cabb-dev \
  --from-literal=mongodb-password="$PASSWORD"
```

### Using External Secrets Operator

Deploy [External Secrets Operator](https://external-secrets.io/) to automatically sync secrets:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: azure-keyvault
  namespace: 86cabb-dev
spec:
  provider:
    azurekv:
      authType: managed-identity
      vaultUrl: https://<vault-name>.vault.azure.net/
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: mongodb-secret
  namespace: 86cabb-dev
spec:
  secretStoreRef:
    name: azure-keyvault
    kind: SecretStore
  target:
    name: mongodb-secret
    creationPolicy: Owner
  data:
    - secretKey: mongodb-password
      remoteRef:
        key: mongodb-password-dev
    - secretKey: mongodb-admin-password
      remoteRef:
        key: mongodb-admin-password-dev
```

## Migration from Values Files

If you have existing password in values files:

1. **Extract passwords** from old values files
2. **Create Kubernetes Secrets** with those passwords
3. **Remove passwords** from values files (already done)
4. **Deploy** the Helm chart
5. **Verify** MongoDB pod starts successfully

## Troubleshooting

### Pod can't start - "secret not found"

```bash
# Check if Secret exists
kubectl get secret mongodb-secret -n <namespace>

# If not, create it
kubectl create secret generic mongodb-secret \
  -n <namespace> \
  --from-literal=mongodb-password='<password>' \
  --from-literal=mongodb-admin-password='<admin-password>'

# Restart pod
kubectl delete pod mongodb-0 -n <namespace>
```

### Pod starts but can't authenticate

```bash
# Check Secret contents
kubectl get secret mongodb-secret -n <namespace> -o yaml

# Decode to verify (should match actual password)
kubectl get secret mongodb-secret -n <namespace> \
  -o jsonpath='{.data.mongodb-password}' | base64 -d

# Check pod logs
kubectl logs mongodb-0 -n <namespace>
```

### Changed password but pod still using old one

```bash
# Update Secret
kubectl patch secret mongodb-secret -n <namespace> \
  -p '{"data":{"mongodb-password":"'$(echo -n 'new-password' | base64)'"}}'

# Force pod restart (only way to pick up new Secret value)
kubectl delete pod mongodb-0 -n <namespace>

# StatefulSet will recreate it with new password
```

## Rotation Policy

For production, establish a password rotation policy:

1. **Quarterly rotation** - Every 90 days
2. **Immediate rotation** - If credentials are compromised
3. **On-demand rotation** - During security audits

### Rotation Procedure

```bash
# 1. Generate new password
NEW_PASSWORD=$(openssl rand -base64 32)

# 2. Update Secret
kubectl patch secret mongodb-secret -n <namespace> \
  -p '{"data":{"mongodb-password":"'$(echo -n "$NEW_PASSWORD" | base64)'"}}'

# 3. Restart pod
kubectl delete pod mongodb-0 -n <namespace>

# 4. Verify connectivity
kubectl logs -f mongodb-0 -n <namespace>

# 5. Update your documentation/vault with new password
```

## Checklist for Deployment

Before deploying the MongoDB Helm chart:

- [ ] Secret `mongodb-secret` created in the namespace
- [ ] `mongodb-password` key exists in Secret
- [ ] `mongodb-admin-password` key exists in Secret
- [ ] Passwords are strong (min 16 characters, mixed case, numbers, symbols)
- [ ] Passwords are stored securely (not in Git or public repos)
- [ ] Different passwords used per environment (dev ≠ test ≠ prod)
- [ ] Password change procedure documented
- [ ] Rotation schedule established
- [ ] Backup of passwords stored in secure location

## Reference

- [Kubernetes Secrets Documentation](https://kubernetes.io/docs/concepts/configuration/secret/)
- [External Secrets Operator](https://external-secrets.io/)
- [Azure Key Vault Integration](https://learn.microsoft.com/en-us/azure/aks/csi-secrets-store-driver)
