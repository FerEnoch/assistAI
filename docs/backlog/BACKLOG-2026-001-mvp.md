# AssistAI MVP — Product Backlog

| Metadata | |
|----------|---|
| Backlog ID | BACKLOG-2026-001 |
| Status | Active |
| Created | 2026-03-30 |
| Last Updated | 2026-04-03 |
| Owner | Engineering Team |
| PRD Reference | PRD-2026-001 |

---

## 1. Conventions

### Priority Levels

| Priority | Meaning |
|----------|---------|
| P0 | Required for private beta |
| P1 | Valuable if P0 is stable and on schedule |
| P2 | Explicitly deferred unless hard dependency appears |

### Workstreams

- `Product` — Strategy, research, design
- `Frontend` — React, Vite, Tiptap
- `Backend` — NestJS API, worker
- `Data` — PostgreSQL, pgvector, Redis
- `Infra` — DevOps, CI/CD, observability
- `Security` — Auth, encryption, rate limiting

### Status

- `Not started` — Ready for implementation
- `Ready` — Dependencies met, waiting for assignment
- `In progress` — Being implemented
- `Blocked` — Blocker identified
- `Done` — Completed and verified

---

## 2. Technical Decisions Registry

> ⚠️ **All items below are LOCKED**. An agent implementing any task must use the specified packages and parameters without substitution.

### Backend Package Pins

| Concern | Decision | Package(s) |
|---------|----------|------------|
| Magic-link auth | `@nestjs/jwt` signs 15-min one-time-use JWT; Resend sends email | `@nestjs/jwt`, `resend@^3` |
| Session store | express-session + connect-redis (redis client) | `express-session@^1.18`, `connect-redis@^9` |
| CSRF | Double Submit Cookie + HMAC | `csrf-csrf@^3` |
| Rate limiting | Redis-backed throttler | `@nestjs/throttler@^6`, `nestjs-throttler-storage-redis` |
| Completion streaming | `@Sse()` + `rxjs Observable` | Built-in `@nestjs/common` + `rxjs` |
| Credential encryption | AES-256-GCM via Node crypto | Node `crypto` (no additional dep) |
| SSRF validation | Block RFC 1918 + reserved ranges | `ssrf-req-filter`, `class-validator` |
| GraphQL | Apollo v4, code-first | `@nestjs/graphql@^13`, `@apollo/server@^4` |
| Queue dashboard | `@bull-board/*` scoped packages | `@bull-board/api@^6`, `@bull-board/express@^6` |
| DOCX parsing | Mammoth | `mammoth@^1.8` |
| PDF parsing | Mozilla PDF.js | `pdfjs-dist@^4` |
| Log redaction | pino built-in | pino built-in |

### Embedding & Retrieval Parameters

| Parameter | Locked Value | Notes |
|-----------|--------------|-------|
| Embedding model | `text-embedding-3-small` | Pass `dimensions: 1024` |
| Vector column | `vector(1024)` | |
| Chunking library | `RecursiveCharacterTextSplitter` | From `@langchain/textsplitters` |
| Chunk size | 1,500 characters | |
| Overlap | 200 characters | |
| Separator list | `["\n\n", "\n", ". ", ";\n", "; ", ", ", " "]` | |
| Retrieval top-k | 4 chunks | |
| Confidence threshold | cosine similarity ≥ 0.72 | `1-(embedding<=>$q) >= 0.72` |
| Reranker | None (MVP) | V2 candidate: Cohere |

### pgvector Schema

| Concern | Decision |
|---------|----------|
| Index type | HNSW: `m=16`, `ef_construction=64`, `vector_cosine_ops` |
| Query setting | `SET hnsw.ef_search = 100` |
| Similarity metric | Cosine distance (`<=>`) |
| Tenant isolation | `WHERE workspace_id = $1` + B-tree index |

### Cookie & Session

| Setting | Value |
|---------|-------|
| Cookie prefix | `__Host-` (prod) / none (dev) |
| `SameSite` | `Lax` |
| `HttpOnly` | `true` |
| `Secure` | `true` (prod) / `false` (dev) |
| `maxAge` | 8 hours rolling (28800000ms) |

---

## 3. Epic Overview

| Epic | Goal | Priority | Status |
|------|------|----------|--------|
| E1 | Scope lock and beta definition | P0 | |
| E2 | Monorepo and runtime foundation | P0 | |
| E3 | Auth, sessions, workspace model | P0 | |
| E4 | Google Drive source connection | P0 | |
| E5 | Document ingestion and parsing | P0 | |
| E6 | Chunking, embeddings, retrieval | P0 | |
| E7 | Editor shell and inline completion UX | P0 | |
| E8 | Completion orchestration and provider routing | P0 | |
| E9 | Source evidence and trust UX | P0 | |
| E10 | Security and privacy baseline | P0 | |
| E11 | Observability and product analytics | P0 | |
| E12 | Beta operations and feedback loop | P0 | |
| E13 | IPFS manual import | P1 | |
| E14 | Legal drafting presets | P1 | |
| E15 | Admin support tooling | P1 | |

---

## 4. Sprint Allocation

### Sprint 1 — Foundation & Scope

| ID | Task | Priority | Status |
|----|------|----------|--------|
| A-001 | Define beta persona and jobs-to-be-done | P0 | |
| A-002 | Run user interviews | P0 | |
| A-003 | Freeze MVP scope | P0 | |
| A-004 | Define success metrics | P0 | |
| A-005 | Define BYO endpoint contract | P0 | |
| A-010 | Create pnpm monorepo structure | P0 | |
| A-011 | Set up React + Vite frontend | P0 | |
| A-012 | Set up NestJS API app | P0 | |
| A-013 | Set up NestJS worker app | P0 | |
| A-014 | Docker Compose for local stack | P0 | |
| A-015 | Shared config and env validation | P0 | |
| A-016 | CI pipeline | P0 | |
| A-020 | PostgreSQL schema for users/workspaces | P0 | |
| A-021 | Magic-link authentication | P0 | |

### Sprint 2 — Auth & Source

| ID | Task | Priority | Status |
|----|------|----------|--------|
| A-022 | Secure cookie session management | P0 | |
| A-023 | Workspace bootstrap | P0 | |
| A-024 | Auth UI flows | P0 | |
| A-025 | Recent-auth requirement | P0 | |
| A-030 | Google Drive OAuth flow | P0 | |
| A-031 | OAuth scopes restriction | P0 | |
| A-032 | Token encryption | P0 | |
| A-033 | Drive file/folder picker | P0 | |
| A-034 | Source registration | P0 | |
| A-035 | Source disconnect flow | P0 | |
| A-091 | CSRF protection | P0 | |

### Sprint 3 — Ingestion

| ID | Task | Priority | Status |
|----|------|----------|--------|
| A-040 | File discovery job | P0 | |
| A-041 | MIME filtering | P0 | |
| A-042 | TXT/Markdown parsing | P0 | |
| A-043 | DOCX parsing | P0 | |
| A-044 | PDF text extraction | P0 | |
| A-045 | Document persistence | P0 | |
| A-046 | Indexing status states | P0 | |
| A-047 | Retry policy | P0 | |
| A-050 | Chunking strategy | P0 | |
| A-052 | pgvector schema | P0 | |
| A-090 | Credential encryption | P0 | |

### Sprint 4 — Retrieval & Editor

| ID | Task | Priority | Status |
|----|------|----------|--------|
| A-051 | Embedding model integration | P0 | |
| A-053 | Retrieval query service | P0 | |
| A-054 | Reindex triggers | P0 | |
| A-055 | Retrieval debug logging | P0 | |
| A-056 | Tenant isolation tests | P0 | |
| A-060 | Tiptap editor shell | P0 | |
| A-061 | Editor session tracking | P0 | |
| A-062 | Ghost-text rendering | P0 | |
| A-063 | Tab-to-accept | P0 | |
| A-064 | Debounce logic | P0 | |
| A-070 | Completion streaming endpoint | P0 | |
| A-071 | Retrieval gating | P0 | |
| A-072 | Prompt assembly | P0 | |

### Sprint 5 — Providers & UX

| ID | Task | Priority | Status |
|----|------|----------|--------|
| A-073 | OpenRouter provider | P0 | |
| A-074 | BYO provider adapter | P0 | |
| A-075 | Provider routing | P0 | |
| A-076 | Completion logging | P0 | |
| A-077 | Timeout budgets | P0 | |
| A-080 | Retrieval hits persistence | P0 | |
| A-081 | Evidence panel UI | P0 | |
| A-082 | Source metadata display | P0 | |
| A-083 | Ungrounded suppression | P0 | |
| A-084 | Source inspection events | P0 | |
| A-092 | SSRF protections | P0 | |
| A-095 | Rate limits | P0 | |
| A-100 | Structured logging | P0 | |
| A-103 | Analytics events | P0 | |

### Sprint 6 — Beta Ready

| ID | Task | Priority | Status |
|----|------|----------|--------|
| A-093 | Secret redaction | P0 | |
| A-094 | Deletion flows | P0 | |
| A-096 | Privacy disclosures | P0 | |
| A-101 | Metrics | P0 | |
| A-102 | OpenTelemetry | P0 | |
| A-104 | KPI dashboard | P0 | |
| A-110 | Onboarding checklist | P0 | |
| A-111 | Beta user recruitment | P0 | |
| A-112 | Triage rubric | P0 | |
| A-113 | Weekly reviews | P0 | |
| A-114 | Go/no-go criteria | P0 | |

---

## 5. Cut List (If Schedule Slips)

Cut in order before touching P0 core:

1. E13 IPFS manual import
2. E14 Legal drafting presets
3. E15 Admin support tooling
4. Non-essential frontend polish
5. Optional fallback routing logic

**Do NOT cut:**
- Secure sessions
- Tenant isolation
- Google Drive flow
- Ingestion and retrieval
- Inline completion UX
- Evidence inspection
- Analytics
- Latency instrumentation

---

## 6. Dependency Notes

- **A-074 (BYO)** cannot start before **A-005 (contract)** is frozen
- IPFS is lower priority than Drive
- No collaboration/team features before single-user loop works
- Retrieval isolation tests are mandatory (cross-tenant leakage = highest-risk failure)
- Evidence UX must ship with completion UX

---

## 7. Implementation Notes

### PDF Parsing
- Use `pdfjs-dist@^4` (Mozilla PDF.js)
- **Do NOT use `pdf-parse`** — unmaintained since 2020, CVE

### DOCX Parsing
- Use `mammoth@^1.8`

### Completion Streaming
- Use `@Sse()` returning `Observable<MessageEvent>`
- Do NOT use `StreamableFile` or WebSockets

### GraphQL
- Installed but NOT implemented in MVP
- Future consideration

---

*This backlog is the single source of truth for MVP implementation. All acceptance criteria are testable and packages are pinned.*
