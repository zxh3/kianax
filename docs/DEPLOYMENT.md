# Kianax Platform - AWS EKS Deployment Guide

This guide covers deploying Kianax to AWS using Amazon EKS (Elastic Kubernetes Service) with a production-ready, scalable architecture.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Environment Strategy](#environment-strategy)
- [Authentication with Better Auth](#authentication-with-better-auth)
- [Prerequisites](#prerequisites)
- [Infrastructure Components](#infrastructure-components)
- [Local Development](#local-development)
- [Deployment Steps](#deployment-steps)
- [CI/CD Pipeline](#cicd-pipeline)
- [Monitoring & Observability](#monitoring--observability)
- [Cost Estimates](#cost-estimates)
- [Troubleshooting](#troubleshooting)

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│  Frontend (Vercel or CloudFront)                │
│  - Next.js 16 application                       │
│  - CDN distribution                             │
└──────────────┬──────────────────────────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────────────────────┐
│  AWS Application Load Balancer (ALB)            │
│  - SSL termination (ACM certificate)            │
│  - WAF for DDoS protection                      │
│  - WebSocket support                            │
└──────────────┬──────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────┐
│  Amazon EKS Cluster (Kubernetes 1.31)           │
│                                                  │
│  ┌────────────────────────────────────────┐   │
│  │ Microservices (Fargate/EC2 nodes)      │   │
│  │                                         │   │
│  │  • api-gateway (entry point)           │   │
│  │  • auth-service (better-auth)          │   │
│  │  • trading-service (orders, portfolio) │   │
│  │  • agent-service (AI execution)        │   │
│  │  • market-data-service (Polygon.io)    │   │
│  │  • info-retrieval-service (RAG)        │   │
│  │  • notification-service (WebSocket)    │   │
│  │  • scheduler-service (cron triggers)   │   │
│  └────────────────────────────────────────┘   │
└──────────────┬──────────────────────────────────┘
               │
      ┌────────┴────────┐
      ▼                 ▼
┌──────────────┐  ┌──────────────┐
│  Amazon RDS  │  │ ElastiCache  │
│  PostgreSQL  │  │    Redis     │
│  16 (Multi-  │  │  Cluster     │
│  AZ)         │  │  Mode        │
└──────────────┘  └──────────────┘
               │
      ┌────────┴────────────────┐
      ▼                         ▼
┌──────────────┐  ┌──────────────────────┐
│   External   │  │    Observability     │
│   Services   │  │                      │
│              │  │  • Prometheus        │
│  • Polygon   │  │  • Grafana          │
│  • Alpaca    │  │  • FluentBit        │
│  • OpenAI    │  │  • X-Ray/Jaeger     │
│  • Anthropic │  │  • Sentry           │
└──────────────┘  └──────────────────────┘
```

### Key Design Principles

1. **Multi-Tenancy**: All services enforce user isolation at the database layer
2. **Microservices**: Loosely coupled services for scalability and independent deployment
3. **GitOps**: ArgoCD manages deployments from Git as single source of truth
4. **Observability**: Comprehensive monitoring, logging, and tracing
5. **Security**: IRSA for AWS access, network policies, secrets management
6. **Scalability**: Horizontal pod autoscaling and cluster autoscaling

## Environment Strategy

Kianax will be deployed to **two separate environments**:

### Development Environment
- **Purpose**: Testing, staging, and pre-production validation
- **Cluster**: `kianax-development` EKS cluster
- **Domain**: `dev.kianax.io` or `api-dev.kianax.io`
- **Database**: Smaller RDS instance (db.t3.small, single-AZ)
- **Redis**: Smaller ElastiCache instance (cache.t3.micro)
- **Git Branch**: `develop` branch auto-deploys via ArgoCD
- **Cost**: ~$250-350/month
- **Use Cases**:
  - Feature testing before production
  - Integration testing with external APIs (sandbox mode)
  - Load testing and performance optimization
  - Breaking changes validation

### Production Environment
- **Purpose**: Live user-facing application
- **Cluster**: `kianax-production` EKS cluster
- **Domain**: `kianax.io` or `api.kianax.io`
- **Database**: Production-grade RDS (db.t3.medium, Multi-AZ)
- **Redis**: Production ElastiCache cluster (cache.t3.small, 3 nodes)
- **Git Branch**: `main` branch auto-deploys via ArgoCD
- **Cost**: ~$1,100-1,500/month
- **Use Cases**:
  - Real user traffic
  - Real broker accounts (live trading)
  - Production data and compliance

### Environment Isolation

Both environments are **completely isolated**:
- Separate EKS clusters
- Separate databases (no shared data)
- Separate AWS accounts (recommended) or separate VPCs
- Separate secrets in AWS Secrets Manager
- Separate monitoring dashboards
- Independent CI/CD pipelines

**Terraform Workspaces:**
```bash
terraform workspace new development
terraform workspace new production
```

## Authentication with Better Auth

Kianax uses **Better Auth** for authentication and user management. Better Auth is a comprehensive, TypeScript-first authentication framework that handles all authentication concerns with minimal setup.

### What is Better Auth?

Better Auth is a framework-agnostic authentication library that provides:
- **Database-backed sessions**: Secure, server-side session management
- **Multiple auth methods**: Email/password, OAuth (Google, GitHub, etc.), magic links, passkeys
- **Built-in security**: Password hashing (scrypt), CSRF protection, rate limiting
- **TypeScript-first**: Full type safety across client and server
- **Extensible**: Plugin system for advanced features (2FA, organizations, etc.)

**Why Better Auth for Kianax?**
- Eliminates need to build custom authentication from scratch
- Handles complex security concerns automatically (password hashing, session management, token refresh)
- Provides OAuth integration out-of-the-box for social login
- Multi-session support (users can log in on multiple devices)
- Works seamlessly with Next.js and Fastify (our tech stack)
- Easy database migrations via CLI

### Better Auth Architecture

```
┌─────────────────────────────────────────────┐
│  Frontend (Next.js 16)                      │
│  - authClient (better-auth/react)           │
│  - Reactive session state                   │
│  - Sign up/in/out UI                        │
└──────────────┬──────────────────────────────┘
               │ HTTPS
               ▼
┌─────────────────────────────────────────────┐
│  API Gateway or Auth Service                │
│  - Better Auth handler                      │
│  - /api/auth/* routes                       │
│  - Session validation middleware            │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  PostgreSQL Database                        │
│  - user table                               │
│  - session table                            │
│  - account table (OAuth providers)          │
│  - verification table (email verification)  │
└─────────────────────────────────────────────┘
```

### Database Schema

Better Auth requires **4 core tables** in PostgreSQL:

**1. user table**
```sql
id          TEXT PRIMARY KEY
name        TEXT
email       TEXT UNIQUE NOT NULL
emailVerified BOOLEAN DEFAULT false
image       TEXT
createdAt   TIMESTAMP DEFAULT NOW()
updatedAt   TIMESTAMP DEFAULT NOW()
```

**2. session table**
```sql
id          TEXT PRIMARY KEY  -- Session token (used as cookie)
userId      TEXT NOT NULL REFERENCES user(id)
expiresAt   TIMESTAMP NOT NULL
ipAddress   TEXT
userAgent   TEXT
createdAt   TIMESTAMP DEFAULT NOW()
updatedAt   TIMESTAMP DEFAULT NOW()
```

**3. account table** (for OAuth providers and passwords)
```sql
id              TEXT PRIMARY KEY
userId          TEXT NOT NULL REFERENCES user(id)
accountId       TEXT NOT NULL  -- Provider user ID (e.g., GitHub user ID)
providerId      TEXT NOT NULL  -- Provider name (e.g., 'github', 'google')
accessToken     TEXT
refreshToken    TEXT
expiresAt       TIMESTAMP
scope           TEXT
idToken         TEXT
password        TEXT           -- Hashed password (for email/password auth)
createdAt       TIMESTAMP DEFAULT NOW()
updatedAt       TIMESTAMP DEFAULT NOW()
```

**4. verification table** (for email verification tokens)
```sql
id          TEXT PRIMARY KEY
identifier  TEXT NOT NULL      -- Email or phone number
value       TEXT NOT NULL      -- Verification code/token
expiresAt   TIMESTAMP NOT NULL
createdAt   TIMESTAMP DEFAULT NOW()
updatedAt   TIMESTAMP DEFAULT NOW()
```

### Installation and Setup

**1. Install Better Auth**

```bash
# Install better-auth core and React client
bun add better-auth
bun add better-auth/react  # For frontend

# Install database adapter (we use Drizzle ORM)
bun add better-auth/drizzle-orm
```

**2. Configure Better Auth Server**

Create `packages/db/src/auth.ts`:

```typescript
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";  // Your Drizzle instance

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",  // PostgreSQL
  }),

  // Email/password authentication
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification: true,  // Require email verification before login
  },

  // OAuth providers (optional, add as needed)
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7,  // 7 days
    updateAge: 60 * 60 * 24,       // Refresh if session used after 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,  // 5 minutes (reduces DB queries)
    },
  },

  // Security
  rateLimit: {
    enabled: true,
    window: 60,        // 1 minute
    max: 100,          // 100 requests per minute per IP
  },

  // Advanced options
  advanced: {
    generateId: () => crypto.randomUUID(),  // Custom ID generation
  },
});

// Export types for TypeScript
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.User;
```

**3. Set Up API Routes**

For **Next.js (Frontend)**:

Create `apps/web/app/api/auth/[...all]/route.ts`:

```typescript
import { auth } from "@kianax/db/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Export GET and POST handlers
export const { GET, POST } = toNextJsHandler(auth.handler);
```

For **Fastify (Backend/API Gateway)**:

Create `apps/server/src/routes/auth.ts`:

```typescript
import { FastifyInstance } from "fastify";
import { auth } from "@kianax/db/auth";

export default async function authRoutes(fastify: FastifyInstance) {
  // Mount Better Auth handler at /auth/*
  fastify.all("/auth/*", async (request, reply) => {
    return auth.handler({
      request: {
        method: request.method,
        url: request.url,
        headers: request.headers as Record<string, string>,
        body: request.body,
      },
      setHeader: (key, value) => {
        reply.header(key, value);
      },
      setCookie: (name, value, options) => {
        reply.setCookie(name, value, options);
      },
    });
  });
}
```

**4. Set Up Frontend Client**

Create `apps/web/lib/auth-client.ts`:

```typescript
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
});

// Export hooks for components
export const {
  useSession,
  signIn,
  signUp,
  signOut,
} = authClient;
```

**5. Generate Database Schema**

```bash
# Generate Drizzle schema
cd packages/db
npx @better-auth/cli generate

# This creates migration files in drizzle/ directory

# Run migrations
bun run db:migrate
```

### Authentication Flows

**Sign Up (Email/Password)**

```typescript
// Frontend component
import { authClient } from "@/lib/auth-client";

async function handleSignUp(email: string, password: string, name: string) {
  const { data, error } = await authClient.signUp.email({
    email,
    password,
    name,
    callbackURL: "/dashboard",  // Redirect after sign up
  });

  if (error) {
    console.error("Sign up failed:", error);
    return;
  }

  // User created, verification email sent (if enabled)
  console.log("User created:", data.user);
}
```

**Sign In (Email/Password)**

```typescript
async function handleSignIn(email: string, password: string) {
  const { data, error } = await authClient.signIn.email({
    email,
    password,
    rememberMe: true,  // Extend session duration
  });

  if (error) {
    console.error("Sign in failed:", error);
    return;
  }

  // Session created
  console.log("Signed in:", data.user);
}
```

**OAuth Sign In (GitHub/Google)**

```typescript
async function handleOAuthSignIn() {
  // Redirects to OAuth provider
  await authClient.signIn.social({
    provider: "github",
    callbackURL: "/dashboard",
  });
}
```

**Sign Out**

```typescript
async function handleSignOut() {
  await authClient.signOut();
  router.push("/");
}
```

### Session Management

**Client-Side: Check Session**

```typescript
"use client";
import { useSession } from "@/lib/auth-client";

export function ProfileButton() {
  const { data: session, isPending } = useSession();

  if (isPending) return <div>Loading...</div>;

  if (!session) {
    return <a href="/sign-in">Sign In</a>;
  }

  return (
    <div>
      Welcome, {session.user.name}!
      <button onClick={handleSignOut}>Sign Out</button>
    </div>
  );
}
```

**Server-Side: Validate Session**

```typescript
// Next.js Server Component
import { auth } from "@kianax/db/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  return <div>Welcome, {session.user.name}!</div>;
}
```

**Fastify: Validate Session Middleware**

```typescript
import { FastifyRequest, FastifyReply } from "fastify";
import { auth } from "@kianax/db/auth";

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const session = await auth.api.getSession({
    headers: request.headers as Record<string, string>,
  });

  if (!session) {
    return reply.code(401).send({ error: "Unauthorized" });
  }

  // Attach user to request
  request.user = session.user;
}

// Use in routes
fastify.get("/portfolio", {
  preHandler: requireAuth,
}, async (request, reply) => {
  const userId = request.user.id;
  // Fetch portfolio for user...
});
```

### Multi-Session Support

Better Auth supports multiple sessions per user (e.g., logged in on phone and laptop).

```typescript
// List all active sessions
const sessions = await authClient.listSessions();

// Revoke specific session
await authClient.revokeSession({ sessionToken: "session-token-here" });

// Revoke all other sessions (keep current)
await authClient.revokeOtherSessions();

// Revoke ALL sessions (force re-login everywhere)
await authClient.revokeSessions();
```

### Security Features

**1. Password Hashing**
- Uses **scrypt** algorithm (memory-intensive, resistant to brute-force)
- Configurable via custom hash/verify functions

**2. Session Security**
- Sessions stored server-side in database
- Session tokens are cryptographically random UUIDs
- Cookies are HTTP-only, secure, and signed
- Automatic session refresh on activity

**3. Rate Limiting**
- Built-in rate limiting per IP address
- Prevents brute-force attacks
- Configurable limits

**4. CSRF Protection**
- CSRF tokens for state-changing operations
- Automatic validation

**5. Email Verification**
- Require email verification before login
- Verification tokens expire after 24 hours

### Environment Variables

Add to AWS Secrets Manager:

```bash
# Development environment
aws secretsmanager create-secret \
  --name kianax/development/better-auth-secret \
  --secret-string "$(openssl rand -hex 32)"

# Production environment
aws secretsmanager create-secret \
  --name kianax/production/better-auth-secret \
  --secret-string "$(openssl rand -hex 32)"

# OAuth credentials (if using social login)
aws secretsmanager create-secret \
  --name kianax/production/github-oauth \
  --secret-string '{"clientId":"your-id","clientSecret":"your-secret"}'
```

Reference in application:

```typescript
// apps/server/.env or k8s secret
BETTER_AUTH_SECRET=<from-secrets-manager>
BETTER_AUTH_URL=https://api.kianax.io
DATABASE_URL=<rds-connection-string>

# OAuth (optional)
GITHUB_CLIENT_ID=<from-secrets-manager>
GITHUB_CLIENT_SECRET=<from-secrets-manager>
GOOGLE_CLIENT_ID=<from-secrets-manager>
GOOGLE_CLIENT_SECRET=<from-secrets-manager>
```

### Deployment Considerations

**Database Migration**
- Run `npx @better-auth/cli generate` to create schema
- Apply migrations before deploying new code
- Better Auth handles schema evolution automatically

**Session Storage**
- Sessions stored in PostgreSQL by default
- Optional: Use Redis for session caching (reduces DB load)
- Configure via `secondaryStorage` option

**Kubernetes Deployment**
- Better Auth is stateless (session stored in DB/Redis)
- Can run multiple replicas for high availability
- No sticky sessions required (unlike WebSocket)

**Multi-Tenant Considerations**
- Better Auth's `user` table includes `userId` (perfect for multi-tenancy)
- All user data automatically scoped by `userId`
- No additional isolation needed at auth layer

### Customization

**Additional User Fields**

```typescript
export const auth = betterAuth({
  // ... other config
  user: {
    additionalFields: {
      phoneNumber: {
        type: "string",
        required: false,
      },
      role: {
        type: "string",
        defaultValue: "user",
      },
      subscriptionTier: {
        type: "string",
        defaultValue: "free",
      },
    },
  },
});
```

**Custom Authentication Logic**

```typescript
export const auth = betterAuth({
  // ... other config
  hooks: {
    after: [
      {
        matcher: (context) => context.path === "/sign-up/email",
        handler: async (context) => {
          // Custom logic after sign up
          const user = context.returnValue;
          await sendWelcomeEmail(user.email);
        },
      },
    ],
  },
});
```

### Migration from Custom Auth

If you already have a custom authentication system:

1. **Map existing tables** to Better Auth schema
2. **Migrate passwords**: Better Auth can validate existing hashes
3. **Migrate sessions**: Force re-login or map session tokens
4. **Update API calls**: Replace custom auth with Better Auth API

### Further Resources

- **Better Auth Docs**: https://www.better-auth.com/docs
- **GitHub Repository**: https://github.com/better-auth/better-auth
- **Example Apps**: https://github.com/better-auth/better-auth/tree/main/examples
- **Discord Community**: Join for support and discussions

## Prerequisites

### Required Tools

Install the following tools on your local machine:

```bash
# AWS CLI v2
brew install awscli

# kubectl (Kubernetes CLI)
brew install kubectl

# Terraform
brew install terraform

# Helm (Kubernetes package manager)
brew install helm

# ArgoCD CLI
brew install argocd

# Optional but recommended
brew install k9s              # Terminal UI for Kubernetes
brew install kubectx          # Switch between clusters/namespaces easily
brew install stern            # Multi-pod log tailing
```

### AWS Account Setup

1. **Create AWS Account** (if you don't have one)
   - Sign up at https://aws.amazon.com

2. **Create IAM User for Terraform**
   ```bash
   # Create IAM user with admin access (for initial setup)
   # In production, use more restrictive policies
   aws iam create-user --user-name kianax-terraform

   # Attach admin policy (temporary, restrict later)
   aws iam attach-user-policy \
     --user-name kianax-terraform \
     --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

   # Create access keys
   aws iam create-access-key --user-name kianax-terraform
   ```

3. **Configure AWS CLI**
   ```bash
   aws configure
   # Enter:
   # - AWS Access Key ID
   # - AWS Secret Access Key
   # - Default region: us-east-1 (or your preferred region)
   # - Default output format: json
   ```

4. **Set up Terraform backend** (S3 + DynamoDB for state locking)
   ```bash
   # Create S3 bucket for Terraform state
   aws s3api create-bucket \
     --bucket kianax-terraform-state \
     --region us-east-1

   # Enable versioning
   aws s3api put-bucket-versioning \
     --bucket kianax-terraform-state \
     --versioning-configuration Status=Enabled

   # Create DynamoDB table for state locking
   aws dynamodb create-table \
     --table-name kianax-terraform-locks \
     --attribute-definitions AttributeName=LockID,AttributeType=S \
     --key-schema AttributeName=LockID,KeyType=HASH \
     --billing-mode PAY_PER_REQUEST \
     --region us-east-1
   ```

### GitHub Setup

1. **Create GitHub Personal Access Token** (for ArgoCD)
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Generate token with `repo` scope
   - Save token securely

2. **Set up GitHub Actions secrets**
   ```bash
   # We'll add these via GitHub UI:
   # - AWS_ACCOUNT_ID
   # - AWS_REGION
   # - ECR_REPOSITORY_*
   ```

## Infrastructure Components

### Network Architecture

**VPC Configuration:**
- CIDR: `10.0.0.0/16`
- 3 Availability Zones for high availability
- Public subnets: `10.0.1.0/24`, `10.0.2.0/24`, `10.0.3.0/24` (ALB, NAT)
- Private subnets: `10.0.11.0/24`, `10.0.12.0/24`, `10.0.13.0/24` (EKS pods)
- Database subnets: `10.0.21.0/24`, `10.0.22.0/24`, `10.0.23.0/24` (RDS, Redis)

**Security Groups:**
- `alb-sg`: Allow 443 from internet, allow all to EKS
- `eks-cluster-sg`: Allow all from ALB and within cluster
- `eks-node-sg`: Allow all within VPC
- `rds-sg`: Allow 5432 from EKS pods only
- `redis-sg`: Allow 6379 from EKS pods only

### EKS Cluster Configuration

**Cluster Specifications:**
- Kubernetes version: 1.31
- Control plane: AWS-managed (highly available across 3 AZs)
- Networking: VPC CNI with prefix delegation (more IPs per node)
- Logging: Audit, API, Controller Manager logs to CloudWatch

**Node Groups:**

1. **General workload nodes** (`general-ng`)
   - Instance type: `t3.medium` (2 vCPU, 4GB RAM)
   - Capacity: 2-5 nodes (autoscaling)
   - Taints: None
   - Use: Most microservices

2. **System addons nodes** (`system-ng`)
   - Instance type: `t3.small` (2 vCPU, 2GB RAM)
   - Capacity: 2 nodes (fixed)
   - Taints: `node-role.kubernetes.io/system:NoSchedule`
   - Use: Prometheus, Grafana, ArgoCD

3. **Spot instance nodes** (`jobs-ng`) - Optional
   - Instance type: `t3.medium` (spot)
   - Capacity: 0-10 nodes (autoscaling)
   - Taints: `node-role.kubernetes.io/spot:NoSchedule`
   - Use: AI agent execution, batch jobs

**EKS Addons:**
- `vpc-cni`: Pod networking (version: latest)
- `coredns`: DNS resolution
- `kube-proxy`: Network proxying
- `aws-ebs-csi-driver`: Persistent volume support

### Database Configuration

**Amazon RDS PostgreSQL 16:**

**Staging:**
- Instance: `db.t3.small` (2 vCPU, 2GB RAM)
- Storage: 50GB GP3
- Single-AZ deployment
- Automated backups: 7-day retention
- Backup window: 03:00-04:00 UTC

**Production:**
- Instance: `db.t3.medium` (2 vCPU, 4GB RAM)
- Storage: 100GB GP3
- Multi-AZ deployment (automatic failover)
- Automated backups: 14-day retention
- Backup window: 03:00-04:00 UTC
- Read replica: Optional (add for scaling reads)

**Performance Insights:** Enabled (7-day retention)

**Amazon ElastiCache Redis 7:**

**Staging:**
- Node type: `cache.t3.micro` (0.5GB RAM)
- Nodes: 1 (no clustering)
- Snapshot retention: 1 day

**Production:**
- Node type: `cache.t3.small` (1.5GB RAM)
- Nodes: 3 (cluster mode enabled with 3 shards)
- Automatic failover: Enabled
- Snapshot retention: 7 days
- Snapshot window: 04:00-05:00 UTC

### Kubernetes Addons

**Essential Addons** (installed via Helm):

1. **AWS Load Balancer Controller** (v2.8+)
   - Manages ALB and NLB from K8s Ingress/Service
   - Automatic target group registration
   - WebSocket support via annotations

2. **External Secrets Operator** (v0.9+)
   - Syncs AWS Secrets Manager to K8s Secrets
   - Automatic rotation
   - IRSA for secure access

3. **Metrics Server**
   - Pod-level resource metrics
   - Required for HPA (Horizontal Pod Autoscaler)

4. **Cluster Autoscaler**
   - Automatically adds/removes nodes
   - Integrates with AWS Auto Scaling Groups

5. **kube-prometheus-stack** (Prometheus + Grafana)
   - Metrics collection and visualization
   - Pre-built dashboards for K8s and applications
   - AlertManager for notifications

6. **FluentBit**
   - Log collection from all pods
   - Ships to CloudWatch Logs
   - Structured JSON parsing

7. **ArgoCD**
   - GitOps continuous delivery
   - Web UI for deployment visualization
   - Automated sync from Git

8. **External DNS** (Optional)
   - Automatic Route53 record management
   - Updates DNS when Ingress is created

## Local Development

For local Kubernetes testing, see [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md).

**Quick summary:**
- Use **Minikube** or **Kind** for local K8s cluster
- Use **Docker Compose** for local services (simpler alternative)
- Use **Tilt** for rapid inner-loop development with K8s

## Deployment Steps

### Phase 1: Infrastructure Provisioning (Terraform)

1. **Clone repository and set up Terraform**
   ```bash
   git clone https://github.com/yourusername/kianax.git
   cd kianax/infrastructure/terraform
   ```

2. **Initialize Terraform**
   ```bash
   terraform init
   ```

3. **Create workspace for staging**
   ```bash
   terraform workspace new staging
   terraform workspace select staging
   ```

4. **Review and customize variables**
   ```bash
   cp terraform.tfvars.example terraform.tfvars.staging
   # Edit terraform.tfvars.staging with your values
   ```

   Example `terraform.tfvars.staging`:
   ```hcl
   environment         = "staging"
   aws_region         = "us-east-1"
   cluster_name       = "kianax-staging"
   cluster_version    = "1.31"

   # Node group configuration
   general_node_instance_type = "t3.medium"
   general_node_min_size     = 2
   general_node_max_size     = 5
   general_node_desired_size = 2

   # Database configuration
   rds_instance_class        = "db.t3.small"
   rds_allocated_storage    = 50
   rds_multi_az            = false

   # Redis configuration
   redis_node_type          = "cache.t3.micro"
   redis_num_cache_nodes   = 1

   # Tags
   tags = {
     Project     = "kianax"
     Environment = "staging"
     ManagedBy   = "terraform"
   }
   ```

5. **Plan and apply infrastructure**
   ```bash
   # Review what will be created
   terraform plan -var-file=terraform.tfvars.staging

   # Apply (will take 15-20 minutes for EKS cluster)
   terraform apply -var-file=terraform.tfvars.staging
   ```

6. **Configure kubectl**
   ```bash
   # Update kubeconfig to access the cluster
   aws eks update-kubeconfig \
     --region us-east-1 \
     --name kianax-staging

   # Verify connection
   kubectl get nodes
   ```

### Phase 2: Install Kubernetes Addons

1. **Install AWS Load Balancer Controller**
   ```bash
   # Add Helm repository
   helm repo add eks https://aws.github.io/eks-charts
   helm repo update

   # Install
   helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
     -n kube-system \
     --set clusterName=kianax-staging \
     --set serviceAccount.create=false \
     --set serviceAccount.name=aws-load-balancer-controller
   ```

2. **Install External Secrets Operator**
   ```bash
   helm repo add external-secrets https://charts.external-secrets.io
   helm repo update

   helm install external-secrets external-secrets/external-secrets \
     -n external-secrets-system \
     --create-namespace
   ```

3. **Install Metrics Server**
   ```bash
   kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
   ```

4. **Install Cluster Autoscaler**
   ```bash
   helm repo add autoscaler https://kubernetes.github.io/autoscaler
   helm repo update

   helm install cluster-autoscaler autoscaler/cluster-autoscaler \
     -n kube-system \
     --set autoDiscovery.clusterName=kianax-staging \
     --set awsRegion=us-east-1
   ```

5. **Install kube-prometheus-stack**
   ```bash
   helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
   helm repo update

   helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
     -n monitoring \
     --create-namespace \
     --set prometheus.prometheusSpec.retention=30d \
     --set grafana.adminPassword=your-secure-password
   ```

6. **Install FluentBit**
   ```bash
   helm repo add fluent https://fluent.github.io/helm-charts
   helm repo update

   helm install fluent-bit fluent/fluent-bit \
     -n logging \
     --create-namespace \
     --set cloudWatch.enabled=true \
     --set cloudWatch.region=us-east-1 \
     --set cloudWatch.logGroupName=/aws/eks/kianax-staging/application
   ```

7. **Install ArgoCD**
   ```bash
   kubectl create namespace argocd
   kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

   # Get initial admin password
   kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

   # Port forward to access UI
   kubectl port-forward svc/argocd-server -n argocd 8080:443
   # Open https://localhost:8080
   ```

### Phase 3: Configure Secrets

1. **Store secrets in AWS Secrets Manager**
   ```bash
   # Database URL
   aws secretsmanager create-secret \
     --name kianax/staging/database-url \
     --secret-string "postgresql://username:password@rds-endpoint:5432/kianax"

   # Redis URL
   aws secretsmanager create-secret \
     --name kianax/staging/redis-url \
     --secret-string "redis://elasticache-endpoint:6379"

   # JWT Secret
   aws secretsmanager create-secret \
     --name kianax/staging/jwt-secret \
     --secret-string "$(openssl rand -hex 32)"

   # External API keys
   aws secretsmanager create-secret \
     --name kianax/staging/polygon-api-key \
     --secret-string "your-polygon-key"

   aws secretsmanager create-secret \
     --name kianax/staging/openai-api-key \
     --secret-string "your-openai-key"

   aws secretsmanager create-secret \
     --name kianax/staging/anthropic-api-key \
     --secret-string "your-anthropic-key"
   ```

2. **Create ExternalSecret resources**

   Create `k8s/base/external-secrets.yaml`:
   ```yaml
   apiVersion: external-secrets.io/v1beta1
   kind: SecretStore
   metadata:
     name: aws-secrets-manager
     namespace: kianax
   spec:
     provider:
       aws:
         service: SecretsManager
         region: us-east-1
         auth:
           jwt:
             serviceAccountRef:
               name: external-secrets-sa
   ---
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
       name: kianax-secrets
       creationPolicy: Owner
     data:
       - secretKey: DATABASE_URL
         remoteRef:
           key: kianax/staging/database-url
       - secretKey: REDIS_URL
         remoteRef:
           key: kianax/staging/redis-url
       - secretKey: JWT_SECRET
         remoteRef:
           key: kianax/staging/jwt-secret
       - secretKey: POLYGON_API_KEY
         remoteRef:
           key: kianax/staging/polygon-api-key
       - secretKey: OPENAI_API_KEY
         remoteRef:
           key: kianax/staging/openai-api-key
       - secretKey: ANTHROPIC_API_KEY
         remoteRef:
           key: kianax/staging/anthropic-api-key
   ```

   Apply:
   ```bash
   kubectl apply -f k8s/base/external-secrets.yaml
   ```

### Phase 4: Deploy Applications

1. **Build and push Docker images**
   ```bash
   # Login to ECR
   aws ecr get-login-password --region us-east-1 | \
     docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

   # Build and push api-gateway
   cd apps/server
   docker build -t kianax-api-gateway:latest .
   docker tag kianax-api-gateway:latest $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/kianax-api-gateway:latest
   docker push $AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/kianax-api-gateway:latest
   ```

2. **Deploy via Helm**
   ```bash
   # Install api-gateway
   helm install api-gateway k8s/charts/api-gateway \
     -n kianax \
     --create-namespace \
     -f k8s/charts/api-gateway/values-staging.yaml
   ```

3. **Or deploy via ArgoCD (recommended)**
   ```bash
   # Login to ArgoCD
   argocd login localhost:8080 --username admin --password <password>

   # Create application
   argocd app create api-gateway \
     --repo https://github.com/yourusername/kianax.git \
     --path k8s/charts/api-gateway \
     --dest-server https://kubernetes.default.svc \
     --dest-namespace kianax \
     --values values-staging.yaml \
     --sync-policy automated \
     --auto-prune \
     --self-heal
   ```

4. **Verify deployment**
   ```bash
   # Check pods
   kubectl get pods -n kianax

   # Check services
   kubectl get svc -n kianax

   # Check ingress
   kubectl get ingress -n kianax

   # Get ALB URL
   kubectl get ingress api-gateway -n kianax -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
   ```

5. **Run database migrations**
   ```bash
   # Create migration job
   kubectl create job --from=cronjob/migrations migrate-$(date +%s) -n kianax

   # Or run directly
   kubectl run migrate --image=$AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/kianax-api-gateway:latest \
     --restart=Never \
     --env="DATABASE_URL=$(kubectl get secret kianax-secrets -n kianax -o jsonpath='{.data.DATABASE_URL}' | base64 -d)" \
     --command -- bun run db:migrate
   ```

### Phase 5: Configure DNS and SSL

1. **Request ACM certificate**
   ```bash
   aws acm request-certificate \
     --domain-name api.kianax.io \
     --subject-alternative-names "*.kianax.io" \
     --validation-method DNS \
     --region us-east-1
   ```

2. **Validate certificate**
   - Add DNS records as instructed by ACM
   - Wait for validation (can take 5-30 minutes)

3. **Update Ingress with certificate ARN**

   In `k8s/charts/api-gateway/templates/ingress.yaml`:
   ```yaml
   metadata:
     annotations:
       alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT_ID
   ```

4. **Create Route53 record**
   ```bash
   # Get ALB DNS name
   ALB_DNS=$(kubectl get ingress api-gateway -n kianax -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

   # Create CNAME record pointing api.kianax.io → ALB
   aws route53 change-resource-record-sets \
     --hosted-zone-id YOUR_ZONE_ID \
     --change-batch "{
       \"Changes\": [{
         \"Action\": \"CREATE\",
         \"ResourceRecordSet\": {
           \"Name\": \"api.kianax.io\",
           \"Type\": \"CNAME\",
           \"TTL\": 300,
           \"ResourceRecords\": [{\"Value\": \"$ALB_DNS\"}]
         }
       }]
     }"
   ```

## CI/CD Pipeline

### GitHub Actions Workflow

Create `.github/workflows/deploy-staging.yml`:

```yaml
name: Deploy to Staging

on:
  push:
    branches:
      - develop

env:
  AWS_REGION: us-east-1
  ECR_REGISTRY: ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.us-east-1.amazonaws.com

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.2.23

      - name: Install dependencies
        run: bun install

      - name: Lint
        run: bun run lint

      - name: Type check
        run: bun run typecheck

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read

    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/GithubActionsRole
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and push api-gateway
        working-directory: apps/server
        run: |
          IMAGE_TAG=${{ github.sha }}
          docker build -t $ECR_REGISTRY/kianax-api-gateway:$IMAGE_TAG .
          docker push $ECR_REGISTRY/kianax-api-gateway:$IMAGE_TAG
          docker tag $ECR_REGISTRY/kianax-api-gateway:$IMAGE_TAG $ECR_REGISTRY/kianax-api-gateway:latest
          docker push $ECR_REGISTRY/kianax-api-gateway:latest

      - name: Update Helm values
        run: |
          yq eval ".image.tag = \"${{ github.sha }}\"" -i k8s/charts/api-gateway/values-staging.yaml

      - name: Commit updated values
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add k8s/charts/api-gateway/values-staging.yaml
          git commit -m "Update api-gateway image to ${{ github.sha }}"
          git push
```

### ArgoCD Auto-Sync

ArgoCD will automatically detect the updated `values-staging.yaml` and deploy the new image to the cluster.

## Monitoring & Observability

### Access Grafana

```bash
# Port forward Grafana
kubectl port-forward -n monitoring svc/kube-prometheus-stack-grafana 3000:80

# Open http://localhost:3000
# Username: admin
# Password: (set during Helm install)
```

**Pre-built Dashboards:**
- Kubernetes / Compute Resources / Cluster
- Kubernetes / Compute Resources / Namespace (Pods)
- Node Exporter / Nodes

### Access Prometheus

```bash
kubectl port-forward -n monitoring svc/kube-prometheus-stack-prometheus 9090:9090
# Open http://localhost:9090
```

### CloudWatch Container Insights

Enable Container Insights for your EKS cluster:

```bash
aws eks update-cluster-config \
  --name kianax-staging \
  --logging '{"clusterLogging":[{"types":["api","audit","authenticator","controllerManager","scheduler"],"enabled":true}]}'
```

View metrics in CloudWatch Console:
- CloudWatch → Container Insights → Performance monitoring

### Sentry Integration

Add Sentry DSN to secrets:

```bash
aws secretsmanager create-secret \
  --name kianax/staging/sentry-dsn \
  --secret-string "https://your-sentry-dsn@sentry.io/project"
```

Configure in application (example for Fastify):

```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

fastify.addHook('onError', async (request, reply, error) => {
  Sentry.captureException(error);
});
```

## Cost Estimates

### Staging Environment (~$300/month)

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| EKS Control Plane | Managed | $75 |
| EC2 Nodes | 2x t3.medium (general) | $60 |
| RDS PostgreSQL | db.t3.small, single-AZ, 50GB | $50 |
| ElastiCache Redis | cache.t3.micro, 1 node | $15 |
| ALB | With WAF | $40 |
| NAT Gateway | 3 AZs | $35 |
| CloudWatch/Logs | 10GB ingestion | $10 |
| Secrets Manager | 10 secrets | $4 |
| Data Transfer | ~100GB out | $10 |
| **Total** | | **~$300** |

### Production Environment (~$1,100-1,500/month)

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| EKS Control Plane | Managed | $75 |
| EC2 Nodes | 3-5x t3.medium (general) + 2x t3.small (system) | $240-360 |
| RDS PostgreSQL | db.t3.medium, Multi-AZ, 100GB | $200 |
| ElastiCache Redis | cache.t3.small, 3-node cluster | $100 |
| ALB + WAF | With DDoS protection | $60 |
| NAT Gateway | 3 AZs | $70 |
| CloudWatch/Logs | 50GB ingestion | $30 |
| Secrets Manager | 20 secrets | $8 |
| Data Transfer | ~500GB out | $45 |
| Sentry | Team plan | $50 |
| **Subtotal (Infrastructure)** | | **~$878-998** |
| | | |
| **External Services** | | |
| Polygon.io | Starter plan | $200 |
| OpenAI API | ~1M tokens/month | $30-150 |
| Anthropic API | ~500K tokens/month | $15-80 |
| **Subtotal (External)** | | **~$245-430** |
| | | |
| **Total** | | **~$1,123-1,428** |

**Cost Optimization Tips:**
- Use Spot instances for non-critical workloads (50-70% savings)
- Enable Savings Plans for EC2 (up to 72% discount)
- Use S3 Intelligent-Tiering for log storage
- Monitor and right-size node instance types

## Troubleshooting

### Common Issues

**1. Pods stuck in Pending state**

```bash
# Check pod events
kubectl describe pod <pod-name> -n kianax

# Common causes:
# - Insufficient resources: Scale up node group
# - Image pull errors: Check ECR permissions
# - Node taints: Ensure pod tolerations match
```

**2. Cannot connect to RDS/Redis from pods**

```bash
# Verify security group rules
aws ec2 describe-security-groups --group-ids <rds-sg-id>

# Test connectivity from a pod
kubectl run -it --rm debug --image=alpine --restart=Never -- sh
apk add postgresql-client
psql $DATABASE_URL
```

**3. ALB not routing traffic**

```bash
# Check Ingress status
kubectl describe ingress api-gateway -n kianax

# Verify target group health
aws elbv2 describe-target-health --target-group-arn <tg-arn>

# Common issues:
# - Health check path incorrect
# - Security group blocking ALB → pods
# - Pods not ready
```

**4. High AWS costs**

```bash
# Check CloudWatch Logs retention (reduce from 30d to 7d)
aws logs put-retention-policy --log-group-name /aws/eks/kianax-staging/application --retention-in-days 7

# Check NAT Gateway usage (consider NAT instances for lower cost)
aws cloudwatch get-metric-statistics \
  --namespace AWS/NATGateway \
  --metric-name BytesOutToDestination \
  --dimensions Name=NatGatewayId,Value=<nat-id> \
  --start-time 2025-01-01T00:00:00Z \
  --end-time 2025-01-07T00:00:00Z \
  --period 86400 \
  --statistics Sum
```

### Useful Commands

```bash
# View all resources in namespace
kubectl get all -n kianax

# Tail logs from multiple pods
stern api-gateway -n kianax

# Execute command in pod
kubectl exec -it <pod-name> -n kianax -- sh

# Port forward to service
kubectl port-forward svc/api-gateway -n kianax 3001:3001

# View pod resource usage
kubectl top pods -n kianax

# View node resource usage
kubectl top nodes

# Restart deployment (rolling restart)
kubectl rollout restart deployment/api-gateway -n kianax

# View deployment history
kubectl rollout history deployment/api-gateway -n kianax

# Rollback deployment
kubectl rollout undo deployment/api-gateway -n kianax
```

### Emergency Procedures

**Rollback a bad deployment:**

```bash
# Via kubectl
kubectl rollout undo deployment/api-gateway -n kianax

# Via ArgoCD
argocd app rollback api-gateway <revision>
```

**Scale up quickly due to traffic spike:**

```bash
# Scale deployment manually
kubectl scale deployment api-gateway -n kianax --replicas=10

# Cluster autoscaler will add nodes automatically
```

**Database connection pool exhausted:**

```bash
# Increase max connections in RDS parameter group
aws rds modify-db-parameter-group \
  --db-parameter-group-name kianax-postgres-params \
  --parameters "ParameterName=max_connections,ParameterValue=200,ApplyMethod=immediate"

# Restart pods to reconnect with new pool size
kubectl rollout restart deployment/api-gateway -n kianax
```

## Next Steps

1. **Review [KUBERNETES.md](./KUBERNETES.md)** for K8s fundamentals and operations
2. **Review [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md)** for local testing workflows
3. **Review [MICROSERVICES.md](./MICROSERVICES.md)** for service splitting strategy
4. **Set up production environment** by repeating steps with `production` workspace
5. **Configure monitoring alerts** in Prometheus/AlertManager
6. **Implement disaster recovery** procedures (backup testing, runbooks)
7. **Security audit** (penetration testing, vulnerability scanning)

## Additional Resources

- [AWS EKS Best Practices](https://aws.github.io/aws-eks-best-practices/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Terraform AWS Modules](https://registry.terraform.io/namespaces/terraform-aws-modules)
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [Helm Documentation](https://helm.sh/docs/)
