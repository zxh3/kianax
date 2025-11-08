# Local Development Guide for Kianax

This guide covers local development and testing options for the Kianax platform, including both Docker Compose (simpler) and local Kubernetes clusters (closer to production).

## Table of Contents

- [Quick Start (Docker Compose)](#quick-start-docker-compose)
- [Local Kubernetes Options](#local-kubernetes-options)
- [Minikube Setup](#minikube-setup)
- [Kind Setup](#kind-setup)
- [Tilt for Fast Development](#tilt-for-fast-development)
- [Testing Microservices Locally](#testing-microservices-locally)
- [Debugging Workflows](#debugging-workflows)
- [CI/CD Testing](#cicd-testing)

## Quick Start (Docker Compose)

For rapid local development without Kubernetes complexity, use Docker Compose.

### Setup

Current Docker Compose configuration (`docker-compose.yml` in project root):

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: kianax-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: kianax
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: kianax-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Optional: Add backend service
  backend:
    build:
      context: ./apps/server
      dockerfile: Dockerfile
    container_name: kianax-backend
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: development
      PORT: 3001
      HOST: 0.0.0.0
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/kianax
      REDIS_URL: redis://redis:6379
      JWT_SECRET: local-dev-secret-change-in-production
      LOG_LEVEL: debug
    ports:
      - "3001:3001"
    volumes:
      - ./apps/server/src:/app/src  # Hot reload
    command: bun run dev

  # Optional: Add frontend service
  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile.dev
    container_name: kianax-web
    depends_on:
      - backend
    environment:
      NODE_ENV: development
      NEXT_PUBLIC_API_URL: http://localhost:3001
    ports:
      - "3000:3000"
    volumes:
      - ./apps/web:/app
      - /app/node_modules
      - /app/.next
    command: bun run dev

volumes:
  postgres_data:
  redis_data:
```

### Usage

```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend

# Stop services
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v

# Rebuild containers after code changes
docker-compose up --build

# Run migrations
docker-compose exec backend bun run db:migrate

# Open shell in backend container
docker-compose exec backend sh

# Run tests
docker-compose exec backend bun test
```

### Pros and Cons

**Pros:**
- ✅ Simple setup (no Kubernetes knowledge required)
- ✅ Fast startup (< 1 minute)
- ✅ Good for rapid iteration
- ✅ Works on any machine with Docker
- ✅ Low resource usage

**Cons:**
- ❌ Different from production (no K8s features)
- ❌ Cannot test Helm charts, Ingress, etc.
- ❌ Cannot test autoscaling behavior
- ❌ Not suitable for testing microservices interactions at scale

## Local Kubernetes Options

For testing Kubernetes features locally, you have three main options:

| Feature | Minikube | Kind | Docker Desktop K8s |
|---------|----------|------|-------------------|
| **Ease of Setup** | Easy | Medium | Easiest |
| **Performance** | Good | Best | Good |
| **LoadBalancer** | Via tunnel | Via MetalLB | Native |
| **Multiple Clusters** | Yes | Yes | No |
| **Resource Usage** | Medium | Low | Medium |
| **Best For** | General testing | CI/CD | Mac users |

**Recommendation**:
- **Mac**: Docker Desktop K8s or Minikube
- **Linux**: Kind or Minikube
- **Windows**: Docker Desktop K8s or Minikube
- **CI/CD**: Kind

## Minikube Setup

Minikube runs a single-node Kubernetes cluster in a VM or container.

### Installation

```bash
# Mac
brew install minikube

# Linux
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube

# Windows (with Chocolatey)
choco install minikube
```

### Start Cluster

```bash
# Start with Docker driver (recommended)
minikube start --driver=docker --cpus=4 --memory=8192

# Or with VirtualBox
minikube start --driver=virtualbox --cpus=4 --memory=8192

# Verify
kubectl get nodes
```

### Enable Addons

```bash
# Enable Ingress controller
minikube addons enable ingress

# Enable metrics server (for HPA)
minikube addons enable metrics-server

# Enable dashboard
minikube addons enable dashboard
```

### Deploy Kianax to Minikube

1. **Build images and load into Minikube**
   ```bash
   # Set Docker environment to use Minikube's Docker daemon
   eval $(minikube docker-env)

   # Build images (they'll be available in Minikube)
   cd apps/server
   docker build -t kianax-api-gateway:dev .

   cd ../web
   docker build -t kianax-web:dev .
   ```

2. **Create namespace**
   ```bash
   kubectl create namespace kianax
   ```

3. **Deploy PostgreSQL and Redis**
   ```bash
   # Create persistent volumes
   kubectl apply -f - <<EOF
   apiVersion: v1
   kind: PersistentVolumeClaim
   metadata:
     name: postgres-pvc
     namespace: kianax
   spec:
     accessModes:
     - ReadWriteOnce
     resources:
       requests:
         storage: 5Gi
   ---
   apiVersion: v1
   kind: PersistentVolumeClaim
   metadata:
     name: redis-pvc
     namespace: kianax
   spec:
     accessModes:
     - ReadWriteOnce
     resources:
       requests:
         storage: 1Gi
   EOF

   # Deploy PostgreSQL
   kubectl apply -f - <<EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: postgres
     namespace: kianax
   spec:
     replicas: 1
     selector:
       matchLabels:
         app: postgres
     template:
       metadata:
         labels:
           app: postgres
       spec:
         containers:
         - name: postgres
           image: postgres:16-alpine
           env:
           - name: POSTGRES_USER
             value: postgres
           - name: POSTGRES_PASSWORD
             value: postgres
           - name: POSTGRES_DB
             value: kianax
           ports:
           - containerPort: 5432
           volumeMounts:
           - name: data
             mountPath: /var/lib/postgresql/data
         volumes:
         - name: data
           persistentVolumeClaim:
             claimName: postgres-pvc
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: postgres
     namespace: kianax
   spec:
     selector:
       app: postgres
     ports:
     - port: 5432
   EOF

   # Deploy Redis
   kubectl apply -f - <<EOF
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: redis
     namespace: kianax
   spec:
     replicas: 1
     selector:
       matchLabels:
         app: redis
     template:
       metadata:
         labels:
           app: redis
       spec:
         containers:
         - name: redis
           image: redis:7-alpine
           ports:
           - containerPort: 6379
           volumeMounts:
           - name: data
             mountPath: /data
         volumes:
         - name: data
           persistentVolumeClaim:
             claimName: redis-pvc
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: redis
     namespace: kianax
   spec:
     selector:
       app: redis
     ports:
     - port: 6379
   EOF
   ```

4. **Deploy backend using Helm**
   ```bash
   # Install with local values
   helm upgrade --install api-gateway k8s/charts/api-gateway \
     -n kianax \
     -f k8s/charts/api-gateway/values-local.yaml
   ```

   Example `values-local.yaml`:
   ```yaml
   replicaCount: 1

   image:
     repository: kianax-api-gateway
     tag: dev
     pullPolicy: Never  # Don't try to pull from registry

   service:
     type: ClusterIP
     port: 3001

   resources:
     requests:
       memory: "128Mi"
       cpu: "100m"
     limits:
       memory: "256Mi"
       cpu: "200m"

   env:
     NODE_ENV: development
     DATABASE_URL: postgresql://postgres:postgres@postgres.kianax.svc.cluster.local:5432/kianax
     REDIS_URL: redis://redis.kianax.svc.cluster.local:6379
     JWT_SECRET: local-dev-secret
   ```

5. **Expose service**
   ```bash
   # Via Ingress (if ingress addon enabled)
   kubectl apply -f - <<EOF
   apiVersion: networking.k8s.io/v1
   kind: Ingress
   metadata:
     name: api-gateway
     namespace: kianax
   spec:
     rules:
     - host: api.kianax.local
       http:
         paths:
         - path: /
           pathType: Prefix
           backend:
             service:
               name: api-gateway
               port:
                 number: 3001
   EOF

   # Add to /etc/hosts
   echo "$(minikube ip) api.kianax.local" | sudo tee -a /etc/hosts

   # Access at http://api.kianax.local
   ```

   Or use port forwarding:
   ```bash
   kubectl port-forward svc/api-gateway -n kianax 3001:3001
   # Access at http://localhost:3001
   ```

### Useful Minikube Commands

```bash
# View dashboard
minikube dashboard

# SSH into Minikube VM
minikube ssh

# Get cluster IP (for accessing services)
minikube ip

# Tunnel for LoadBalancer services
minikube tunnel

# Stop cluster
minikube stop

# Delete cluster
minikube delete

# View logs
minikube logs

# Add more resources
minikube start --cpus=6 --memory=12288
```

## Kind Setup

Kind (Kubernetes IN Docker) runs K8s clusters as Docker containers. Very fast and lightweight.

### Installation

```bash
# Mac
brew install kind

# Linux
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.20.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind

# Windows (with Chocolatey)
choco install kind
```

### Create Cluster

```bash
# Simple cluster
kind create cluster --name kianax

# Cluster with Ingress support
cat <<EOF | kind create cluster --name kianax --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
    protocol: TCP
  - containerPort: 443
    hostPort: 443
    protocol: TCP
- role: worker
- role: worker
EOF

# Verify
kubectl cluster-info --context kind-kianax
kubectl get nodes
```

### Install Ingress NGINX

```bash
# Install Ingress NGINX controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml

# Wait for it to be ready
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=90s
```

### Load Images into Kind

```bash
# Build image
cd apps/server
docker build -t kianax-api-gateway:dev .

# Load into Kind cluster
kind load docker-image kianax-api-gateway:dev --name kianax

# Verify
docker exec -it kianax-control-plane crictl images | grep kianax
```

### Deploy to Kind

Same steps as Minikube (create namespace, deploy services, deploy app).

### Useful Kind Commands

```bash
# List clusters
kind get clusters

# Get kubeconfig
kind get kubeconfig --name kianax

# Delete cluster
kind delete cluster --name kianax

# Export logs
kind export logs --name kianax
```

## Tilt for Fast Development

Tilt automates the local Kubernetes dev loop: build → push → deploy → logs.

### Why Tilt?

Without Tilt:
```
1. Make code change
2. docker build ...
3. kind load docker-image ...
4. kubectl delete pod ... (to force restart)
5. kubectl logs -f ...
```

With Tilt:
```
1. Make code change
2. (Tilt automatically does steps 2-5)
```

### Installation

```bash
# Mac
brew install tilt-dev/tap/tilt

# Linux
curl -fsSL https://raw.githubusercontent.com/tilt-dev/tilt/master/scripts/install.sh | bash

# Windows
scoop install tilt
```

### Setup

Create `Tiltfile` in project root:

```python
# Tiltfile for Kianax

# Configuration
allow_k8s_contexts('kind-kianax')  # Safety: only run on local cluster

# Backend service
docker_build(
  'kianax-api-gateway',
  context='./apps/server',
  dockerfile='./apps/server/Dockerfile',
  live_update=[
    # Sync source code changes without rebuilding
    sync('./apps/server/src', '/app/src'),
    # Run commands after sync
    run('cd /app && bun install', trigger='./apps/server/package.json'),
  ]
)

# Deploy backend with Helm
k8s_yaml(helm(
  './k8s/charts/api-gateway',
  name='api-gateway',
  namespace='kianax',
  values=['./k8s/charts/api-gateway/values-local.yaml']
))

# Port forward
k8s_resource(
  'api-gateway',
  port_forwards='3001:3001',
  labels=['backend']
)

# Database (deploy from YAML)
k8s_yaml([
  './k8s/local/postgres.yaml',
  './k8s/local/redis.yaml'
])

k8s_resource('postgres', port_forwards='5432:5432', labels=['database'])
k8s_resource('redis', port_forwards='6379:6379', labels=['database'])

# Frontend service (optional)
docker_build(
  'kianax-web',
  context='./apps/web',
  dockerfile='./apps/web/Dockerfile.dev',
  live_update=[
    sync('./apps/web/src', '/app/src'),
    sync('./apps/web/app', '/app/app'),
    run('cd /app && bun install', trigger='./apps/web/package.json'),
  ]
)

k8s_yaml(helm(
  './k8s/charts/web',
  name='web',
  namespace='kianax',
  values=['./k8s/charts/web/values-local.yaml']
))

k8s_resource('web', port_forwards='3000:3000', labels=['frontend'])
```

### Usage

```bash
# Start Tilt
tilt up

# Tilt opens a web UI at http://localhost:10350

# Make code changes → Tilt auto-rebuilds and deploys

# View logs in Tilt UI or terminal
tilt logs api-gateway

# Stop Tilt (keeps resources running)
tilt down

# Stop and clean up all resources
tilt down --delete-namespaces
```

### Tilt UI

The Tilt UI shows:
- Build status
- Pod status
- Logs (streaming)
- Resource graph
- Errors and warnings

Very helpful for debugging!

## Testing Microservices Locally

### Option 1: Run Some Services Locally, Some in K8s

Example: Backend in K8s, frontend locally (for fast iteration).

```bash
# Deploy backend to local K8s
tilt up api-gateway

# Run frontend locally
cd apps/web
bun run dev

# Frontend connects to backend via port-forward
# NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Option 2: All Services in K8s

```bash
# Deploy everything with Tilt
tilt up

# Access services via port forwards or Ingress
```

### Option 3: Hybrid (Docker Compose for deps, code runs locally)

```bash
# Start databases only
docker-compose up postgres redis

# Run backend locally
cd apps/server
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kianax
export REDIS_URL=redis://localhost:6379
bun run dev

# Run frontend locally
cd apps/web
export NEXT_PUBLIC_API_URL=http://localhost:3001
bun run dev
```

**Recommended**: Option 3 for fastest iteration, Option 2 for testing K8s features.

## Debugging Workflows

### Debug Backend Code

**With Docker Compose:**
```bash
# Add debugger statement in code
// src/routes/health.ts
fastify.get('/health', async (request, reply) => {
  debugger;  // Execution pauses here
  return { status: 'ok' };
});

# Start with Node inspector
docker-compose run --service-ports backend node --inspect=0.0.0.0:9229 src/index.ts

# Connect from VS Code or Chrome DevTools (chrome://inspect)
```

**With Kubernetes:**
```bash
# Port forward debug port
kubectl port-forward api-gateway-xyz -n kianax 9229:9229

# Connect debugger to localhost:9229
```

### Debug Container Issues

```bash
# Start a debug container with all tools
kubectl run -it --rm debug --image=nicolaka/netshoot -- /bin/bash

# Test connectivity
curl http://api-gateway.kianax.svc.cluster.local:3001/health

# Test DNS
nslookup postgres.kianax.svc.cluster.local

# Test database connection
psql postgresql://postgres:postgres@postgres.kianax.svc.cluster.local:5432/kianax
```

### Debug with VS Code

**launch.json** for backend:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Attach to Docker",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "address": "localhost",
      "localRoot": "${workspaceFolder}/apps/server",
      "remoteRoot": "/app",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Run Backend Locally",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "bun",
      "runtimeArgs": ["run", "dev"],
      "cwd": "${workspaceFolder}/apps/server",
      "env": {
        "DATABASE_URL": "postgresql://postgres:postgres@localhost:5432/kianax",
        "REDIS_URL": "redis://localhost:6379",
        "JWT_SECRET": "local-dev-secret"
      }
    }
  ]
}
```

## CI/CD Testing

### Test Helm Charts

```bash
# Lint chart
helm lint k8s/charts/api-gateway

# Dry run (see rendered templates)
helm template api-gateway k8s/charts/api-gateway \
  -f k8s/charts/api-gateway/values-local.yaml

# Install with dry run
helm install api-gateway k8s/charts/api-gateway \
  -n kianax \
  -f k8s/charts/api-gateway/values-local.yaml \
  --dry-run
```

### Test GitHub Actions Locally

Use `act` to run GitHub Actions on your machine:

```bash
# Install act
brew install act

# Run workflow
act -j build-and-deploy

# Run with secrets
act -j build-and-deploy --secret-file .secrets
```

### Integration Tests in Kind

Create a CI script:

```bash
#!/bin/bash
# scripts/test-ci.sh

set -e

# Create Kind cluster
kind create cluster --name ci-test

# Load images
kind load docker-image kianax-api-gateway:test --name ci-test

# Deploy
kubectl apply -f k8s/local/
helm install api-gateway k8s/charts/api-gateway -n kianax --create-namespace

# Wait for pods
kubectl wait --for=condition=ready pod -l app=api-gateway -n kianax --timeout=120s

# Run tests
kubectl run test --image=curlimages/curl --rm -it --restart=Never -- \
  curl http://api-gateway.kianax.svc.cluster.local:3001/health

# Cleanup
kind delete cluster --name ci-test
```

## Resource Requirements

### Minimum System Requirements

**Docker Compose:**
- 4GB RAM
- 2 CPU cores
- 10GB disk

**Minikube:**
- 8GB RAM (allocate 4-6GB to Minikube)
- 4 CPU cores (allocate 2-4 to Minikube)
- 20GB disk

**Kind:**
- 8GB RAM
- 4 CPU cores
- 20GB disk

**Tilt + Kind:**
- 12GB RAM
- 4+ CPU cores
- 30GB disk

### Performance Tips

1. **Use Kind instead of Minikube** (faster, lower overhead)
2. **Limit replica count** (1 replica for local testing)
3. **Reduce resource requests** (smaller than production)
4. **Use Tilt's live_update** (avoid full rebuilds)
5. **Use local registry** (avoid repeated image builds)

## Summary

**For beginners or quick testing:**
→ Use **Docker Compose** (simplest, fastest)

**For testing Kubernetes features:**
→ Use **Minikube** (easy) or **Kind** (faster)

**For serious K8s development:**
→ Use **Kind + Tilt** (best experience)

**For CI/CD:**
→ Use **Kind** (fast, reproducible)

---

For production deployment, see [DEPLOYMENT.md](./DEPLOYMENT.md).
For Kubernetes fundamentals, see [KUBERNETES.md](./KUBERNETES.md).
For microservices architecture, see [MICROSERVICES.md](./MICROSERVICES.md).
