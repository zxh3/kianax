# Kubernetes Learning Guide for Kianax

This guide helps you understand and operate Kubernetes for the Kianax platform. It's designed as both a learning resource and an operations reference.

## Table of Contents

- [Kubernetes Fundamentals](#kubernetes-fundamentals)
- [Essential kubectl Commands](#essential-kubectl-commands)
- [Working with Deployments](#working-with-deployments)
- [Services and Networking](#services-and-networking)
- [ConfigMaps and Secrets](#configmaps-and-secrets)
- [Persistent Storage](#persistent-storage)
- [Autoscaling](#autoscaling)
- [Debugging and Troubleshooting](#debugging-and-troubleshooting)
- [Helm Basics](#helm-basics)
- [GitOps with ArgoCD](#gitops-with-argocd)
- [Security Best Practices](#security-best-practices)
- [Learning Resources](#learning-resources)

## Kubernetes Fundamentals

### What is Kubernetes?

Kubernetes (K8s) is a container orchestration platform that automates deployment, scaling, and management of containerized applications.

**Key Concepts:**
- **Cluster**: A set of nodes (machines) running containerized applications
- **Node**: A worker machine (EC2 instance in our case)
- **Pod**: Smallest deployable unit, contains one or more containers
- **Deployment**: Manages a replicated set of pods
- **Service**: Exposes pods to network traffic
- **Ingress**: HTTP/HTTPS routing to services
- **Namespace**: Virtual cluster for resource isolation

### Kianax Cluster Architecture

```
EKS Cluster: kianax-staging
│
├── Namespaces
│   ├── kianax (application services)
│   ├── monitoring (Prometheus, Grafana)
│   ├── argocd (GitOps)
│   ├── logging (FluentBit)
│   └── external-secrets-system
│
├── Node Groups
│   ├── general-ng (t3.medium, 2-5 nodes)
│   ├── system-ng (t3.small, 2 nodes, tainted)
│   └── jobs-ng (t3.medium spot, 0-10 nodes, optional)
│
└── Addons
    ├── vpc-cni (networking)
    ├── coredns (DNS)
    ├── kube-proxy (network proxy)
    └── aws-ebs-csi-driver (storage)
```

### Resource Hierarchy

```
Cluster
  └── Namespace (e.g., kianax)
      └── Deployment (e.g., api-gateway)
          └── ReplicaSet (managed automatically)
              └── Pods (e.g., api-gateway-xyz, api-gateway-abc)
                  └── Containers (e.g., api-gateway container)
```

## Essential kubectl Commands

### Setup and Configuration

```bash
# View current context (which cluster you're connected to)
kubectl config current-context

# List all contexts
kubectl config get-contexts

# Switch context
kubectl config use-context arn:aws:eks:us-east-1:ACCOUNT:cluster/kianax-staging

# Set default namespace (avoid typing -n every time)
kubectl config set-context --current --namespace=kianax

# View cluster info
kubectl cluster-info
```

### Viewing Resources

```bash
# List all resources in a namespace
kubectl get all -n kianax

# List specific resource types
kubectl get pods -n kianax
kubectl get deployments -n kianax
kubectl get services -n kianax
kubectl get ingress -n kianax

# List resources across all namespaces
kubectl get pods --all-namespaces
# Or short form:
kubectl get pods -A

# Watch resources in real-time (updates automatically)
kubectl get pods -n kianax --watch
# Or short form:
kubectl get pods -n kianax -w

# Get detailed information about a resource
kubectl describe pod api-gateway-xyz -n kianax
kubectl describe deployment api-gateway -n kianax

# Get resource in YAML format
kubectl get pod api-gateway-xyz -n kianax -o yaml

# Get resource in JSON format
kubectl get pod api-gateway-xyz -n kianax -o json

# Use custom columns for specific information
kubectl get pods -n kianax -o custom-columns=NAME:.metadata.name,STATUS:.status.phase,NODE:.spec.nodeName

# Get resource with labels
kubectl get pods -n kianax --show-labels
```

### Working with Pods

```bash
# View pod logs
kubectl logs api-gateway-xyz -n kianax

# Follow logs (like tail -f)
kubectl logs -f api-gateway-xyz -n kianax

# View logs from previous container (if pod crashed and restarted)
kubectl logs api-gateway-xyz -n kianax --previous

# View logs from multiple pods with label selector
kubectl logs -l app=api-gateway -n kianax --tail=50

# Execute command in a pod
kubectl exec api-gateway-xyz -n kianax -- ls /app
kubectl exec api-gateway-xyz -n kianax -- env

# Start interactive shell in a pod
kubectl exec -it api-gateway-xyz -n kianax -- sh
# Or bash if available:
kubectl exec -it api-gateway-xyz -n kianax -- bash

# Copy files to/from a pod
kubectl cp api-gateway-xyz:/app/logs/error.log ./error.log -n kianax
kubectl cp ./config.json api-gateway-xyz:/app/config.json -n kianax

# Port forward to a pod
kubectl port-forward api-gateway-xyz -n kianax 3001:3001
# Now access http://localhost:3001

# Port forward to a service
kubectl port-forward svc/api-gateway -n kianax 3001:3001

# View pod resource usage
kubectl top pod api-gateway-xyz -n kianax

# View all pod resource usage in namespace
kubectl top pods -n kianax
```

### Managing Deployments

```bash
# Scale deployment
kubectl scale deployment api-gateway -n kianax --replicas=5

# View deployment status
kubectl rollout status deployment/api-gateway -n kianax

# View deployment history
kubectl rollout history deployment/api-gateway -n kianax

# Rollback to previous version
kubectl rollout undo deployment/api-gateway -n kianax

# Rollback to specific revision
kubectl rollout undo deployment/api-gateway -n kianax --to-revision=2

# Restart deployment (rolling restart)
kubectl rollout restart deployment/api-gateway -n kianax

# Pause/resume deployment (for making multiple changes)
kubectl rollout pause deployment/api-gateway -n kianax
# Make changes...
kubectl rollout resume deployment/api-gateway -n kianax

# View deployment spec
kubectl get deployment api-gateway -n kianax -o yaml

# Edit deployment (opens in editor)
kubectl edit deployment api-gateway -n kianax
```

### Applying Configuration

```bash
# Apply a manifest file
kubectl apply -f deployment.yaml

# Apply all files in a directory
kubectl apply -f k8s/

# Apply with recursive directory search
kubectl apply -f k8s/ -R

# Delete resources defined in a file
kubectl delete -f deployment.yaml

# Delete specific resource
kubectl delete pod api-gateway-xyz -n kianax
kubectl delete deployment api-gateway -n kianax

# Delete all resources with a label
kubectl delete pods -l app=api-gateway -n kianax

# Force delete a stuck pod
kubectl delete pod api-gateway-xyz -n kianax --grace-period=0 --force
```

### Debugging

```bash
# View cluster events (very useful for troubleshooting)
kubectl get events -n kianax --sort-by='.lastTimestamp'

# Watch events in real-time
kubectl get events -n kianax --watch

# Check node status
kubectl get nodes
kubectl describe node ip-10-0-1-123.ec2.internal

# View node resource usage
kubectl top nodes

# Check if API server is responsive
kubectl get --raw /healthz

# Explain a resource (view API documentation)
kubectl explain pod
kubectl explain pod.spec
kubectl explain pod.spec.containers
```

## Working with Deployments

### Anatomy of a Deployment

Example `api-gateway` deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway              # Deployment name
  namespace: kianax               # Namespace
  labels:
    app: api-gateway
    version: v1.0.0
spec:
  replicas: 3                     # Number of pod replicas
  selector:
    matchLabels:
      app: api-gateway            # Pods with this label belong to this deployment
  template:                       # Pod template
    metadata:
      labels:
        app: api-gateway          # Must match selector
    spec:
      serviceAccountName: api-gateway-sa
      containers:
      - name: api-gateway
        image: 123456789.dkr.ecr.us-east-1.amazonaws.com/kianax-api-gateway:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3001
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3001"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: kianax-secrets
              key: DATABASE_URL
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: kianax-secrets
              key: REDIS_URL
        resources:
          requests:
            memory: "256Mi"       # Minimum guaranteed
            cpu: "250m"           # 0.25 CPU cores
          limits:
            memory: "512Mi"       # Maximum allowed
            cpu: "500m"           # 0.5 CPU cores
        livenessProbe:            # Kubernetes restarts pod if this fails
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:           # Kubernetes removes from service if this fails
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2
```

### Understanding Resource Requests and Limits

**Requests**: Minimum guaranteed resources
- Used for pod scheduling (node must have this available)
- Pod gets at least this amount

**Limits**: Maximum resources pod can use
- If exceeded, pod may be throttled (CPU) or killed (memory)

**CPU Units**:
- `1000m` = 1 CPU core
- `500m` = 0.5 CPU core
- `100m` = 0.1 CPU core

**Memory Units**:
- `Mi` = Mebibytes (1024-based)
- `Gi` = Gibibytes
- `256Mi` ≈ 268 MB

**Best Practices**:
```yaml
# Development/small service
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "256Mi"
    cpu: "200m"

# Production API service
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"

# High-memory service (AI agent execution)
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "2Gi"
    cpu: "1000m"
```

### Health Checks

**Liveness Probe**: Is the application running?
- If fails, Kubernetes restarts the container
- Use for detecting deadlocks or hung processes

**Readiness Probe**: Is the application ready to serve traffic?
- If fails, Kubernetes removes pod from service endpoints
- Use for startup delays or temporary unavailability

**Startup Probe**: Has the application finished starting?
- Only relevant for slow-starting applications
- After startup probe succeeds, liveness probe takes over

Example health check endpoint (Fastify):

```typescript
// apps/server/src/routes/health.ts
fastify.get('/health', async (request, reply) => {
  // Check database connection
  const dbHealthy = await checkDatabase();

  // Check Redis connection
  const redisHealthy = await checkRedis();

  if (dbHealthy && redisHealthy) {
    return { status: 'ok', timestamp: new Date().toISOString() };
  } else {
    reply.code(503);
    return { status: 'unhealthy', db: dbHealthy, redis: redisHealthy };
  }
});
```

## Services and Networking

### Service Types

**1. ClusterIP** (default) - Internal only
```yaml
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
  namespace: kianax
spec:
  type: ClusterIP
  selector:
    app: api-gateway
  ports:
  - port: 3001          # Service port
    targetPort: 3001    # Container port
    protocol: TCP
    name: http
```

**2. NodePort** - Exposes on each node's IP
```yaml
spec:
  type: NodePort
  ports:
  - port: 3001
    targetPort: 3001
    nodePort: 30001     # Accessible on <node-ip>:30001
```

**3. LoadBalancer** - Creates external load balancer (AWS NLB)
```yaml
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 3001
```

**For Kianax, we use ClusterIP + Ingress** (recommended pattern):
- Services are ClusterIP (internal only)
- Ingress exposes via ALB (single entry point)

### Ingress

Ingress provides HTTP/HTTPS routing to services.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-gateway
  namespace: kianax
  annotations:
    # AWS Load Balancer Controller annotations
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT
    alb.ingress.kubernetes.io/ssl-policy: ELBSecurityPolicy-TLS-1-2-Ext-2018-06

    # Health check
    alb.ingress.kubernetes.io/healthcheck-path: /health
    alb.ingress.kubernetes.io/healthcheck-interval-seconds: '15'
    alb.ingress.kubernetes.io/healthcheck-timeout-seconds: '5'
    alb.ingress.kubernetes.io/healthy-threshold-count: '2'
    alb.ingress.kubernetes.io/unhealthy-threshold-count: '2'

    # WebSocket support
    alb.ingress.kubernetes.io/load-balancer-attributes: routing.http2.enabled=true,idle_timeout.timeout_seconds=300

    # WAF
    alb.ingress.kubernetes.io/wafv2-acl-arn: arn:aws:wafv2:us-east-1:ACCOUNT:global/webacl/NAME/ID
spec:
  ingressClassName: alb
  rules:
  - host: api.kianax.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-gateway
            port:
              number: 3001
```

**View Ingress**:
```bash
kubectl get ingress -n kianax
kubectl describe ingress api-gateway -n kianax

# Get ALB URL
kubectl get ingress api-gateway -n kianax -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

## ConfigMaps and Secrets

### ConfigMaps

Store non-sensitive configuration data.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: api-gateway-config
  namespace: kianax
data:
  LOG_LEVEL: "info"
  CORS_ORIGIN: "https://kianax.io"
  RATE_LIMIT: "100"
  # Multi-line values
  config.json: |
    {
      "feature1": true,
      "feature2": false
    }
```

**Use in Pod**:

```yaml
# As environment variables
env:
- name: LOG_LEVEL
  valueFrom:
    configMapKeyRef:
      name: api-gateway-config
      key: LOG_LEVEL

# Or load all keys
envFrom:
- configMapRef:
    name: api-gateway-config

# As volume mount (for files)
volumeMounts:
- name: config
  mountPath: /app/config
volumes:
- name: config
  configMap:
    name: api-gateway-config
```

### Secrets

Store sensitive data (base64 encoded at rest, use External Secrets for production).

```bash
# Create secret from literal
kubectl create secret generic my-secret \
  -n kianax \
  --from-literal=password=secret123

# Create secret from file
kubectl create secret generic my-secret \
  -n kianax \
  --from-file=ssh-privatekey=~/.ssh/id_rsa

# View secret (data is base64 encoded)
kubectl get secret my-secret -n kianax -o yaml

# Decode secret value
kubectl get secret my-secret -n kianax -o jsonpath='{.data.password}' | base64 -d
```

**Use in Pod**:
```yaml
env:
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: kianax-secrets
      key: DATABASE_URL
```

### External Secrets (Production)

Sync from AWS Secrets Manager:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: kianax-secrets
  namespace: kianax
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: kianax-secrets        # K8s secret to create
    creationPolicy: Owner
  data:
  - secretKey: DATABASE_URL     # Key in K8s secret
    remoteRef:
      key: kianax/prod/database-url  # Key in AWS Secrets Manager
```

## Persistent Storage

### PersistentVolumeClaim (PVC)

Request storage for your pods.

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: api-gateway-data
  namespace: kianax
spec:
  accessModes:
  - ReadWriteOnce         # Can be mounted by one node
  storageClassName: gp3   # AWS EBS gp3 storage class
  resources:
    requests:
      storage: 10Gi
```

**Use in Deployment**:
```yaml
spec:
  template:
    spec:
      containers:
      - name: api-gateway
        volumeMounts:
        - name: data
          mountPath: /app/data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: api-gateway-data
```

**View PVCs**:
```bash
kubectl get pvc -n kianax
kubectl describe pvc api-gateway-data -n kianax
```

**Note**: For Kianax, we use RDS and ElastiCache (external), so PVCs are only needed for:
- Log storage (prefer FluentBit to CloudWatch)
- Temporary file uploads
- Prometheus metrics storage

## Autoscaling

### Horizontal Pod Autoscaler (HPA)

Automatically scale pods based on CPU/memory usage.

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway-hpa
  namespace: kianax
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70    # Scale up when CPU > 70%
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80    # Scale up when memory > 80%
  behavior:                       # Control scaling speed
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100                # Double pods at most
        periodSeconds: 60
      - type: Pods
        value: 4                  # Add max 4 pods at once
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50                 # Remove max 50% of pods
        periodSeconds: 60
```

**View HPA**:
```bash
kubectl get hpa -n kianax
kubectl describe hpa api-gateway-hpa -n kianax

# Watch autoscaling in action
kubectl get hpa -n kianax --watch
```

### Cluster Autoscaler

Automatically adds/removes nodes based on pod scheduling needs.

Managed by Cluster Autoscaler deployment (installed via Helm).

**How it works**:
1. Pod cannot be scheduled (insufficient resources)
2. Cluster Autoscaler adds a node
3. Pod gets scheduled on new node
4. When node is idle for 10 minutes, Cluster Autoscaler removes it

**View logs**:
```bash
kubectl logs -n kube-system -l app=cluster-autoscaler
```

## Debugging and Troubleshooting

### Common Scenarios

#### 1. Pod is Pending

```bash
# Check pod events
kubectl describe pod <pod-name> -n kianax

# Common causes:
# - Insufficient CPU/memory: "0/3 nodes are available: insufficient cpu"
# - Image pull error: "Failed to pull image"
# - Node taints: "node(s) had taints that the pod didn't tolerate"

# Solutions:
# - Scale up node group or reduce resource requests
# - Check ECR permissions: aws ecr get-login-password
# - Add tolerations to pod spec
```

#### 2. Pod is CrashLoopBackOff

```bash
# View logs
kubectl logs <pod-name> -n kianax

# View previous container logs (after crash)
kubectl logs <pod-name> -n kianax --previous

# Common causes:
# - Application error on startup
# - Missing environment variables
# - Cannot connect to database/Redis

# Debug interactively
kubectl run -it debug --image=alpine --restart=Never -- sh
# Test connectivity from debug pod
```

#### 3. Service Not Reachable

```bash
# Check service endpoints
kubectl get endpoints api-gateway -n kianax

# If empty, pods aren't matching service selector
kubectl get pods -n kianax --show-labels
kubectl get service api-gateway -n kianax -o yaml  # Check selector

# Test from another pod
kubectl run -it debug --image=alpine --restart=Never -- sh
apk add curl
curl http://api-gateway.kianax.svc.cluster.local:3001/health
```

#### 4. Ingress Not Working

```bash
# Check Ingress status
kubectl describe ingress api-gateway -n kianax

# Check ALB controller logs
kubectl logs -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller

# Verify target group
aws elbv2 describe-target-health --target-group-arn <tg-arn>

# Common issues:
# - Security group not allowing ALB → pods
# - Health check path incorrect
# - Certificate ARN invalid
```

#### 5. High Memory Usage (Pod OOMKilled)

```bash
# Check if pod was killed due to OOM
kubectl describe pod <pod-name> -n kianax
# Look for: "Reason: OOMKilled"

# View resource usage
kubectl top pod <pod-name> -n kianax

# Solutions:
# - Increase memory limits
# - Fix memory leak in application
# - Use vertical pod autoscaler (VPA)
```

### Useful Debugging Tools

**1. Debug Pod** (Swiss Army knife)
```bash
kubectl run debug -it --rm --restart=Never --image=nicolaka/netshoot -- /bin/bash
# Includes: curl, dig, nslookup, netstat, tcpdump, etc.
```

**2. Stern** (Multi-pod log tailing)
```bash
brew install stern

# Tail logs from all api-gateway pods
stern api-gateway -n kianax

# Tail logs from multiple services
stern "api-gateway|trading-service" -n kianax

# Tail with context
stern api-gateway -n kianax --context 5
```

**3. K9s** (Terminal UI)
```bash
brew install k9s
k9s -n kianax

# Keyboard shortcuts:
# :pods - View pods
# :deployments - View deployments
# l - View logs
# d - Describe
# Enter - Edit
# Ctrl-d - Delete
```

**4. kubectx/kubens** (Context and namespace switching)
```bash
brew install kubectx

# Switch context
kubectx arn:aws:eks:us-east-1:ACCOUNT:cluster/kianax-staging

# Switch namespace
kubens kianax

# Now all commands use kianax namespace by default
kubectl get pods  # No need for -n kianax
```

## Helm Basics

Helm is a package manager for Kubernetes (like npm for Node.js).

### Helm Chart Structure

```
charts/api-gateway/
├── Chart.yaml              # Chart metadata
├── values.yaml             # Default configuration
├── values-staging.yaml     # Staging overrides
├── values-prod.yaml        # Production overrides
└── templates/              # K8s manifest templates
    ├── deployment.yaml
    ├── service.yaml
    ├── ingress.yaml
    ├── hpa.yaml
    ├── serviceaccount.yaml
    └── _helpers.tpl        # Template helpers
```

### Common Helm Commands

```bash
# Install chart
helm install api-gateway ./charts/api-gateway -n kianax -f values-staging.yaml

# Upgrade chart (update existing)
helm upgrade api-gateway ./charts/api-gateway -n kianax -f values-staging.yaml

# Install or upgrade (idempotent)
helm upgrade --install api-gateway ./charts/api-gateway -n kianax -f values-staging.yaml

# Uninstall chart
helm uninstall api-gateway -n kianax

# List installed charts
helm list -n kianax

# View chart values
helm get values api-gateway -n kianax

# View rendered templates (without applying)
helm template api-gateway ./charts/api-gateway -f values-staging.yaml

# View release history
helm history api-gateway -n kianax

# Rollback to previous version
helm rollback api-gateway -n kianax

# Rollback to specific revision
helm rollback api-gateway 2 -n kianax
```

### Example Chart

**Chart.yaml**:
```yaml
apiVersion: v2
name: api-gateway
version: 1.0.0
description: Kianax API Gateway service
type: application
```

**values.yaml**:
```yaml
replicaCount: 2

image:
  repository: 123456789.dkr.ecr.us-east-1.amazonaws.com/kianax-api-gateway
  tag: latest
  pullPolicy: Always

service:
  type: ClusterIP
  port: 3001

resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
```

**templates/deployment.yaml** (uses Go templates):
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "api-gateway.fullname" . }}
  labels:
    {{- include "api-gateway.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "api-gateway.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "api-gateway.selectorLabels" . | nindent 8 }}
    spec:
      containers:
      - name: {{ .Chart.Name }}
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
        imagePullPolicy: {{ .Values.image.pullPolicy }}
        ports:
        - containerPort: {{ .Values.service.port }}
        resources:
          {{- toYaml .Values.resources | nindent 10 }}
```

## GitOps with ArgoCD

ArgoCD continuously monitors Git and syncs to Kubernetes.

### How It Works

```
1. Push code to Git (main branch)
2. GitHub Actions builds Docker image
3. GitHub Actions updates Helm values with new image tag
4. ArgoCD detects Git change
5. ArgoCD syncs to Kubernetes cluster
6. New pods deployed with new image
```

### ArgoCD Application

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: api-gateway
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/yourusername/kianax.git
    targetRevision: main
    path: k8s/charts/api-gateway
    helm:
      valueFiles:
      - values-prod.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: kianax
  syncPolicy:
    automated:
      prune: true           # Delete resources not in Git
      selfHeal: true        # Revert manual changes
      allowEmpty: false
    syncOptions:
    - CreateNamespace=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
```

### ArgoCD Commands

```bash
# Login
argocd login localhost:8080 --username admin --password <password>

# List applications
argocd app list

# Get application status
argocd app get api-gateway

# Sync application (deploy now)
argocd app sync api-gateway

# View application history
argocd app history api-gateway

# Rollback to previous version
argocd app rollback api-gateway

# Delete application
argocd app delete api-gateway
```

### ArgoCD UI

```bash
# Port forward to access UI
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Open https://localhost:8080
# Username: admin
# Password: kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

## Security Best Practices

### 1. Use Service Accounts with IRSA

Never use long-lived AWS credentials in pods. Use IRSA (IAM Roles for Service Accounts).

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: api-gateway-sa
  namespace: kianax
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::ACCOUNT:role/api-gateway-role
---
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      serviceAccountName: api-gateway-sa  # Use this SA
```

### 2. Network Policies

Restrict pod-to-pod communication.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-gateway-netpol
  namespace: kianax
spec:
  podSelector:
    matchLabels:
      app: api-gateway
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: kianax
    ports:
    - protocol: TCP
      port: 3001
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: trading-service
    ports:
    - protocol: TCP
      port: 3002
  - to:  # Allow DNS
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: UDP
      port: 53
```

### 3. Pod Security Standards

Use restrictive pod security.

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: kianax
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### 4. Resource Quotas

Prevent resource exhaustion.

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: kianax-quota
  namespace: kianax
spec:
  hard:
    requests.cpu: "10"        # Total CPU requests
    requests.memory: "20Gi"   # Total memory requests
    limits.cpu: "20"          # Total CPU limits
    limits.memory: "40Gi"     # Total memory limits
    pods: "50"                # Max pods
```

## Learning Resources

### Official Documentation
- [Kubernetes Docs](https://kubernetes.io/docs/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [Helm Docs](https://helm.sh/docs/)
- [ArgoCD Docs](https://argo-cd.readthedocs.io/)

### Interactive Learning
- [Kubernetes Tutorial (katacoda)](https://kubernetes.io/docs/tutorials/)
- [Play with Kubernetes](https://labs.play-with-k8s.com/)

### Books
- "Kubernetes in Action" by Marko Lukša
- "Kubernetes: Up and Running" by Kelsey Hightower

### Practice
Set up a local cluster with Minikube and deploy a simple app. See [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) for setup.

## Quick Reference Card

```bash
# View resources
kubectl get pods -n kianax
kubectl get all -n kianax
kubectl describe pod <pod-name> -n kianax

# Logs
kubectl logs <pod-name> -n kianax -f
stern api-gateway -n kianax

# Execute commands
kubectl exec -it <pod-name> -n kianax -- sh

# Port forward
kubectl port-forward svc/api-gateway -n kianax 3001:3001

# Scale
kubectl scale deployment api-gateway -n kianax --replicas=5

# Deploy
kubectl apply -f deployment.yaml
helm upgrade --install api-gateway ./charts/api-gateway -n kianax

# Rollback
kubectl rollout undo deployment/api-gateway -n kianax
helm rollback api-gateway -n kianax

# Debug
kubectl get events -n kianax --sort-by='.lastTimestamp'
kubectl top pods -n kianax
k9s -n kianax

# Switch context/namespace
kubectx <context-name>
kubens kianax
```

---

For deployment procedures, see [DEPLOYMENT.md](./DEPLOYMENT.md).
For local development, see [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md).
For microservices architecture, see [MICROSERVICES.md](./MICROSERVICES.md).
