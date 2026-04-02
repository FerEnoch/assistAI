# AssistAI MVP Backlog

## 1. Purpose

This backlog translates the MVP plan into execution-ready work for a 12-week build. It is intentionally biased toward the narrow beta goal:

- primary cohort: Spanish-speaking legal professionals,
- primary source: Google Drive,
- primary interaction: inline completions in the editor,
- primary success criteria: activation, trust, latency, and retention.

Everything here should be judged against one rule: if a task does not materially improve activation, trust, or stable drafting, it should not displace P0 work.

## 2. Backlog Conventions

### Priority levels

- `P0`: required for private beta.
- `P1`: valuable if P0 is stable and on schedule.
- `P2`: explicitly deferred unless a hard dependency appears.

### Suggested workstreams

- `Product`
- `Frontend`
- `Backend`
- `Data`
- `Infra`
- `Security`

### Status labels

- `Not started`
- `Ready`
- `In progress`
- `Blocked`
- `Done`

## 2.5. Technical Decisions Registry

All items below are **locked**. An agent implementing any task in this backlog must use the specified packages and parameters without substitution. To propose a change, open a discussion before writing code.

### Backend Package Pins

| Concern | Decision | Package(s) |
| --- | --- | --- |
| Magic-link auth | `@nestjs/jwt` signs a 15-min one-time-use JWT; Resend sends the email | `@nestjs/jwt`, `resend@^3` |
| Session store | express-session + connect-redis v8 (ioredis native) | `express-session@^1.18`, `connect-redis@^8` |
| CSRF | Double Submit Cookie + HMAC. `csurf` is deprecated and CVE-flagged — do not use it. Exempt pre-auth endpoints. | `csrf-csrf@^3` |
| Rate limiting | Redis-backed throttler. Auth: 5 req / 15 min per IP. Completions: 60 req / min + 1,000 / day. Ingestion: 10 req / hour. | `@nestjs/throttler@^6`, `nestjs-throttler-storage-redis` |
| Completion streaming | `@Sse()` + `rxjs Observable<MessageEvent>`. Not `StreamableFile` (binary downloads only). Not WebSockets. | Built-in `@nestjs/common` + `rxjs` |
| Credential encryption | AES-256-GCM via Node built-in `crypto`. Store as `iv:authTag:ciphertext` hex. Key from env var `CREDENTIAL_ENCRYPTION_KEY`. No KMS in MVP. | Node `crypto` (no additional npm dep) |
| SSRF validation | Resolve via 8.8.8.8, block all RFC 1918 + reserved ranges + non-443 ports. Use custom `lookup` fn on the HTTP agent to defeat DNS rebinding — validated IPs must be reused on the actual request. | `ssrf-req-filter`, `class-validator` |
| GraphQL | Apollo v4, code-first. Completions stay on REST/SSE — no GraphQL subscriptions in MVP. | `@nestjs/graphql@^13`, `@apollo/server@^4` |
| Queue dashboard | Scoped `@bull-board/*` packages (the unscoped `bull-board` is unmaintained). Must be behind an auth guard before any deployment. | `@bull-board/api@^6`, `@bull-board/express@^6` |
| DOCX parsing | Mammoth for DOCX. | `mammoth@^1.8` |
| PDF parsing | Mozilla PDF.js. **Do not use `pdf-parse`** — unmaintained since 2020, path traversal CVE. | `pdfjs-dist@^4` |
| Log redaction | pino built-in `redact` paths array + Sentry `beforeSend` hook. Not `pino-noir`. | pino built-in |

### Embedding and Retrieval Parameters

| Parameter | Locked Value | Notes |
| --- | --- | --- |
| Embedding model | `text-embedding-3-small` (OpenAI API) | Pass `dimensions: 1024` in every API call |
| Vector column width | `vector(1024)` | Applied in pgvector DDL |
| Chunking library | `RecursiveCharacterTextSplitter` | From `@langchain/textsplitters` |
| Chunk size | 1,500 characters | — |
| Overlap | 200 characters | Preserves sentence bridges across boundaries |
| Separator list | `["\n\n", "\n", ". ", ";\n", "; ", ", ", " "]` | `;\n` captures Spanish legal clause transitions |
| Retrieval top-k | 4 chunks | Filter by threshold before injecting into prompt |
| Confidence threshold | cosine similarity ≥ 0.72 | pgvector: `WHERE 1-(embedding<=>$q) >= 0.72` |
| Reranker | None in MVP | V2 candidate: Cohere `rerank-multilingual-v3.0` |
| Embedding provider | OpenAI API | Wrapped in `EmbeddingProvider` interface for future ONNX swap |

### pgvector Schema and Index

| Concern | Decision |
| --- | --- |
| Index type | HNSW: `m=16`, `ef_construction=64`, `vector_cosine_ops` |
| Query-time setting | `SET hnsw.ef_search = 100` before every similarity query |
| Similarity metric | Cosine distance (`<=>`) |
| Tenant isolation | `WHERE workspace_id = $1` + B-tree index on `workspace_id` |
| Deletion strategy | Hard delete with `ON DELETE CASCADE` from `documents` → `document_chunks` |
| Migration tooling | TypeORM runner with raw SQL (entity diff does not understand `vector` type) |

### Cookie and Session Specifics

| Setting | Value |
| --- | --- |
| Cookie name prefix | `__Host-` (pins cookie to HTTPS origin, no domain attribute needed) |
| `SameSite` | `Lax` — `Strict` breaks Google OAuth redirect callbacks |
| `HttpOnly` | `true` |
| `Secure` | `true` |
| `maxAge` | 8 hours rolling (`28800000` ms) |
| Recent-auth window | 15 minutes. Store `lastAuthAt` in session object. Return `403 RECENT_AUTH_REQUIRED` on stale sessions. |

## 3. Release Gates

The MVP is beta-ready only when all of the following are true:

1. A user can sign up, connect Google Drive, select files, and complete indexing without manual engineering support.
2. The editor can show grounded inline completions in Spanish.
3. Median completion latency is below 1.5 seconds and p95 is below 3 seconds for the managed path.
4. Suggestions include evidence visibility for the user.
5. BYO model endpoint setup works for the defined compatibility contract.
6. Security baseline controls for sessions, secrets, tenant isolation, and SSRF protections are in place.
7. Instrumentation exists for activation, suggestion acceptance, source inspection, and failure rates.
8. At least one retention metric is instrumented and has a numeric baseline value captured from the beta cohort before gate evaluation (acceptable metrics: return-to-editor rate at day 7, or weekly active suggestion events per user).

## 4. Epic Overview

| Epic | Goal | Priority | Owner |
| --- | --- | --- | --- |
| E1 | Scope lock and beta definition | P0 | Product |
| E2 | Monorepo and runtime foundation | P0 | Infra |
| E3 | Auth, sessions, and workspace model | P0 | Backend |
| E4 | Google Drive source connection | P0 | Backend |
| E5 | Document ingestion and parsing | P0 | Backend |
| E6 | Chunking, embeddings, and retrieval | P0 | Backend/Data |
| E7 | Editor shell and inline completion UX | P0 | Frontend |
| E8 | Completion orchestration and provider routing | P0 | Backend |
| E9 | Source evidence and trust UX | P0 | Frontend/Backend |
| E10 | Security and privacy baseline | P0 | Security/Backend |
| E11 | Observability and product analytics | P0 | Infra/Backend |
| E12 | Beta operations and feedback loop | P0 | Product |
| E13 | IPFS manual import | P1 | Backend |
| E14 | Legal drafting presets and content tuning | P1 | Product/Backend |
| E15 | Admin support tooling | P1 | Backend |

## 5. Detailed Backlog

## E1. Scope Lock and Beta Definition

| ID | Task | Priority | Workstream | Dependencies | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| A-001 | Define beta persona and jobs-to-be-done | P0 | Product | None | One primary persona document exists; top 3 drafting jobs are documented and approved. |
| A-002 | Run 6 to 8 user interviews with legal professionals | P0 | Product | A-001 | Interview notes captured; repeated workflow patterns and file types summarized. |
| A-003 | Freeze MVP scope and non-goals | P0 | Product | A-002 | Written scope freeze exists; out-of-scope list approved and shared. |
| A-004 | Define beta success metrics and reporting cadence | P0 | Product | A-003 | KPI definitions for activation, latency, acceptance, source inspection, and retention are documented. |
| A-005 | Define BYO endpoint contract for MVP | P0 | Product/Backend | A-003 | Contract specifies supported protocol, auth style, response format, limits, and unsupported cases. |

## E2. Monorepo and Runtime Foundation

| ID | Task | Priority | Workstream | Dependencies | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| A-010 | Create pnpm monorepo structure | P0 | Infra | None | Repo has separate apps/packages layout for web, api, worker, and shared libraries. |
| A-011 | Set up React + Vite frontend app | P0 | Frontend | A-010 | Frontend app boots locally with environment-based config. |
| A-012 | Set up NestJS API app | P0 | Backend | A-010 | API app boots locally and exposes health endpoints. |
| A-013 | Set up NestJS worker app | P0 | Backend | A-010 | Worker can consume a test BullMQ job successfully. |
| A-014 | Add Docker Compose for local stack | P0 | Infra | A-011, A-012, A-013 | Local environment starts frontend, api, worker, postgres, redis, and optional ipfs. |
| A-015 | Add shared config and env validation | P0 | Infra | A-010 | Invalid env config fails fast at startup in all services. |
| A-016 | Add CI for lint, typecheck, and tests | P0 | Infra | A-010 | Pull requests run basic validation automatically. |

## E3. Auth, Sessions, and Workspace Model

| ID | Task | Priority | Workstream | Dependencies | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| A-020 | Design PostgreSQL schema for users and workspaces | P0 | Backend/Data | A-010 | Migration exists for users, workspaces, sessions, and roles needed for MVP. |
| A-021 | Implement passwordless or magic-link authentication | P0 | Backend | A-020 | Users can sign in without manual admin setup; session created server-side. |
| A-022 | Implement secure cookie session management | P0 | Backend/Security | A-021 | Cookie named `__Host-assistai_sid` (prefix enforces `Secure` + no `Domain` attribute). Flags: `HttpOnly; Secure; SameSite=Lax; Path=/`. `maxAge` 8 h rolling (28 800 000 ms). Sessions stored in `user_sessions` via `connect-pg-simple`. `DELETE /auth/session` destroys server-side record. Tests: `Set-Cookie` header contains all required flags; cross-origin POST returns 403. |
| A-023 | Implement workspace bootstrap on first login | P0 | Backend | A-020, A-021 | First login creates a default workspace with language defaults. |
| A-024 | Add auth UI flows in frontend | P0 | Frontend | A-021, A-022 | User can request login, complete login, log out, and see authenticated workspace state. |
| A-025 | Add recent-auth requirement for sensitive actions | P0 | Backend/Security | A-022 | `RecentAuthGuard` rejects requests where `session.lastAuthAt` is older than 15 min with `403 { code: 'RECENT_AUTH_REQUIRED', redirectTo: '/auth/reconfirm' }`. `lastAuthAt` set only at `POST /auth/verify` (OTP success). Applied to: `PATCH /settings/credentials`, `DELETE /account`, `POST /workspaces/:id/drive-disconnect`. Tests: 16-min-old `lastAuthAt` → 403; 14‑min-old → 200; regular API calls do not advance `lastAuthAt`. |

## E4. Google Drive Source Connection

| ID | Task | Priority | Workstream | Dependencies | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| A-030 | Implement separate Google Drive OAuth flow | P0 | Backend | A-023 | Drive can be connected independently of product login. |
| A-031 | Restrict OAuth scopes to `drive.file` and required identity scopes | P0 | Backend/Security | A-030 | OAuth consent screen requests exactly `drive.file` and `openid email`. Scope list is committed to `docs/oauth-scopes.md`. An integration test asserts the constructed OAuth authorization URL contains no scope outside this exact set. |
| A-032 | Encrypt and store Google tokens server-side | P0 | Backend/Security | A-030 | Refresh tokens encrypted with AES-256-GCM before DB persistence (see A-090). Access tokens cached in Redis encrypted, TTL = `expiry_date − now − 60 s`. `revokeTokens(userId)` deletes Redis key and nulls DB column. Tests: Redis value is not plaintext; DB column never contains `1//` prefix; TTL ≤ expiry−60 s; concurrent calls trigger exactly one token refresh (per-user lock). |
| A-033 | Build Drive file/folder picker UI | P0 | Frontend | A-030 | User can select files or folders to authorize for indexing. |
| A-034 | Create source registration and sync-run records | P0 | Backend | A-020, A-030 | Source and sync-run rows are created and track status transitions. |
| A-035 | Add source connection status and disconnect flow | P0 | Frontend/Backend | A-032, A-034 | User can see connection state and disconnect Drive cleanly. |

## E5. Document Ingestion and Parsing

| ID | Task | Priority | Workstream | Dependencies | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| A-040 | Implement file discovery job for selected Drive sources | P0 | Backend | A-034, A-013 | Selected files create ingestion jobs and source run metrics update. |
| A-041 | Implement MIME filtering and file size limits | P0 | Backend/Security | A-040 | Unsupported files are rejected with clear status and reason. |
| A-042 | Implement TXT and Markdown parsing | P0 | Backend | A-040 | Text-native files parse into normalized text successfully. |
| A-043 | Implement DOCX parsing | P0 | Backend | A-040 | DOCX files parse into normalized text with basic structural preservation. |
| A-044 | Implement PDF text extraction for text-based PDFs | P0 | Backend | A-040 | Text-based PDFs parse successfully without OCR dependency. |
| A-045 | Persist documents and document versions | P0 | Backend/Data | A-042, A-043, A-044 | Parsed content is saved with source linkage, checksum, and ingest status. |
| A-046 | Add indexing status states and error reasons | P0 | Backend | A-045 | UI can show `queued`, `processing`, `indexed`, `failed` with error details. |
| A-047 | Implement retry policy for transient ingestion failures | P0 | Backend | A-040 | Transient fetch/parse errors retry with capped attempts and dead-letter handling. |

> **E5 Implementation Note:** Use `pdfjs-dist@^4` (Mozilla PDF.js) for PDF text extraction. **Do not use `pdf-parse`** — unmaintained since 2020 with a path traversal CVE on crafted PDFs. Use `mammoth@^1.8` for DOCX. Both parsers execute inside the worker process, not the API process.

## E6. Chunking, Embeddings, and Retrieval

| ID | Task | Priority | Workstream | Dependencies | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| A-050 | Implement chunking strategy for Spanish text | P0 | Backend/Data | A-045 | `RecursiveCharacterTextSplitter` from `@langchain/textsplitters` produces chunks of 1,500 chars, 200-char overlap, separator list `["\n\n", "\n", ". ", ";\n", "; ", ", ", " "]`. Each chunk record stores `chunk_index`, `token_count`, and `model_version`. A unit test verifies that a Spanish legal clause ending in `;\n` is not split mid-clause. |
| A-051 | Integrate multilingual embedding model | P0 | Backend | A-050 | `OpenAIEmbeddingProvider` calls `text-embedding-3-small` with `dimensions: 1024`. Embeddings write to `document_chunks.embedding vector(1024)`. `model_version` is set to `text-embedding-3-small-1024d`. Provider is accessed via an `EmbeddingProvider` interface (one `embedBatch(texts: string[]): Promise<number[][]>` method). A unit test asserts output array shape is `[n][1024]`. |
| A-052 | Enable pgvector schema and indexes | P0 | Data | A-020 | Migration creates `document_chunks` with `embedding vector(1024)`, HNSW index (`m=16, ef_construction=64, vector_cosine_ops`), and B-tree indexes on `workspace_id` and `document_id`. A smoke test inserts 100 test vectors and performs a similarity query returning in under 200 ms. |
| A-053 | Implement retrieval query service scoped by workspace | P0 | Backend | A-051, A-052 | Service issues `SET hnsw.ef_search = 100` then queries `WHERE workspace_id = $1 ORDER BY embedding <=> $query LIMIT 4`. An automated test seeds two workspaces with distinct chunks, queries workspace A, and asserts zero results belonging to workspace B are returned. |
| A-054 | Add reindex triggers based on checksum/model changes | P0 | Backend | A-045, A-051 | Changed documents or embedding config create reindex jobs automatically. |
| A-055 | Add retrieval debug logging and similarity trace data | P0 | Backend | A-053 | Logs capture latency, hit count, and top similarity results for debugging. |
| A-056 | Add tenant isolation tests for retrieval | P0 | Backend/Security | A-053 | Automated tests prove cross-workspace retrieval leakage is blocked. |

> **E6 Implementation Note:** All embedding and chunking parameters are locked in §2.5. Model: `text-embedding-3-small` at `dimensions=1024`. Chunker: `RecursiveCharacterTextSplitter` from `@langchain/textsplitters`, 1,500-char chunks, 200-char overlap. Confidence threshold: cosine ≥ 0.72. Top-k: 4. Do not change these values without updating §2.5 and re-running the evaluation set from A-132.

## E7. Editor Shell and Inline Completion UX

| ID | Task | Priority | Workstream | Dependencies | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| A-060 | Build editor shell with Tiptap | P0 | Frontend | A-011 | Editor loads, supports plain drafting, and preserves cursor position. |
| A-061 | Add editor session tracking | P0 | Frontend/Backend | A-060, A-020 | Sessions are created and associated with workspace and active language. |
| A-062 | Implement inline ghost-text rendering | P0 | Frontend | A-060 | Suggested text appears inline without corrupting existing document state. |
| A-063 | Implement tab-to-accept and dismiss interactions | P0 | Frontend | A-062 | Suggestion can be accepted with Tab and dismissed without editor instability. |
| A-064 | Add debounce and request threshold logic client-side | P0 | Frontend | A-062 | Completion requests are rate-controlled and avoid noisy requests on short prefixes. |
| A-065 | Add localized Spanish empty/error states in editor | P0 | Frontend | A-062 | Editor renders `es-ES` copy for all three states: (1) awaiting completion, (2) provider error, (3) zero grounding evidence. Playwright screenshot tests capture each state. No English-language fallback strings appear when locale is `es-ES`. |

## E8. Completion Orchestration and Provider Routing

| ID | Task | Priority | Workstream | Dependencies | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| A-070 | Create completion REST endpoint with streaming response | P0 | Backend | A-012 | Endpoint accepts editor context and streams completion tokens back. |
| A-071 | Implement retrieval gating heuristic | P0 | Backend | A-053, A-070 | Service can skip retrieval for short/local continuations and use retrieval when appropriate. |
| A-072 | Implement prompt assembly with evidence injection | P0 | Backend | A-071 | Prompt includes system rules, local context, language instruction, and selected evidence. |
| A-073 | Add OpenRouter managed provider adapter | P0 | Backend | A-070 | Managed path can generate completions with configured model and timeouts. |
| A-074 | Add BYO provider adapter for OpenAI-compatible endpoints | P0 | Backend | A-070, A-005 | Supported external endpoints pass validation and can serve completions. |
| A-075 | Implement provider routing and fallback rules | P0 | Backend | A-073, A-074 | Workspace default provider is used first; fallback behavior obeys workspace settings. |
| A-076 | Log completion request metadata and outcome | P0 | Backend | A-070 | Latency, provider, retrieval hit count, and status are persisted asynchronously. |
| A-077 | Enforce timeout budgets and response caps | P0 | Backend/Security | A-073, A-074 | Long-running or oversized responses fail safely within defined limits. |

> **E8 Implementation Note:** Completion streaming must use `@Sse()` (Server-Sent Events) returning `Observable<MessageEvent>` from `rxjs`. Do not use `StreamableFile` (binary downloads only) or WebSockets. Do not introduce GraphQL subscriptions — SSE is enough and is already established by this epic.

## E9. Source Evidence and Trust UX

| ID | Task | Priority | Workstream | Dependencies | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| A-080 | Persist retrieval hits linked to completion requests | P0 | Backend/Data | A-076 | Completion requests store ranked supporting chunk references. |
| A-081 | Build evidence panel UI | P0 | Frontend | A-080 | User can inspect top supporting documents/chunks behind a suggestion. |
| A-082 | Add source metadata display in editor context | P0 | Frontend | A-081 | Evidence panel shows title, source type, and relevant excerpt. |
| A-083 | Suppress grounded completions when evidence is weak | P0 | Backend | A-071, A-080 | When top retrieval result cosine similarity is below 0.72 (pgvector distance `> 0.28`), the system strips retrieved chunks from the prompt and marks the response as ungrounded. Unit test seeds an unrelated corpus, sends a query, and asserts the completion request carries no retrieval context and the evidence panel is hidden. |
| A-084 | Instrument source inspection events | P0 | Frontend/Backend | A-081 | Evidence opens and related trust events are logged. |

## E10. Security and Privacy Baseline

| ID | Task | Priority | Workstream | Dependencies | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| A-090 | Implement application-layer encryption for stored credentials | P0 | Security/Backend | A-032 | Algorithm: AES-256-GCM. Key: 32 bytes from `CREDENTIAL_ENCRYPTION_KEY` env var (64 hex chars); startup fails fast if missing or wrong length. IV: 16 random bytes per call. Stored format: `iv_hex:authTag_hex:ciphertext_hex`. `key_version` integer column enables rotation. Tests: two `encrypt(x)` calls produce different stored strings; `decrypt(encrypt(x,k),k)===x`; tampered auth tag throws; DB `google_refresh_token` column never contains `ya29.` or `1//`. |
| A-091 | Add CSRF protection for state-changing browser endpoints | P0 | Security/Backend | A-022 | Double Submit Cookie with HMAC signing via `csrf-csrf` package. Cookie `__Host-assistai_csrf` (`HttpOnly:false; Secure; SameSite=Lax`). Token from `GET /auth/csrf-token`. Client sends token in `x-csrf-token` header. GET/HEAD/OPTIONS excluded. Tests: POST without header → 403; valid token → 200; token from different session → 403. |
| A-092 | Add SSRF protections for BYO endpoint validation | P0 | Security/Backend | A-074 | Allowed protocols: `http:`, `https:` only. Allowed ports: 80, 443 only. Blocked hostnames: `localhost`, `169.254.169.254`, `metadata.google.internal`, `metadata.internal`, `instance-data`. Blocked IPv4 CIDRs: `127.0.0.0/8`, `0.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `100.64.0.0/10`, `192.0.x.0/24` protocol-assigned, `198.18.0.0/15`, `240.0.0.0/4`, `255.255.255.255/32`. Blocked IPv6: `::1/128`, `fc00::/7`, `fe80::/10`. DNS resolved via external servers (8.8.8.8, 1.1.1.1); ALL A/AAAA records checked. Tests: `http://169.254.169.254/` → 400; `http://10.0.0.1/` → 400; `http://localhost:8080/` → 400; port 22 → 400; `file://` → 400; hostname resolving to private IP → 400; public HTTPS endpoint → valid. |
| A-093 | Add secret redaction in logs and traces | P0 | Security/Infra | A-016 | pino built-in `redact` (not `pino-noir`). Redacted paths: `password`, `token`, `secret`, `apiKey`, `api_key`, `accessToken`, `refreshToken`, `access_token`, `refresh_token`, `client_secret`, `authorization`, `cookie`, `x-api-key`, and `*.` variants. Censor: `[REDACTED]`. Sentry `beforeSend` strips auth headers and credential fields from request bodies. Tests: `{ refreshToken:'abc' }` logged → output contains `[REDACTED]`, not `abc`; `Authorization: Bearer ya29.x` → `ya29` absent; CI `grep` for `ya29\.|1\/\/` in log output finds nothing. |
| A-094 | Implement deletion flow for sources, indexed data, and credentials | P0 | Backend/Security | A-035, A-045, A-051 | Disconnecting a source queues cleanup of parsed content, chunks, embeddings, and credentials. |
| A-095 | Add rate limits for auth, ingestion, and completion endpoints | P0 | Security/Backend | A-012, A-070 | `@nestjs/throttler` with Redis store (`@nest-lab/throttler-storage-redis`). Limits: magic-link request → 5/15 min per IP; OTP verify → 3 attempts per token+IP; reindex → 10/hr per userId; completions → 60/min and 1 000/day per userId; workspace create → 5/hr per userId; global fallback → 200/min per IP. 429 response includes `Retry-After` (seconds). 429 on magic-link must not reveal email existence. Tests: 6th magic-link within 15 min → 429 with `Retry-After ≤ 900`; two IPs have independent counters; counter resets after window. |
| A-096 | Document privacy disclosures and external data routing | P0 | Product/Security | A-030, A-073, A-074 | User-facing copy explains when data goes to Google, OpenRouter, or BYO endpoints. |
| A-097 | Add admin MFA requirement for operational accounts | P1 | Security | None | Admin/operator access requires MFA before production use. |

## E11. Observability and Product Analytics

| ID | Task | Priority | Workstream | Dependencies | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| A-100 | Add structured logging with request and workspace IDs | P0 | Infra/Backend | A-012 | Logs are structured and can trace API and worker operations per request. |
| A-101 | Add metrics for completion latency, retrieval latency, and queue depth | P0 | Infra/Backend | A-070, A-053 | Metrics are exported and visible in local or hosted dashboards. |
| A-102 | Add OpenTelemetry tracing for API, retrieval, provider, and worker jobs | P0 | Infra/Backend | A-012, A-013 | Traces follow requests across the main completion path. |
| A-103 | Capture product analytics events for activation funnel | P0 | Backend/Frontend | A-024, A-033, A-062 | Events exist for signup, source connect, indexing complete, suggestion shown, accepted, dismissed, source opened. |
| A-104 | Build a minimal KPI dashboard for beta monitoring | P0 | Product/Infra | A-101, A-103 | Team can view activation, latency, acceptance, and failure trends daily. |

## E12. Beta Operations and Feedback Loop

| ID | Task | Priority | Workstream | Dependencies | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| A-110 | Prepare private beta onboarding checklist | P0 | Product | A-003, A-104 | Standard onboarding flow exists for invited users. |
| A-111 | Recruit 15 to 25 legal beta users | P0 | Product | A-002, A-110 | Beta cohort list is confirmed and ready for rollout. |
| A-112 | Define beta triage rubric for bugs vs feature requests | P0 | Product/Engineering | A-003 | Triage framework explicitly favors activation, trust, and retention blockers. |
| A-113 | Run weekly beta review and KPI triage | P0 | Product | A-104, A-111 | A recurring calendar invite exists by Sprint 5 end. Each review produces a written summary containing: current activation rate, median and p95 completion latency from the dashboard, and top-3 blockers each with an owner and a target resolution date. First review occurs no later than 7 days after the first beta user completes onboarding. |
| A-114 | Define go/no-go criteria for second segment expansion | P0 | Product | A-004, A-113 | Expansion decision criteria are documented before beta end. |

## E13. IPFS Manual Import

| ID | Task | Priority | Workstream | Dependencies | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| A-120 | Add manual CID import flow | P1 | Backend/Frontend | A-045 | User can submit a CID and import supported public content. |
| A-121 | Add IPFS privacy warning and irreversible-public-content copy | P1 | Product/Frontend | A-120 | UI requires explicit acknowledgement before import or upload actions. |
| A-122 | Add IPFS source record and status model | P1 | Backend | A-120 | IPFS sources are tracked similarly to Drive sources with manual sync semantics. |

## E14. Legal Drafting Presets and Content Tuning

| ID | Task | Priority | Workstream | Dependencies | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| A-130 | Define Spanish legal drafting prompt preset | P1 | Product/Backend | A-072 | One preset exists for neutral, formal legal drafting tone. |
| A-131 | Add workspace-level default tone and language rules | P1 | Backend/Frontend | A-023, A-130 | Workspace settings can control default completion behavior. |
| A-132 | Tune chunking and retrieval heuristics using dogfood corpus | P1 | Backend/Data | A-055 | Retrieval quality improves on internal evaluation set and findings are documented. |

## E15. Admin Support Tooling

| ID | Task | Priority | Workstream | Dependencies | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| A-140 | Build internal view for source/indexing status | P1 | Backend/Frontend | A-046 | Support can inspect source state and failure reasons without database access. |
| A-141 | Build internal view for provider validation failures | P1 | Backend/Frontend | A-074 | Admin view shows for each failed validation event: endpoint domain (URL redacted to domain only), error class from the set `{timeout, ssrf-blocked, auth-rejected, format-invalid, unreachable}`, HTTP status code when available, and timestamp. All five error classes have distinct labels and are covered by unit tests. |
| A-142 | Add manual requeue for failed ingestion jobs | P1 | Backend | A-047 | Support can requeue recoverable failures from an internal tool. |

## 6. Sprint Recommendation

## Sprint 1

Target outcome: repo foundation, auth skeleton, and product scope lock.

Committed candidates:

- A-001
- A-002
- A-003
- A-004
- A-005
- A-010
- A-011
- A-012
- A-013
- A-014
- A-015
- A-020
- A-021

## Sprint 2

Target outcome: secure sessions, workspace bootstrap, Drive connection, source registration, and CSRF hardening.

Committed candidates:

- A-022
- A-023
- A-024
- A-025
- A-030
- A-031
- A-032
- A-033
- A-034
- A-035
- A-091

## Sprint 3

Target outcome: ingestion pipeline, basic indexed corpus availability, and credential encryption.

Committed candidates:

- A-040
- A-041
- A-042
- A-043
- A-044
- A-045
- A-046
- A-047
- A-050
- A-052
- A-090

## Sprint 4

Target outcome: retrieval, editor shell, and end-to-end completion path for dogfooding.

Committed candidates:

- A-051
- A-053
- A-054
- A-055
- A-056
- A-060
- A-061
- A-062
- A-063
- A-064
- A-070
- A-071
- A-072

## Sprint 5

Target outcome: provider integration, evidence UX, analytics, and security hardening.

Committed candidates:

- A-073
- A-074
- A-075
- A-076
- A-077
- A-080
- A-081
- A-082
- A-083
- A-084
- A-092
- A-095
- A-100
- A-103

## Sprint 6

Target outcome: beta readiness, dashboards, deletion flows, and controlled onboarding.

Committed candidates:

- A-093
- A-094
- A-096
- A-101
- A-102
- A-104
- A-110
- A-111
- A-112
- A-113
- A-114

## 7. Dependency Notes

- Do not begin BYO endpoint development (A-074) before the compatibility contract (A-005) is frozen. A-005 is scheduled in Sprint 1 for this reason.
- Do not treat IPFS as equal priority to Drive before beta signal exists.
- Do not expand to collaboration or team features before the single-user drafting loop is working and measurable.
- Retrieval isolation tests are not optional because cross-tenant leakage is the highest-risk technical failure.
- Evidence UX should ship with completion UX, not later, because trust is part of the core product loop.

## 8. Cut List If Schedule Slips

Cut in this order before touching P0 core:

1. E13 IPFS manual import.
2. E14 legal drafting presets.
3. E15 admin support tooling.
4. Any non-essential frontend polish unrelated to trust or error clarity.
5. Any optional fallback routing logic beyond one managed provider plus one BYO contract.

Do not cut:

1. secure sessions,
2. tenant isolation,
3. Google Drive flow,
4. ingestion and retrieval,
5. inline completion UX,
6. evidence inspection,
7. analytics,
8. latency instrumentation.

## 9. Suggested Next Step

Use this file as the source for issue creation. Tasks are agent-ready: acceptance criteria are testable, packages are pinned in §2.5, and sprint order respects all dependencies. The cleanest next move is to convert all P0 items in Sprints 1 and 2 into tracked tickets, assign owners, and attach the acceptance criteria verbatim. Do not renegotiate package choices at the ticket level — open a backlog discussion instead.