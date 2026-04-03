# AssistAI — Next Level Backlog (v1.0)

## 1. Purpose

This backlog translates `next-level-v1.md` (PROP-2026-002) into execution-ready tasks for the 16-week journey from engineering MVP to production v1.0.

**Pre-requisite before Phase 1**: Complete A-001 through A-005 (persona definition, user interviews, scope freeze, success metrics, BYO contract) from the original backlog. These define the beta persona and success criteria that shape every production decision.

**Critical path items to start immediately** (long lead times):
- `P2-040` — Submit Google OAuth for verification **NOW** (takes 4-6 weeks, blocks production Drive for > 100 users)
- `P1-001` + `P1-005` — `.dockerignore` + entities in Dockerfiles (quick wins that unblock all production Docker builds)
- `P1-050` — Playwright setup (can run in parallel from Day 1)

---

## 2. Backlog Conventions

### Priority levels

- `P0`: blocks everything else — do not proceed without this.
- `P1`: high value, can be parallelized with P0 work.
- `P2`: deferred until phase gate criteria are met.

### Workstreams

- `Infra` — deployment, Docker, Caddy, cloud services
- `Backend` — NestJS API, worker, database, queues
- `Frontend` — React web app, routing, components, pages
- `Testing` — unit, integration, e2e, load, accessibility
- `Product` — product research, UX, content, growth
- `Security` — auth, CORS, secrets, audit

### Status labels

- `Not started`
- `Ready`
- `In progress`
- `Blocked`
- `Done`

### Effort sizing (person-days)

- `S` — 0.5–1 day
- `M` — 2–3 days
- `L` — 4–5 days
- `XL` — 6–10 days

---

## 3. Technical Debt Register

These are known issues from the MVP that MUST be addressed in Phase 1 or they will compound. All are referenced in individual tasks below.

| ID | Item | Severity | Location |
|----|------|----------|----------|
| TD-001 | Root-level dependencies in wrong package.json | Medium | `package.json` root |
| TD-002 | ESM/CJS hybrid — 10 runtime fixes, will repeat | High | All packages |
| TD-003 | Inline styles in React (428-line styles object) | Medium | `apps/web/src/editor/AssistEditor.tsx` |
| TD-004 | No `.dockerignore` file | High | Root |
| TD-005 | Missing `packages/entities` in API + Worker Dockerfiles | **Critical** | Both Dockerfiles |
| TD-006 | TypeORM entity glob patterns in data-source.ts | Medium | `apps/api/src/database/data-source.ts` |
| TD-007 | GraphQL packages installed but zero resolvers | Low | `apps/api/package.json` |
| TD-008 | Cookie-parser ordering only documented in comments | Low | `apps/api/src/main.ts` |
| TD-009 | No database seed script | Medium | `apps/api/src/database/` |
| TD-010 | `console.log` in main.ts (line 122) | Low | `apps/api/src/main.ts` |

---

## 4. Phase 1: Production Readiness (Weeks 1–4)

**Goal**: Deploy to a real server, serve real users, and recover from failures without manual intervention.

**Phase 1 Exit Criteria**:
- [ ] `docker compose -f docker-compose.prod.yml up` works behind Caddy with HTTPS
- [ ] Production Docker images: API < 200MB, Worker < 200MB, Web/nginx < 30MB
- [ ] Web initial bundle (gzipped) < 200KB, total < 400KB with lazy chunks
- [ ] 4+ e2e tests pass in CI (auth, editor, Drive flows)
- [ ] Health endpoint reports Postgres, Redis, and app status
- [ ] Graceful shutdown completes within 10 seconds
- [ ] Sentry receives errors with readable stack traces
- [ ] Grafana dashboard shows completion latency, retrieval latency, queue depth

---

### Epic P1-E1: Production Docker Infrastructure

| Task | Description | Priority | Workstream | Effort | Status | Files |
|------|-------------|----------|------------|--------|--------|-------|
| P1-001 | Add `.dockerignore` to project root. Excludes `.git`, `node_modules`, `dist`, `*.md`, `.env`, `*.tsbuildinfo`. Current builds send 500MB+ to Docker daemon. | P0 | Infra | S | Not started | `.dockerignore` (new) |
| P1-002 | Optimize API Dockerfile production stage. Use `pnpm deploy --prod` for minimal node_modules (<150MB). Add non-root `USER node`. Add `HEALTHCHECK`. | P0 | Infra | M | Not started | `apps/api/Dockerfile` |
| P1-003 | Optimize Worker Dockerfile production stage. Same as P1-002. Verify `pdfjs-dist` native binaries survive the prune step. | P0 | Infra | M | Not started | `apps/worker/Dockerfile` |
| P1-004 | Optimize Web Dockerfile production stage. Add: nginx gzip compression, SPA fallback (`try_files $uri /index.html`), security headers (CSP, X-Frame-Options, X-Content-Type-Options), cache-control for hashed assets. | P0 | Infra | M | Not started | `apps/web/Dockerfile` |
| P1-005 | Add `packages/entities` to API and Worker Dockerfiles. **Critical fix**: both Dockerfiles copy `packages/shared` but NOT `packages/entities`. Works in dev (volume mounts), will fail in production builds. (TD-005) | P0 | Infra | S | Not started | `apps/api/Dockerfile`, `apps/worker/Dockerfile` |

---

### Epic P1-E2: Production Docker Compose and Services

| Task | Description | Priority | Workstream | Effort | Status | Files |
|------|-------------|----------|------------|--------|--------|-------|
| P1-010 | Create `docker-compose.prod.yml`. Uses `target: production` for all app services. No volume mounts. Resource limits. Separate from dev compose. | P0 | Infra | M | Not started | `docker-compose.prod.yml` (new) |
| P1-011 | Add Caddy reverse proxy service. Automatic HTTPS (Let's Encrypt), HTTP/2, routing: web on `/`, api on `/api`, worker internal-only. | P0 | Infra | M | Not started | `infra/caddy/Caddyfile` (new) |
| P1-012 | Configure managed database connection. Env vars for Supabase/Neon/AWS RDS. Connection pooling config. SSL mode enforcement. | P0 | Backend | M | Not started | `apps/api/src/database/database.module.ts` |
| P1-013 | Configure managed Redis connection. Env vars for Upstash/ElastiCache/Railway. TLS support. Connection retry with exponential backoff. | P0 | Backend | M | Not started | `apps/api/src/main.ts` |
| P1-014 | Document backup strategy. PostgreSQL: pg_dump cron or managed snapshots. Redis AOF persistence. Retention: 30 days. | P1 | Infra | S | Not started | `docs/backup-strategy.md` (new) |

---

### Epic P1-E3: Environment and Secrets Management

| Task | Description | Priority | Workstream | Effort | Status | Files |
|------|-------------|----------|------------|--------|--------|-------|
| P1-020 | Extend env schema validation for production-specific requirements. `CREDENTIAL_ENCRYPTION_KEY` must not be all zeros. `SESSION_SECRET` must be 32+ chars of real entropy. `NODE_ENV=production` required. | P0 | Security | M | Not started | `packages/shared/src/config/env.schema.ts` |
| P1-021 | Document secret rotation procedure. How to rotate `SESSION_SECRET`, `CSRF_SECRET`, `JWT_SECRET`, `CREDENTIAL_ENCRYPTION_KEY` without downtime. The `key_version` column already supports this. | P1 | Security | S | Not started | `docs/secret-rotation.md` (new) |
| P1-022 | Fix CORS configuration. Replace `origin: false` with explicit allowlist from env var `ALLOWED_ORIGINS` (comma-separated). Supports staging + production domains. | P0 | Security | S | Not started | `apps/api/src/main.ts` |

---

### Epic P1-E4: Frontend Bundle Optimization

| Task | Description | Priority | Workstream | Effort | Status | Files |
|------|-------------|----------|------------|--------|--------|-------|
| P1-030 | Add code splitting via `React.lazy` + `Suspense`. Lazy-load `EditorPage`, `DashboardPage`, `VerifyPage`. Only `LoginPage` loads eagerly. Target: initial bundle < 200KB. | P0 | Frontend | M | Not started | `apps/web/src/App.tsx` |
| P1-031 | Add manual chunks in Vite config. Split vendor chunks: `react`+`react-dom` (shared, cached), `@tiptap/*` (editor-only), `react-router` (small). Use `build.rollupOptions.output.manualChunks`. | P0 | Frontend | M | Not started | `apps/web/vite.config.ts` |
| P1-032 | Add Tiptap lazy loading. Editor + extensions (`StarterKit`, `Placeholder`, `GhostText`) are the heaviest dependency. Load only when user navigates to `/editor`. | P0 | Frontend | M | Not started | `apps/web/src/App.tsx`, `apps/web/src/pages/EditorPage.tsx` |
| P1-033 | Enable Vite build compression. Add `vite-plugin-compression` for gzip + brotli pre-compression. Caddy serves pre-compressed files. Target: 636KB → < 180KB transferred. | P1 | Frontend | S | Not started | `apps/web/vite.config.ts`, `apps/web/package.json` |
| P1-034 | Add bundle size analysis to CI. `rollup-plugin-visualizer` + CI step reporting bundle size per PR. Fail CI if total gzipped bundle exceeds 250KB. | P1 | Infra | M | Not started | `.github/workflows/ci.yml`, `apps/web/vite.config.ts` |

---

### Epic P1-E5: API Performance Baseline

| Task | Description | Priority | Workstream | Effort | Status | Files |
|------|-------------|----------|------------|--------|--------|-------|
| P1-040 | Configure TypeORM connection pool. Set `extra: { max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 }`. Current defaults are inadequate for production load. | P0 | Backend | S | Not started | `apps/api/src/database/database.module.ts` |
| P1-041 | Add Redis connection pool configuration. Configure `redis` client with connection options. | P0 | Backend | S | Not started | `apps/api/src/main.ts` |
| P1-042 | Add retrieval result caching. Cache retrieval results per editor session in Redis with 60s TTL. Reduces pgvector load during active editing. | P1 | Backend | M | Not started | `apps/api/src/retrieval/retrieval.service.ts` |
| P1-043 | Enable gzip compression for API responses (including SSE). SSE text compresses 60-70%. Use `compression` middleware. | P1 | Backend | S | Not started | `apps/api/src/main.ts`, `apps/api/package.json` |

---

### Epic P1-E6: E2E Testing (Playwright)

| Task | Description | Priority | Workstream | Effort | Status | Files |
|------|-------------|----------|------------|--------|--------|-------|
| P1-050 | Set up Playwright. Install, configure for Chromium + Firefox. Add `apps/web/e2e/` directory. Configure base URL, storage state for authenticated tests. | P0 | Testing | M | Not started | `apps/web/playwright.config.ts` (new), `apps/web/package.json` |
| P1-051 | Auth flow e2e test. Navigate to `/auth/login`, submit email, verify magic-link redirect, session cookie set, redirect to dashboard. | P0 | Testing | M | Not started | `apps/web/e2e/auth.spec.ts` (new) |
| P1-052 | Editor completion e2e test. Navigate to `/editor`, wait for session creation, type text, verify ghost-text appears (or timeout gracefully), Tab to accept. | P0 | Testing | L | Not started | `apps/web/e2e/editor.spec.ts` (new) |
| P1-053 | Google Drive connection e2e test (mocked). Navigate to dashboard, click connect Drive, verify OAuth redirect URL is correct, mock callback, verify source appears with status. | P1 | Testing | M | Not started | `apps/web/e2e/drive.spec.ts` (new) |
| P1-054 | Add e2e to CI pipeline. Run Playwright tests in GitHub Actions after build passes. Use `docker compose` to spin up Postgres + Redis. Parallelize with existing jobs. | P0 | Infra | M | Not started | `.github/workflows/ci.yml` |

---

### Epic P1-E7: Error Handling and Resilience

| Task | Description | Priority | Workstream | Effort | Status | Files |
|------|-------------|----------|------------|--------|--------|-------|
| P1-060 | Add React error boundary. Wrap app in an error boundary showing a Spanish-language error page instead of white screen. Log error. Offer "Recargar" button. | P0 | Frontend | S | Not started | `apps/web/src/App.tsx` |
| P1-061 | Add global NestJS exception filter. Catch unhandled exceptions, structured logging, consistent error shape `{ error, code, statusCode }`. Never leak stack traces in production. | P0 | Backend | M | Not started | `apps/api/src/filters/global-exception.filter.ts` (new) |
| P1-062 | Extend health check for external dependencies. Check: Postgres connectivity, Redis ping, OpenAI API reachability (optional, degraded-mode). Return aggregate health status. | P0 | Backend | M | Not started | `apps/api/src/health/health.controller.ts` |
| P1-063 | Add graceful shutdown handling. Handle SIGTERM/SIGINT in API and worker. Drain SSE connections, finish in-progress BullMQ jobs, close DB connections. Use NestJS `enableShutdownHooks()`. | P0 | Backend | M | Not started | `apps/api/src/main.ts`, `apps/worker/src/main.ts` |
| P1-064 | Add retry with exponential backoff for provider calls. `openrouter.adapter.ts` and `byo.adapter.ts`: retry on 429 and 5xx, max 3 retries, 1s → 2s → 4s. | P1 | Backend | M | Not started | `apps/api/src/provider/openrouter.adapter.ts`, `apps/api/src/provider/byo.adapter.ts` |
| P1-065 | Add circuit breaker for embedding service calls. If OpenAI embedding fails 5 times in 60s, open the circuit and return clear error to ingestion pipeline instead of hammering a dead endpoint. | P1 | Backend | M | Not started | `apps/worker/src/indexing/embedding/` |

---

### Epic P1-E8: Production Logging and Monitoring

| Task | Description | Priority | Workstream | Effort | Status | Files |
|------|-------------|----------|------------|--------|--------|-------|
| P1-070 | Configure pino for production output. JSON format (no pino-pretty in prod). Add `serializers` for request/response. Ensure `redact` paths from `packages/shared` are applied. Fix `console.log` (TD-010). | P0 | Backend | S | Not started | `apps/api/src/main.ts`, `packages/shared/src/observability/logger.ts` |
| P1-071 | Add request correlation IDs. Generate UUID per request, propagate through all log entries and downstream calls. Essential for debugging issues across API ↔ Worker. | P1 | Backend | M | Not started | `apps/api/src/main.ts` |
| P1-072 | Set up Prometheus + Grafana. Document Prometheus scrape config. Add Grafana dashboard JSON for: completion latency (p50/p95), retrieval latency, queue depth, error rates. | P0 | Infra | L | Not started | `infra/grafana/dashboards/assistai.json` (new), `infra/prometheus/prometheus.yml` (new) |
| P1-073 | Set up Sentry. Add `@sentry/node` to API and worker. `beforeSend` strips auth headers and credential fields. Source maps upload in CI. | P0 | Backend | M | Not started | `apps/api/src/main.ts`, `apps/worker/src/main.ts`, `.github/workflows/ci.yml` |
| P1-074 | Add alerting rules. Prometheus alerts: completion p95 > 3s, error rate > 5%, queue depth > 100, Redis connection failures, Postgres pool exhaustion. | P1 | Infra | M | Not started | `infra/prometheus/alerts.yml` (new) |

---

## 5. Phase 2: Product Completeness (Weeks 5–8)

**Goal**: Fill the gap between "engineering demo" and "product that users can independently use."

**Phase 2 Exit Criteria**:
- [ ] IPFS import works end-to-end with Spanish-language privacy warning
- [ ] Legal drafting preset measurably improves completion quality on Spanish legal corpus
- [ ] Admin can view source status, provider failures, and requeue jobs without direct DB access
- [ ] Magic-link emails delivered via Resend with HTML templates in Spanish
- [ ] Google OAuth works with production credentials (Google verification complete)
- [ ] New users complete onboarding wizard in < 5 minutes
- [ ] Users can browse, search, and manage their indexed documents

---

### Epic P2-E1: IPFS Manual Import (from original backlog E13)

| Task | Description | Priority | Workstream | Effort | Status | Files |
|------|-------------|----------|------------|--------|--------|-------|
| P2-001 | Implement CID import endpoint. `POST /sources/ipfs/import` accepts a CID, fetches content via IPFS gateway, creates source and ingestion job. Docker Compose already has `ipfs` service in `profiles: [ipfs]`. | P1 | Backend | L | Not started | `apps/api/src/source/source.controller.ts`, `apps/api/src/source/ipfs.service.ts` (new) |
| P2-002 | Add IPFS privacy warning UI. Clear warning about content permanence. Require explicit confirmation before import. Spanish-language copy. | P1 | Frontend | M | Not started | `apps/web/src/components/IpfsImport.tsx` (new) |
| P2-003 | Add IPFS source status model. Track IPFS sources similarly to Drive: manual sync semantics, no auto-refresh, status tracking. Extends `content_sources` with `source_type: 'ipfs'`. | P1 | Backend | M | Not started | `apps/api/src/source/source.service.ts` |

---

### Epic P2-E2: Legal Drafting Presets (from original backlog E14)

| Task | Description | Priority | Workstream | Effort | Status | Files |
|------|-------------|----------|------------|--------|--------|-------|
| P2-010 | Define Spanish legal drafting prompt preset. Formal register, third-person voice, conditional subjunctive preference, numbered clause formatting. Store in `packages/shared/src/config/`. | P1 | Product | M | Not started | `packages/shared/src/config/completion.ts` |
| P2-011 | Add workspace-level default tone setting. Extend workspace entity with `default_tone` enum (`'formal_legal'`, `'neutral'`, `'custom'`). Wire through `prompt-assembler.ts`. | P1 | Backend | M | Not started | `packages/entities/src/workspace.entity.ts`, `apps/api/src/completion/prompt-assembler.ts` |
| P2-012 | Tune retrieval with internal evaluation corpus. Use sample Spanish legal documents, measure retrieval precision. Adjust chunking if needed. Document findings. | P1 | Data | L | Not started | `docs/retrieval-tuning-results.md` (new) |

---

### Epic P2-E3: Admin and Support Tooling (from original backlog E15)

| Task | Description | Priority | Workstream | Effort | Status | Files |
|------|-------------|----------|------------|--------|--------|-------|
| P2-020 | Build internal source/indexing status view. `GET /admin/sources?workspace=X` returns source state, last sync, failure reasons. Protected by admin guard. | P1 | Backend | M | Not started | `apps/api/src/admin/admin.controller.ts` (new), `apps/api/src/admin/admin.module.ts` (new) |
| P2-021 | Build provider validation failure view. `GET /admin/provider-failures` — error class, HTTP status, timestamp. URL redacted per spec. | P1 | Backend | M | Not started | `apps/api/src/admin/admin.controller.ts` |
| P2-022 | Add manual requeue for failed jobs. `POST /admin/jobs/:id/requeue` — support can retry recoverable ingestion failures. Uses BullMQ `Job.retry()`. | P1 | Backend | M | Not started | `apps/api/src/admin/admin.controller.ts` |
| P2-023 | Add Bull Board dashboard. Wire `@bull-board/api` + `@bull-board/express` (already pinned in original backlog). Mount at `/admin/queues` behind admin guard. | P1 | Backend | M | Not started | `apps/api/src/app.module.ts`, `apps/api/src/admin/` |

---

### Epic P2-E4: Real Email Delivery

| Task | Description | Priority | Workstream | Effort | Status | Files |
|------|-------------|----------|------------|--------|--------|-------|
| P2-030 | Implement Resend email templates. HTML templates for: magic-link login, Drive connection confirmation, indexing complete notification, account deletion. Spanish-language. Responsive. | P0 | Backend | L | Not started | `apps/api/src/auth/email.service.ts`, `apps/api/src/auth/email-templates/` (new) |
| P2-031 | Add email delivery monitoring. Log send success/failure via Resend webhook callbacks. Track bounce rates. Alert on delivery failures. | P1 | Backend | M | Not started | `apps/api/src/auth/auth.service.ts` |
| P2-032 | Add email rate limiting per address. Max 5 magic-link emails per email address per 15 minutes. Dedup at email level (beyond existing endpoint rate limiting). | P0 | Security | M | Not started | `apps/api/src/auth/auth.service.ts` |

---

### Epic P2-E5: Production Google OAuth

| Task | Description | Priority | Workstream | Effort | Status | Files |
|------|-------------|----------|------------|--------|--------|-------|
| P2-040 | Set up Google Cloud project for production. OAuth consent screen for external users. **Submit for Google verification NOW** (takes 4-6 weeks, required for `drive.file` scope on 100+ users). | P0 | Product | M | Not started | External setup |
| P2-041 | Configure production OAuth redirect URIs. Update `GOOGLE_REDIRECT_URI` to production domain. Handle both dev and production URIs in callback. | P0 | Backend | S | Not started | `apps/api/src/source/drive-oauth.service.ts`, `.env.example` |
| P2-042 | Document OAuth consent screen requirements. Checklist: privacy policy URL, ToS URL, app homepage, authorized domains. | P1 | Product | S | Not started | `docs/google-oauth-setup.md` (new) |

---

### Epic P2-E6: Onboarding Flow UI

| Task | Description | Priority | Workstream | Effort | Status | Files |
|------|-------------|----------|------------|--------|--------|-------|
| P2-050 | Create multi-step onboarding wizard. Steps: (1) Welcome + workspace name, (2) Connect Google Drive, (3) Select files, (4) Choose provider (OpenRouter or BYO), (5) Start editing. Requires: email delivery + OAuth. | P0 | Frontend | XL | Not started | `apps/web/src/pages/OnboardingPage.tsx` (new), `apps/web/src/components/OnboardingWizard.tsx` (new), `apps/web/src/App.tsx` |
| P2-051 | Add onboarding progress tracking. Store onboarding step in workspace settings. Show progress indicator. Allow skipping. Resume where left off. | P1 | Frontend | M | Not started | `apps/web/src/components/OnboardingWizard.tsx` |
| P2-052 | Add empty states for all pages. Dashboard with no sources → "Conectá tu primera fuente". Editor with no indexed documents → integrate existing `EditorEmptyState()` with actual source status. | P1 | Frontend | M | Not started | `apps/web/src/pages/DashboardPage.tsx` |

---

### Epic P2-E7: Document Library / Management UI

| Task | Description | Priority | Workstream | Effort | Status | Files |
|------|-------------|----------|------------|--------|--------|-------|
| P2-060 | Build document library page. List all indexed documents with: title, source, status (queued/processing/indexed/failed), last indexed date, chunk count. Filterable by source and status. | P0 | Frontend | L | Not started | `apps/web/src/pages/DocumentsPage.tsx` (new), `apps/web/src/App.tsx` |
| P2-061 | Add document detail view. Document metadata, indexing history, chunk preview, error details for failures. | P1 | Frontend | M | Not started | `apps/web/src/components/DocumentDetail.tsx` (new) |
| P2-062 | Add re-index action per document. Button to trigger re-indexing for a single document. Calls existing reindex trigger in `retrieval.service.ts`. | P1 | Frontend | S | Not started | `apps/api/src/document/` (list/detail endpoints) |
| P2-063 | Add source disconnect with data cleanup. Confirm dialog in Spanish: "Esto eliminará todos los documentos y sugerencias asociados." Triggers deletion flow in `deletion.service.ts`. | P1 | Frontend | M | Not started | `apps/web/src/pages/DashboardPage.tsx`, `apps/api/src/workspace/deletion.service.ts` |

---

## 6. Phase 3: Scale and Polish (Weeks 9–12)

**Goal**: Improve quality at scale — better retrieval, better API design, better performance under load, and accessibility compliance.

**Phase 3 Exit Criteria**:
- [ ] All UI strings extracted to i18n files (es.json, en.json)
- [ ] Cohere reranking measurably improves precision@4 on Spanish legal eval set
- [ ] GraphQL endpoint serves workspace, document, and source queries
- [ ] Load test baseline documented with 50 concurrent users
- [ ] WCAG 2.1 AA audit passes with zero critical issues
- [ ] Completion p95 latency < 3s under load

---

### Epic P3-E1: Multi-Language Support (i18n Framework)

| Task | Description | Priority | Workstream | Effort | Status | Files |
|------|-------------|----------|------------|--------|--------|-------|
| P3-001 | Add i18n framework. Install `react-i18next` + `i18next`. Extract ALL hardcoded Spanish strings from components (AssistEditor, StatusBar, empty states, error states, all pages). Create `es.json` and `en.json`. | P1 | Frontend | L | Not started | `apps/web/src/i18n.ts` (new), `apps/web/src/locales/es.json` (new), `apps/web/src/locales/en.json` (new), `apps/web/package.json` |
| P3-002 | Standardize API error codes. API returns codes instead of localized strings. Client maps codes to localized messages. | P1 | Backend | M | Not started | `apps/api/src/filters/global-exception.filter.ts` |
| P3-003 | Wire language preference through API. `primary_language` already on workspace entity. Expose via API and connect to frontend i18n. Default: `'es'`. | P2 | Backend | S | Not started | `apps/api/src/workspace/`, `apps/web/src/` |

---

### Epic P3-E2: Advanced Retrieval — Cohere Reranking

| Task | Description | Priority | Workstream | Effort | Status | Files |
|------|-------------|----------|------------|--------|--------|-------|
| P3-010 | Integrate Cohere `rerank-multilingual-v3.0`. Add reranking step between pgvector retrieval and prompt assembly. Retrieve top-8, rerank to top-4. | P1 | Backend | L | Not started | `apps/api/src/retrieval/retrieval.service.ts`, `apps/api/src/retrieval/cohere-reranker.ts` (new) |
| P3-011 | Add reranking feature flag. Workspace-level setting, default off (cost control). Measure quality improvement. | P1 | Backend | S | Not started | `packages/shared/src/config/` |
| P3-012 | Add retrieval quality evaluation suite. Dataset: 50 Spanish legal queries with expected document hits. Automate as test suite. Measure precision@4 with and without reranking. | P1 | Testing | L | Not started | `tests/evaluation/retrieval-quality.test.ts` (new) |

---

### Epic P3-E3: GraphQL API for Product Data

> **Note**: `@nestjs/graphql@^13` and `@apollo/server@^4` are already installed in `apps/api/package.json` (TD-007).

| Task | Description | Priority | Workstream | Effort | Status | Files |
|------|-------------|----------|------------|--------|--------|-------|
| P3-020 | Set up Apollo Server with NestJS code-first. Configure GraphQL module in `app.module.ts`. Code-first schema generation. | P1 | Backend | M | Not started | `apps/api/src/app.module.ts`, `apps/api/src/graphql/` (new) |
| P3-021 | Add workspace resolver. `Query { workspace(id: ID!): Workspace }` — returns workspace settings, sources, document counts, indexing status. Replaces multiple REST calls. | P1 | Backend | M | Not started | `apps/api/src/graphql/workspace.resolver.ts` (new) |
| P3-022 | Add document/source resolvers. `Query { documents(workspaceId: ID!, filter: DocumentFilter): DocumentConnection }` with cursor-based pagination. Source resolver with nested sync runs. | P1 | Backend | L | Not started | `apps/api/src/graphql/` |
| P3-023 | Add indexing progress subscription. `Subscription { indexingProgress(workspaceId: ID!): IndexingEvent }` via Redis PubSub. Real-time updates for document processing. | P2 | Backend | L | Not started | `apps/api/src/graphql/` |
| P3-024 | Migrate frontend product data fetching to GraphQL. Replace `fetch` calls in Dashboard, Documents, Settings pages. Keep completion endpoints on REST/SSE. Add `@apollo/client` to web. | P1 | Frontend | L | Not started | `apps/web/src/pages/`, `apps/web/package.json` |

---

### Epic P3-E4: Performance Tuning Under Load

| Task | Description | Priority | Workstream | Effort | Status | Files |
|------|-------------|----------|------------|--------|--------|-------|
| P3-030 | Add Redis caching for workspace settings. Cache workspace settings, provider config, source status. 5-minute TTL, invalidate on mutation. | P1 | Backend | M | Not started | `apps/api/src/workspace/` |
| P3-031 | Optimize pgvector query plan. `EXPLAIN ANALYZE` on retrieval queries with 10K+ chunks. Tune `hnsw.ef_search`. Consider partial indexes by workspace. | P1 | Backend | M | Not started | `apps/api/src/retrieval/retrieval.service.ts` |
| P3-032 | Add PgBouncer connection pooler. Transaction-mode pooling between API/worker and PostgreSQL for production. Add to `docker-compose.prod.yml`. | P2 | Infra | M | Not started | `infra/pgbouncer/pgbouncer.ini` (new), `docker-compose.prod.yml` |
| P3-033 | Implement SSE connection multiplexing. If multiple editor tabs are open, reuse a single SSE connection per user session. | P2 | Backend | L | Not started | `apps/api/src/completion/completion.controller.ts` |
| P3-034 | Establish k6 load testing baseline. 50 concurrent users. Measure completion p50/p95, retrieval latency, error rate. Document results. Run monthly. | P1 | Testing | L | Not started | `tests/load/completion.k6.ts` (new), `docs/performance-baseline.md` (new) |

---

### Epic P3-E5: Accessibility Audit (WCAG 2.1 AA)

| Task | Description | Priority | Workstream | Effort | Status | Files |
|------|-------------|----------|------------|--------|--------|-------|
| P3-040 | Audit editor for keyboard navigation. Ghost-text, Tab-to-accept (conflicts with native Tab), evidence panel — explicit ARIA roles and keyboard flow. | P1 | Frontend | L | Not started | `apps/web/src/editor/AssistEditor.tsx`, `apps/web/src/editor/ghost-text-extension.ts` |
| P3-041 | Add ARIA labels to all interactive elements. Status bar, evidence panel toggle, onboarding wizard steps, form inputs, buttons. Currently zero ARIA attributes in the codebase. | P1 | Frontend | M | Not started | All components and page files |
| P3-042 | Fix color contrast compliance. Ghost text color (`#6366f1` at 0.4 opacity on white) fails WCAG contrast ratio. Evidence panel colors need review. | P1 | Frontend | S | Not started | `apps/web/src/editor/AssistEditor.tsx` |
| P3-043 | Add screen reader support for completion flow. Announce when suggestion appears, when accepted, when evidence is available. Use `aria-live` regions. | P1 | Frontend | M | Not started | `apps/web/src/editor/EvidencePanel.tsx`, `apps/web/src/editor/ghost-text-extension.ts` |
| P3-044 | Add focus management for modals and panels. Evidence panel open/close must manage focus. Escape closes panel AND dismisses ghost text — handle conflict. | P1 | Frontend | M | Not started | `apps/web/src/editor/EvidencePanel.tsx`, `apps/web/src/editor/AssistEditor.tsx` |

---

## 7. Phase 4: Growth (Weeks 13–16)

**Goal**: Expand beyond single-user legal vertical to validate broader market fit.

**Pre-requisite gate**: Do NOT start Phase 4 unless the legal vertical meets activation, latency, and week-4 retention targets for two consecutive weeks. Per original plan §10.

**Phase 4 Exit Criteria**:
- [ ] At least one non-legal vertical has 5+ active users
- [ ] Team workspaces support 2+ members with role-based access
- [ ] Self-service signup works with email verification and CAPTCHA
- [ ] Billing integration handles free tier + paid upgrade
- [ ] Landing page live with SEO targeting primary Spanish keywords

---

### Epic P4-E1: Second Vertical Expansion

| Task | Description | Priority | Workstream | Effort | Status | Files |
|------|-------------|----------|------------|--------|--------|-------|
| P4-001 | Define journalist persona and prompt presets. Interview 4-6 Spanish-speaking journalists. Create presets for journalistic writing (inverted pyramid, source attribution, neutral tone). | P0 | Product | M | Not started | `packages/shared/src/config/completion.ts` |
| P4-002 | Define public administration persona and presets. Interview 4-6 professionals. Presets for administrative writing (regulatory language, formal correspondence, procedural documentation). | P0 | Product | M | Not started | `packages/shared/src/config/completion.ts` |
| P4-003 | Add vertical selection in onboarding wizard. Step: "¿Qué tipo de escritura hacés?" — Legal, Periodismo, Administración Pública, Otro. Sets default prompt preset and workspace tone. | P0 | Frontend | M | Not started | `apps/web/src/components/OnboardingWizard.tsx` |
| P4-004 | Vertical-aware chunking configuration. Journalism uses shorter paragraphs, legal uses long clauses. Add vertical-aware separators, chunk sizes, overlap. | P1 | Backend | M | Not started | `apps/worker/src/indexing/chunker.ts` |

---

### Epic P4-E2: Team Workspaces (Multi-User)

> **Warning**: Highest-risk feature — requires exhaustive automated tests, security review before launch, phased rollout (3 teams first).

| Task | Description | Priority | Workstream | Effort | Status | Files |
|------|-------------|----------|------------|--------|--------|-------|
| P4-010 | Implement workspace invitations. Owner invites users by email. Creates `workspace_members` record (entity already exists). Invited user gets magic-link to join. Roles: owner, editor, viewer. | P0 | Backend | L | Not started | `packages/entities/src/workspace-member.entity.ts`, `apps/api/src/workspace/` |
| P4-011 | Add workspace member management UI. List members, change roles, remove members. Owner-only actions. | P0 | Frontend | L | Not started | `apps/web/src/pages/SettingsPage.tsx` (new) |
| P4-012 | Add workspace switching UI. Users with multiple workspaces can switch between them. Workspace context stored in session. | P1 | Frontend | M | Not started | `apps/web/src/App.tsx`, `apps/web/src/components/` |
| P4-013 | Audit tenant isolation for multi-user. All `userId` filters must check workspace membership. Retrieval, completions, sources, documents — all scoped by `workspaceId`. Write exhaustive tests. | P0 | Security | L | Not started | `apps/api/src/auth/guards/session.guard.ts`, all service files |
| P4-014 | Add workspace-level usage quotas. Per-workspace limits on: indexed documents, monthly completions, stored chunks. Display usage in settings. Alert at 80% and 100%. | P1 | Backend | L | Not started | `apps/api/src/workspace/`, `apps/web/src/pages/SettingsPage.tsx` |

---

### Epic P4-E3: API Rate Limiting Refinement

| Task | Description | Priority | Workstream | Effort | Status | Files |
|------|-------------|----------|------------|--------|--------|-------|
| P4-020 | Add per-workspace rate limits for team workspaces. Current limits are per-user. Add workspace-level aggregate limits. Prevent one power user from exhausting the workspace budget. | P1 | Backend | M | Not started | `apps/api/src/security/throttler.guards.ts` |
| P4-021 | Add rate limit headers. `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` on every response. Helps BYO integrations and power users. | P1 | Backend | S | Not started | `apps/api/src/completion/completion.controller.ts` |
| P4-022 | Add adaptive rate limiting. If completion p95 > 3s, auto-reduce per-user limit from 60/min to 30/min until latency recovers. | P2 | Backend | L | Not started | `apps/api/src/security/throttler.guards.ts` |

---

### Epic P4-E4: Self-Service Onboarding

| Task | Description | Priority | Workstream | Effort | Status | Files |
|------|-------------|----------|------------|--------|--------|-------|
| P4-030 | Remove invite-only gate. Allow public signups with email verification. Add CAPTCHA (hCaptcha or Cloudflare Turnstile) to prevent bot signups. | P0 | Backend | M | Not started | `apps/api/src/auth/auth.service.ts` |
| P4-031 | Add free tier with upgrade path. Free: 1 workspace, 50 documents, 100 completions/day. Paid: unlimited. Track usage against limits. | P0 | Backend | L | Not started | `apps/api/src/workspace/`, `apps/web/src/pages/` |
| P4-032 | Add Stripe integration for billing. Subscription management, webhook handler for payment events, usage-based billing for completions beyond quota. | P0 | Backend | XL | Not started | `apps/api/src/billing/` (new), `apps/web/src/pages/` |

---

### Epic P4-E5: Marketing Site and Landing Page

| Task | Description | Priority | Workstream | Effort | Status | Files |
|------|-------------|----------|------------|--------|--------|-------|
| P4-040 | Create landing page. Separate static site (Astro or Next.js static). Spanish-first. Hero, feature highlights, demo GIF, CTA to sign up. | P1 | Product | XL | Not started | `apps/landing/` (new workspace project), `pnpm-workspace.yaml` |
| P4-041 | Add SEO optimization. Meta tags, Open Graph, structured data. Keywords: "asistente de escritura legal", "autocompletado con IA para abogados", "escritura jurídica con inteligencia artificial". | P1 | Product | M | Not started | `apps/landing/` |
| P4-042 | Add privacy-friendly analytics. Plausible or Fathom. Track: landing page visits, signup clicks, onboarding completion funnel. | P1 | Product | M | Not started | `apps/landing/`, `apps/web/src/` |

---

## 8. Technical Debt Tasks

These tasks address the items in the Technical Debt Register (§3). Some are already covered in phase tasks above; these are the remaining standalone items.

| Task | Debt Item | Priority | Workstream | Effort | Status | Files |
|------|-----------|----------|------------|--------|--------|-------|
| TD-T001 | Move root-level dependencies to correct workspace packages. Move `@langchain/textsplitters`, `bullmq`, `googleapis`, `mammoth`, `pdfjs-dist` to `apps/worker/package.json` and `apps/api/package.json`. (TD-001) | P1 | Backend | M | Not started | `package.json`, `apps/worker/package.json`, `apps/api/package.json` |
| TD-T002 | Standardize ESM/CJS module resolution. `packages/shared` and `packages/entities` must compile to both (add `"exports"` field with `"import"` and `"require"` conditions). Document the convention. (TD-002) | P1 | Backend | L | Not started | `packages/shared/package.json`, `packages/entities/package.json` |
| TD-T003 | Add CSS modules or Tailwind CSS to web app. Replace the 100+ line inline styles object in `AssistEditor.tsx`. Create design tokens for colors, spacing, typography. (TD-003) | P2 | Frontend | L | Not started | `apps/web/src/editor/AssistEditor.tsx`, `apps/web/` |
| TD-T004 | Add integration test for middleware ordering. Verify session → cookie-parser → CSRF ordering is correct. Prevents regression of the cookie-parser runtime fix (Fix #10). (TD-008) | P1 | Testing | M | Not started | `apps/api/src/` (test file) |
| TD-T005 | Add database seed script. `make db-seed` with sample user, workspace, source, documents. Eliminates manual data creation for each developer. (TD-009) | P1 | Backend | M | Not started | `apps/api/src/database/seeds/` (new) |

---

## 9. Task Summary

| Phase | Tasks | Effort (est.) | Priority | Gate |
|-------|-------|---------------|----------|------|
| Phase 1: Production Readiness | 30 tasks (P1-001 to P1-074) | ~4 weeks | P0 | Deploy behind Caddy with HTTPS, e2e tests pass |
| Phase 2: Product Completeness | 23 tasks (P2-001 to P2-063) | ~4 weeks | P0/P1 | Onboarding < 5 min, email delivery live |
| Phase 3: Scale and Polish | 18 tasks (P3-001 to P3-044) | ~4 weeks | P1 | Load test passes, WCAG AA, reranking active |
| Phase 4: Growth | 18 tasks (P4-001 to P4-042) | ~4 weeks | P1/P2 | Legal vertical hits targets ×2 weeks |
| Technical Debt | 5 standalone tasks | ~2 weeks | P1 | Run throughout phases |
| **Total** | **~94 tasks** | **~16 weeks** | | |

---

## 10. Dependency Map (Quick Reference)

```
IMMEDIATE START (no dependencies)
  P1-001  .dockerignore
  P1-005  entities in Dockerfiles
  P1-050  Playwright setup
  P2-040  Google OAuth — submit ASAP (4-6 week lead time)

PHASE 1 (blocks Phase 2)
  P1-E1 + P1-E2  Docker infra  ──────────────────────►  P1-E8 Monitoring
  P1-E4          Bundle optimization  (independent)
  P1-E6          E2E tests  (independent)
  P1-E7          Error handling  (independent)

PHASE 2 (can start after Phase 1 deployment)
  P2-E4 Email  ──────────────────────────────────────►  P2-E6 Onboarding
  P2-E5 OAuth  ──────────────────────────────────────►  P2-E6 Onboarding
  P2-E3 Admin  (independent)
  P2-E7 Docs UI  (independent)

PHASE 3 (after Phase 2)
  P3-E2 Reranking  ──────────────────────────────────►  P3-E4 Load testing
  P3-E3 GraphQL  (packages already installed)
  P3-E5 Accessibility  (independent)

PHASE 4 (gate: legal vertical metrics for 2 weeks)
  P4-E2 Team Workspaces  ──────────────────────────►  P4-E3 Rate Limits
  P4-E4 Self-Service  ──────────────────────────────►  P4-E5 Landing
  P4-E1 Verticals  (independent after gate)
```

---

*This backlog implements `proposals/next-level-v1.md` (PROP-2026-002). Task IDs P1-xxx through P4-xxx do not conflict with the original backlog IDs A-xxx.*
