# Deployment

Deploy Kianax to production with zero infrastructure management.

## Stack

**Frontend:** Vercel (Next.js)
**Backend:** Convex (serverless)
**Workflows:** Temporal Cloud (managed)
**Workers:** TypeScript Workers (deployed on Vercel or separate server)

**Cost:** Free tier covers development + small production workloads.

## Prerequisites

- GitHub account (for Vercel deployment)
- Convex account (free at https://convex.dev)
- Temporal Cloud account (free at https://temporal.io)

## First Deployment

### 1. Deploy Convex Backend

```bash
# From project root
npx convex deploy

# Follow prompts to select production deployment
# Creates production Convex project automatically
```

**Result:** Convex backend deployed at `https://your-project.convex.cloud`

### 2. Deploy Frontend to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts:
# - Link to GitHub repository (recommended)
# - Select project settings
# - Add environment variables (see below)
```

**Or via GitHub:**
1. Push code to GitHub
2. Import repository on [vercel.com](https://vercel.com)
3. Vercel auto-deploys on every push to `main`

### 3. Configure Environment Variables

**In Vercel Dashboard (for Frontend):**
- `NEXT_PUBLIC_CONVEX_URL` - From Convex dashboard
- `CONVEX_DEPLOYMENT` - From Convex dashboard
- `OPENAI_API_KEY` - Your OpenAI API key

**In Convex (for backend):**
```bash
npx convex env set OPENAI_API_KEY sk-... --prod
npx convex env set TEMPORAL_ADDRESS your-namespace.tmprl.cloud:7233 --prod
npx convex env set TEMPORAL_NAMESPACE your-namespace --prod
```

**For Temporal Workers:**
```bash
# In workers/.env.production
TEMPORAL_ADDRESS=your-namespace.tmprl.cloud:7233
TEMPORAL_NAMESPACE=your-namespace
TEMPORAL_CLIENT_CERT=<base64-encoded-cert>
TEMPORAL_CLIENT_KEY=<base64-encoded-key>
CONVEX_URL=https://your-project.convex.cloud
```

### 4. Setup Temporal Cloud

1. Go to [cloud.temporal.io](https://cloud.temporal.io)
2. Create account and namespace
3. Generate client certificates (Settings → Certificates)
4. Download certificates (cert.pem and key.pem)
5. Add credentials to worker environment

**Namespace:** Each environment gets its own namespace (e.g., `kianax-prod`, `kianax-dev`)

### 5. Deploy Temporal Workers

Workers execute your workflow code and must run continuously.

**Option A: Deploy to Vercel (Serverless Functions)**

```bash
# Deploy worker as Vercel serverless function
cd workers
vercel deploy --prod

# Configure as background function (vercel.json)
{
  "functions": {
    "api/worker.ts": {
      "maxDuration": 300,
      "memory": 1024
    }
  }
}
```

**Option B: Deploy to Render/Railway (Long-Running Process)**

1. Create new service on [render.com](https://render.com) or [railway.app](https://railway.app)
2. Connect GitHub repository
3. Set start command: `bun run workers/index.ts`
4. Add environment variables (TEMPORAL_* credentials)
5. Deploy - workers auto-restart on code changes

**Option C: Self-Host (Docker)**

```bash
# Build worker container
docker build -t kianax-worker -f workers/Dockerfile .

# Run with credentials
docker run -d \
  --name kianax-worker \
  -e TEMPORAL_ADDRESS=... \
  -e TEMPORAL_NAMESPACE=... \
  -e TEMPORAL_CLIENT_CERT=... \
  -e TEMPORAL_CLIENT_KEY=... \
  kianax-worker
```

**Worker Auto-Scaling:**
- Temporal Workers can scale horizontally
- Deploy multiple instances for high availability
- Temporal Cloud handles load balancing automatically

## CI/CD Setup

### Automatic Deployments

**Vercel (Frontend):**
- Push to `main` → Auto-deploy to production
- Push to other branches → Preview deployments
- No configuration needed

**Convex (Backend):**
- Run `npx convex deploy` manually
- Or add to GitHub Actions:

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: npx convex deploy --cmd 'bun run build'
        env:
          CONVEX_DEPLOY_KEY: ${{ secrets.CONVEX_DEPLOY_KEY }}
```

Get `CONVEX_DEPLOY_KEY` from Convex dashboard → Settings → Deploy Keys.

## Monitoring

### Convex Dashboard

https://dashboard.convex.dev/yourproject

**Monitor:**
- Function execution logs
- Database queries and performance
- Real-time active connections
- Storage usage
- Error rates

### Vercel Dashboard

https://vercel.com/yourproject

**Monitor:**
- Deployment status
- Function invocations
- Edge network performance
- Build logs

### Temporal Cloud Dashboard

https://cloud.temporal.io/namespaces/your-namespace

**Monitor:**
- Workflow execution history
- Activity logs and retries
- Execution duration and status
- Failed workflows with full history replay
- Worker health and task queue metrics
- Real-time workflow state visualization

## Scaling

**Automatic:**
- Convex auto-scales functions and database
- Vercel auto-scales edge functions
- Temporal Cloud auto-scales workflow execution

**Worker Scaling:**
- Scale workers horizontally (deploy multiple instances)
- Temporal Cloud load-balances tasks automatically
- Workers can be added/removed without downtime
- Recommended: Start with 2-3 workers for HA

**No infrastructure management needed.**

## Costs

### Free Tiers

**Convex:**
- 1GB storage
- 1M function calls/month
- Unlimited real-time connections

**Vercel:**
- 100GB bandwidth
- 100 deployments/day
- Serverless function execution

**Temporal Cloud:**
- Free: 1M Actions/month (Actions = workflow starts + activity executions)
- Unlimited workflow executions
- Unlimited retention

**Workers Hosting (Render/Railway):**
- Free tier available (512MB RAM)
- Or ~$7/month for basic worker

### Production Pricing

**Convex:** ~$25/month for 5GB + 5M calls
**Vercel:** ~$20/month for Pro
**Temporal Cloud:** $200/month for Growth (25M actions)
**Workers (Render):** ~$20/month for 2 workers (HA setup)

**Total:** ~$265/month for production app serving thousands of users.

**Note:** Temporal Cloud pricing is higher, but provides enterprise-grade reliability, versioning, and observability. For a workflow platform, this is the core infrastructure worth investing in.

## Rollback

### Convex

```bash
# List deployments
npx convex deployments list

# Rollback to specific deployment
npx convex deployments rollback <deployment-id>
```

### Vercel

1. Go to Vercel dashboard
2. Click "Deployments"
3. Find previous working deployment
4. Click "..." → "Promote to Production"

**Instant rollback** - takes ~30 seconds.

## Secrets Management

**Never commit secrets to Git.**

**Convex secrets:**
```bash
npx convex env set SECRET_NAME value --prod
```

**Vercel env vars:**
- Add via Vercel dashboard
- Or use Vercel CLI: `vercel env add`

**trigger.dev secrets:**
- Add via trigger.dev dashboard
- Or use CLI

## Custom Domain

### Vercel

1. Go to Vercel project settings
2. Click "Domains"
3. Add your domain (e.g., `kianax.app`)
4. Update DNS records as instructed
5. SSL certificate auto-generated

### Convex

Uses Convex subdomain by default: `your-project.convex.cloud`

For custom domain, contact Convex support (Enterprise plan).

## Health Checks

**Convex:** Built-in health monitoring
**Vercel:** Automatic health checks on deploy
**trigger.dev:** Monitors workflow execution

**No manual health check endpoints needed.**

## Logs

### View Logs

```bash
# Convex logs
npx convex logs --prod

# Vercel logs
vercel logs

# trigger.dev logs
# View in dashboard
```

### Log Retention

- **Convex:** 30 days
- **Vercel:** 7 days (Hobby), 90 days (Pro)
- **trigger.dev:** 30 days

For longer retention, export to external service (Datadog, Sentry, etc.)

## Security

**Built-in:**
- HTTPS everywhere (automatic)
- DDoS protection (Vercel)
- Row-level security (Convex)
- Encrypted at rest (all services)

**Best Practices:**
- Rotate API keys quarterly
- Use environment variables for secrets
- Enable 2FA on all accounts
- Monitor error rates

## Troubleshooting

**Deployment fails:**
```bash
# Check build logs
vercel logs --follow

# Check Convex deployment
npx convex deployments list
```

**Functions timing out:**
- Check Convex dashboard for slow queries
- Optimize function code
- Consider caching

**Unexpected costs:**
- Check Convex dashboard usage
- Review Vercel bandwidth
- Monitor trigger.dev task count

---

**That's it!** Your app is live with:
- Auto-scaling infrastructure
- Real-time updates
- Zero server management
- Production monitoring
- One-command deployments

**Deploy command:** `npx convex deploy && vercel --prod`
