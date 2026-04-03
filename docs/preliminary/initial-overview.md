# AssistAI MVP Architecture Plan

## 1. Product Focus for a 3-Month MVP

AssistAI should be built as a backend-first product whose single differentiator is: generate low-latency inline text completions grounded in the user's own corpus.

The MVP should only optimize for these outcomes:

1. A user can connect a document source: Google Drive or IPFS.
2. The system can ingest supported files: PDF, DOCX, TXT, Markdown.
3. The system can index that content for retrieval.
4. The editor can request inline completions with relevant contextual grounding.
5. The user can choose either AssistAI-managed inference via OpenRouter or a bring-your-own model endpoint.

Everything else should be treated as post-MVP unless it is required to support those flows.

Do not include in MVP:

1. Fine-tuning.
2. Advanced collaboration.
3. Full billing automation.
4. Complex multi-tenant role models.
5. Real-time multi-user editing.
6. Multi-provider routing logic beyond a small fallback chain.
7. Full document version control.

## 2. Recommended Architecture

### Architecture Pattern

Recommended for MVP: modular monolith backend, not microservices.

Why:

1. A 3-month MVP needs fast iteration and simple operations.
2. Ingestion, retrieval, completion orchestration, auth, and provider management are strongly coupled early on.
3. NestJS modules give enough internal separation without the overhead of distributed systems.

Recommended stack:

1. Frontend: React + Vite + Tiptap.
2. Backend: NestJS.
3. API shape: GraphQL for product data and editor state, REST for high-frequency completion and integration callbacks.
4. Primary database: PostgreSQL.
5. Vector search: pgvector in the same PostgreSQL cluster.
6. Cache and queue: Redis.
7. Background jobs: BullMQ.
8. Object/file handling: source pointers plus normalized extracted text in PostgreSQL, optional object storage later.
9. Infra: Docker Compose for local dev and initial single-host deployment.

### Recommended High-Level Components

1. Web app
   React app with Tiptap editor, auth flows, source management UI, and indexing status.
2. API app
   NestJS application exposing GraphQL and REST endpoints.
3. Job workers
   Separate NestJS worker process consuming BullMQ jobs for ingestion, parsing, chunking, embedding, and reindexing.
4. PostgreSQL
   Stores users, workspaces, sources, documents, chunks, embeddings metadata, completions logs, and configuration.
5. Redis
   Stores job queue state, rate limiting counters, ephemeral completion caching, and short-lived session data if needed.
6. IPFS node
   Optional in self-hosted and privacy-oriented setups. For MVP, support both external IPFS gateway references and a bundled local node.
7. External integrations
   Google Drive API, OpenRouter API, user-provided model endpoints, embedding provider.

### Backend Module Breakdown

Recommended NestJS module boundaries:

1. AuthModule
   User auth, sessions, API keys, provider credentials.
2. WorkspaceModule
   Workspaces, settings, quotas, language preferences.
3. SourceModule
   Google Drive and IPFS connectors, sync registration, source health.
4. DocumentModule
   Documents, extraction state, parsing results, content snapshots.
5. IndexingModule
   Chunking, embeddings, vector search, reindex policies.
6. CompletionModule
   Prompt assembly, retrieval, provider routing, latency budgeting, streaming.
7. ProviderModule
   OpenRouter integration plus BYO endpoint adapters.
8. UsageModule
   Request logs, token usage, cost attribution, rate limits.
9. ObservabilityModule
   Structured logs, tracing hooks, metrics.

## 3. Explicit MVP Trade-Offs and Simplifications

### Monolith vs Microservices

Recommendation: modular monolith.

Trade-off:

1. Pro: faster delivery, easier debugging, simpler local setup.
2. Pro: transactional consistency is easier across ingestion and indexing.
3. Con: less independent scaling later.
4. Con: module boundaries need discipline to avoid entanglement.

For MVP, the benefits clearly outweigh microservice purity.

### PostgreSQL + pgvector vs Dedicated Vector DB

Recommendation: PostgreSQL + pgvector.

Trade-off:

1. Pro: one operational datastore, fewer failure modes.
2. Pro: easier joins between chunks, documents, users, and permissions.
3. Pro: strong fit for MVP scale.
4. Con: retrieval performance ceiling is lower than specialized vector systems at large scale.

For an MVP focused on early customers, PostgreSQL is the right simplification.

### Queueing

Recommendation: add Redis + BullMQ from day one.

Trade-off:

1. Pro: ingestion and reindexing are naturally asynchronous.
2. Pro: keeps completion path isolated from parsing and embedding workloads.
3. Con: adds one more infra component.

This is justified because background work is core, not optional.

### Google Drive Sync Scope

Recommendation: start with user-selected folders and manual re-sync.

Trade-off:

1. Pro: much simpler permissions and sync logic.
2. Pro: avoids building a full change-data-capture system in month one.
3. Con: less seamless than full live sync.

Later, add webhook or scheduled delta sync.

### IPFS Scope

Recommendation: treat IPFS as a document source and optional persistence destination, not a full decentralized collaboration layer.

Trade-off:

1. Pro: preserves privacy-oriented positioning.
2. Pro: keeps implementation bounded to fetch/pin/store flows.
3. Con: no complex peer coordination or advanced content graph features.

## 4. API Strategy: GraphQL vs REST

### Recommended Split

Keep GraphQL, but do not force everything through GraphQL.

Use GraphQL for:

1. Workspace data.
2. User profile and settings.
3. Source and document inventory.
4. Indexing status.
5. Historical usage and completion metadata.
6. Editor bootstrap queries.

Use REST for:

1. Completion requests.
2. Streaming completion responses.
3. OAuth callback endpoints.
4. File ingestion webhooks.
5. Health checks.
6. Provider connectivity tests.

### Opinion

Schema-first GraphQL is reasonable for the product surface because the UI will query mixed resource graphs like workspaces, sources, documents, and indexing states. But completion generation is not a natural GraphQL workload because it is latency-sensitive, often streamed, and operationally closer to an RPC endpoint.

Recommendation:

1. Keep GraphQL for product data.
2. Prefer REST for completion and integration callbacks.
3. Avoid GraphQL subscriptions in MVP unless there is a real need; polling or SSE is enough.

## 5. SQLite vs PostgreSQL for Users

### Opinion

Do not use SQLite for users if PostgreSQL already exists for the platform.

Recommendation: keep users, auth, workspace metadata, sources, and indexing data in the same PostgreSQL database.

Why:

1. User identity is tightly coupled to document access and retrieval permissions.
2. Splitting SQLite for users and PostgreSQL for everything else adds complexity without a real MVP advantage.
3. SQLite becomes awkward once you need concurrency, hosted deployment, auditability, backups, and joins across user/workspace/content tables.
4. A second database engine increases migration and operational burden.

When SQLite would make sense:

1. Purely local desktop/offline product.
2. Single-user edge deployment.
3. Embedded-only prototype.

But for a web SaaS MVP, PostgreSQL should be the single source of truth.

## 6. Data Model for MVP

Use PostgreSQL schemas with pgvector enabled.

### Core Entities

#### users

1. id
2. email
3. password_hash or external_auth_subject
4. display_name
5. locale
6. created_at
7. last_login_at
8. status

#### workspaces

1. id
2. owner_user_id
3. name
4. primary_language
5. created_at
6. plan_tier
7. byo_model_enabled

#### workspace_members

1. id
2. workspace_id
3. user_id
4. role

This can be minimal in MVP even if there is only one owner role at first.

#### model_endpoints

1. id
2. workspace_id
3. provider_type: openrouter, openai_compatible, local, custom
4. base_url
5. model_name
6. encrypted_api_key
7. is_default
8. supports_streaming
9. supports_embeddings
10. status

#### content_sources

1. id
2. workspace_id
3. source_type: google_drive, ipfs
4. display_name
5. auth_reference
6. root_locator
7. sync_mode: manual, scheduled
8. last_synced_at
9. status

#### source_sync_runs

1. id
2. source_id
3. started_at
4. finished_at
5. status
6. discovered_count
7. changed_count
8. error_summary

#### documents

1. id
2. workspace_id
3. source_id
4. external_document_id
5. title
6. mime_type
7. language_detected
8. checksum
9. source_uri
10. current_version
11. ingest_status
12. indexed_at
13. last_modified_at_source

#### document_versions

1. id
2. document_id
3. version_label
4. raw_text
5. normalized_text
6. extraction_method
7. token_count
8. created_at

For MVP, this can be capped to the latest version plus one historical snapshot if storage becomes a concern.

#### document_chunks

1. id
2. document_version_id
3. chunk_index
4. content
5. language
6. token_count
7. heading_path
8. char_start
9. char_end
10. embedding vector
11. embedding_model
12. content_hash

#### editor_sessions

1. id
2. workspace_id
3. user_id
4. document_title
5. active_language
6. created_at
7. last_activity_at

This stores editor state metadata, not full collaborative editing.

#### completion_requests

1. id
2. workspace_id
3. user_id
4. editor_session_id
5. model_endpoint_id
6. request_type: inline, expand, rewrite
7. input_prefix_chars
8. input_suffix_chars
9. retrieved_chunk_count
10. latency_ms
11. provider_latency_ms
12. outcome_status
13. accepted_by_user
14. created_at

#### completion_retrieval_hits

1. id
2. completion_request_id
3. document_chunk_id
4. rank
5. similarity_score

#### usage_events

1. id
2. workspace_id
3. user_id
4. event_type
5. units
6. cost_estimate
7. created_at

### Security-Sensitive Data

Encrypt at rest where possible for:

1. OAuth refresh tokens.
2. BYO provider API keys.
3. Potentially raw extracted text if privacy posture requires it.

At minimum, use application-level encryption for secrets and database-level encryption for storage volumes.

## 7. Ingestion and Indexing Pipeline

### MVP Pipeline

The ingestion pipeline should be fully asynchronous.

1. User connects source.
2. Source scan job discovers candidate files.
3. Each file produces an ingestion job.
4. File fetcher downloads file bytes or streams content.
5. Parser extracts text.
6. Normalizer cleans text and tags language.
7. Chunker creates retrieval-ready chunks.
8. Embedder generates embeddings.
9. Upserter writes document, version, chunks, and embeddings.
10. Indexing status is updated for the UI.

### Parsing Strategy

Use a pragmatic parser selection chain:

1. TXT and Markdown: direct parse.
2. DOCX: mammoth or equivalent DOCX text extractor.
3. PDF: start with pdf-parse.
4. OCR fallback: scribe.js only when text extraction quality is below threshold.

This avoids expensive OCR on every PDF.

### Chunking Strategy

Recommended MVP chunking:

1. Chunk target: 400 to 700 tokens.
2. Overlap: 60 to 120 tokens.
3. Prefer paragraph-aware and heading-aware splitting.
4. Preserve source references so completions can cite or internally trace origin.

Avoid sophisticated semantic segmentation initially. Good-enough chunk quality is sufficient for MVP.

### Reindex Triggers

Reindex when:

1. A new document appears.
2. Checksum changes.
3. Embedding model changes.
4. Chunking rules change.
5. Language normalization policy changes.

### Embedding Strategy

Recommendation:

1. Use a single multilingual embedding model from day one.
2. Store model name on each chunk.
3. Do not mix embeddings from multiple models inside the same retrieval index without explicit versioning.

This supports Spanish-first while avoiding a future re-architecture for English.

### Indexing Simplifications for MVP

1. No hybrid BM25 plus vector search in v1 unless retrieval quality is clearly poor.
2. No full document graph ranking.
3. No per-user custom chunking strategies.
4. No near-real-time auto-sync from every connector.

## 8. Completion Pipeline

### Goal

Inline completion should feel fast enough for a copilot-style editor. The completion path must be optimized for perceived latency, not maximum context size.

### Recommended Request Flow

1. Editor sends prefix, optional suffix, workspace ID, session ID, and active language.
2. Completion service applies debounce and minimum prefix thresholds client-side.
3. Server runs lightweight intent gate:
   decide whether retrieval is necessary.
4. If retrieval is needed, server builds a compact query from recent text window.
5. Vector search returns top 3 to 6 chunks.
6. Prompt builder assembles:
   system rules, language instruction, style instruction, recent user text window, and retrieved context.
7. Provider adapter sends request to selected model.
8. Server streams response back to editor.
9. Request metadata is logged asynchronously.

### Latency-Conscious Rules

Use these constraints for MVP:

1. Keep retrieval top-k low: usually 3 to 4.
2. Use only the last 500 to 1200 characters of local editor context for inline completion.
3. Skip retrieval for very short prompts unless the user explicitly asks for knowledge-grounded generation.
4. Cache recent retrieval hits per editor session for a short TTL.
5. Cache prompt fragments for workspace rules and language policy.
6. Stream tokens immediately once provider starts responding.
7. Set strict timeout budgets with fallback behavior.

Example budget:

1. Retrieval budget: 30 to 80 ms.
2. Prompt assembly budget: under 10 ms.
3. Provider first-token target: under 800 ms on managed providers.
4. End-to-end perceived response target: 700 to 1500 ms.

### When to Skip RAG

Not every completion request needs retrieval. For MVP, add a simple gating heuristic:

1. Skip retrieval when the user is continuing a sentence in a highly local context.
2. Run retrieval when there are domain terms, citations, legal references, named entities, or the prefix suggests knowledge reuse.
3. Allow users to toggle a stronger grounding mode later.

This will reduce latency and cost materially.

### Provider Routing

Recommended provider policy:

1. Workspace default endpoint.
2. If it fails, optional fallback to OpenRouter only when the workspace permits it.
3. Log all routing decisions for supportability.

Do not implement a complex round-robin marketplace in MVP production. It complicates determinism and support.

For development, fallback across low-cost providers is acceptable.

## 9. Multilingual Strategy

### MVP Language Positioning

Spanish first, English later, but architect the backend to avoid a rewrite.

### Recommended Language Approach

1. Store `primary_language` at workspace level.
2. Detect language per document and per chunk.
3. Pass active editor language into completion requests.
4. Use multilingual embeddings from day one.
5. Prompt the model to answer in the language of the editor unless the user overrides it.

### Why This Is Better Than Spanish-Only Internals

1. Your early market is Spanish-speaking, so UX and prompt defaults should prioritize Spanish.
2. But source data and future customers may mix Spanish and English.
3. Multilingual embeddings avoid later reindex pain.

### Simplification

Do not build translation in the pipeline.

Instead:

1. Index original language text.
2. Retrieve in original language.
3. Let the prompt instruct the model on response language.

Only add translation or cross-lingual reranking if actual retrieval quality requires it.

## 10. Auth, Privacy, and Security for MVP

### Security Goal

For a 3-month MVP, the security target should be: protect user documents, tokens, and completions from common web and SaaS failures; avoid making privacy claims that the product cannot technically enforce; and keep the design simple enough to ship on time.

This baseline assumes:

1. AssistAI is a multi-tenant SaaS.
2. Product authentication is separate from Google Drive connection.
3. Google Drive and IPFS are optional sources.
4. Users may use OpenRouter or their own model endpoint.
5. The service stores extracted text, chunks, embeddings, and limited operational metadata server-side.

### Threat Model: Top Risks

| Risk | Why it matters | MVP control | Priority |
| --- | --- | --- | --- |
| Cross-tenant data leakage | A bug in retrieval, caching, or prompt assembly could expose one user's documents to another user. | Enforce workspace ID on every record, chunk, embedding, cache key, and query path; add tests for tenant isolation. | Critical |
| Token or API key compromise | Google refresh tokens, OpenRouter keys, and BYO model credentials grant access to external services and customer data. | Store secrets only server-side, encrypt at rest, redact from logs, restrict operator access. | Critical |
| Prompt and data exfiltration to model providers | User documents may be sent to OpenRouter or another provider and retained outside AssistAI's control. | Minimize prompt data, disclose processors, make external model use explicit, and avoid unverified "no retention" claims. | High |
| SSRF through BYO model endpoint | Arbitrary endpoint URLs can be abused to hit internal services, metadata endpoints, or local network targets. | Allow only HTTPS, block private and reserved IP ranges, restrict redirects and ports, and re-check DNS. | Critical |
| Over-scoped Google Drive access | Broad OAuth scopes increase blast radius if tokens are stolen and make Google verification harder. | Use incremental consent and prefer `drive.file`. | High |
| Irreversible IPFS disclosure | Public IPFS content is effectively permanent and broadly replicable; deletion is not realistic. | Do not market raw IPFS as private storage; require explicit warnings and recommend encryption before upload. | Critical |
| Malicious documents | PDFs and Office docs may exploit parsers, overload workers, or inject hostile instructions into prompts. | Isolate ingestion workers, validate file types and sizes, apply timeouts, treat document text as untrusted prompt input. | High |
| Session hijacking or account takeover | A stolen browser token or weak session design exposes all connected data sources. | Use secure cookie sessions, CSRF protection, short-lived sessions, and recent-auth checks for sensitive actions. | High |
| Excessive retention | Keeping extracted text, embeddings, prompts, and logs longer than needed increases privacy and breach impact. | Define short retention defaults and implement delete propagation across active stores and backups. | High |
| Abuse and cost denial of service | Attackers can drive up LLM and embedding costs or starve the service. | Rate limits, quotas, per-workspace caps, ingestion size limits, and anomaly alerts. | Medium |

### Minimum Security Requirements

These are the minimum controls worth shipping for MVP.

#### Must ship

1. TLS everywhere in production.
2. Secure cookie-based web sessions with `HttpOnly`, `Secure`, and `SameSite=Lax` or stricter.
3. CSRF protection on all state-changing browser endpoints.
4. Strict tenant isolation in relational queries, vector search filters, caches, job queues, and object storage paths.
5. All provider tokens and user-supplied API keys stored only server-side and encrypted at rest.
6. Secrets never written to logs, analytics, traces, or client-visible responses.
7. OAuth with least-privilege scopes and separate consent for Google Drive connection.
8. File ingestion in a separate worker/container with file type, file size, and timeout limits.
9. BYO model endpoint SSRF defenses and egress restrictions.
10. Minimal audit trail for security events: login, logout, Drive connect/disconnect, token refresh failure, key update, deletion request, admin access.
11. Data deletion workflow that removes cached files, extracted text, chunks, embeddings, and model credentials.
12. Rate limiting for login, ingestion, completion, embedding, and admin routes.
13. Backup encryption and documented backup retention.
14. Public privacy documentation that clearly states what data leaves AssistAI and which subprocessors receive it.

#### Strongly recommended if time allows

1. MFA for admin accounts.
2. Session revocation UI.
3. Signed upload URLs or isolated ingestion bucket.
4. Alerting on suspicious login or abnormal token use.
5. Malware scanning for uploaded files.

#### Postpone until after MVP

1. SAML or SCIM.
2. Customer-managed encryption keys.
3. Regional data residency controls.
4. Formal SOC 2 or ISO 27001 program.
5. Fine-grained DLP and content classification.
6. Full external penetration test before every release.

### Authentication and Session Design

#### Recommended MVP approach

1. Product auth should be separate from Google Drive auth.
2. Use email magic link or another passwordless flow as the primary account method.
3. Offer Google sign-in only as a convenience login option, not as the only way to access the product.
4. Link Google Drive later through a separate OAuth flow with incremental consent.

This matters because privacy-focused users may want IPFS or their own model endpoint without using Google identity at all.

#### Session design

1. Use opaque server-managed session IDs, not long-lived JWTs in browser storage.
2. Store the session token in an `HttpOnly` secure cookie.
3. Keep session lifetime short, for example 8 to 12 hours of inactivity, with a bounded remember-me option if needed.
4. Rotate the session on login, privilege change, and sensitive account events.
5. Require recent re-authentication before changing email, connecting or disconnecting Google Drive, adding or rotating BYO model credentials, or deleting the account.
6. Protect all state-changing routes with CSRF tokens.
7. Keep a server-side session store so sessions can be revoked immediately.

#### Admin access

1. Separate admin identities from normal customer accounts.
2. Enforce MFA for admin and operator accounts for MVP.
3. Record all admin access to customer metadata and support actions.

### Credential and Secret Handling

#### What must be treated as secrets

1. Google OAuth access and refresh tokens.
2. OpenRouter API keys.
3. User-supplied BYO model API keys or bearer tokens.
4. Internal signing keys, encryption keys, and session secrets.
5. Database credentials and any IPFS pinning provider secrets.

#### Storage rules

1. Never store secrets in the browser except temporary OAuth state and PKCE verifier values.
2. Never expose provider secrets back to the client after initial save.
3. Encrypt stored customer secrets at rest using envelope encryption backed by a cloud KMS if available.
4. If KMS is not available for MVP, store secrets encrypted with a dedicated server-side master key kept outside the database and rotated on a defined schedule.
5. Keep application secrets in a managed secret store or protected environment variables, not in source control and not in Docker images.

#### Operational rules

1. Redact secrets from logs by default.
2. Prevent secrets from being copied into analytics, tracing spans, and error monitoring.
3. Give production secret access only to the runtime and a minimal set of operators.
4. Support manual revocation and rotation of Google tokens and BYO credentials.
5. On Google disconnect, revoke the token at Google and delete the local copy.

### Data Retention and Deletion Policy

For privacy-conscious users, retention should be short by default and easy to explain.

#### Recommended default retention

1. Account profile and billing records: keep while the account is active, then retain only what is legally required.
2. Google OAuth tokens and BYO model credentials: keep until the integration is disconnected or the account is deleted.
3. Cached source files from Google Drive: keep only as long as needed for ingestion or sync; avoid long-term raw file storage unless the product explicitly needs it.
4. Extracted text, chunks, and embeddings: keep while the data source remains connected and indexing is enabled.
5. Prompt and completion bodies: do not retain by default for product analytics; if stored for UX history, make it explicit and user-controlled.
6. Security and operational logs: 30 to 90 days, with content redaction.
7. Backups: encrypted, retained for a short fixed period such as 30 to 35 days.

#### Deletion commitments that are realistic

1. On document removal or source disconnect, queue deletion of cached files, extracted text, chunks, embeddings, and search indexes within 24 hours.
2. On account deletion, disable access immediately and complete asynchronous purge of active data stores within 7 days.
3. State clearly that encrypted backups may persist until the backup retention window expires.
4. Keep a deletion audit record that the purge job ran, without retaining the user content itself.

#### Privacy wording to avoid

1. Do not claim "complete deletion everywhere" if backups or third-party processors retain copies temporarily.
2. Do not claim "private by default" for IPFS unless content is encrypted client-side before publishing.
3. Do not claim "no provider retention" unless the provider contract and configuration explicitly guarantee it.

### IPFS-Specific Caveats

IPFS is the hardest part of the privacy story. The product should be explicit here.

#### MVP-safe position

1. Treat raw IPFS as a publication or distribution mechanism, not a deletion-friendly private document store.
2. Warn users that any unencrypted content uploaded to public IPFS can become globally retrievable and effectively permanent.
3. Explain that deleting a local pin does not erase copies already replicated by other peers or gateways.

#### Specific caveats to document

1. CIDs are content-addressed and can be shared indefinitely.
2. File names, directory structure, and access patterns may leak metadata.
3. Public gateways can observe which CIDs are requested.
4. Pinning services may store data in jurisdictions outside the user's preference.
5. IPNS improves mutability, not confidentiality.
6. Sensitive content should only go to IPFS if the user encrypts it before upload and manages keys outside AssistAI.

#### Practical MVP requirement

1. If AssistAI offers IPFS upload from the UI, the UI must show a clear warning and require explicit confirmation before uploading any unencrypted content.
2. For privacy-sensitive positioning, present Google Drive or other private storage as safer than raw public IPFS unless client-side encryption is added later.

### Google OAuth Scope Guidance

#### Recommended scopes

1. For sign-in only: `openid`, `email`, `profile`.
2. For Drive integration: prefer `https://www.googleapis.com/auth/drive.file`.

`drive.file` is usually the best MVP scope because it lets the app access files the user explicitly opens with the app or selects for the app, which reduces blast radius and makes verification easier.

#### Scope decisions

1. Avoid full `drive` scope for MVP unless broad browsing and background processing across all Drive files is truly required.
2. Avoid `drive.readonly` if a file picker plus `drive.file` meets the product need.
3. Request offline access only if background sync is necessary. If sync happens only during active use, avoid refresh tokens.
4. Use incremental consent: first sign the user in, then ask for Drive access only when they enable that feature.

#### Implementation rules

1. Store Google tokens server-side only.
2. Encrypt refresh tokens at rest.
3. Revoke tokens on disconnect.
4. Restrict redirect URIs exactly.
5. Validate OAuth `state` and use PKCE.
6. Separate Google login and Google Drive connection in both UI and backend logic.

### BYO Model Endpoint Safeguards

Supporting arbitrary model endpoints introduces the biggest custom risk surface.

#### SSRF and network controls

1. Accept only `https://` endpoints in production.
2. Deny endpoints that resolve to localhost, loopback, RFC1918 private ranges, link-local addresses, multicast ranges, and cloud metadata addresses.
3. Re-resolve DNS on each connection or on a short cache to reduce DNS rebinding risk.
4. Disable or tightly restrict redirects.
5. Restrict outbound ports to a small allowlist such as 443 and 8443.
6. Apply connect, read, and total request timeouts.
7. Apply response size limits.
8. Never forward browser cookies, internal headers, or cloud instance credentials.

#### Data minimization and exfiltration reduction

1. Send only the minimum prompt context needed for completion.
2. Cap the number and length of retrieved chunks inserted into prompts.
3. Treat all document text as untrusted input; do not let documents override system behavior.
4. Never place internal secrets, admin data, or raw provider tokens into prompts.
5. Disable tool execution from model responses for MVP unless there is a strict allowlist.
6. Make it explicit in the UI when user data is being sent to OpenRouter or another external endpoint.

#### Product guardrails

1. For MVP, support only public HTTPS endpoints reachable from the AssistAI backend.
2. Postpone support for private LAN, self-signed TLS, SSH tunnels, or arbitrary intranet endpoints.
3. Require the user to confirm endpoint ownership and retention terms when connecting a custom endpoint.
4. Store endpoint metadata separately from credentials.
5. Run a validation check at setup time that verifies certificate validity, model compatibility, and network policy compliance.

### Compliance-Ready Checklist for Privacy-Conscious Users

This is not a certification checklist. It is the minimum set of controls that lets AssistAI speak credibly with privacy-conscious professionals.

#### Product and policy checklist

1. Publish a privacy notice that clearly lists subprocessors, data flows, retention windows, and deletion behavior.
2. State whether prompts, completions, chunks, and embeddings are stored, for how long, and why.
3. State whether user data is used for model training by AssistAI or any provider.
4. Explain that Google Drive and external model providers are separate processors with their own terms.
5. Explain the IPFS permanence caveat in plain language.

#### Technical checklist

1. Encryption in transit.
2. Encryption at rest for stored credentials and tokens.
3. Tenant isolation tests for retrieval and vector search.
4. Least-privilege Google OAuth scopes.
5. Server-side secret storage only.
6. CSRF protection and secure sessions.
7. Rate limiting and abuse controls.
8. Auditable deletion workflow.
9. Redacted logs.
10. Documented incident response contact and breach notification process.

#### Customer-facing controls checklist

1. Ability to disconnect Google Drive.
2. Ability to rotate or remove BYO model credentials.
3. Ability to delete indexed data and account data.
4. Clear indicator when data is sent to an external provider.
5. Clear distinction between public IPFS and private storage options.

### What Can Realistically Ship in 3 Months

#### Ship in MVP

1. Secure session-based auth with magic link or equivalent passwordless login.
2. Optional Google sign-in, but separate Google Drive connection flow.
3. Incremental OAuth with `drive.file`.
4. Encrypted storage for refresh tokens and BYO provider credentials.
5. Basic tenant isolation and test coverage around retrieval boundaries.
6. Isolated ingestion worker with MIME checks, file size limits, and timeouts.
7. BYO endpoint validation with SSRF blocking and HTTPS-only policy.
8. Rate limits, quotas, and basic audit logs.
9. Default-minimal retention and user-driven deletion flows.
10. Explicit IPFS warning and no misleading privacy claims.
11. Clear privacy documentation and subprocessor disclosure.

#### Postpone to later phases

1. Enterprise SSO and lifecycle management.
2. Customer-managed encryption keys.
3. Advanced DLP, malware detonation, and content disarm and reconstruction.
4. Private-network BYO endpoint connectivity.
5. Fine-grained regional hosting and residency controls.
6. Formal certifications and external audits.
7. End-to-end client-side encryption for searchable private corpora.

### Bottom Line

For MVP, the highest-value security investments are:

1. isolate tenants correctly,
2. keep secrets server-side and encrypted,
3. minimize what leaves the platform,
4. constrain BYO endpoint networking,
5. keep Google scopes narrow,
6. and be explicit about IPFS privacy limits.

That set is realistic in 3 months and materially reduces the most likely breach and privacy-failure scenarios without dragging the MVP into enterprise-only scope.

## 11. Observability

### Recommendation

Add observability from the start because the hardest part of this product is diagnosing latency and retrieval quality.

### Logs

Use structured JSON logs with request IDs and workspace IDs.

Log at minimum:

1. Completion request received.
2. Retrieval duration and hit count.
3. Provider chosen.
4. First-token latency.
5. Total latency.
6. Ingestion job duration.
7. Parse failure reasons.
8. Embedding failures.

### Metrics

Track:

1. Completion p50, p95 latency.
2. Retrieval latency.
3. Provider error rate.
4. Indexing throughput.
5. Queue depth.
6. Parse success rate by file type.
7. Completion acceptance rate.
8. Cost per workspace.

### Tracing

Use OpenTelemetry tracing across:

1. API request.
2. Retrieval query.
3. Provider API call.
4. Background jobs.

For MVP deployment, a lightweight stack such as Prometheus + Grafana + Tempo or a hosted equivalent is enough.

## 12. Deployment Topology for MVP

### Local Development with Docker Compose

Services:

1. frontend
2. api
3. worker
4. postgres
5. redis
6. ipfs

This is enough for development and initial QA.

### Initial Production Topology

Recommendation: single VM or single small cluster, not Kubernetes.

Suggested topology:

1. Reverse proxy: Caddy or Nginx.
2. Frontend static assets served via CDN or reverse proxy.
3. One NestJS API container.
4. One worker container.
5. Managed PostgreSQL if possible.
6. Managed Redis if possible.
7. Optional self-hosted IPFS node.

Why:

1. Lowest operational overhead.
2. Enough for initial paying customers.
3. Clear migration path later.

### Scaling Path After MVP

When load grows, scale in this order:

1. Separate API and worker autoscaling.
2. Move PostgreSQL to managed production-grade service if not already.
3. Add read replicas if query load demands it.
4. Externalize object storage.
5. Introduce a dedicated retrieval service only when completion traffic justifies it.

## 13. Recommended 3-Month Delivery Plan

### Month 1

1. Establish monorepo with pnpm.
2. Create React + Vite frontend shell and Tiptap integration.
3. Create NestJS API and worker apps.
4. Set up PostgreSQL, pgvector, Redis, Docker Compose.
5. Implement auth, workspace model, provider model, and basic GraphQL API.
6. Implement REST completion endpoint skeleton.
7. Add Google Drive OAuth and minimal source registration.

### Month 2

1. Build ingestion pipeline for Google Drive and IPFS.
2. Implement PDF, DOCX, TXT parsing.
3. Implement chunking and embeddings.
4. Build source dashboard and indexing status UI.
5. Add vector retrieval and retrieval debugging logs.

### Month 3

1. Implement completion orchestration with streaming.
2. Add BYO model endpoint support and OpenRouter integration.
3. Add latency controls, caching, and fallback logic.
4. Add observability dashboards and alerting.
5. Run end-to-end testing on Spanish datasets.
6. Harden security, quotas, and rate limiting.

## 14. Final Recommendations

### Strong Recommendations

1. Use PostgreSQL for everything in MVP, including users.
2. Keep pgvector in the same database.
3. Add Redis plus BullMQ early.
4. Use a modular monolith, not microservices.
5. Keep GraphQL for product state and REST for completion flows.
6. Use multilingual embeddings from day one while optimizing UX for Spanish.
7. Optimize completion latency by skipping retrieval when local continuation is enough.

### MVP Principle

AssistAI wins if it makes grounded writing feel immediate and useful for Spanish-speaking professionals. The architecture should therefore prioritize:

1. Reliable ingestion.
2. Fast retrieval.
3. Low-latency streaming completions.
4. Clear privacy controls.
5. Operational simplicity.

That means choosing boring infrastructure where possible and spending complexity only on the ingestion and completion pipelines, because that is the actual product.
