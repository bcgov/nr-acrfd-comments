#!/bin/bash

set -e

NAMESPACE="86cabb-dev"
RELEASE_NAME="nr-acrfd-comments-14"
CHART_PATH="./charts/app"
VALUES_FILE="./charts/app/values.yaml"

echo "=========================================="
echo "MongoDB 3.6 to 7.0 Migration Script"
echo "=========================================="
echo "Using namespace: $NAMESPACE"
echo "Using release: $RELEASE_NAME"
echo ""

# Function to wait for migration job to complete
wait_for_migration() {
  local target_version=$1
  echo "Waiting for MongoDB migration to complete for version $target_version..."
  
  # Wait for migration job to complete
  for i in {1..120}; do
    JOB_STATUS=$(kubectl get job -n $NAMESPACE mongodb-app-migrate-fcv -o jsonpath='{.status.succeeded}' 2>/dev/null || echo "0")
    
    if [ "$JOB_STATUS" = "1" ]; then
      echo "✓ Migration job completed successfully for MongoDB $target_version"
      # Delete the completed job so we can run the next upgrade
      kubectl delete job -n $NAMESPACE mongodb-app-migrate-fcv 2>/dev/null || true
      sleep 5
      return 0
    fi
    
    echo "  Status: Job not yet complete... (attempt $i/120)"
    sleep 10
  done
  
  echo "✗ Migration job timeout for version $target_version"
  kubectl logs -n $NAMESPACE -l app.kubernetes.io/component=migration --tail=50
  return 1
}

# Function to upgrade MongoDB version
upgrade_mongodb() {
  local version=$1
  local fcv=$2
  
  echo ""
  echo "=========================================="
  echo "Upgrading to MongoDB $version (FCV: $fcv)"
  echo "=========================================="
  
  # Update values.yaml with new version (using proper YAML replacement)
  echo "Updating values.yaml with MongoDB $version..."
  
  # Use sed to update the image tag on the correct line
  sed -i.bak "/mongodb:/,/^  [^ ]/ s/tag: '[0-9.]*'/tag: '$version'/" $VALUES_FILE
  
  # Update migration target FCV
  sed -i.bak "/migration:/,/^  [^ ]/ s/targetFCV: '[0-9.]*'/targetFCV: '$fcv'/" $VALUES_FILE
  
  # Run helm upgrade
  echo "Running helm upgrade..."
  helm upgrade $RELEASE_NAME $CHART_PATH \
    -n $NAMESPACE \
    -f $VALUES_FILE \
    --wait \
    --timeout=10m
  
  echo "Helm upgrade completed. Waiting for migration..."
  wait_for_migration $version
  
  echo "✓ MongoDB $version upgrade complete"
}

# Step 1: Deploy MongoDB 4.0 (handles upgrade from 3.6 data)
echo ""
echo "Note: Data is currently MongoDB 3.6 format"
echo "MongoDB 4.0 will automatically upgrade the data format on first start"
upgrade_mongodb "4.0" "4.0"

# Step 2: Upgrade to MongoDB 5.0
upgrade_mongodb "5.0" "5.0"

# Step 3: Upgrade to MongoDB 6.0
upgrade_mongodb "6.0" "6.0"

# Step 4: Upgrade to MongoDB 7.0 (Final version)
upgrade_mongodb "7.0" "7.0"

echo ""
echo "=========================================="
echo "✓ MongoDB Migration Complete!"
echo "=========================================="
echo "MongoDB is now running version 7.0 in namespace $NAMESPACE"
echo ""
echo "Verifying installation..."
kubectl get statefulset -n $NAMESPACE mongodb-app -o wide
echo ""
kubectl get pods -n $NAMESPACE -l app.kubernetes.io/name=mongodb-app
echo ""
echo "To verify connectivity:"
echo "  kubectl exec -n $NAMESPACE mongodb-app-0 -- mongosh admin --eval \"db.version()\""
