# Deployment

Deploy Kianax to production with zero infrastructure management.

## Stack

**Frontend:** Vercel (Next.js)
**Backend:** Convex (serverless)
**Workflows:** trigger.dev (managed)

**Cost:** Free tier covers development + small production workloads.

## Prerequisites

- GitHub account (for Vercel deployment)
- Convex account (free at https://convex.dev)
- trigger.dev account (free at https://trigger.dev)

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

**In Vercel Dashboard:**
- `NEXT_PUBLIC_CONVEX_URL` - From Convex dashboard
- `CONVEX_DEPLOYMENT` - From Convex dashboard
- `TRIGGER_DEV_API_KEY` - From trigger.dev dashboard
- `OPENAI_API_KEY` - Your OpenAI API key

**In Convex (for backend):**
```bash
npx convex env set OPENAI_API_KEY sk-... --prod
npx convex env set TRIGGER_DEV_API_KEY sk-... --prod
```

### 4. Setup trigger.dev

1. Go to [trigger.dev](https://trigger.dev)
2. Create project
3. Get API key
4. Add to Convex environment (see step 3)

**trigger.dev auto-deploys workflows** when you create them via Convex actions.

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

### trigger.dev Dashboard

https://cloud.trigger.dev/yourproject

**Monitor:**
- Workflow execution history
- Task logs and retries
- Execution duration
- Failed runs

## Scaling

**Automatic:**
- Convex auto-scales functions and database
- Vercel auto-scales edge functions
- trigger.dev auto-scales workflow execution

**No manual scaling needed.**

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

**trigger.dev:**
- 1M task executions/month
- 10 concurrent workflows

### Production Pricing

**Convex:** ~$25/month for 5GB + 5M calls
**Vercel:** ~$20/month for Pro
**trigger.dev:** ~$50/month for Team

**Total:** ~$100/month for production app serving thousands of users.

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
