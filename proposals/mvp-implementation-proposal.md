# AssistAI MVP Implementation Proposal

## Metadata

| Property | Value |
|----------|-------|
| Proposal ID | PROP-2026-001 |
| Status | Draft |
| Created | 2026-03-30 |
| Author | SDD Orchestrator |
| Target | AssistAI MVP |
| Scope | Complete MVP implementation from scratch |

---

## 1. Intent

### 1.1 Problem Statement

Professionals who draft long-form, domain-specific text waste time searching past documents, reusing preferred language, and validating phrasing. Generic AI copilots are fast but weak on user-specific style and context.

### 1.2 Goal

Build a narrow, high-trust writing product for Spanish-speaking legal professionals that delivers inline text completions grounded in the user's own documents. The MVP must demonstrate:

1. **Activation**: Users can connect a corpus, index content, and receive completions within 48 hours
2. **Trust**: Suggestions include visible source evidence
3. **Latency**: Median completion under 1.5s, p95 under 3s
4. **Retention**: Weekly active writers meet 50%+ target

### 1.3 Success Criteria

The MVP is beta-ready when ALL of the following are true (per backlog §3):

1. User can sign up, connect Google Drive, select files, and complete indexing without manual engineering support
2. Editor can show grounded inline completions in Spanish
3. Median completion latency < 1.5s, p95 < 3s for managed path
4. Suggestions include evidence visibility for the user
5. BYO model endpoint setup works for defined compatibility contract
6. Security baseline controls for sessions, secrets, tenant isolation, and SSRF protections are in place
7. Instrumentation exists for activation, suggestion acceptance, source inspection, and failure rates
8. At least one retention metric has baseline value captured from beta cohort

---

## 2. Scope

### 2.1 MVP Boundaries

**IN SCOPE (P0)**:

| Epic | Description | Key Deliverables |
|------|-------------|------------------|
| E1 | Scope lock and beta definition | Persona, interviews, scope freeze, success metrics, BYO contract |
| E2 | Monorepo and runtime foundation | pnpm monorepo, React+Vite, NestJS API+worker, Docker Compose |
| E3 | Auth, sessions, workspace model | PostgreSQL schema, magic-link auth, secure cookies, workspace bootstrap |
| E4 | Google Drive source connection | OAuth flow, token encryption, file picker UI, source registration |
| E5 | Document ingestion and parsing | File discovery, MIME filtering, DOCX/PDF/TXT parsing, indexing status |
| E6 | Chunking, embeddings, retrieval | Recursive chunking, text-embedding-3-small, pgvector HNSW, retrieval service |
| E7 | Editor shell and inline completion UX | Tiptap editor, ghost-text rendering, tab-to-accept, Spanish error states |
| E8 | Completion orchestration and provider routing | REST+SSE streaming, retrieval gating, prompt assembly, OpenRouter + BYO |
| E9 | Source evidence and trust UX | Evidence panel, source metadata, grounded completion suppression |
| E10 | Security and privacy baseline | AES-256-GCM encryption, CSRF, SSRF, redaction, rate limiting |
| E11 | Observability and product analytics | Structured logs, metrics, OpenTelemetry, analytics events |
| E12 | Beta operations and feedback loop | Onboarding, recruitment, triage rubric, weekly reviews |

**OUT OF SCOPE (Explicitly Deferred)**:

- Real-time collaboration
- Side chat / agents
- Fine-tuning
- Team permissions and enterprise RBAC
- SSO, SCIM, team billing
- OCR-heavy workflows and scanned PDFs
- Continuous Drive sync
- Mobile app

### 2.2 Technical Constraints (Locked per Backlog §2.5)

| Constraint | Decision |
|------------|----------|
| Embedding model | `text-embedding-3-small` with `dimensions: 1024` |
| Vector column | `vector(1024)` |
| Chunking | `RecursiveCharacterTextSplitter`, 1500 chars, 200 overlap |
| Retrieval top-k | 4 chunks |
| Confidence threshold | cosine similarity ≥ 0.72 |
| pgvector index | HNSW: m=16, ef_construction=64 |
| Session cookie | `__Host-` prefix, `HttpOnly; Secure; SameSite=Lax`, 8h rolling |
| Auth rate limit | 5 req/15min per IP |
| Completion rate limit | 60 req/min + 1000/day per user |

### 2.3 P1 Items (If Schedule Permits)

| Epic | Description | Trigger |
|------|-------------|---------|
| E13 | IPFS manual import | After E5 stable |
| E14 | Legal drafting presets | After E8 stable |
| E15 | Admin support tooling | After beta feedback |

---

## 3. Approach

### 3.1 Phased Delivery Strategy

The implementation follows a 6-sprint delivery model aligned with the backlog §6:

#### Sprint 1: Foundation (Weeks 1-2)
**Objective**: Repo foundation, auth skeleton, product scope lock

**Committed Tasks**:
- A-001: Define beta persona and jobs-to-be-done
- A-002: Run 6-8 user interviews with legal professionals
- A-003: Freeze MVP scope and non-goals
- A-004: Define beta success metrics
- A-005: Define BYO endpoint contract
- A-010: Create pnpm monorepo structure
- A-011: Set up React + Vite frontend
- A-012: Set up NestJS API app
- A-013: Set up NestJS worker app
- A-014: Add Docker Compose
- A-015: Add shared config and env validation
- A-020: Design PostgreSQL schema

**Exit Criteria**: Monorepo boots locally, schema migrations run, product scope locked

#### Sprint 2: Auth & Sources (Weeks 3-4)
**Objective**: Secure sessions, workspace bootstrap, Drive connection, CSRF hardening

**Committed Tasks**:
- A-021: Implement magic-link authentication
- A-022: Secure cookie session management
- A-023: Workspace bootstrap on first login
- A-024: Auth UI flows in frontend
- A-025: Recent-auth requirement for sensitive actions
- A-030: Google Drive OAuth flow
- A-031: Restrict OAuth scopes to `drive.file`
- A-032: Encrypt and store Google tokens
- A-033: Drive file/folder picker UI
- A-034: Source registration and sync-run records
- A-035: Source connection status and disconnect
- A-091: CSRF protection

**Exit Criteria**: User can sign in, connect Drive, select files

#### Sprint 3: Ingestion Pipeline (Weeks 5-6)
**Objective**: Ingestion pipeline, indexed corpus availability, credential encryption

**Committed Tasks**:
- A-040: File discovery job for Drive sources
- A-041: MIME filtering and file size limits
- A-042: TXT and Markdown parsing
- A-043: DOCX parsing (via mammoth)
- A-044: PDF text extraction (via pdfjs-dist)
- A-045: Persist documents and versions
- A-046: Indexing status states
- A-047: Retry policy for transient failures
- A-050: Spanish text chunking strategy
- A-052: pgvector schema and indexes
- A-090: AES-256-GCM credential encryption

**Exit Criteria**: Files can be indexed and retrieved reliably

#### Sprint 4: Retrieval & Editor (Weeks 7-8)
**Objective**: Retrieval, editor shell, end-to-end completion path

**Committed Tasks**:
- A-051: Multilingual embedding integration
- A-053: Retrieval query service (workspace-scoped)
- A-054: Reindex triggers based on checksum
- A-055: Retrieval debug logging
- A-056: Tenant isolation tests
- A-060: Editor shell with Tiptap
- A-061: Editor session tracking
- A-062: Inline ghost-text rendering
- A-063: Tab-to-accept and dismiss
- A-064: Debounce and request threshold
- A-070: Completion REST endpoint with SSE streaming
- A-071: Retrieval gating heuristic
- A-072: Prompt assembly with evidence injection

**Exit Criteria**: End-to-end grounded completion works for dogfooding

#### Sprint 5: Provider Integration (Weeks 9-10)
**Objective**: Provider integration, evidence UX, analytics, security hardening

**Committed Tasks**:
- A-073: OpenRouter managed provider adapter
- A-074: BYO provider adapter (OpenAI-compatible)
- A-075: Provider routing and fallback
- A-076: Completion request logging
- A-077: Timeout budgets and response caps
- A-080: Retrieval hits persistence
- A-081: Evidence panel UI
- A-082: Source metadata in editor context
- A-083: Suppress weak-grounded completions
- A-084: Source inspection events
- A-092: SSRF protections for BYO
- A-095: Rate limiting
- A-100: Structured logging
- A-103: Product analytics events

**Exit Criteria**: Dual provider paths work, evidence UX visible, analytics flowing

#### Sprint 6: Beta Readiness (Weeks 11-12)
**Objective**: Beta readiness, dashboards, deletion flows, onboarding

**Committed Tasks**:
- A-093: Secret redaction in logs
- A-094: Deletion flows
- A-096: Privacy disclosures
- A-101: Metrics for latency and queue depth
- A-102: OpenTelemetry tracing
- A-104: KPI dashboard
- A-110: Private beta onboarding checklist
- A-111: Recruit 15-25 legal beta users
- A-112: Triage rubric
- A-113: Weekly beta review
- A-114: Go/no-go criteria

**Exit Criteria**: 15-25 users onboarded, KPIs tracked, go/no-go decision ready

### 3.2 Implementation Dependencies

Critical path:
```
Sprint 1 → Sprint 2 → Sprint 3 → Sprint 4 → Sprint 5 → Sprint 6
   ↓          ↓          ↓          ↓          ↓          ↓
 E1+E2      E3+E4      E5+E6      E6+E7      E8+E9      E10+E11+E12
```

Key blockers to prevent:
1. **BYO contract (A-005)** must freeze before BYO endpoint work (A-074)
2. **Tenant isolation tests (A-056)** are mandatory - cross-tenant leakage is highest-risk failure
3. **Evidence UX (E9)** must ship with completion UX (E7+E8) - trust is core to product loop

---

## 4. Affected Modules and Dependencies

### 4.1 Backend Modules (NestJS)

| Module | Responsibility | Dependencies |
|--------|---------------|--------------|
| AuthModule | User auth, sessions, API keys, provider credentials | Users table, JWT, CSRF |
| WorkspaceModule | Workspaces, settings, quotas, language preferences | Users table |
| SourceModule | Google Drive connector, sync registration | AuthModule, WorkspaceModule |
| DocumentModule | Documents, extraction state, content snapshots | SourceModule |
| IndexingModule | Chunking, embeddings, vector search, reindex | DocumentModule, Redis, pgvector |
| CompletionModule | Prompt assembly, retrieval, provider routing | IndexingModule, ProviderModule |
| ProviderModule | OpenRouter + BYO endpoint adapters | WorkspaceModule |
| UsageModule | Request logs, token usage, rate limits | All modules |
| ObservabilityModule | Structured logs, tracing, metrics | All modules |

### 4.2 Frontend Modules (React)

| Module | Responsibility |
|--------|---------------|
| AuthPages | Login, magic-link, logout flows |
| WorkspaceShell | Workspace context, settings |
| SourceConnector | Google Drive picker, connection status |
| DocumentLibrary | Indexed files, status display |
| EditorCore | Tiptap integration, session tracking |
| CompletionUI | Ghost-text rendering, tab-to-accept |
| EvidencePanel | Source inspection, trust UI |
| Settings | Provider configuration, preferences |

### 4.3 Data Layer

| Table | Purpose | Isolation |
|-------|---------|-----------|
| users | User identities | N/A |
| workspaces | Workspace per user | user_id FK |
| sessions | Active sessions | workspace_id FK |
| content_sources | Source connections | workspace_id FK |
| source_sync_runs | Sync history | source_id FK |
| documents | Indexed documents | workspace_id FK |
| document_versions | Parsed content snapshots | document_id FK |
| document_chunks | Retrieval chunks + embeddings | workspace_id + document_id FK |
| completion_requests | Request logs | workspace_id FK |
| completion_retrieval_hits | Evidence links | completion_request_id FK |
| model_endpoints | Provider configs | workspace_id FK |

### 4.4 Infrastructure Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| Database | PostgreSQL + pgvector | Primary store + vector search |
| Cache/Queue | Redis | BullMQ queues, rate limits, session cache |
| Frontend | React + Vite | SPA |
| API | NestJS | REST + GraphQL |
| Workers | NestJS + BullMQ | Async ingestion jobs |
| Logging | Pino + Sentry | Structured logs + error tracking |
| Metrics | Prometheus + Grafana | Latency, throughput dashboards |

### 4.5 External Integrations

| Integration | Scope | Security |
|-------------|-------|----------|
| Google Drive | `drive.file` scope only | Encrypted tokens, server-side |
| OpenRouter | Managed inference | API key encrypted at rest |
| BYO Endpoints | OpenAI-compatible HTTPS | SSRF protection, HTTPS-only |
| OpenAI Embeddings | text-embedding-3-small | API key encrypted at rest |

---

## 5. Rollback and Contingency Plan

### 5.1 Schedule Slip Cuts

Per backlog §8, cut in this order before touching P0:

1. **E13 IPFS manual import** - valuable but not core loop
2. **E14 Legal drafting presets** - content tuning can come after beta
3. **E15 Admin support tooling** - can use direct DB access in beta
4. Any non-essential frontend polish
5. Optional fallback routing beyond managed + one BYO

### 5.2 Do NOT Cut (Core Loop)

- Secure sessions (A-022)
- Tenant isolation (A-056)
- Google Drive flow (E4)
- Ingestion and retrieval (E5+E6)
- Inline completion UX (E7)
- Evidence inspection (E9)
- Analytics (E11)
- Latency instrumentation (A-101)

### 5.3 Technical Rollback Plan

| Scenario | Trigger | Rollback Action |
|----------|---------|-----------------|
| pgvector performance degrades | p95 query >500ms | Reduce top-k to 3, lower ef_search |
| Completion latency too high | median >2s | Disable retrieval for short prefixes, reduce chunk size |
| Embedding costs explode | daily cost >10x budget | Switch to smaller model, cache aggressively |
| Security vulnerability | CVE in dependency | Pin exact versions, hotfix within 24h |
| Data leakage incident | Cross-tenant retrieval confirmed | Disable retrieval immediately, audit logs |

### 5.4 Recovery Procedures

| Incident | Recovery Time | Procedure |
|----------|--------------|------------|
| Database outage | <1h | Managed PostgreSQL failover |
| Redis failure | <30min | Managed Redis failover, queue rebuild |
| API downtime | <15min | Health checks, container restart |
| Worker backlog | <2h | Scale workers, pause rate limiting |
| Security incident | <4h | Isolate affected workspace, rotate keys |

### 5.5 Contingency Budget

- **Schedule buffer**: 1 week implicit buffer in 12-week plan
- **Feature buffer**: 15% of P0 tasks can slip without timeline impact
- **Cost buffer**: 20% over embedding/completion budget for early experimentation

---

## 6. Risks and Mitigations

### 6.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Retrieval quality insufficient | Medium | High | Tune chunking for Spanish legal, dogfood early |
| Completion latency too high | Medium | High | Skip retrieval heuristics, cache aggressively |
| Drive integration delays | Low | High | User-selected folders only, manual sync |
| BYO endpoint unreliability | Medium | Medium | Strict contract, validation at setup, fallback to OpenRouter |

### 6.2 Product Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Scope creep | High | Medium | Strict scope freeze, reject adjacent features |
| Beta recruitment delays | Medium | High | Start recruitment in Sprint 3 |
| Wrong persona fit | Low | High | Interview 6-8 users in Sprint 1 |

### 6.3 Operational Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Dependency CVE | Medium | Medium | Pin versions, monitor security feeds |
| Cost overrun | Medium | Low | Monitor daily, implement hard caps |
| Team bandwidth | High | High | Prioritize ruthlessly, cut P1 items first |

---

## 7. Next Steps

1. **Initialize SDD context** in the project (sdd-init)
2. **Create issues** for all P0 tasks in Sprints 1-2 from backlog
3. **Assign owners** to each epic
4. **Set up monorepo** with pnpm workspaces
5. **Run Sprint 1** - foundation and scope lock
6. **Begin beta user recruitment** in parallel with development

---

## Appendix A: Backlog Reference

| Sprint | Epic | Tasks |
|--------|------|-------|
| 1 | E1 | A-001, A-002, A-003, A-004, A-005 |
| 1 | E2 | A-010, A-011, A-012, A-013, A-014, A-015, A-020 |
| 2 | E3 | A-021, A-022, A-023, A-024, A-025 |
| 2 | E4 | A-030, A-031, A-032, A-033, A-034, A-035 |
| 2 | E10 | A-091 |
| 3 | E5 | A-040, A-041, A-042, A-043, A-044, A-045, A-046, A-047 |
| 3 | E6 | A-050, A-052 |
| 3 | E10 | A-090 |
| 4 | E6 | A-051, A-053, A-054, A-055, A-056 |
| 4 | E7 | A-060, A-061, A-062, A-063, A-064 |
| 4 | E8 | A-070, A-071, A-072 |
| 5 | E8 | A-073, A-074, A-075, A-076, A-077 |
| 5 | E9 | A-080, A-081, A-082, A-083, A-084 |
| 5 | E10 | A-092, A-095 |
| 5 | E11 | A-100, A-103 |
| 6 | E10 | A-093, A-094, A-096 |
| 6 | E11 | A-101, A-102, A-104 |
| 6 | E12 | A-110, A-111, A-112, A-113, A-114 |

---

*Proposal created via SDD methodology. Refer to `assistai-backlog.md` for full acceptance criteria and `assistai-plan.md` for architectural context.*
