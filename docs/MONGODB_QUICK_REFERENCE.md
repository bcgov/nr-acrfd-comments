# MongoDB StatefulSet - Quick Reference

## Common Commands

### Check Status

```bash
# StatefulSet status
kubectl get statefulset mongodb -n <namespace>

# Pod status
kubectl get pods mongodb-0 -n <namespace>

# All MongoDB resources
kubectl get all -l app.kubernetes.io/name=mongodb -n <namespace>
```

### Monitor MongoDB

```bash
# View logs
kubectl logs mongodb-0 -n <namespace>

# Follow logs in real-time
kubectl logs -f mongodb-0 -n <namespace>

# Describe pod (events, mounts, etc)
kubectl describe pod mongodb-0 -n <namespace>

# MongoDB shell access
kubectl exec -it mongodb-0 -n <namespace> -- mongo
```

### Test Connection

```bash
# Ping MongoDB
kubectl exec mongodb-0 -n <namespace> -- \
  mongo 127.0.0.1:27017 --eval "db.adminCommand('ping')"

# Connect to specific database
kubectl exec mongodb-0 -n <namespace> -- \
  mongo 127.0.0.1:27017/prc-dev \
  -u user54L \
  -p <password> \
  --authenticationDatabase admin
```

### Manage Secrets

```bash
# View secret
kubectl get secret mongodb-secret -n <namespace> -o yaml

# Update password
kubectl patch secret mongodb-secret -n <namespace> \
  -p '{"data":{"mongodb-password":"'$(echo -n 'new-password' | base64)'"}}'

# Force pod restart to pick up new secret
kubectl delete pod mongodb-0 -n <namespace>
```

### Data Operations

```bash
# Backup database
kubectl exec mongodb-0 -n <namespace> -- \
  mongodump --out=/tmp/backup \
  -u user54L -p <password>

# Restore database
kubectl exec -i mongodb-0 -n <namespace> -- \
  mongorestore --archive < ./backup.archive \
  -u user54L -p <password>

# Count documents
kubectl exec mongodb-0 -n <namespace> -- \
  mongo 127.0.0.1:27017/prc-dev \
  -u user54L -p <password> \
  --authenticationDatabase admin \
  --eval "db.applications.count()"
```

## Helm Operations

```bash
# Check deployed version
helm list -n <namespace> | grep mongodb

# View values in use
helm get values mongodb -n <namespace>

# Upgrade (with new values)
helm upgrade mongodb ./helm/mongodb \
  -n <namespace> \
  -f ./helm/mongodb/values-dev.yaml

# Rollback to previous version
helm rollback mongodb -n <namespace>

# Remove release (keeps PVC)
helm uninstall mongodb -n <namespace>
```

## Troubleshooting

### Pod Won't Start

```bash
# Check pod events
kubectl describe pod mongodb-0 -n <namespace>

# Check logs
kubectl logs mongodb-0 -n <namespace>

# Check PVC
kubectl get pvc mongodbdata -n <namespace>
kubectl describe pvc mongodbdata -n <namespace>
```

### Connection Issues

```bash
# Verify service
kubectl get svc mongodb -n <namespace>

# Test service DNS
kubectl run -it --rm debug --image=busybox --restart=Never -- \
  nslookup mongodb.<namespace>.svc.cluster.local

# Test TCP connection
kubectl run -it --rm debug --image=busybox --restart=Never -- \
  sh -c 'nc -zv mongodb.<namespace>.svc.cluster.local 27017'
```

### Data Loss Concerns

```bash
# Verify PVC is still bound
kubectl get pvc mongodbdata -n <namespace>

# Check PVC storage capacity
kubectl get pvc mongodbdata -n <namespace> -o wide

# Verify mount point in pod
kubectl exec mongodb-0 -n <namespace> -- mount | grep mongodb

# Check disk usage
kubectl exec mongodb-0 -n <namespace> -- df -h /var/lib/mongodb/data
```

### Performance Issues

```bash
# Check resource usage
kubectl top pod mongodb-0 -n <namespace>

# Check node it's running on
kubectl get pod mongodb-0 -n <namespace> -o wide

# View resource limits
kubectl get pod mongodb-0 -n <namespace> -o yaml | grep -A 5 resources

# Check readiness/liveness probe failures
kubectl describe pod mongodb-0 -n <namespace> | grep -A 10 "Events"
```

## Environment Variables

Used in pod:

- `MONGODB_USER` - Username
- `MONGODB_PASSWORD` - User password (from Secret)
- `MONGODB_DATABASE` - Database name
- `MONGODB_ADMIN_PASSWORD` - Admin password (from Secret)

## Important Paths

Inside container:

- Data: `/var/lib/mongodb/data`
- Logs: `stdout` (view with `kubectl logs`)
- Config: Uses OpenShift image defaults

## Scaling Notes

- **Single replica** (current): Uses one StatefulSet Pod, one PVC
- **Multiple replicas**: Would require multiple PVCs or changes to volumeClaimTemplate

## Maintenance

### Scheduled Restart

```bash
kubectl delete pod mongodb-0 -n <namespace>
# StatefulSet will recreate it
```

### Resource Update

```bash
helm upgrade mongodb ./helm/mongodb \
  -n <namespace> \
  --set resources.limits.memory=5Gi \
  --set resources.requests.memory=2.5Gi
```

### Image Update

```bash
helm upgrade mongodb ./helm/mongodb \
  -n <namespace> \
  --set image.tag="3.6-latest"
```

## Emergency Contacts

- Kubernetes/OpenShift: Check cluster status
- PVC Issues: Storage team
- MongoDB Issues: Database team
- Helm/Deployment: DevOps team
