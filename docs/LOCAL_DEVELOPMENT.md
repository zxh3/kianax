# Local Development Guide for Kianax

High-level guide for local development and testing options for the Kianax platform.

## Overview

Two main approaches for local development:

1. **Docker Compose** - Simple, fast iteration (recommended for most development)
2. **Local Kubernetes** - Test K8s features, closer to production

## Quick Start (Docker Compose)

### Why Docker Compose?

**Best for:**
- Rapid local development without Kubernetes complexity
- Fast startup and iteration cycles
- Database and cache testing
- Backend API development
- Frontend integration testing

**Pros:**
- Simple setup (no Kubernetes knowledge required)
- Fast startup (< 1 minute)
- Low resource usage (4GB RAM, 2 CPU cores)
- Works on any machine with Docker
- Hot reload for code changes

**Cons:**
- Different from production (no K8s features)
- Cannot test Helm charts, Ingress, autoscaling
- Not suitable for testing microservices at scale

### Current Setup

Docker Compose configuration (`docker-compose.yml`) includes:
- **PostgreSQL 16** - Primary database
- **Redis 7** - Cache and sessions
- **Backend** (optional) - Fastify server with hot reload
- **Web** (optional) - Next.js frontend

### Basic Usage

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f [service-name]

# Stop services
docker-compose down

# Fresh start (remove volumes)
docker-compose down -v

# Rebuild after changes
docker-compose up --build

# Run migrations
docker-compose exec backend bun run db:migrate

# Run tests
docker-compose exec backend bun test
```

### Development Workflow

**Typical flow:**
1. Start databases: `docker-compose up postgres redis`
2. Run backend locally: `cd apps/server && bun run dev`
3. Run frontend locally: `cd apps/web && bun run dev`
4. Make code changes → Hot reload happens automatically

**Benefits of hybrid approach:**
- Databases in Docker (consistent environment)
- Code runs locally (faster, easier debugging)
- Best of both worlds

## Local Kubernetes Options

For testing Kubernetes features locally, choose from:

| Feature | Minikube | Kind | Docker Desktop K8s |
|---------|----------|------|-------------------|
| **Ease of Setup** | Easy | Medium | Easiest |
| **Performance** | Good | Best | Good |
| **LoadBalancer** | Via tunnel | Via MetalLB | Native |
| **Multiple Clusters** | Yes | Yes | No |
| **Resource Usage** | Medium | Low | Medium |
| **Best For** | General testing | CI/CD | Mac users |

### Recommendations

**By Platform:**
- **Mac**: Docker Desktop K8s or Minikube
- **Linux**: Kind or Minikube
- **Windows**: Docker Desktop K8s or Minikube
- **CI/CD**: Kind (fastest, reproducible)

**By Use Case:**
- **Testing Helm charts**: Any option
- **Testing Ingress**: Kind or Minikube
- **Testing autoscaling**: Minikube with metrics-server
- **Multi-cluster**: Kind or Minikube

## Minikube Setup

### Overview

Minikube runs a single-node Kubernetes cluster in a VM or container.

**Installation:**
- Mac: `brew install minikube`
- Linux: Download from minikube.sigs.k8s.io
- Windows: `choco install minikube`

**Start cluster:**
```bash
minikube start --driver=docker --cpus=4 --memory=8192
```

**Enable addons:**
```bash
minikube addons enable ingress
minikube addons enable metrics-server
minikube addons enable dashboard
```

### Deployment Workflow

1. **Build images** and load into Minikube
   - Set Docker environment: `eval $(minikube docker-env)`
   - Build images (available in Minikube automatically)

2. **Create namespace**
   - `kubectl create namespace kianax`

3. **Deploy databases**
   - Deploy PostgreSQL and Redis with persistent volumes
   - Create Services for internal communication

4. **Deploy application** using Helm
   - Use `values-local.yaml` with `imagePullPolicy: Never`
   - Resource requests/limits lower than production

5. **Expose services**
   - Via Ingress with `/etc/hosts` entry
   - Or port forwarding: `kubectl port-forward svc/api-gateway -n kianax 3001:3001`

### Key Commands

```bash
# View dashboard
minikube dashboard

# Get cluster IP
minikube ip

# Tunnel for LoadBalancer services
minikube tunnel

# Stop/delete cluster
minikube stop
minikube delete
```

## Kind Setup

### Overview

Kind (Kubernetes IN Docker) runs K8s clusters as Docker containers. Very fast and lightweight.

**Installation:**
- Mac: `brew install kind`
- Linux: Download from kind.sigs.k8s.io
- Windows: `choco install kind`

**Why Kind?**
- Fastest local K8s option
- Perfect for CI/CD testing
- Lower resource usage than Minikube
- Multiple clusters easily

### Deployment Workflow

1. **Create cluster** with multi-node configuration
   - Control plane + worker nodes
   - Port mappings for Ingress (80, 443)

2. **Install Ingress NGINX** controller

3. **Load images** into Kind
   - Build image: `docker build -t kianax-api-gateway:dev .`
   - Load: `kind load docker-image kianax-api-gateway:dev --name kianax`

4. **Deploy** same as Minikube
   - Create namespace, deploy databases, deploy app

### Key Commands

```bash
# Create cluster
kind create cluster --name kianax

# Load image
kind load docker-image <image-name> --name kianax

# List clusters
kind get clusters

# Delete cluster
kind delete cluster --name kianax

# Export logs for debugging
kind export logs --name kianax
```

## Tilt for Fast Development

### Overview

Tilt automates the local Kubernetes dev loop: build → push → deploy → logs.

**Why Tilt?**

**Without Tilt:**
1. Make code change
2. `docker build ...`
3. `kind load docker-image ...`
4. `kubectl delete pod ...` (force restart)
5. `kubectl logs -f ...`

**With Tilt:**
1. Make code change
2. Tilt automatically does steps 2-5 (in seconds)

### Installation

- Mac: `brew install tilt-dev/tap/tilt`
- Linux: Download from tilt.dev
- Windows: `scoop install tilt`

### Configuration

Create `Tiltfile` in project root with:
- Docker image builds with live updates
- Helm deployments
- Port forwards
- Resource grouping (backend, frontend, database)

**Key features:**
- **Live updates**: Sync code changes without rebuilding image
- **Web UI**: Dashboard showing all services, logs, errors
- **Resource graph**: Visual dependency tree
- **Hot reload**: Changes reflected in seconds

### Usage

```bash
# Start Tilt
tilt up

# Opens web UI at http://localhost:10350

# Make code changes → Auto-deploys

# View logs in UI or terminal
tilt logs api-gateway

# Stop (keeps resources running)
tilt down

# Stop and clean up
tilt down --delete-namespaces
```

### Tilt UI Features

- Build status and timing
- Pod status and health
- Streaming logs with filtering
- Resource dependency graph
- Errors and warnings highlighted
- One-click log downloads

## Testing Strategies

### Option 1: Hybrid (Recommended for Development)

**Databases in Docker, Code Runs Locally:**

```bash
# Start databases only
docker-compose up postgres redis

# Run backend locally
cd apps/server && bun run dev

# Run frontend locally
cd apps/web && bun run dev
```

**Benefits:**
- Fastest iteration
- Easy debugging (native debugger support)
- Full IDE features
- Consistent database environment

### Option 2: Some Services in K8s, Some Local

**Backend in K8s, Frontend Local:**

```bash
# Deploy backend to Kind/Minikube with Tilt
tilt up api-gateway

# Run frontend locally
cd apps/web && bun run dev
```

**Benefits:**
- Test K8s backend behavior
- Fast frontend iteration
- Realistic backend environment

### Option 3: All Services in K8s

**Everything via Tilt:**

```bash
tilt up
```

**Benefits:**
- Production-like environment
- Test service mesh, Ingress, etc.
- End-to-end Kubernetes testing

### Recommendation by Phase

- **Phase 1 (Auth, Database)**: Option 1 (Hybrid)
- **Phase 2 (API Development)**: Option 1 or 2
- **Phase 3 (Microservices)**: Option 2 or 3
- **Pre-Production Testing**: Option 3 (Full K8s)

## Debugging

### Backend Debugging

**Local (Non-Docker):**
- Use IDE debugger directly
- VS Code launch configurations
- Breakpoints work natively

**Docker Compose:**
- Expose debug port (9229)
- Connect from VS Code or Chrome DevTools
- Port forward: `docker-compose run --service-ports backend`

**Kubernetes:**
- Port forward debug port: `kubectl port-forward pod/api-gateway-xyz -n kianax 9229:9229`
- Connect debugger to localhost:9229

### Container Issues

**Test connectivity:**
- Run debug pod: `kubectl run -it --rm debug --image=nicolaka/netshoot -- /bin/bash`
- Test service: `curl http://api-gateway.kianax.svc.cluster.local:3001/health`
- Test DNS: `nslookup postgres.kianax.svc.cluster.local`

**View logs:**
- Docker Compose: `docker-compose logs -f [service]`
- Kubernetes: `kubectl logs -f deployment/api-gateway -n kianax`
- Tilt: Built-in log viewer in UI

### Common Issues

**Image not found in Kind/Minikube:**
- Use `imagePullPolicy: Never` in values.yaml
- Verify image loaded: `docker exec -it kind-control-plane crictl images`

**Port already in use:**
- Check what's using port: `lsof -i :3000`
- Stop conflicting service or use different port

**Database connection failed:**
- Verify service is running: `kubectl get svc -n kianax`
- Check connection string format
- Test connectivity from debug pod

## CI/CD Testing

### Test Helm Charts

```bash
# Lint charts
helm lint k8s/charts/api-gateway

# Render templates (dry run)
helm template api-gateway k8s/charts/api-gateway \
  -f k8s/charts/api-gateway/values-local.yaml

# Verify output
helm install api-gateway k8s/charts/api-gateway \
  -n kianax --dry-run
```

### Test GitHub Actions Locally

Use `act` to run workflows on your machine:
- Install: `brew install act`
- Run: `act -j build-and-deploy`
- Test before pushing to GitHub

### Integration Tests in Kind

**Typical CI script:**
1. Create Kind cluster
2. Load Docker images
3. Deploy application
4. Wait for pods to be ready
5. Run test suite
6. Cleanup cluster

**Benefits:**
- Fast (Kind starts in seconds)
- Reproducible
- Same tests in CI and locally

## Resource Requirements

### Minimum System Specs

**Docker Compose:**
- 4GB RAM, 2 CPU cores, 10GB disk
- Lightest option

**Minikube:**
- 8GB RAM (allocate 4-6GB), 4 CPU cores (allocate 2-4), 20GB disk

**Kind:**
- 8GB RAM, 4 CPU cores, 20GB disk
- More efficient than Minikube

**Tilt + Kind:**
- 12GB RAM, 4+ CPU cores, 30GB disk
- Best experience but highest resource usage

### Performance Tips

1. **Use Kind** instead of Minikube (faster, lower overhead)
2. **Limit replica count** to 1 for local testing
3. **Reduce resource requests** in values-local.yaml
4. **Use Tilt's live_update** to avoid full rebuilds
5. **Enable Docker BuildKit** for faster builds

## Decision Matrix

### Choose Docker Compose if:
- ✅ You're new to the project
- ✅ You're developing backend APIs
- ✅ You need fast iteration cycles
- ✅ You don't need Kubernetes features
- ✅ Limited system resources

### Choose Minikube if:
- ✅ You want full Kubernetes experience
- ✅ You need LoadBalancer/Ingress testing
- ✅ You're learning Kubernetes
- ✅ You have 8GB+ RAM

### Choose Kind if:
- ✅ You're testing Helm charts
- ✅ You need multi-cluster setups
- ✅ You're running CI/CD tests
- ✅ You want fast cluster creation

### Choose Tilt if:
- ✅ You're doing serious K8s development
- ✅ You have multiple microservices
- ✅ You want automated workflows
- ✅ You value developer experience

## Summary

**For beginners or quick testing:**
→ **Docker Compose** (simplest, fastest)

**For testing Kubernetes features:**
→ **Minikube** (easy) or **Kind** (faster)

**For serious K8s development:**
→ **Kind + Tilt** (best experience)

**For CI/CD:**
→ **Kind** (fast, reproducible)

---

**For production deployment:**
- [DEPLOYMENT.md](./DEPLOYMENT.md) - AWS EKS deployment guide
- [KUBERNETES.md](./KUBERNETES.md) - Kubernetes operations and strategy
