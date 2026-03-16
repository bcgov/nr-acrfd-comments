# MongoDB 3.6 to 7.0 Migration Guide

## Prerequisites

- MongoDB data is already loaded in the `mongodbdata` PVC in `86cabb-dev` namespace
- Users are configured in MongoDB (admin user and userQBY for prc-prod database)
- Migration is enabled in values.yaml
- Helm is installed and accessible

## Migration Path

The script performs incremental upgrades to ensure compatibility:

- 3.6 → 4.0 → 5.0 → 6.0 → 7.0

## Instructions

### Step 1: Run the Migration Script

```bash
cd /Users/barrettfalk/Projects/Github/parc/nr-acrfd-comments
./migrate-mongodb-3.6-to-7.0.sh
```

The script will:

1. Update `charts/app/values.yaml` with each MongoDB version
2. Run `helm upgrade` to deploy each version
3. Wait for the migration job to complete before moving to the next version
4. Verify installation at the end

### Step 2: Monitor Progress

The script logs each step. For each version upgrade, it will:

- Show the MongoDB version being deployed
- Run helm upgrade
- Wait for migration job to complete (up to 2 hours)
- Display status

### Step 3: Verify Completion

After the script completes, verify MongoDB 7.0 is running:

```bash
# Check MongoDB version
kubectl exec -n 86cabb-dev mongodb-app-0 -- mongosh admin --eval "db.version()"

# Check database connectivity
kubectl exec -n 86cabb-dev mongodb-app-0 -- mongosh prc-prod -u user54L -p tNRXuW8jjV4wnFqm --eval "db.getCollectionNames()"

# Check data integrity
kubectl exec -n 86cabb-dev mongodb-app-0 -- mongosh prc-prod -u user54L -p tNRXuW8jjV4wnFqm --eval "
  const collections = db.getCollectionNames();
  for (let col of collections) {
    print(col + ': ' + db[col].countDocuments() + ' documents');
  }
"
```

## Troubleshooting

### Migration Job Stuck

If the migration job appears stuck:

```bash
# Check job status
kubectl get job -n 86cabb-dev -l app.kubernetes.io/component=migration

# View job logs
kubectl logs -n 86cabb-dev -l app.kubernetes.io/component=migration --tail=100

# Delete stuck job to retry
kubectl delete job -n 86cabb-dev mongodb-app-migrate-fcv
```

### StatefulSet Not Updating

```bash
# Check StatefulSet status
kubectl get statefulset -n 86cabb-dev mongodb-app

# Check pod events
kubectl describe pod -n 86cabb-dev mongodb-app-0

# Force StatefulSet recreation if needed
kubectl delete statefulset -n 86cabb-dev mongodb-app
kubectl delete pod -n 86cabb-dev mongodb-app-0
# Then rerun the script
```

### Rollback

If something goes wrong, you can manually revert to previous version:

```bash
# Edit values.yaml to revert image tag and FCV
# Then run helm upgrade to apply the change
helm upgrade nr-acrfd-comments-14 ./charts/app -n 86cabb-dev -f ./charts/app/values.yaml
```

## Manual Migration (Alternative)

If you prefer to do each step manually:

```bash
# Step 1: Deploy MongoDB 4.0
sed -i 's/tag: ['"'"'"].*['"'"'"]/tag: '"'"'4.0'"'"'/' charts/app/values.yaml
sed -i 's/targetFCV: ['"'"'"].*['"'"'"]/targetFCV: '"'"'4.0'"'"'/' charts/app/values.yaml
helm upgrade nr-acrfd-comments-14 ./charts/app -n 86cabb-dev

# Wait for migration job to complete
kubectl wait --for=condition=complete job/mongodb-app-migrate-fcv -n 86cabb-dev --timeout=2h

# Repeat for 5.0, 6.0, and 7.0
```
