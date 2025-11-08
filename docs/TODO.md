# TODO - Current Tasks

**Last Updated:** 2025-01-07
**Current Phase:** Phase 0 - Foundation

> For long-term vision, see [ROADMAP.md](./ROADMAP.md)

---

## 🎯 This Week - Phase 0: Convex Setup

**Goal:** Get Convex working with real-time data flow

### Tasks

- [ ] **Convex Setup**
  - [ ] Run `npx convex dev`
  - [ ] Create Convex account (free)
  - [ ] Install dependencies: `npm install convex`
  - [ ] Wrap app with `ConvexProvider`

- [ ] **Define Schema**
  - [ ] Create `convex/schema.ts`
  - [ ] Define `workflows` table
  - [ ] Define `workflow_executions` table
  - [ ] Test schema compiles

- [ ] **First Functions**
  - [ ] Create `convex/workflows.ts`
  - [ ] Add `list` query (get user's workflows)
  - [ ] Add `create` mutation (create workflow)
  - [ ] Test with CLI: `npx convex run workflows:create`

- [ ] **Frontend Integration**
  - [ ] Create `app/workflows/page.tsx`
  - [ ] Use `useQuery(api.workflows.list)`
  - [ ] Use `useMutation(api.workflows.create)`
  - [ ] Add simple form to create workflow
  - [ ] Verify real-time updates (open 2 tabs)

**Done when:** Create workflow in tab 1, see it instantly in tab 2

---

## 📋 Next Week - Phase 1: Auth

**Goal:** Users can sign up, login, and have isolated data

### Tasks

- [ ] **Convex Auth**
  - [ ] Install `@convex-dev/auth`
  - [ ] Create `convex/auth.ts`
  - [ ] Configure password provider
  - [ ] Test auth in dashboard

- [ ] **Auth UI**
  - [ ] Create `app/login/page.tsx`
  - [ ] Create `app/register/page.tsx`
  - [ ] Add auth components from Convex Auth
  - [ ] Add sign out button

- [ ] **Protect Routes**
  - [ ] Update queries to check `ctx.auth.getUserIdentity()`
  - [ ] Filter all queries by `userId`
  - [ ] Redirect `/workflows` if not authenticated
  - [ ] Test user isolation

**Done when:** Two users can't see each other's workflows

---

## 🔮 Coming Soon

### Phase 2: Plugin SDK (Weeks 4-6)
- Define plugin interface
- Build plugin SDK package
- Create plugin registry in Convex

### Phase 3: Workflow Engine (Weeks 7-9)
- Integrate trigger.dev
- Build DAG compiler
- Execute first workflow

### Phase 4: Core Plugins (Weeks 10-13)
- Cron Trigger
- Stock Price Input
- AI Processor
- Email Output
- If/Else Logic

### Phase 5: AI Parsing (Weeks 14-17)
- Chat interface
- GPT-4 integration
- Natural language → workflow

---

## 🐛 Known Issues

*None yet*

---

## 💡 Ideas Backlog

- Workflow versioning
- Execution replay
- Workflow marketplace (templates + sharing) - See Phase 7 in ROADMAP.md
- Team workspaces
- Fork/remix workflows from marketplace
- Workflow analytics (execution stats, popular workflows)

---

## 📝 Notes

### Development Commands

```bash
# Start Convex backend
npx convex dev

# Start Next.js frontend
bun run dev

# Run Convex function
npx convex run workflows:list

# Deploy to production
npx convex deploy && vercel --prod
```

### Useful Links

- [Convex Docs](https://docs.convex.dev)
- [trigger.dev Docs](https://trigger.dev/docs)
- [Convex Dashboard](https://dashboard.convex.dev)

---

**Focus:** One phase at a time. Finish Phase 0 before starting Phase 1.
