# Kubernetes Strategy for Kianax

High-level Kubernetes architecture and operational strategy for the Kianax platform.

## Why Kubernetes?

**Decision Rationale:**
- **Microservices Architecture**: 7+ services requiring independent scaling
- **Cloud-Native**: Industry-standard for container orchestration
- **Auto-Scaling**: Horizontal pod and cluster autoscaling
- **Learning Opportunity**: Team wants hands-on K8s experience
- **Flexibility**: Easy migration between cloud providers if needed

**Trade-offs:**
- More complex than simple container deployment (ECS)
- Requires team K8s knowledge
- Higher initial setup time
- Worth it for our microservices architecture

## Cluster Architecture

### EKS Cluster (Kubernetes 1.31)

```
Cluster: kianax-production
├── Node Groups
│   ├── general-ng (t3.medium, 2-5 nodes, autoscaling)
│   ├── system-ng (t3.small, 2 nodes, system addons)
│   └── jobs-ng (spot instances, 0-10 nodes, batch jobs)
│
├── Namespaces
│   ├── kianax (application services)
│   ├── monitoring (Prometheus, Grafana)
│   ├── argocd (GitOps)
│   └── logging (FluentBit)
│
└── Core Addons
    ├── vpc-cni (networking)
    ├── aws-load-balancer-controller (Ingress)
    ├── external-secrets-operator (secrets sync)
    ├── metrics-server (HPA)
    ├── cluster-autoscaler (node scaling)
    └── kube-prometheus-stack (monitoring)
```

### Resource Organization

**Namespaces:**
- `kianax`: Application services (API, trading, agents)
- `monitoring`: Prometheus, Grafana, AlertManager
- `argocd`: GitOps deployment automation
- `logging`: FluentBit log collectors

**Why Namespaces:**
- Logical separation of concerns
- Resource quotas per namespace
- RBAC isolation
- Network policy boundaries

## Deployment Strategy

### GitOps with ArgoCD

**Philosophy:** Git is the single source of truth

**Flow:**
1. Helm charts define desired state in Git
2. ArgoCD watches Git repository
3. Auto-syncs changes to cluster
4. Self-healing if manual changes detected

**Benefits:**
- Declarative deployments
- Audit trail in Git history
- Easy rollbacks (revert Git commit)
- No direct kubectl access needed in prod

### Application Deployment

**Helm Charts:** One chart per microservice
- `charts/api-gateway/`
- `charts/trading-service/`
- `charts/agent-service/`
- `charts/market-data-service/`
- etc.

**Structure:**
```
charts/api-gateway/
├── Chart.yaml
├── values.yaml (defaults)
├── values-dev.yaml (overrides)
├── values-prod.yaml (overrides)
└── templates/
    ├── deployment.yaml
    ├── service.yaml
    ├── ingress.yaml
    ├── hpa.yaml
    └── externalsecret.yaml
```

## Scaling Strategy

### Horizontal Pod Autoscaler (HPA)

**Auto-scales pods based on:**
- CPU utilization (target: 70%)
- Memory utilization (target: 80%)
- Custom metrics (requests/sec)

**Example:**
- Min replicas: 2
- Max replicas: 10
- Scale up when CPU > 70% for 2 minutes
- Scale down when CPU < 50% for 5 minutes

### Cluster Autoscaler

**Auto-scales nodes based on:**
- Pods in pending state (need more resources)
- Node utilization < 50% for 10 minutes (scale down)

**Configuration:**
- Scale up: Immediate when pods pending
- Scale down: Wait 10 minutes of low utilization
- Min nodes: 2 (for high availability)
- Max nodes: 10 (cost control)

## Networking

### Service Types

**ClusterIP** (Internal only)
- Default for inter-service communication
- `api-gateway.kianax.svc.cluster.local`

**LoadBalancer** (External via ALB)
- Managed by AWS Load Balancer Controller
- Creates AWS ALB automatically
- SSL termination with ACM certificates

### Ingress

**Purpose:** HTTP/HTTPS routing to services

**Features:**
- Single ALB for all services (cost optimization)
- Path-based routing (`/api/orders` → trading-service)
- Host-based routing (api.kianax.io → API gateway)
- SSL/TLS termination
- WAF integration
- WebSocket support

## Security

### Network Policies

**Approach:** Default deny, explicit allow

**Example Rules:**
- API Gateway can talk to all services
- Trading Service can only talk to Database
- Agent Service can only talk to External APIs
- No service can directly access internet (except via NAT)

### RBAC (Role-Based Access Control)

**Principle:** Least privilege access

**Roles:**
- `developer`: Read-only access to logs and pods
- `operator`: Deployment and scaling permissions
- `admin`: Full cluster access (limited to 2-3 people)

### IRSA (IAM Roles for Service Accounts)

**Purpose:** AWS access without credentials

**How it Works:**
- Service Account annotated with IAM role ARN
- Pods automatically get AWS permissions
- No API keys or secrets in pods
- Audit trail via CloudTrail

**Example:**
- Trading Service → IAM role → Can access Secrets Manager
- No AWS_ACCESS_KEY_ID in environment

## Monitoring & Observability

### Prometheus + Grafana

**Metrics Collection:**
- Pod CPU/memory usage
- Application metrics (requests, errors, latency)
- Business metrics (trades, users, revenue)
- Database query performance

**Alerting:**
- High error rate (> 5%)
- Pod crash loop
- High memory usage (> 90%)
- Deployment failures

### Logging with FluentBit

**Flow:**
1. Pods write logs to stdout/stderr
2. FluentBit DaemonSet collects all logs
3. Logs shipped to CloudWatch Logs
4. Searchable and analyzable

**Best Practice:** Structured JSON logging

### Distributed Tracing

**Tools:** OpenTelemetry + X-Ray

**Purpose:** Track requests across services
- API Gateway → Trading Service → Database
- Identify bottlenecks
- Debug latency issues

## Kubernetes Concepts

### Pods
- Smallest deployable unit
- One or more containers
- Share network and storage
- Ephemeral (can be killed anytime)

### Deployments
- Manages ReplicaSets
- Declarative updates
- Rolling updates
- Rollback capability

### Services
- Stable network endpoint for pods
- Load balancing across pod replicas
- Service discovery via DNS

### ConfigMaps & Secrets
- **ConfigMap**: Non-sensitive config (env vars, files)
- **Secret**: Sensitive data (passwords, API keys)
- **External Secrets**: Sync from AWS Secrets Manager

### Health Checks
- **Liveness Probe**: Is app running? (restart if fails)
- **Readiness Probe**: Is app ready for traffic? (remove from service if fails)
- **Startup Probe**: For slow-starting apps

## Development Workflow

### Local Testing

**Option 1: Minikube** (Local K8s cluster)
- Pros: Full K8s experience locally
- Cons: Resource heavy, slower iteration

**Option 2: Kind** (Kubernetes in Docker)
- Pros: Fast, lightweight
- Cons: Networking quirks

**Option 3: Tilt** (Rapid development)
- Pros: Hot reload, automatic rebuilds
- Cons: Learning curve

**Recommendation:** Use Docker Compose for fast iteration, Kind + Tilt for K8s-specific testing

### CI/CD Flow

1. **Developer** pushes code to `develop` branch
2. **GitHub Actions** runs tests and builds Docker image
3. **GitHub Actions** pushes image to ECR
4. **GitHub Actions** updates Helm values with new image tag
5. **ArgoCD** detects change and deploys to dev cluster
6. **Monitoring** verifies deployment health

### Production Deployment

1. **Merge** `develop` → `main` via Pull Request
2. **GitHub Actions** builds and tags production image
3. **ArgoCD** auto-deploys to production cluster
4. **Feature Flags** enable gradual rollout (0% → 50% → 100%)
5. **Monitor** error rates and performance
6. **Rollback** if issues detected

## Operational Best Practices

### Resource Requests/Limits

**Always Define:**
```yaml
resources:
  requests:
    memory: "256Mi"  # Minimum guaranteed
    cpu: "250m"      # 0.25 CPU cores
  limits:
    memory: "512Mi"  # Maximum allowed
    cpu: "500m"      # 0.5 CPU cores
```

**Why:**
- Enables proper scheduling
- Prevents resource starvation
- Required for HPA

### Pod Disruption Budgets

**Purpose:** Ensure availability during updates

```yaml
minAvailable: 1  # At least 1 pod must be running
```

**Protects Against:**
- Node upgrades
- Cluster autoscaler scale-down
- kubectl drain operations

### Multi-AZ Deployment

**Strategy:** Spread pods across availability zones

**Benefits:**
- High availability if AZ fails
- Lower latency (serve from closest AZ)

**Implementation:** Topology spread constraints

## Cost Optimization

### Node Right-Sizing
- Monitor actual usage via metrics
- Adjust node instance types
- Use Spot instances for non-critical workloads

### Pod Right-Sizing
- Set appropriate resource requests/limits
- Avoid over-provisioning
- Use VPA (Vertical Pod Autoscaler) for recommendations

### Cluster Efficiency
- Consolidate services (fewer nodes)
- Use cluster autoscaler to scale down
- Reserved instances for predictable workloads

## Disaster Recovery

### Backup Strategy
- **Config**: All in Git (GitOps)
- **Secrets**: Backed up in AWS Secrets Manager
- **Data**: Database snapshots (RDS automated)

### Recovery Process
1. Provision new cluster with Terraform
2. Deploy ArgoCD
3. ArgoCD syncs all applications from Git
4. Restore database from snapshot
5. Verify functionality

**Recovery Time:** ~2 hours

## Common Operations

### Checking Pod Status
```bash
kubectl get pods -n kianax
```

### Viewing Logs
```bash
kubectl logs <pod-name> -n kianax -f
```

### Scaling Deployment
```bash
kubectl scale deployment api-gateway -n kianax --replicas=5
```

### Rolling Restart
```bash
kubectl rollout restart deployment/api-gateway -n kianax
```

### Rollback Deployment
```bash
kubectl rollout undo deployment/api-gateway -n kianax
```

### Check Resource Usage
```bash
kubectl top pods -n kianax
kubectl top nodes
```

## Learning Resources

### Essential Reading
- [Kubernetes Basics](https://kubernetes.io/docs/tutorials/kubernetes-basics/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [AWS EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)

### Recommended Tools
- **kubectl**: Command-line tool
- **k9s**: Terminal UI for Kubernetes
- **Lens**: Desktop Kubernetes IDE
- **Helm**: Package manager
- **Stern**: Multi-pod log tailing

### Hands-On Learning
- Set up Minikube locally
- Deploy a simple application
- Practice kubectl commands
- Understand pod lifecycle

---

**For detailed commands and examples, see:**
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [Local Development Guide](./LOCAL_DEVELOPMENT.md)
- [Deployment Guide](./DEPLOYMENT.md)
