# AssistAI MVP Plan

## 1. Executive Summary

AssistAI should launch as a narrow, high-trust writing product for Spanish-speaking legal professionals, not as a general AI workspace. The MVP is a web editor with copilot-style inline completions grounded in the user's own documents, with Google Drive as the primary corpus source, optional IPFS manual import, and a choice between a user-supplied model endpoint or AssistAI-managed inference through OpenRouter.

The product will succeed if it makes grounded drafting feel fast and trustworthy. That means spending engineering effort on ingestion quality, retrieval quality, inline completion latency, and privacy clarity, while aggressively cutting features that do not improve activation, trust, or retention.

## 2. Product Positioning

### Problem

Professionals who draft long-form, domain-specific text waste time searching past documents, reusing preferred language, and validating phrasing. Generic AI copilots are fast but weak on user-specific style and context.

### Initial wedge

- Primary beta cohort: lawyers and legal teams.
- Interview and waitlist cohorts: journalists and public administration staff.
- Primary market language: Spanish.

### Core promise

"Write faster with suggestions grounded in your own corpus."

This is stronger than "AI editor" and narrower than "AI knowledge workspace," which is important for the first 3 months.

## 3. MVP Scope

### Must have

- Web editor with inline ghost-text suggestions.
- Tab-to-accept interaction.
- User account and single-user workspace.
- Google Drive connection with user-selected files or folders.
- Document ingestion for TXT, Markdown, DOCX, and text-based PDFs.
- Retrieval-augmented completion pipeline.
- Source evidence panel showing the top retrieved references behind a suggestion.
- Model configuration for either:
  - BYO model endpoint.
  - Managed inference through OpenRouter.
- Spanish-first UX and error states.
- Usage and latency instrumentation.

### Should have if delivery is on track

- IPFS manual import by CID for public text documents.
- Re-index action per source.
- Basic document library inside the workspace.
- A small set of legal-oriented prompt presets in Spanish.

### Explicitly out of scope

- Real-time collaboration.
- Side chat.
- Agents or workflow automation.
- Fine-tuning.
- Team permissions and enterprise RBAC.
- SSO, SCIM, team billing.
- OCR-heavy workflows and scanned PDF support.
- Continuous Drive sync.
- Mobile app.

## 4. Product Decisions To Lock Early

These should not stay open past week 2.

1. The primary interaction is inline completion inside the editor, not chat.
2. Google Drive is the primary source connector for beta; IPFS is secondary and limited.
3. The first beta optimizes for lawyers, not three verticals at once.
4. The system indexes selected files on demand, not the full Drive continuously.
5. The app supports a strict BYO endpoint contract instead of arbitrary provider behavior.

## 5. Recommended Tech Stack

### Frontend

- Runtime and package management: Node.js + pnpm.
- App: React + Vite.
- Editor: Tiptap.
- State:
  - TanStack Query for server data.
  - Zustand only for local editor and UI state if needed.

Why this stack:

- React + Vite is fast to ship and easy to hire for.
- Tiptap is the correct abstraction for editor-driven AI UX.
- TanStack Query is enough for remote state and reduces custom caching logic.
- Zustand is optional; do not introduce it unless the editor state actually needs it.

### Backend

- Framework: NestJS.
- Architecture: modular monolith.
- API shape:
  - GraphQL for product data.
  - REST for completions, streaming, OAuth callbacks, and health checks.
- Background jobs: BullMQ.
- Cache and queue backend: Redis.

Why this stack:

- NestJS is productive for a structured Node backend.
- A modular monolith is materially better than microservices for a 3-month MVP.
- GraphQL fits the settings/source/document UI well.
- Completion generation is operationally closer to an RPC or streaming REST endpoint than GraphQL.

### Data layer

- Primary database: PostgreSQL.
- Vector search: pgvector in the same PostgreSQL cluster.
- Do not use SQLite for users.
- Do not start with pgEdge unless multi-region replication becomes a real requirement.

Why this stack:

- PostgreSQL plus pgvector is the simplest reliable RAG stack for an MVP.
- Keeping users, documents, permissions, embeddings metadata, and usage in one datastore reduces operational risk.
- SQLite adds unnecessary split-brain complexity for a SaaS backend.
- pgEdge is interesting, but it is extra complexity before product-market proof.

### Integrations and inference

- Managed provider path: OpenRouter.
- BYO endpoint path: OpenAI-compatible HTTPS endpoints only for MVP.
- Embeddings: one multilingual model from day one.

### Deployment

- Local development: Docker Compose.
- First production target: single VM or small hosted setup with:
  - reverse proxy,
  - frontend,
  - API,
  - worker,
  - managed PostgreSQL if possible,
  - managed Redis if possible.

## 6. System Architecture

### High-level shape

AssistAI should be built as a modular monolith with separate runtime processes for the API and workers.

Core modules:

1. Auth and sessions.
2. Workspace and settings.
3. Source connectors.
4. Document ingestion.
5. Indexing and embeddings.
6. Retrieval.
7. Completion orchestration.
8. Provider adapters.
9. Usage and observability.

### Request flow for inline completion

1. User types in the editor.
2. Client debounces and sends prefix, optional suffix, workspace, and session context.
3. Server decides whether retrieval is needed.
4. If needed, vector search returns the top 3 to 6 relevant chunks.
5. Prompt builder assembles:
   - system instructions,
   - language rules,
   - recent editor context,
   - retrieved evidence.
6. Selected model endpoint generates the completion.
7. Server streams tokens back to the editor.
8. Usage and latency events are logged asynchronously.

### Ingestion and indexing pipeline

1. User connects a source.
2. Source scan discovers selected files.
3. Each file creates an ingestion job.
4. Parser extracts normalized text.
5. Chunker splits text into retrieval-ready chunks.
6. Embedder generates vectors.
7. PostgreSQL stores documents, chunks, and metadata.
8. Indexing status is exposed back to the UI.

### Parser strategy

- TXT and Markdown: direct parse.
- DOCX: Mammoth or equivalent.
- PDF: pdf-parse first.
- OCR fallback: postpone unless a narrow subset of customers truly needs it.

## 7. Performance Targets

Inline completion only works if it feels immediate.

Target budgets:

- Retrieval: 30 to 80 ms.
- Prompt assembly: under 10 ms.
- Provider first token: under 800 ms on the managed path.
- End-to-end median completion latency: under 1.5 s.
- End-to-end p95 completion latency: under 3.0 s.

Latency control rules:

- Keep top-k low, usually 3 or 4.
- Use only the recent local editor window for inline completion.
- Skip retrieval for very short local continuation cases.
- Cache recent retrieval results per editor session for a short TTL.
- Use a small fallback chain, not multi-provider routing complexity.

## 8. Privacy and Security Baseline

AssistAI should market itself as privacy-conscious, not privacy-magical. The product should be explicit about what leaves the platform and when.

### Must ship controls

- TLS everywhere in production.
- Secure server-managed sessions using `HttpOnly` cookies.
- CSRF protection on state-changing browser endpoints.
- Strict tenant isolation in relational queries, vector search filters, cache keys, and jobs.
- Server-side encrypted storage for OAuth tokens and provider credentials.
- Secret redaction in logs and traces.
- Narrow Google OAuth scopes using `drive.file`.
- Isolated ingestion worker with MIME, size, and timeout limits.
- HTTPS-only BYO endpoints with SSRF protections.
- Data deletion workflow for indexed content, credentials, and caches.
- Basic audit trail for security-relevant actions.
- Rate limits and usage caps.

### Important privacy constraints

- Google Drive authentication and product authentication should be separate flows.
- IPFS is not private by default and should be presented carefully.
- Public IPFS content should be treated as effectively irreversible.
- The UI must clearly indicate when prompts or retrieved content are sent to an external model provider.

### BYO endpoint policy for MVP

- HTTPS only.
- No private network or localhost targets.
- No self-signed certificates.
- Strict timeout and response-size limits.
- Re-check DNS to reduce rebinding risk.
- Support only public OpenAI-compatible APIs in the first release.

## 9. Data Model

Core entities:

- users
- workspaces
- model_endpoints
- content_sources
- source_sync_runs
- documents
- document_versions
- document_chunks
- editor_sessions
- completion_requests
- completion_retrieval_hits
- usage_events

Key rule: everything that can leak across tenants must carry `workspace_id` and be filtered by it.

## 10. Product Analytics and KPIs

### Core beta KPIs

- Activation rate:
  - invited users who connect a corpus, index content, and receive at least one completion within 48 hours.
  - Target: 60%+
- Time to first value:
  - signup to first accepted grounded suggestion.
  - Target: under 20 minutes.
- Weekly active writers:
  - users with at least one editing session and one suggestion impression in the week.
  - Target: 50%+ of onboarded beta users.
- Suggestion acceptance rate:
  - Target: 20% to 30%.
- Source inspection rate:
  - Target: 25%+ of accepted-suggestion sessions.
- Grounded suggestion coverage:
  - suggestions backed by at least one retrievable source.
  - Target: 80%+
- Week-4 retention:
  - activated users still writing weekly after 4 weeks.
  - Target: 30%+

### Beta decision gates

- Do not expand to a second vertical unless activation, latency, and week-4 retention meet target for at least two consecutive weeks.
- Do not add major product features during beta unless they improve activation, trust, or retention.

## 11. 12-Week Delivery Plan

### Weeks 1-2: Scope lock and customer validation

- Interview 6 to 8 Spanish-speaking legal professionals.
- Validate the top drafting jobs and most common file types.
- Freeze:
  - beta persona,
  - supported formats,
  - source evidence UX,
  - BYO endpoint contract.
- Finalize privacy and data-flow messaging.

Exit criteria:

- A single, explicit MVP scope is locked.
- The product promise is clear enough to recruit a private beta cohort.

### Weeks 3-4: Foundation

- Set up pnpm monorepo.
- Build React + Vite app shell.
- Add Tiptap editor base.
- Build NestJS API and worker services.
- Stand up PostgreSQL, pgvector, Redis, and Docker Compose.
- Implement auth, workspace basics, and Google Drive connection flow.

Exit criteria:

- A user can sign in, connect Drive, and select files for indexing.

### Weeks 5-6: Ingestion and retrieval core

- Implement file discovery and ingestion jobs.
- Parse TXT, Markdown, DOCX, and text-based PDFs.
- Build chunking and embeddings.
- Add indexing status states: queued, indexed, failed.
- Expose retrieval debugging and operational logs.

Exit criteria:

- Indexed files can be retrieved reliably for a drafting prompt.

### Weeks 7-8: Editor completion experience

- Implement ghost-text completions.
- Implement tab-to-accept.
- Connect retrieval output to prompt assembly and generation.
- Add evidence panel with top supporting sources.
- Instrument completion impression, accept, dismiss, and failure events.

Exit criteria:

- End-to-end grounded inline completion works for internal dogfooding.

### Weeks 9-10: Hardening and trust

- Add OpenRouter managed path.
- Add BYO endpoint settings and validation.
- Add privacy disclosures and Spanish error states.
- Harden credential storage and session handling.
- Add basic admin troubleshooting for indexing and provider failures.

Exit criteria:

- The product is safe enough and understandable enough for a small external beta.

### Weeks 11-12: Private beta

- Onboard 15 to 25 users from the legal cohort.
- Track KPIs daily.
- Fix only issues that block activation, trust, or stable drafting.
- Defer feature requests outside the frozen scope.
- Make the go or no-go decision for segment expansion.

Exit criteria:

- You know whether users want this enough to keep narrowing or start expanding.

## 12. Main Risks and Mitigations

### Risk: latency makes the editor feel bad

Mitigation:

- keep prompts compact,
- keep retrieval shallow,
- prefer faster providers first,
- skip retrieval when local completion is enough.

### Risk: Drive integration consumes too much schedule

Mitigation:

- support only user-selected files or folders,
- avoid continuous sync,
- avoid broad Drive scopes.

### Risk: BYO model endpoints are unreliable

Mitigation:

- publish a strict compatibility contract,
- validate endpoints during setup,
- support a narrow list of expected behaviors.

### Risk: retrieval quality is not good enough

Mitigation:

- prioritize text-native documents,
- tune chunking for Spanish legal writing,
- inspect retrieval hits during internal dogfooding,
- log bad evidence patterns early.

### Risk: scope creep from multiple personas and features

Mitigation:

- one primary persona,
- one primary connector,
- one primary interaction,
- one explicit beta KPI framework.

## 13. Final Recommendation

The right MVP is not "AI editor for everyone." It is "Spanish-first legal drafting assistant grounded in your own documents." The correct architecture is a modular monolith on NestJS with PostgreSQL, pgvector, Redis, BullMQ, React, Vite, and Tiptap. The correct product discipline is to ship one strong loop:

1. connect documents,
2. index them,
3. write in the editor,
4. receive grounded completions,
5. verify evidence,
6. keep using it because it saves time.

If the team protects that loop and rejects adjacent feature pressure for 12 weeks, AssistAI has a credible path to a useful MVP.