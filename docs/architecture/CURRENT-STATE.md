# AssistAI Architecture — Current State

> **Last Updated**: 2026-04-03  
> **Status**: Documenting current implementation  
> **Related**: RFC-2026-001, BACKLOG-2026-001

---

## 1. Current State Assessment (as of 2026-04-03)

### 1.1 Strengths

| Area | Assessment |
|------|------------|
| **Architecture** | Clean modular monolith with well-separated NestJS modules |
| **Core loop** | End-to-end path works: Google Drive → ingestion → chunking → embedding → pgvector retrieval → SSE streaming → ghost-text in Tiptap |
| **Security baseline** | CSRF, session management, AES-256-GCM encryption, SSRF protection, rate limiting, secret redaction |
| **Data model** | TypeORM entities covering users, workspaces, sources, documents, chunks, completions, etc. |
| **Observability** | Structured logging (pino), Prometheus metrics, OpenTelemetry stubs |
| **CI** | GitHub Actions pipeline runs lint, typecheck, and tests |
| **Testing** | 178 tests passing across auth, completion, retrieval, parsing, encryption, etc. |
| **Developer experience** | Makefile with `make dev`, `make infra`, `make ci`, Docker Compose |

### 1.2 Weaknesses & Gaps

| Area | Issue | Priority |
|------|-------|----------|
| **No production deployment** | Docker Compose is dev-only | Critical |
| **Web bundle size** | 636KB single chunk, no code splitting | High |
| **No e2e tests** | Zero Playwright tests | High |
| **Production Dockerfiles** | Naive, copies all node_modules | High |
| **No error boundary** | React app white-screens on errors | Medium |
| **Inline styles** | No CSS modules, no design tokens | Medium |
| **GraphQL not implemented** | Package installed but no resolvers | Low |
| **No real email delivery** | Likely stubbed | Medium |
| **Missing UI flows** | No settings page, document library | High |
| **CORS hardcoded** | Production CORS needs real origin allowlist | Medium |
| **No health check for deps** | Doesn't check Postgres, Redis, etc. | Medium |

### 1.3 Technical Debt

1. **ESM/CJS hybrid** — NestJS uses CommonJS, web uses ESM. Packages must compile to both.
2. **TypeORM entity loading** — Needed runtime fixes for entity discovery.
3. **Missing `.dockerignore`** — Unnecessary files sent to build context.
4. **Root-level dependencies** — Some deps in root instead of workspace packages.
5. **Cookie-parser ordering** — Critical ordering documented only in comments.

---

## 2. Application Structure

```
assist-ai/
├── apps/
│   ├── api/           # NestJS API (REST + SSE)
│   ├── web/           # React + Vite + Tiptap
│   └── worker/        # NestJS BullMQ worker
├── packages/
│   ├── shared/        # Shared config, utils, security
│   └── entities/      # TypeORM entities
├── proposals/         # Historical proposals (legacy)
├── docs/              # THIS FOLDER — Official docs
│   ├── prd/           # Product Requirements
│   ├── rfc/           # Technical Design
│   ├── backlog/       # Product Backlog
│   └── architecture/  # Architecture decisions
└── docker-compose.yml
```

---

## 3. Key Configuration

### 3.1 Environment Variables

See `.env.example` for complete list.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection |
| `REDIS_URL` | Yes | Redis connection |
| `SESSION_SECRET` | Yes | Session cookie secret |
| `CSRF_SECRET` | Yes | CSRF protection secret |
| `JWT_SECRET` | Yes | JWT signing secret |
| `CREDENTIAL_ENCRYPTION_KEY` | Yes | AES-256-GCM key (64 hex chars) |
| `GOOGLE_CLIENT_ID` | For Drive | OAuth credentials |
| `OPENAI_API_KEY` | For completions | LLM API key |
| `OPENROUTER_API_KEY` | Alternative | Managed inference |

### 3.2 Ports

| Service | Port |
|---------|------|
| Web (Vite) | 5173 |
| API (NestJS) | 3000 |
| Worker (BullMQ) | 3001 |
| PostgreSQL | 5432 |
| Redis | 6379 |

---

## 4. Security Implementation

### 4.1 Authentication

- **Method**: Magic-link (JWT) + express-session
- **Session storage**: Redis via connect-redis
- **Cookie**: `__Host-assistai_sid` (prod) / `assistai_sid` (dev)

### 4.2 CSRF

- **Package**: `csrf-csrf` (Double Submit Cookie)
- **Header**: `x-csrf-token`
- **Exempt**: GET, HEAD, OPTIONS, `/auth/magic-link`, `/health`

### 4.3 Encryption

- **Algorithm**: AES-256-GCM
- **Format**: `iv_hex:authTag_hex:ciphertext_hex`
- **Key source**: `CREDENTIAL_ENCRYPTION_KEY` env var

### 4.4 Rate Limiting

- **Package**: `@nestjs/throttler` with Redis store
- **Limits**:
  - Auth: 5 req/15min per IP
  - Completions: 60 req/min + 1000/day per user

---

## 5. Known Issues & Fixes Applied

| Issue | Fix | Date |
|-------|-----|------|
| CORS not loading in dev | Added `envDir` to vite.config.ts | 2026-04-03 |
| CORS mismatch frontend→API | Use Vite proxy in dev (`/api` relative) | 2026-04-03 |
| connect-redis + ioredis incompatibility | Replaced with official `redis` client | 2026-04-03 |
| Technical errors exposed to users | Added GlobalExceptionFilter | 2026-04-03 |
| TS5055: `tsc` refusing to overwrite `dist/*.d.ts` as input files | Test file inside `packages/shared` was importing from `@assistai/shared` (the package itself), causing TypeScript to include `dist/` as input. Fixed by replacing the self-referential import with a relative path (`../../index`). | 2026-04-17 |

---

## 6. Roadmap

### Current Focus

1. ~~Fix Redis session store~~ ✅ Done
2. ~~Add user-friendly error messages~~ ✅ Done
3. Documentation organization

### Next Steps

1. Add Playwright e2e tests
2. Configure production Dockerfiles
3. Add React error boundary
4. Health check for external dependencies
5. Production deployment setup

---

## 7. Testing Coverage

### Unit Tests (178 passing)

- Auth guards
- Completion prompt assembly
- Retrieval service
- Document parsing
- Chunking
- Encryption
- SSRF validation
- Env validation
- Provider routing

### Missing

- E2E tests (Playwright)
- Integration tests

---

*This document captures the current state of the AssistAI implementation. It should be updated as significant changes are made.*
