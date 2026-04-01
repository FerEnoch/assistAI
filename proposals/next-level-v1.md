# AssistAI — Next Level: MVP to Production v1.0

## Metadata

| Property | Value |
|----------|-------|
| Proposal ID | PROP-2026-002 |
| Status | Draft |
| Created | 2026-03-31 |
| Predecessor | PROP-2026-001 (MVP Implementation) |
| Target | AssistAI v1.0 — Production-Ready |
| Timeline | 16 weeks (4 phases of ~4 weeks each) |

---

## 1. Executive Summary

AssistAI has completed its engineering MVP: 65 of 70 P0 tasks across 6 sprints, 178 tests passing, clean builds, and a working end-to-end loop from Google Drive ingestion to grounded inline completions in a Tiptap editor. The remaining 5 tasks are product/research (persona definition, user interviews, scope freeze, success metrics, BYO contract), not engineering.

**"Next level" means three things:**

1. **Production-ready**: The system can serve real users on real infrastructure with confidence — monitored, optimized, resilient, and deployable to a production environment beyond Docker Compose.
2. **Product-complete**: The gaps between "engineering works" and "users succeed" are filled — onboarding flows, document management, email delivery, IPFS support, legal presets, admin tooling.
3. **Scale-ready**: The architecture supports growth to hundreds of users, multiple verticals, and team workspaces without a rewrite.

The 5 remaining product tasks (A-001 through A-005) should be completed **before Phase 1 begins** — they define the beta persona, success metrics, and BYO contract that shape every production decision. This proposal assumes they are done.

---

## 2. Current State Assessment

### 2.1 Strengths

| Area | Assessment |
|------|------------|
| **Architecture** | Clean modular monolith with well-separated NestJS modules (`apps/api/src/` has 12 domain folders: auth, completion, document, health, observability, provider, retrieval, security, source, workspace, database, types). Shared packages (`@assistai/shared`, `@assistai/entities`) prevent cross-app coupling. |
| **Core loop** | End-to-end path works: Google Drive → ingestion (TXT/MD/DOCX/PDF) → chunking → embedding → pgvector retrieval → prompt assembly → SSE streaming → ghost-text in Tiptap editor → evidence panel. This is the product's entire value proposition. |
| **Security baseline** | CSRF (csrf-csrf), session management (express-session + connect-redis), AES-256-GCM credential encryption, SSRF protection (`packages/shared/src/security/ssrf.ts`), rate limiting (@nestjs/throttler), secret redaction in pino logs. Serious work, not checkbox security. |
| **Data model** | 12 TypeORM entities (`packages/entities/src/`) covering users, workspaces, sources, documents, chunks, completions, retrieval hits, model endpoints, editor sessions. Tenant isolation via `workspace_id` on every query-able entity. |
| **Observability** | Structured logging (pino via nestjs-pino), Prometheus metrics (prom-client), OpenTelemetry tracing stubs, analytics event service. Dashboard config exists in `packages/shared/src/observability/dashboard.ts`. |
| **CI** | GitHub Actions pipeline (`.github/workflows/ci.yml`) runs lint, typecheck, and test on every PR and push to main. Fast feedback. |
| **Testing** | 19 test files, 178 tests passing. Coverage spans auth guards, completion prompt assembly, retrieval service, document parsing, chunking, encryption, SSRF validation, env validation, provider routing. Unit-level, not integration — but the right units are tested. |
| **Developer experience** | Makefile with `make dev`, `make ci`, `make infra`, `make health`. Docker Compose for Postgres+Redis+IPFS. `.env.example` with clear documentation. pnpm workspaces with clean dependency graph. |

### 2.2 Weaknesses and Gaps

| Area | Issue | Impact | Evidence |
|------|-------|--------|----------|
| **No production deployment** | Docker Compose is dev-only. No production Dockerfiles optimized for size, no reverse proxy config, no managed DB/Redis setup, no CDN for static assets. | **Critical** — cannot ship to users | `docker-compose.yml` has `target: dev` for all services |
| **Web bundle size** | 636KB single chunk. No code splitting, no lazy loading, no tree-shaking optimization. Vite config (`apps/web/vite.config.ts`) has zero build optimizations. | **High** — slow initial load, especially on mobile/poor connections in LATAM markets | Missing `build.rollupOptions.output.manualChunks` in vite config |
| **No e2e tests** | Zero Playwright or Cypress tests. The entire user journey is untested end-to-end. Unit tests exist but can't catch integration failures. | **High** — 10 runtime fixes were needed to get servers running (enum mismatches, cookie-parser ordering, ESM/CJS issues, TypeORM entity loading, dotenv loading) — exactly the failures e2e tests catch |
| **Production Dockerfiles are naive** | `apps/api/Dockerfile` production stage copies ALL `node_modules` (~400MB+) instead of production-only deps. No `.dockerignore`. No multi-stage pruning. | **High** — bloated images, slow deploys, larger attack surface | Lines 27-29 of `apps/api/Dockerfile` |
| **No error boundary or recovery UI** | Web app has no React error boundaries. If a component throws, the entire app white-screens. | **Medium** — terrible UX for real users | `apps/web/src/App.tsx` — raw Routes with no error handling |
| **Inline styles everywhere** | Editor component (`apps/web/src/editor/AssistEditor.tsx`) uses 428 lines including massive `styles` object. No CSS modules, no design tokens, no Tailwind. | **Medium** — maintenance burden, inconsistent styling, no dark mode path | |
| **GraphQL not implemented** | Plan specified GraphQL for product data (`@nestjs/graphql@^13`, `@apollo/server@^4` are in `apps/api/package.json`), but only REST endpoints exist. | **Low for now** — REST works, but product data queries will get complex | Package installed but zero resolvers/schemas |
| **No real email delivery** | `apps/api/src/auth/email.service.ts` uses Resend SDK but likely stubbed for dev. No email templates, no delivery monitoring. | **High for production** — magic-link auth literally depends on email | `resend@^3.5.0` in deps but no template system |
| **Missing UI flows** | No settings page, no document library view, no source management beyond basic picker (`apps/web/src/components/` has only `DrivePicker.tsx` and `IndexingStatus.tsx`), no onboarding flow. | **High** — users need to manage their workspace | Only 4 pages: Login, Verify, Dashboard, Editor |
| **CORS hardcoded** | `app.enableCors({ origin: env.NODE_ENV === 'production' ? false : true })` — production disables CORS entirely, which breaks if frontend is on a different origin. | **Medium** — production CORS needs real origin allowlist | `apps/api/src/main.ts:116` |
| **No health check for external deps** | Health module exists but likely only checks app liveness, not Postgres, Redis, OpenAI, or Google connectivity. | **Medium** — silent failures in production | `apps/api/src/health/` |
| **5 product tasks incomplete** | A-001 through A-005 (persona, interviews, scope freeze, metrics, BYO contract) are the foundation for every product decision. | **Critical** — cannot make informed prioritization without these |

### 2.3 Technical Debt Summary

1. **ESM/CJS hybrid** — NestJS apps use CommonJS (nest build), web uses ESM (Vite). The `packages/shared` and `packages/entities` must compile to both. This was already a source of 10 runtime fixes. Needs a clear module resolution strategy.
2. **TypeORM entity loading** — Required runtime fixes for entity discovery. Production deployment needs explicit entity registration, not glob patterns.
3. **Missing `.dockerignore`** — No `.dockerignore` files mean `node_modules`, `dist`, and `.git` are sent to Docker build context unnecessarily.
4. **Root-level dependencies** — `@langchain/textsplitters`, `bullmq`, `googleapis`, `mammoth`, `pdfjs-dist` are in root `package.json` instead of their respective workspace packages. This breaks dependency isolation.
5. **Cookie-parser ordering** — Was a runtime fix. The session middleware, cookie-parser, and CSRF middleware have a critical ordering dependency documented only in code comments.
6. **No database connection pooling configuration** — TypeORM uses default pool settings. Production needs tuned pool size, timeout, and retry configuration.

---

## 3. Strategic Priorities (Ordered by Impact)

| Priority | Area | Rationale |
|----------|------|-----------|
| 1 | **Production deployment infrastructure** | Nothing else matters if you can't deploy. No deployment = no users. |
| 2 | **E2E testing** | The 10 runtime fixes prove the system has integration-level gaps that unit tests miss. Shipping without e2e is shipping blind. |
| 3 | **Performance optimization** | 636KB bundle + no code splitting = bad first impression. LATAM markets have variable connectivity. First load speed IS the first UX. |
| 4 | **Error handling & resilience** | No error boundaries, no graceful degradation, no retry UI. Production traffic WILL hit edge cases. |
| 5 | **Product completeness** | Real email, real OAuth, onboarding, document management — the gap between "demo" and "product." |
| 6 | **Admin & operations tooling** | P1 items that become critical the moment a real user has a problem you can't debug. |
| 7 | **i18n framework** | Spanish-first is correct, but hardcoded strings in components block any future language expansion. |
| 8 | **Advanced retrieval (reranking)** | Retrieval quality is the core differentiator. Cohere reranking was always the v2 plan. |
| 9 | **GraphQL for product data** | As planned in the original architecture. REST works for now but product data queries will get complex. |
| 10 | **Growth features** | Multi-user, second vertical, self-service — only after the single-user loop is proven. |

---

## 4. Phase 1: Production Readiness (Weeks 1-4)

**Goal**: The system can be deployed to a production environment, serve real users, and recover from failures without manual intervention.

### 4.1 Production Deployment Infrastructure

**Priority**: P0 — Blocks everything else

#### 4.1.1 Optimize Dockerfiles for production

**Current state**: All three Dockerfiles (`apps/api/Dockerfile`, `apps/worker/Dockerfile`, `apps/web/Dockerfile`) have multi-stage builds but the production stages are naive — they copy ALL `node_modules` from the build stage.

**Tasks**:

| Task | Description | Rationale |
|------|-------------|-----------|
| P1-001 | Add `.dockerignore` to project root | Prevents `.git`, `node_modules`, `dist`, `*.md` from bloating build context. Current builds send 500MB+ to Docker daemon unnecessarily. |
| P1-002 | Optimize API Dockerfile production stage | Use `pnpm deploy --prod` to create a minimal production node_modules. Target: <150MB final image vs current ~500MB+. Add non-root user (`USER node`). Add `HEALTHCHECK` instruction. |
| P1-003 | Optimize Worker Dockerfile production stage | Same as API. Additionally: the worker needs `pdfjs-dist` native binaries — verify they survive the prune step. |
| P1-004 | Optimize Web Dockerfile production stage | Already uses nginx:alpine (good). Add: gzip compression config, SPA fallback route (`try_files $uri /index.html`), security headers (CSP, X-Frame-Options, X-Content-Type-Options), cache-control for hashed assets. |
| P1-005 | Add `packages/entities` to API and Worker Dockerfiles | Both Dockerfiles copy `packages/shared` but NOT `packages/entities`. This works in dev because of volume mounts, but will fail in production builds. Critical fix. |

**Files affected**:
- `apps/api/Dockerfile`
- `apps/worker/Dockerfile`
- `apps/web/Dockerfile`
- New: `.dockerignore` (root)

#### 4.1.2 Production Docker Compose

**Tasks**:

| Task | Description | Rationale |
|------|-------------|-----------|
| P1-010 | Create `docker-compose.prod.yml` | Separate production compose file. Uses `target: production` for all app services. Removes volume mounts (no source code in prod). Sets resource limits. |
| P1-011 | Add Caddy reverse proxy service | Caddy for automatic HTTPS (Let's Encrypt), HTTP/2, request routing (web on `/`, api on `/api`, worker internal-only). Simpler than Nginx for small deployments. |
| P1-012 | Configure managed database connection | Environment variables for managed PostgreSQL (Supabase, Neon, or AWS RDS). Connection pooling via PgBouncer or native TypeORM pool config. SSL mode enforcement. |
| P1-013 | Configure managed Redis connection | Environment variables for managed Redis (Upstash, AWS ElastiCache, or Railway). TLS support. Connection retry with exponential backoff. |
| P1-014 | Add backup strategy documentation | Document automated backup schedule for PostgreSQL (pg_dump cron or managed snapshots). Redis AOF persistence config for production. Retention: 30 days per privacy policy. |

**Files affected**:
- New: `docker-compose.prod.yml`
- New: `infra/caddy/Caddyfile`
- `apps/api/src/database/database.module.ts` (pool config)

#### 4.1.3 Environment and secrets management

**Tasks**:

| Task | Description | Rationale |
|------|-------------|-----------|
| P1-020 | Create production env schema validation | Extend `packages/shared/src/config/env.schema.ts` to enforce production-specific requirements: `CREDENTIAL_ENCRYPTION_KEY` must not be all zeros, `SESSION_SECRET` must be 32+ chars of real entropy, `NODE_ENV=production` must be set. |
| P1-021 | Document secret rotation procedure | How to rotate `SESSION_SECRET`, `CSRF_SECRET`, `JWT_SECRET`, `CREDENTIAL_ENCRYPTION_KEY` without downtime. The `key_version` column in entities already supports this — document the workflow. |
| P1-022 | Production CORS configuration | Replace `origin: false` with explicit origin allowlist from env var (`ALLOWED_ORIGINS`). Support comma-separated list for staging + production domains. |

**Files affected**:
- `packages/shared/src/config/env.schema.ts`
- `apps/api/src/main.ts` (CORS config)
- New: `docs/secret-rotation.md`

### 4.2 Performance Optimization

**Priority**: P0 — 636KB single chunk is unacceptable for production

#### 4.2.1 Frontend bundle optimization

**Tasks**:

| Task | Description | Rationale |
|------|-------------|-----------|
| P1-030 | Add code splitting via React.lazy + Suspense | Lazy-load `EditorPage`, `DashboardPage`, and `VerifyPage`. Only `LoginPage` loads eagerly. Target: initial bundle <200KB. |
| P1-031 | Add manual chunks in Vite config | Split vendor chunks: `react` + `react-dom` (shared, cached), `@tiptap/*` (editor-only, loaded on demand), `react-router` (routing, small). Use `build.rollupOptions.output.manualChunks`. |
| P1-032 | Add Tiptap lazy loading | The editor and its extensions (`StarterKit`, `Placeholder`, `GhostText`) are the heaviest dependency. Only load when user navigates to `/editor`. |
| P1-033 | Enable Vite build compression | Add `vite-plugin-compression` for gzip + brotli pre-compression. Caddy serves pre-compressed files. Target: 636KB → <180KB transferred (gzip). |
| P1-034 | Add bundle size analysis to CI | Add `rollup-plugin-visualizer` and a CI step that reports bundle size on every PR. Fail CI if total bundle exceeds 250KB (gzipped). |

**Files affected**:
- `apps/web/vite.config.ts`
- `apps/web/src/App.tsx` (lazy routes)
- `apps/web/package.json` (new dev deps)
- `.github/workflows/ci.yml` (bundle check step)

#### 4.2.2 API performance baseline

**Tasks**:

| Task | Description | Rationale |
|------|-------------|-----------|
| P1-040 | Configure TypeORM connection pool | Set `extra: { max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 }` in `apps/api/src/database/database.module.ts`. Current defaults are inadequate for production. |
| P1-041 | Add Redis connection pool configuration | Configure `ioredis` with `maxRetriesPerRequest: 3`, `connectTimeout: 5000`, `commandTimeout: 5000` in `apps/api/src/main.ts`. |
| P1-042 | Add retrieval result caching | Cache recent retrieval results per editor session in Redis with 60s TTL. The plan (§8) explicitly calls for this. Reduces pgvector load during active editing. |
| P1-043 | Add completion response compression | Enable gzip compression for SSE responses. SSE text compresses well (60-70% reduction). |

**Files affected**:
- `apps/api/src/database/database.module.ts`
- `apps/api/src/main.ts`
- `apps/api/src/retrieval/retrieval.service.ts`
- `apps/api/src/completion/completion.controller.ts`

### 4.3 E2E Testing

**Priority**: P0 — The 10 runtime fixes prove integration testing is needed

#### 4.3.1 Playwright setup and critical path tests

**Tasks**:

| Task | Description | Rationale |
|------|-------------|-----------|
| P1-050 | Set up Playwright with project configuration | Install Playwright, configure for Chromium + Firefox. Add `apps/web/e2e/` directory. Configure base URL, storage state for authenticated tests. |
| P1-051 | Auth flow e2e test | Test: navigate to `/auth/login`, submit email, verify magic link redirect works, session cookie is set, redirect to dashboard. This is the #1 user-blocking flow. |
| P1-052 | Editor completion e2e test | Test: navigate to `/editor`, wait for session creation, type text, verify ghost-text appears (or timeout gracefully), Tab to accept. This is the core product loop. |
| P1-053 | Google Drive connection e2e test (mocked) | Test: navigate to dashboard, click connect Drive, verify OAuth redirect URL is correct, mock callback, verify source appears with status. |
| P1-054 | Add e2e to CI pipeline | Run Playwright tests in GitHub Actions after build passes. Use `docker compose` to spin up Postgres + Redis. Parallelize with existing lint/typecheck/test jobs. |

**Files affected**:
- New: `apps/web/e2e/auth.spec.ts`
- New: `apps/web/e2e/editor.spec.ts`
- New: `apps/web/e2e/drive.spec.ts`
- New: `apps/web/playwright.config.ts`
- `apps/web/package.json` (playwright dep)
- `.github/workflows/ci.yml` (e2e job)

### 4.4 Error Handling Hardening

**Priority**: P0 — Production traffic will hit every edge case

**Tasks**:

| Task | Description | Rationale |
|------|-------------|-----------|
| P1-060 | Add React error boundary | Wrap app in an error boundary that shows a Spanish-language error page instead of white screen. Log error to console. Offer "Recargar" button. |
| P1-061 | Add global NestJS exception filter | Catch unhandled exceptions, log with structured format, return consistent error shape `{ error: string, code: string, statusCode: number }`. Never leak stack traces in production. |
| P1-062 | Add health check for external dependencies | Extend `apps/api/src/health/` to check: Postgres connectivity, Redis ping, OpenAI API reachability (optional, degraded-mode). Return aggregate health status. |
| P1-063 | Add graceful shutdown handling | Handle SIGTERM/SIGINT in both API and worker processes. Drain active SSE connections, finish in-progress BullMQ jobs, close database connections. NestJS has `enableShutdownHooks()` — use it. |
| P1-064 | Add retry with exponential backoff for provider calls | `apps/api/src/provider/openrouter.adapter.ts` and `byo.adapter.ts` should retry on 429 and 5xx with exponential backoff (max 3 retries, 1s → 2s → 4s). |
| P1-065 | Add circuit breaker for embedding calls | The embedding service (`apps/worker/src/indexing/embedding/`) calls OpenAI API. If it fails 5 times in 60s, open the circuit and return a clear error to the ingestion pipeline instead of hammering a dead endpoint. |

**Files affected**:
- `apps/web/src/App.tsx` (error boundary)
- New: `apps/api/src/filters/global-exception.filter.ts`
- `apps/api/src/health/health.controller.ts`
- `apps/api/src/main.ts` (shutdown hooks)
- `apps/api/src/provider/openrouter.adapter.ts`
- `apps/api/src/provider/byo.adapter.ts`
- `apps/worker/src/indexing/embedding/`

### 4.5 Production Logging and Monitoring Pipeline

**Priority**: P0 — Cannot operate what you cannot observe

**Tasks**:

| Task | Description | Rationale |
|------|-------------|-----------|
| P1-070 | Configure pino for production output | JSON format in production (no pino-pretty). Add `serializers` for request/response. Ensure `redact` paths from `packages/shared/src/observability/logger.ts` are applied. |
| P1-071 | Add request correlation IDs | Generate UUID per request, propagate through all log entries and downstream service calls. Essential for debugging production issues across API ↔ Worker. |
| P1-072 | Set up Prometheus scrape endpoint | The metrics controller (`apps/api/src/observability/metrics.controller.ts`) exposes `/metrics`. Document Prometheus scrape config. Add Grafana dashboard JSON for: completion latency (p50/p95), retrieval latency, queue depth, error rates. |
| P1-073 | Set up Sentry for error tracking | Add `@sentry/node` to API and worker. Configure `beforeSend` to strip auth headers and credential fields (per backlog §2.5). Source maps upload in CI for readable stack traces. |
| P1-074 | Add alerting rules | Define Prometheus alerting rules: completion p95 > 3s, error rate > 5%, queue depth > 100, Redis connection failures, Postgres connection pool exhaustion. |

**Files affected**:
- `apps/api/src/main.ts`
- `packages/shared/src/observability/logger.ts`
- `apps/api/src/observability/metrics.controller.ts`
- New: `infra/grafana/dashboards/assistai.json`
- New: `infra/prometheus/prometheus.yml`
- New: `infra/prometheus/alerts.yml`

### Phase 1 Exit Criteria

- [ ] `docker compose -f docker-compose.prod.yml up` deploys all services behind Caddy with HTTPS
- [ ] Production Docker images are < 200MB each (API, Worker) and < 30MB (Web/nginx)
- [ ] Web initial bundle < 200KB (gzipped), total < 400KB with lazy chunks
- [ ] 4+ e2e tests pass in CI covering auth, editor, and Drive flows
- [ ] Health endpoint reports Postgres, Redis, and app status
- [ ] Graceful shutdown completes within 10s
- [ ] Sentry receives errors with readable stack traces
- [ ] Grafana dashboard shows completion latency, retrieval latency, queue depth

---

## 5. Phase 2: Product Completeness (Weeks 5-8)

**Goal**: Fill the gaps between "engineering demo" and "product that users can independently use."

### 5.1 Finish P1 Backlog Items

#### 5.1.1 IPFS Manual Import (E13: A-120, A-121, A-122)

**Tasks**:

| Task | Description | Rationale |
|------|-------------|-----------|
| P2-001 | Implement CID import endpoint | `POST /sources/ipfs/import` accepts a CID, fetches content via IPFS gateway, creates source and ingestion job. Docker Compose already has `ipfs` service (Kubo) in `profiles: [ipfs]`. |
| P2-002 | Add IPFS privacy warning UI | Per plan: UI must show clear warning about content permanence and require explicit confirmation before import. Spanish-language copy. |
| P2-003 | Add IPFS source status model | Track IPFS sources similarly to Drive: manual sync semantics, no auto-refresh, status tracking. Extends `content_sources` entity with `source_type: 'ipfs'`. |

**Files affected**:
- `apps/api/src/source/source.controller.ts`
- `apps/api/src/source/source.service.ts`
- New: `apps/api/src/source/ipfs.service.ts`
- `apps/web/src/components/` (new IpfsImport component)

#### 5.1.2 Legal Drafting Presets (E14: A-130, A-131, A-132)

**Tasks**:

| Task | Description | Rationale |
|------|-------------|-----------|
| P2-010 | Define Spanish legal drafting prompt preset | Create a system prompt template for neutral, formal legal drafting in Spanish. Store in `packages/shared/src/config/`. Include: formal register, third-person voice, conditional subjunctive preference, numbered clause formatting. |
| P2-011 | Add workspace-level default tone setting | Extend workspace entity with `default_tone` enum ('formal_legal', 'neutral', 'custom'). `apps/api/src/completion/prompt-assembler.ts` reads this. |
| P2-012 | Tune retrieval with internal evaluation corpus | Use sample Spanish legal documents to measure retrieval precision. Adjust chunking separators (the `;\n` for Spanish legal clauses is already in place). Document findings. |

**Files affected**:
- `packages/shared/src/config/completion.ts`
- `packages/entities/src/workspace.entity.ts`
- `apps/api/src/completion/prompt-assembler.ts`
- New: `docs/retrieval-tuning-results.md`

#### 5.1.3 Admin Support Tooling (E15: A-140, A-141, A-142)

**Tasks**:

| Task | Description | Rationale |
|------|-------------|-----------|
| P2-020 | Build internal source/indexing status view | API endpoint `GET /admin/sources?workspace=X` returns source state, last sync, failure reasons. Protected by admin guard. |
| P2-021 | Build provider validation failure view | API endpoint `GET /admin/provider-failures` shows: endpoint domain (URL redacted), error class (timeout, ssrf-blocked, auth-rejected, format-invalid, unreachable), HTTP status, timestamp. |
| P2-022 | Add manual requeue for failed jobs | API endpoint `POST /admin/jobs/:id/requeue` allows support to requeue recoverable ingestion failures. Integrates with BullMQ's `Job.retry()`. |
| P2-023 | Add Bull Board dashboard | Wire up `@bull-board/api` + `@bull-board/express` (already in backlog pin). Mount at `/admin/queues` behind auth guard. Critical for debugging ingestion pipeline issues. |

**Files affected**:
- New: `apps/api/src/admin/admin.module.ts`
- New: `apps/api/src/admin/admin.controller.ts`
- New: `apps/api/src/admin/admin.guard.ts`
- `apps/api/src/app.module.ts` (register AdminModule)

### 5.2 Real Email Delivery

**Tasks**:

| Task | Description | Rationale |
|------|-------------|-----------|
| P2-030 | Implement Resend email templates | Create HTML email templates for: magic-link login, Drive connection confirmation, indexing complete notification, account deletion confirmation. Spanish-language. Responsive design. |
| P2-031 | Add email delivery monitoring | Log send success/failure with Resend webhook callbacks. Track bounce rates. Alert on delivery failures. |
| P2-032 | Add email rate limiting | Prevent abuse: max 5 magic-link emails per email address per 15 minutes. Already partially covered by `@nestjs/throttler` rate limits on auth endpoints, but needs email-level dedup. |

**Files affected**:
- `apps/api/src/auth/email.service.ts`
- New: `apps/api/src/auth/email-templates/` (directory with templates)
- `apps/api/src/auth/auth.service.ts` (delivery tracking)

### 5.3 Real Google OAuth Credentials

**Tasks**:

| Task | Description | Rationale |
|------|-------------|-----------|
| P2-040 | Set up Google Cloud project for production | Create production Google Cloud project. Configure OAuth consent screen for external users. Submit for Google verification (required for `drive.file` scope on 100+ users). |
| P2-041 | Configure production OAuth redirect URIs | Update `GOOGLE_REDIRECT_URI` to production domain. Ensure callback URL in `apps/api/src/source/drive-oauth.service.ts` handles both dev and production URIs. |
| P2-042 | Document OAuth consent screen requirements | Google verification requires: privacy policy URL, terms of service URL, app homepage, authorized domains. Create checklist. |

**Files affected**:
- `apps/api/src/source/drive-oauth.service.ts`
- `.env.example` (document production values)
- New: `docs/google-oauth-setup.md`

### 5.4 Onboarding Flow UI

**Tasks**:

| Task | Description | Rationale |
|------|-------------|-----------|
| P2-050 | Create multi-step onboarding wizard | After first login: (1) Welcome + workspace name, (2) Connect Google Drive, (3) Select files for indexing, (4) Choose provider (OpenRouter or BYO), (5) Start editing. Per plan A-110. |
| P2-051 | Add onboarding progress tracking | Store onboarding step completion in workspace settings. Show progress indicator. Allow skipping steps. Resume where left off. |
| P2-052 | Add empty states for all pages | Dashboard with no sources → "Conectá tu primera fuente". Editor with no indexed documents → already exists in `EditorEmptyState()` but needs integration with actual source status. |

**Files affected**:
- New: `apps/web/src/pages/OnboardingPage.tsx`
- New: `apps/web/src/components/OnboardingWizard.tsx`
- `apps/web/src/App.tsx` (new route)
- `apps/web/src/pages/DashboardPage.tsx` (empty states)

### 5.5 Document Library / Management UI

**Tasks**:

| Task | Description | Rationale |
|------|-------------|-----------|
| P2-060 | Build document library page | List all indexed documents with: title, source, status (queued/processing/indexed/failed), last indexed date, chunk count. Filterable by source and status. |
| P2-061 | Add document detail view | Show document metadata, indexing history, chunk preview, error details for failures. |
| P2-062 | Add re-index action per document | Button to trigger re-indexing for a single document. Calls existing reindex trigger logic in `apps/api/src/retrieval/retrieval.service.ts`. |
| P2-063 | Add source disconnect with data cleanup | Confirm dialog in Spanish: "Esto eliminará todos los documentos y sugerencias asociados." Triggers deletion flow from `apps/api/src/workspace/deletion.service.ts`. |

**Files affected**:
- New: `apps/web/src/pages/DocumentsPage.tsx`
- New: `apps/web/src/components/DocumentDetail.tsx`
- `apps/api/src/document/` (list/detail endpoints)
- `apps/web/src/App.tsx` (new route)

### Phase 2 Exit Criteria

- [ ] IPFS import works end-to-end with privacy warning
- [ ] Legal drafting preset improves completion quality on Spanish legal corpus
- [ ] Admin can view source status, provider failures, and requeue jobs without DB access
- [ ] Magic-link emails delivered via Resend with HTML templates
- [ ] Google OAuth works with production credentials
- [ ] New users complete onboarding wizard in < 5 minutes
- [ ] Users can browse, search, and manage their indexed documents

---

## 6. Phase 3: Scale & Polish (Weeks 9-12)

**Goal**: Improve quality at scale — better retrieval, better API design, better performance under load, and accessibility compliance.

### 6.1 Multi-Language Support (i18n Framework)

**Tasks**:

| Task | Description | Rationale |
|------|-------------|-----------|
| P3-001 | Add i18n framework to web app | Install `react-i18next` + `i18next`. Extract all hardcoded Spanish strings from components (AssistEditor, StatusBar, empty states, error states, pages). Create `apps/web/src/locales/es.json` and `apps/web/src/locales/en.json`. |
| P3-002 | Add i18n to API error messages | Standardize API error responses with error codes. Client maps codes to localized messages. Removes need for API to return localized strings. |
| P3-003 | Add language preference in workspace settings | Already has `primary_language` on workspace entity. Wire it through the API to the frontend. Default: 'es'. |

**Files affected**:
- `apps/web/src/editor/AssistEditor.tsx` (extract strings)
- `apps/web/src/pages/*.tsx` (extract strings)
- New: `apps/web/src/locales/es.json`
- New: `apps/web/src/locales/en.json`
- New: `apps/web/src/i18n.ts`
- `apps/web/package.json` (react-i18next, i18next)

### 6.2 Advanced Retrieval — Cohere Reranking

**Tasks**:

| Task | Description | Rationale |
|------|-------------|-----------|
| P3-010 | Integrate Cohere rerank-multilingual-v3.0 | Per backlog §2.5: "V2 candidate: Cohere rerank-multilingual-v3.0". Add reranking step between pgvector retrieval and prompt assembly. Retrieve top-8, rerank to top-4. |
| P3-011 | Add reranking feature flag | Not all workspaces need reranking. Add workspace-level setting. Default: off (to control costs). Measure quality improvement. |
| P3-012 | Add retrieval quality evaluation suite | Create evaluation dataset: 50 Spanish legal queries with expected document hits. Measure precision@4 with and without reranking. Automate as a test suite. |

**Files affected**:
- `apps/api/src/retrieval/retrieval.service.ts` (reranking step)
- New: `apps/api/src/retrieval/cohere-reranker.ts`
- `packages/shared/src/config/` (reranking config)
- New: `tests/evaluation/retrieval-quality.test.ts`

### 6.3 GraphQL API for Product Data

**Tasks**:

| Task | Description | Rationale |
|------|-------------|-----------|
| P3-020 | Set up Apollo Server with NestJS code-first | The packages are already installed (`@nestjs/graphql@^13`, `@apollo/server@^4`). Configure GraphQL module in `apps/api/src/app.module.ts`. Code-first schema generation. |
| P3-021 | Add workspace resolver | `Query { workspace(id: ID!): Workspace }` — returns workspace settings, sources, document counts, indexing status. Replaces multiple REST calls with one query. |
| P3-022 | Add document/source resolvers | `Query { documents(workspaceId: ID!, filter: DocumentFilter): DocumentConnection }` with cursor-based pagination. Source resolver with nested sync runs. |
| P3-023 | Add subscription for indexing progress | `Subscription { indexingProgress(workspaceId: ID!): IndexingEvent }` — real-time updates for document processing status. Uses Redis PubSub. |
| P3-024 | Migrate frontend to GraphQL for product data | Replace `fetch` calls in Dashboard, Documents, and Settings pages with GraphQL queries. Keep completion endpoints on REST/SSE (per plan). |

**Files affected**:
- `apps/api/src/app.module.ts` (GraphQL module)
- New: `apps/api/src/graphql/` (resolvers, types)
- `apps/web/src/pages/DashboardPage.tsx` (GraphQL queries)
- `apps/web/package.json` (`@apollo/client`)

### 6.4 Performance Tuning

**Tasks**:

| Task | Description | Rationale |
|------|-------------|-----------|
| P3-030 | Add Redis caching layer for workspace settings | Workspace settings, provider config, and source status change infrequently. Cache in Redis with 5-minute TTL. Invalidate on mutation. |
| P3-031 | Optimize pgvector query plan | Run `EXPLAIN ANALYZE` on retrieval queries with production-size data (10K+ chunks). Tune `hnsw.ef_search`, consider partial indexes by workspace for large workspaces. |
| P3-032 | Add connection pooling with PgBouncer | For production: add PgBouncer between API/worker and PostgreSQL. Configure transaction-mode pooling. Reduces connection overhead significantly. |
| P3-033 | Implement SSE connection multiplexing | If multiple editor tabs are open, reuse a single SSE connection per user session. Reduces server-side connection count. |
| P3-034 | Add load testing baseline | Use k6 to establish performance baseline: 50 concurrent users, measure completion p50/p95, retrieval latency, error rate. Document results. Run monthly. |

**Files affected**:
- `apps/api/src/workspace/` (caching layer)
- New: `infra/pgbouncer/pgbouncer.ini`
- New: `tests/load/completion.k6.ts`
- New: `docs/performance-baseline.md`

### 6.5 Accessibility Audit (WCAG 2.1 AA)

**Tasks**:

| Task | Description | Rationale |
|------|-------------|-----------|
| P3-040 | Audit editor for keyboard navigation | Tiptap is generally accessible, but ghost-text, Tab-to-accept (conflicts with native Tab behavior), and evidence panel need explicit ARIA roles and keyboard flow. |
| P3-041 | Add ARIA labels to all interactive elements | Status bar, evidence panel toggle, onboarding wizard steps, form inputs, buttons. Currently zero ARIA attributes in the codebase. |
| P3-042 | Add color contrast compliance | Current ghost text color (`#6366f1` at 0.4 opacity on white) fails WCAG contrast ratio. Evidence panel colors need review. |
| P3-043 | Add screen reader support for completion flow | Announce when a suggestion appears, when it's accepted, when evidence is available. Use `aria-live` regions. |
| P3-044 | Add focus management for modals and panels | Evidence panel open/close should manage focus correctly. Escape key should close panel AND dismiss ghost text (handle conflict). |

**Files affected**:
- `apps/web/src/editor/AssistEditor.tsx`
- `apps/web/src/editor/EvidencePanel.tsx`
- `apps/web/src/editor/ghost-text-extension.ts`
- All page components

### Phase 3 Exit Criteria

- [ ] All UI strings extracted to i18n files (es.json, en.json)
- [ ] Cohere reranking improves precision@4 by measurable amount on eval set
- [ ] GraphQL endpoint serves workspace, document, and source queries
- [ ] Load test baseline documented with 50 concurrent users
- [ ] WCAG 2.1 AA audit passes with zero critical issues
- [ ] Completion p95 latency remains < 3s under load

---

## 7. Phase 4: Growth (Weeks 13-16)

**Goal**: Expand the product beyond single-user legal vertical to validate broader market fit.

### 7.1 Second Vertical Expansion

**Pre-requisite**: Per plan §10 — do NOT expand unless activation, latency, and week-4 retention meet target for two consecutive weeks.

**Tasks**:

| Task | Description | Rationale |
|------|-------------|-----------|
| P4-001 | Define journalist persona and prompt presets | Interview 4-6 Spanish-speaking journalists. Define top writing jobs. Create prompt presets for journalistic writing (inverted pyramid, source attribution, neutral tone). |
| P4-002 | Define public administration persona | Interview 4-6 public admin professionals. Define prompt presets for administrative writing (regulatory language, formal correspondence, procedural documentation). |
| P4-003 | Add vertical selection in onboarding | After workspace creation, ask "What type of writing do you do?" — Legal, Journalism, Public Administration, Other. Sets default prompt preset and workspace tone. |
| P4-004 | Vertical-specific chunking heuristics | Journalism uses shorter paragraphs, legal uses long clauses. Add vertical-aware chunking configuration: different separator lists, chunk sizes, overlap. |

**Files affected**:
- `packages/shared/src/config/completion.ts` (new presets)
- `apps/web/src/components/OnboardingWizard.tsx` (vertical selector)
- `apps/worker/src/indexing/chunker.ts` (configurable separators)

### 7.2 Team Workspaces (Multi-User)

**Tasks**:

| Task | Description | Rationale |
|------|-------------|-----------|
| P4-010 | Implement workspace invitations | Owner can invite users by email. Creates `workspace_members` record (entity already exists). Invited user gets magic-link to join. Roles: owner, editor, viewer. |
| P4-011 | Add workspace member management UI | List members, change roles, remove members. Owner-only actions. |
| P4-012 | Add workspace switching | Users who belong to multiple workspaces can switch between them. Workspace context stored in session. |
| P4-013 | Update tenant isolation for multi-user | All existing `userId` filters need to check workspace membership instead. Retrieval, completions, sources, documents — all scoped by `workspaceId` (already the case for most queries). |
| P4-014 | Add workspace-level usage quotas | Per-workspace limits on: indexed documents, monthly completions, stored chunks. Display usage in settings. Alert at 80% and 100%. |

**Files affected**:
- `packages/entities/src/workspace-member.entity.ts` (roles, invitation status)
- `apps/api/src/workspace/` (invitation, member management)
- New: `apps/web/src/pages/SettingsPage.tsx` (members tab)
- `apps/api/src/auth/guards/session.guard.ts` (workspace membership check)

### 7.3 API Rate Limiting Refinement

**Tasks**:

| Task | Description | Rationale |
|------|-------------|-----------|
| P4-020 | Add per-workspace rate limits | Current limits are per-user. Add workspace-level aggregate limits for team workspaces. Prevent one power user from exhausting the workspace's completion budget. |
| P4-021 | Add rate limit headers in responses | Return `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` on every response. Helps BYO integrations and power users. |
| P4-022 | Add adaptive rate limiting | Reduce rate limits during high load. If completion p95 > 3s, automatically reduce per-user limit from 60/min to 30/min until latency recovers. |

**Files affected**:
- `apps/api/src/security/throttler.guards.ts`
- `apps/api/src/completion/completion.controller.ts`

### 7.4 Self-Service Onboarding

**Tasks**:

| Task | Description | Rationale |
|------|-------------|-----------|
| P4-030 | Remove invite-only gate | Allow public signups with email verification. Add CAPTCHA (hCaptcha or Turnstile) to prevent bot signups. |
| P4-031 | Add free tier with upgrade path | Free tier: 1 workspace, 50 documents, 100 completions/day. Paid tier: unlimited. Track usage against limits. |
| P4-032 | Add Stripe integration for billing | Subscription management with Stripe. Webhook handler for payment events. Usage-based billing for completions beyond quota. |

**Files affected**:
- New: `apps/api/src/billing/` (Stripe integration)
- `apps/api/src/auth/auth.service.ts` (remove invite gate)
- `apps/web/src/pages/` (pricing page, billing settings)

### 7.5 Marketing Site / Landing Page

**Tasks**:

| Task | Description | Rationale |
|------|-------------|-----------|
| P4-040 | Create landing page | Separate from the app. Static site (Astro or Next.js static). Spanish-first. Hero section, feature highlights, demo video/GIF, CTA to sign up. |
| P4-041 | Add SEO optimization | Meta tags, Open Graph, structured data. Target keywords: "asistente de escritura legal", "autocompletado con IA para abogados", "escritura jurídica con inteligencia artificial". |
| P4-042 | Add analytics | Plausible or Fathom (privacy-friendly). Track: landing page visits, signup clicks, onboarding completion funnel. |

**Files affected**:
- New: `apps/landing/` (separate workspace project)
- `pnpm-workspace.yaml` (add landing)

### Phase 4 Exit Criteria

- [ ] At least one non-legal vertical has 5+ active users
- [ ] Team workspaces support 2+ members with role-based access
- [ ] Self-service signup works with email verification and CAPTCHA
- [ ] Billing integration handles free tier + paid upgrade
- [ ] Landing page ranks for primary Spanish keywords

---

## 8. Technical Debt

| Item | Severity | Location | Description | Remediation |
|------|----------|----------|-------------|-------------|
| Root-level dependencies | Medium | `package.json` (root) | `@langchain/textsplitters`, `bullmq`, `googleapis`, `mammoth`, `pdfjs-dist` are in root instead of their workspace packages | Move each to the correct `apps/*/package.json` or `packages/*/package.json` |
| ESM/CJS module hybrid | High | Across all packages | NestJS uses CJS (nest build), web uses ESM (Vite). Required 10+ runtime fixes. | Standardize: NestJS stays CJS, shared packages compile to both (`"exports"` field in package.json with `"import"` and `"require"` conditions) |
| Inline styles in React | Medium | `apps/web/src/editor/AssistEditor.tsx` | 100+ line styles object. No design system, no CSS modules, no Tailwind. | Adopt Tailwind CSS or CSS modules. Create design tokens for colors, spacing, typography. |
| No `.dockerignore` | Low | Root | Docker build context includes everything | Add `.dockerignore` excluding `.git`, `node_modules`, `dist`, `*.md`, `.env` |
| Missing entities in Dockerfiles | Critical | `apps/api/Dockerfile`, `apps/worker/Dockerfile` | Neither copies `packages/entities` — production builds will fail | Add `COPY packages/entities/package.json packages/entities/package.json` and `COPY packages/entities packages/entities` |
| TypeORM entity glob loading | Medium | `apps/api/src/database/data-source.ts` | May use glob patterns for entity discovery, which broke in runtime testing | Switch to explicit entity array imports |
| Unused GraphQL packages | Low | `apps/api/package.json` | `@nestjs/graphql@^13` and `@apollo/server@^4` installed but unused | Either implement GraphQL (Phase 3) or remove until needed |
| Cookie-parser ordering dependency | Low | `apps/api/src/main.ts` | Session → cookie-parser → CSRF ordering is critical and only documented in comments | Add integration test that verifies middleware ordering |
| No database seeding | Medium | `apps/api/src/database/` | No seed script for development or testing. Each developer manually creates data. | Add `make db-seed` command with sample user, workspace, source, documents |
| Console.log in main.ts | Low | `apps/api/src/main.ts:122` | Uses `console.log` instead of pino logger for startup message | Use the configured pino logger |

---

## 9. Risk Assessment

### 9.1 Technical Risks

| Risk | Probability | Impact | Phase | Mitigation |
|------|-------------|--------|-------|------------|
| Production deployment fails on first attempt | High | High | Phase 1 | Deploy to staging environment first. Use `docker-compose.prod.yml` on a test VM before real users. Budget 1 week for deployment debugging. |
| Retrieval quality insufficient for legal domain | Medium | Critical | Phase 2-3 | The evaluation suite (P3-012) is the early warning system. If precision@4 < 60%, invest in hybrid BM25+vector search before expanding verticals. |
| Google OAuth verification delays | High | High | Phase 2 | Google verification can take 4-6 weeks. Submit ASAP. Use test credentials for internal users in the meantime (100-user cap without verification). |
| Cohere reranking adds unacceptable latency | Medium | Medium | Phase 3 | Set strict timeout (200ms). If exceeded, fall back to pgvector-only results. Measure latency impact before enabling by default. |
| Team workspaces break tenant isolation | Medium | Critical | Phase 4 | This is the highest-risk feature. Requires: exhaustive automated tests (extend A-056), security review before launch, phased rollout (3 teams first). |
| Bundle size regresses | Medium | Medium | All phases | CI bundle size check (P1-034) prevents regressions. Any PR that increases gzipped bundle by > 10KB requires explicit approval. |
| SSE connection limits | Low | Medium | Phase 3 | Caddy has default limits. Configure: max 1000 concurrent SSE connections. If exceeded, return 503 with "try again" message. Monitor connection count in Prometheus. |

### 9.2 Product Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Beta users don't adopt | Medium | Critical | Complete A-001 through A-004 FIRST. Don't build Phase 2+ until beta signal exists. |
| Scope creep from beta feedback | High | High | Use the triage rubric (A-112). Only activation, trust, and retention blockers get prioritized. Everything else goes to backlog. |
| Wrong vertical for expansion | Medium | High | Per plan: don't expand until legal vertical meets targets for 2 consecutive weeks. |
| Pricing sensitivity in LATAM market | Medium | Medium | Free tier with generous limits. Price in USD but consider purchasing power parity. |

### 9.3 Operational Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| OpenAI embedding API outage | Medium | High | Add circuit breaker (P1-065). Queue jobs for retry. Consider fallback to local ONNX model (post-v1). |
| OpenRouter downtime | Medium | Medium | BYO endpoint is the natural fallback. Document: "if managed path is down, try your own endpoint." |
| Database corruption | Low | Critical | Automated backups (P1-014). Point-in-time recovery with managed PostgreSQL. |
| Credential leak | Low | Critical | AES-256-GCM encryption already in place. Add: automated secret scanning in CI (gitleaks or trufflehog). |

---

## 10. Success Metrics

### 10.1 Phase 1 (Production Readiness)

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Deployment time | < 10 minutes from git push to running | CI pipeline duration + Docker deployment |
| Production image size | API < 200MB, Worker < 200MB, Web < 30MB | `docker images` |
| Web initial load (3G) | < 3 seconds | Lighthouse performance score > 80 |
| Web bundle size (gzipped) | < 200KB initial, < 400KB total | CI bundle size check |
| E2E test coverage | 4+ critical flows | Playwright test count |
| Uptime | 99.5%+ | Health check monitoring |
| Error rate | < 1% of requests | Prometheus error_rate metric |

### 10.2 Phase 2 (Product Completeness)

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Onboarding completion rate | > 70% of signups | Analytics: signup → complete onboarding |
| Time to first completion | < 20 minutes | Analytics: signup → first accepted suggestion |
| Email delivery rate | > 98% | Resend dashboard |
| Admin response time | < 30 minutes for source/indexing issues | Time from user report to admin visibility |
| Feature completeness | All P1 items shipped | Backlog E13, E14, E15 status |

### 10.3 Phase 3 (Scale & Polish)

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Retrieval precision@4 | > 70% on eval set | Automated eval suite |
| Completion p50 latency | < 1.0s | Prometheus |
| Completion p95 latency | < 2.5s | Prometheus |
| Concurrent users supported | 50+ without degradation | k6 load test |
| WCAG compliance | AA level, 0 critical issues | Automated audit (axe-core) + manual review |

### 10.4 Phase 4 (Growth)

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Weekly active writers | 50+ | Analytics: users with 1+ editing session per week |
| Suggestion acceptance rate | 20-30% | Analytics: accepted / shown |
| Second vertical activation | 5+ users in non-legal vertical | Workspace vertical metadata |
| Team workspace adoption | 3+ teams with 2+ members | Workspace member counts |
| Self-service signup conversion | 15%+ of landing page visitors | Analytics: visit → signup |
| Revenue | First paying customer | Stripe dashboard |

### 10.5 North Star Metric

**Weekly Active Writers with at least one accepted grounded suggestion.**

This single metric captures:
1. The user came back (retention)
2. They actively wrote (engagement)
3. The system suggested something useful (quality)
4. They accepted it (trust)
5. It was grounded in their documents (differentiation)

If this number grows week-over-week, AssistAI is working.

---

## Appendix A: Task Summary by Phase

| Phase | Tasks | Estimated Effort | Priority |
|-------|-------|-----------------|----------|
| Phase 1: Production Readiness | P1-001 to P1-074 (30 tasks) | 4 weeks | P0 |
| Phase 2: Product Completeness | P2-001 to P2-063 (20 tasks) | 4 weeks | P0/P1 |
| Phase 3: Scale & Polish | P3-001 to P3-044 (18 tasks) | 4 weeks | P1 |
| Phase 4: Growth | P4-001 to P4-042 (18 tasks) | 4 weeks | P2 |
| **Total** | **~86 tasks** | **~16 weeks** | |

## Appendix B: Dependency Graph

```
Phase 1 (Foundation)
├── Production Deployment (P1-001 to P1-014)
│   ├── Blocks: everything in Phase 2+
│   └── Independent of: performance, e2e
├── Performance (P1-030 to P1-043)
│   ├── Blocks: load testing in Phase 3
│   └── Depends on: nothing
├── E2E Testing (P1-050 to P1-054)
│   ├── Blocks: confidence to ship
│   └── Depends on: nothing (can start Day 1)
├── Error Handling (P1-060 to P1-065)
│   └── Depends on: nothing
└── Monitoring (P1-070 to P1-074)
    └── Depends on: deployment infra (for Grafana/Prometheus)

Phase 2 (Product)
├── P1 Backlog Items (IPFS, Presets, Admin)
│   └── Depends on: Phase 1 deployment
├── Email (P2-030 to P2-032)
│   └── Depends on: nothing (can start in Phase 1)
├── OAuth (P2-040 to P2-042)
│   └── START ASAP — Google verification takes weeks
├── Onboarding (P2-050 to P2-052)
│   └── Depends on: email delivery, OAuth
└── Document Library (P2-060 to P2-063)
    └── Depends on: nothing

Phase 3 (Scale)
├── i18n (P3-001 to P3-003)
│   └── Independent
├── Reranking (P3-010 to P3-012)
│   └── Depends on: retrieval eval suite
├── GraphQL (P3-020 to P3-024)
│   └── Depends on: nothing (packages already installed)
├── Performance Tuning (P3-030 to P3-034)
│   └── Depends on: Phase 1 deployment, monitoring
└── Accessibility (P3-040 to P3-044)
    └── Independent

Phase 4 (Growth)
├── Second Vertical (P4-001 to P4-004)
│   └── Depends on: legal vertical hitting targets
├── Team Workspaces (P4-010 to P4-014)
│   └── Depends on: auth, workspace module maturity
├── Rate Limiting (P4-020 to P4-022)
│   └── Depends on: team workspaces
├── Self-Service (P4-030 to P4-032)
│   └── Depends on: onboarding, billing
└── Marketing (P4-040 to P4-042)
    └── Depends on: self-service signup
```

## Appendix C: Critical Path Items to Start Immediately

These items have long lead times or block multiple downstream tasks:

1. **Google OAuth verification (P2-040)** — Submit NOW. Takes 4-6 weeks. Blocks production Google Drive for > 100 users.
2. **`.dockerignore` and Dockerfile fixes (P1-001, P1-005)** — Quick wins that unblock all production Docker builds.
3. **Playwright setup (P1-050)** — Can start Day 1 and run in parallel with everything else.
4. **A-001 through A-005 (product tasks)** — Must complete before Phase 1 starts. They define the target user and success criteria.

---

*This proposal builds on `assistai-plan.md`, `assistai-backlog.md`, and `mvp-implementation-proposal.md`. All task IDs (P1-xxx through P4-xxx) are new and do not conflict with the original backlog IDs (A-xxx).*
