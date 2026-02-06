# Secrets Migration - Summary

All MongoDB credentials have been moved from configuration files to Kubernetes Secrets for enhanced
security.

## What Changed

### Removed from Files ❌

- Passwords removed from `helm/mongodb/values.yaml`
- Passwords removed from `helm/mongodb/values-dev.yaml`
- Passwords removed from `helm/mongodb/values-test.yaml`
- Passwords removed from `helm/mongodb/values-prod.yaml`

### Updated Files ✅

- `helm/mongodb/values.yaml` - Removed password fields, kept username and database
- `helm/mongodb/values-dev.yaml` - Removed password fields
- `helm/mongodb/values-test.yaml` - Removed password fields
- `helm/mongodb/values-prod.yaml` - Removed password fields
- `helm/mongodb/templates/secret.yaml` - Updated to handle external secrets
- `helm/mongodb/README.md` - Added secrets management section
- `.github/workflows/deploy-mongodb.yml` - Added "Create MongoDB Secret" step

### New Files 📄

- `helm/mongodb/SECRETS.md` - Complete secrets management guide (best practices, vault integration)
- `helm/mongodb/setup-secrets.sh` - Helper script to create secrets
- `docs/MONGODB_MIGRATION.md` - Updated with secret creation steps

## Quick Start

### 1. Create Secret in Your Namespace

**Option A: Using the helper script**

```bash
chmod +x ./helm/mongodb/setup-secrets.sh

./helm/mongodb/setup-secrets.sh \
  -n 86cabb-dev \
  -p "YourSecurePassword123!" \
  -a "YourAdminPassword456!"
```

**Option B: Using kubectl directly**

```bash
kubectl create secret generic mongodb-secret \
  -n 86cabb-dev \
  --from-literal=mongodb-password='YourSecurePassword123!' \
  --from-literal=mongodb-admin-password='YourAdminPassword456!'
```

### 2. Deploy the Helm Chart

```bash
helm install mongodb ./helm/mongodb \
  -n 86cabb-dev \
  -f ./helm/mongodb/values-dev.yaml
```

### 3. Verify

```bash
kubectl get secret mongodb-secret -n 86cabb-dev
kubectl get statefulset mongodb -n 86cabb-dev
kubectl logs mongodb-0 -n 86cabb-dev
```

## For GitHub Actions Deployment

Add these secrets to your GitHub repository:

**Settings → Secrets and variables → Actions → New repository secret**

Create for each environment:

| Environment | Secret Name              | Example Value           |
| ----------- | ------------------------ | ----------------------- |
| Development | `MONGODB_PASSWORD`       | `DevPassword123!`       |
| Development | `MONGODB_ADMIN_PASSWORD` | `DevAdminPassword456!`  |
| Test        | `MONGODB_PASSWORD`       | `TestPassword789!`      |
| Test        | `MONGODB_ADMIN_PASSWORD` | `TestAdminPassword000!` |
| Production  | `MONGODB_PASSWORD`       | `ProdPassword111!`      |
| Production  | `MONGODB_ADMIN_PASSWORD` | `ProdAdminPassword222!` |

The workflow will use these to create the Secret:

```yaml
- name: Create MongoDB Secret
  run: |
    kubectl create secret generic mongodb-secret \
      -n ${{ env.NAMESPACE }} \
      --from-literal=mongodb-password='${{ secrets.MONGODB_PASSWORD }}' \
      --from-literal=mongodb-admin-password='${{ secrets.MONGODB_ADMIN_PASSWORD }}' \
      --dry-run=client -o yaml | kubectl apply -f -
```

## Security Benefits

✅ **No credentials in Git** - Passwords never committed to source control ✅ **Environment
isolation** - Different passwords per environment (dev ≠ test ≠ prod) ✅ **Audit trail** -
Kubernetes Secret changes are auditable ✅ **Easy rotation** - Update password without redeploying
application ✅ **Vault integration** - Can integrate with Azure Key Vault, HashiCorp Vault, etc.

## Files Safe to Commit

These files are now safe to commit to Git (no credentials):

- ✅ `helm/mongodb/values.yaml`
- ✅ `helm/mongodb/values-dev.yaml`
- ✅ `helm/mongodb/values-test.yaml`
- ✅ `helm/mongodb/values-prod.yaml`
- ✅ `.github/workflows/deploy-mongodb.yml`

## Documentation

- **[helm/mongodb/SECRETS.md](./helm/mongodb/SECRETS.md)** - Complete credentials management guide
  - How to create/update secrets
  - Vault integration
  - Password rotation procedures
  - Troubleshooting

- **[helm/mongodb/README.md](./helm/mongodb/README.md)** - Helm chart documentation (updated)
  - Installation with secrets
  - Migration steps
  - Configuration

- **[docs/MONGODB_MIGRATION.md](./docs/MONGODB_MIGRATION.md)** - Migration guide (updated)
  - Includes secret creation as prerequisite step

## Migration Checklist

If you previously deployed with passwords in values files:

- [ ] Extract current passwords from old `values-*.yaml` files
- [ ] Create Kubernetes Secrets with extracted passwords
- [ ] Verify Secrets exist in each namespace
- [ ] Delete old value files with passwords (git rm)
- [ ] Update Helm chart deployment
- [ ] Test MongoDB connectivity
- [ ] Commit cleaned-up files (without passwords)

## Troubleshooting

### Secret doesn't exist

```bash
# Check if Secret exists
kubectl get secret mongodb-secret -n <namespace>

# Create it if missing
kubectl create secret generic mongodb-secret \
  -n <namespace> \
  --from-literal=mongodb-password='<password>' \
  --from-literal=mongodb-admin-password='<admin-password>'
```

### Pod can't authenticate

```bash
# Check Secret keys
kubectl get secret mongodb-secret -n <namespace> -o yaml

# Verify both keys exist:
# - mongodb-password
# - mongodb-admin-password

# If missing, recreate with both keys
```

### Changed password but pod still using old one

```bash
# Update Secret
kubectl patch secret mongodb-secret -n <namespace> \
  -p '{"data":{"mongodb-password":"'$(echo -n 'new-password' | base64)'"}}'

# Force pod restart to pick up new Secret value
kubectl delete pod mongodb-0 -n <namespace>
```

## Next Steps

1. ✅ **Understand the changes** - Review this document
2. ⏭️ **Read SECRETS.md** - Comprehensive credential management guide
3. ⏭️ **Create Secrets** - For each environment (dev, test, prod)
4. ⏭️ **Deploy Helm Chart** - With Secrets in place
5. ⏭️ **Test Connectivity** - Verify MongoDB works
6. ⏭️ **Automate with GitHub Actions** - Use the provided workflow

## Questions?

See [helm/mongodb/SECRETS.md](./helm/mongodb/SECRETS.md) for comprehensive information on:

- Azure Key Vault integration
- External Secrets Operator setup
- Password rotation procedures
- Vault/HashiCorp integration
- Security best practices

---

**Summary:** Passwords are now managed securely via Kubernetes Secrets. Never commit credentials to
Git. Use the helper script or kubectl to create secrets before deploying.
