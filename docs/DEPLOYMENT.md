# Kianax - Deployment Strategy

High-level deployment architecture and strategy for the Kianax AI trading platform.

## Deployment Architecture

### Cloud Platform: AWS

**Why AWS:**
- Mature EKS (Kubernetes) offering
- Robust managed services (RDS, ElastiCache)
- Strong security and compliance features
- Good pricing for startup scale

### Infrastructure Overview

```
┌─────────────────────────────────────────────┐
│  Frontend - Vercel                          │
│  Next.js 16 with edge caching               │
└──────────────┬──────────────────────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────────────────┐
│  AWS Application Load Balancer              │
│  - SSL termination                          │
│  - WAF protection                           │
│  - WebSocket support                        │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  EKS Cluster (Kubernetes 1.31)              │
│  - API Gateway                              │
│  - Auth Service (Better Auth)               │
│  - Trading Service                          │
│  - Agent Service                            │
│  - Market Data Service                      │
│  - Notification Service                     │
└──────────────┬──────────────────────────────┘
               │
      ┌────────┴────────┐
      ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ RDS          │  │ ElastiCache  │
│ PostgreSQL16 │  │ Redis 7      │
└──────────────┘  └──────────────┘
```

## Environment Strategy

### Two Environments

**Development** (`kianax-development`)
- Purpose: Feature testing and validation
- Domain: `dev.kianax.io`
- Database: db.t3.small, single-AZ
- Redis: cache.t3.micro
- Cost: ~$300/month
- Git: `develop` branch auto-deploys

**Production** (`kianax-production`)
- Purpose: Live user traffic
- Domain: `kianax.io`
- Database: db.t3.medium, Multi-AZ
- Redis: cache.t3.small, 3-node cluster
- Cost: ~$1,200/month
- Git: `main` branch auto-deploys

### Isolation Strategy
- Separate EKS clusters per environment
- Separate databases (no shared data)
- Separate AWS Secrets Manager namespaces
- Independent CI/CD pipelines

## Core Infrastructure Components

### Kubernetes (EKS)
- **Cluster**: Managed control plane, 3-AZ deployment
- **Node Groups**: Auto-scaling (2-10 nodes)
- **Networking**: VPC CNI with private subnets
- **Addons**: ALB Controller, Metrics Server, Cluster Autoscaler

### Database (RDS PostgreSQL 16)
- **Multi-tenancy**: All tables include `user_id` column
- **Backups**: Automated daily snapshots (7-14 day retention)
- **Security**: Encrypted at rest, private subnet only
- **Performance**: Connection pooling, read replicas for scale

### Cache (ElastiCache Redis 7)
- **Use Cases**: Session store, market data cache, pub/sub
- **Cluster Mode**: Enabled in production (3 shards)
- **Persistence**: Snapshots for disaster recovery

### Load Balancer (ALB)
- **SSL/TLS**: AWS Certificate Manager
- **WAF**: Rate limiting, DDoS protection
- **WebSocket**: Sticky sessions for real-time connections

## Application Services

### Authentication (Better Auth)
- **Purpose**: User authentication and session management
- **Features**: Email/password, OAuth (GitHub, Google), 2FA
- **Storage**: Session data in PostgreSQL
- **Security**: Scrypt password hashing, signed cookies

### Feature Flags (Statsig)
- **Purpose**: Safe feature rollouts and A/B testing
- **Use Cases**: AI model selection, pricing experiments, kill switches
- **Configuration**: Environment-based gates (dev/prod)
- **Analytics**: Event tracking for product decisions

### Secrets Management (AWS Secrets Manager)
- **Stored Secrets**: Database credentials, API keys, JWT secrets
- **Access**: IAM roles with least-privilege permissions
- **Rotation**: Automated for database passwords

## CI/CD Pipeline

### Approach: GitOps with ArgoCD

**Workflow:**
1. Developer pushes to Git (`develop` or `main`)
2. GitHub Actions builds Docker images
3. Images pushed to Amazon ECR
4. Helm values updated with new image tags
5. ArgoCD detects changes and syncs to cluster
6. Health checks verify deployment success

**Benefits:**
- Git as single source of truth
- Automatic rollbacks on failures
- Audit trail of all deployments
- Easy rollback to previous versions

### Deployment Safety
- **Database Migrations**: Run before app deployment
- **Zero Downtime**: Rolling updates with health checks
- **Gradual Rollouts**: Feature flags enable incremental releases
- **Monitoring**: Automated alerts on error spikes

## Monitoring & Observability

### Metrics (Prometheus + Grafana)
- Application metrics (requests, latency, errors)
- Infrastructure metrics (CPU, memory, disk)
- Business metrics (trades, users, revenue)
- Custom dashboards per service

### Logging (CloudWatch + FluentBit)
- Structured JSON logs from all services
- Centralized log aggregation
- Log retention (30 days standard)
- Search and analysis capabilities

### Error Tracking (Sentry)
- Frontend and backend error capture
- Stack traces with source maps
- User context for debugging
- Performance monitoring

### Alerting
- High error rates → Slack notification
- Database connection failures → PagerDuty
- API latency > 1s → Team notification
- Cost anomalies → Email alert

## Security Considerations

### Network Security
- **Private Subnets**: All application and database instances
- **Security Groups**: Principle of least privilege
- **VPC Peering**: No direct internet access for sensitive resources
- **Network Policies**: K8s policies restrict pod-to-pod communication

### Data Security
- **Encryption at Rest**: RDS, ElastiCache, EBS volumes
- **Encryption in Transit**: TLS 1.3 for all communications
- **Secrets**: Never in code, always in Secrets Manager
- **API Keys**: AES-256 encryption for broker credentials

### Access Control
- **IAM**: Role-based access with MFA required
- **RBAC**: Kubernetes role-based access control
- **Audit Logging**: CloudTrail for all AWS API calls
- **Session Management**: Automatic timeout after 7 days

### Compliance
- **PCI DSS**: For payment processing
- **SOC 2**: For enterprise customers
- **GDPR**: User data export and deletion capabilities
- **Audit Trail**: Immutable logs for all trading activities

## Cost Optimization

### Current Costs (Estimated)

**Development:** ~$300/month
- EKS: $75
- Compute: $80
- Database: $50
- Redis: $15
- Networking: $50
- Monitoring: $30

**Production:** ~$1,200/month
- EKS: $75
- Compute: $250
- Database: $200
- Redis: $100
- Networking: $100
- External APIs: $300-500 (Polygon, OpenAI)
- Monitoring: $50

### Optimization Strategies
- **Reserved Instances**: 40-60% savings on predictable compute
- **Spot Instances**: For batch jobs and non-critical workloads
- **Auto-scaling**: Reduce costs during low-traffic periods
- **Right-sizing**: Monitor and adjust instance sizes
- **S3 Lifecycle**: Move old logs to cheaper storage tiers

## Disaster Recovery

### Backup Strategy
- **Database**: Daily automated snapshots (14-day retention)
- **Redis**: Daily backups to S3
- **Configuration**: All configs in Git (GitOps)
- **Secrets**: Replicated across regions

### Recovery Objectives
- **RTO** (Recovery Time Objective): 4 hours
- **RPO** (Recovery Point Objective): 1 hour
- **Data Loss**: Maximum 1 hour of trading data

### Failover Plan
1. Detect failure via monitoring
2. Restore database from latest snapshot
3. Deploy application from Git
4. Verify data integrity
5. Resume trading operations

## Scaling Strategy

### Horizontal Scaling
- **Application**: HPA based on CPU/memory (2-10 pods)
- **Database**: Read replicas for query scaling
- **Redis**: Cluster mode with additional shards
- **Infrastructure**: Cluster Autoscaler adds nodes automatically

### Vertical Scaling
- **Database**: Upgrade instance type during maintenance window
- **Redis**: Upgrade to larger node types
- **Compute**: Update EKS node group instance types

### Future Architecture (1000+ Users)
- Multi-region deployment for lower latency
- CDN for static assets
- Separate database per region
- Event-driven architecture with message queues

## Infrastructure as Code

### Terraform
- **Purpose**: Provision AWS resources
- **Structure**: Modular (networking, database, EKS, monitoring)
- **State**: Remote state in S3 with DynamoDB locking
- **Workspaces**: Separate state per environment

### Helm
- **Purpose**: Package K8s applications
- **Charts**: One per microservice
- **Values**: Environment-specific overrides
- **Versioning**: Semantic versioning for releases

### GitOps with ArgoCD
- **Purpose**: Continuous deployment to Kubernetes
- **Sync**: Automatic on Git changes
- **Health**: Application health monitoring
- **Rollback**: One-click rollback to previous versions

## Deployment Checklist

### Pre-Production
- [ ] Load testing completed (1000 concurrent users)
- [ ] Security audit passed
- [ ] Database migrations tested
- [ ] Backup and restore verified
- [ ] Monitoring dashboards configured
- [ ] Runbooks documented
- [ ] On-call rotation established

### Production Deployment
- [ ] Feature flags configured for gradual rollout
- [ ] Database migration plan reviewed
- [ ] Rollback plan documented
- [ ] Team notified of deployment window
- [ ] Monitoring alerts active
- [ ] Incident response plan ready

### Post-Deployment
- [ ] Health checks passing
- [ ] Error rates normal
- [ ] Performance metrics within SLA
- [ ] User feedback monitored
- [ ] Post-mortem scheduled (if issues)

---

**For detailed implementation guides, see:**
- Infrastructure setup → [terraform/README.md](../infrastructure/terraform/README.md)
- Kubernetes operations → [KUBERNETES.md](./KUBERNETES.md)
- Local development → [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)
- Service architecture → [MICROSERVICES.md](./MICROSERVICES.md)
