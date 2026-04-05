# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

See `_shared/skill-resolver.md` for the full resolution protocol.

---

## SDD Workflow Skills

Core skills for Spec-Driven Development workflow in OpenCode.

| Trigger | Skill | Path |
|---------|-------|------|
| Cuando se delega trabajo a sub-agentes en fases SDD. | dynamic-model-selector | /home/ferenoch/.config/opencode/skills/dynamic-model-selector/SKILL.md |
| When user says "judgment day", "judgment-day", "review adversarial", "dual review", "doble review", "juzgar", "que lo juzguen". | judgment-day | /home/ferenoch/.config/opencode/skills/judgment-day/SKILL.md |
| Contextos de arquitectura backend, seguridad, diseño UI/UX, database, testing, workflows de desarrollo, y más de 150 dominios especializados. | copilot-bridge | /home/ferenoch/.config/opencode/skills/copilot-bridge/SKILL.md |
| When creating a GitHub issue, reporting a bug, or requesting a feature. | issue-creation | /home/ferenoch/.config/opencode/skills/issue-creation/SKILL.md |
| When creating a pull request, opening a PR, or preparing changes for review. | branch-pr | /home/ferenoch/.config/opencode/skills/branch-pr/SKILL.md |
| When writing Go tests, using teatest, or adding test coverage. | go-testing | /home/ferenoch/.config/opencode/skills/go-testing/SKILL.md |
| When user asks to create a new skill, add agent instructions, or document patterns for AI. | skill-creator | /home/ferenoch/.config/opencode/skills/skill-creator/SKILL.md |

---

## Project-Specific Skills

Skills tailored to this project (Assist AI with embeddings and vector search).

| Trigger | Skill | Path |
|---------|-------|------|
| Use when choosing embedding models, implementing chunking strategies, or optimizing embedding quality for specific domains. | embedding-strategies | /home/ferenoch/Projects/mis_proyectos/assist-ai/.agents/skills/embedding-strategies/SKILL.md |
| Use when tuning HNSW parameters, selecting quantization strategies, or scaling vector search infrastructure. | vector-index-tuning | /home/ferenoch/Projects/mis_proyectos/assist-ai/.agents/skills/vector-index-tuning/SKILL.md |

---

## Global Skills

General-purpose skills for various development domains.

| Trigger | Skill | Path |
|---------|-------|------|
| Use this skill when designing or reviewing a PostgreSQL-specific schema. | postgresql-table-design | /home/ferenoch/.agents/skills/postgresql-table-design/SKILL.md |
| Use when implementing error handling, designing APIs, or improving application reliability. | error-handling-patterns | /home/ferenoch/.agents/skills/error-handling-patterns/SKILL.md |
| Use when optimizing prompts, improving LLM outputs, or designing production prompt templates. | prompt-engineering-patterns | /home/ferenoch/.agents/skills/prompt-engineering-patterns/SKILL.md |
| Use when writing, reviewing, or refactoring React/Next.js code to ensure optimal performance patterns. | vercel-react-best-practices | /home/ferenoch/.agents/skills/vercel-react-best-practices/SKILL.md |
| Use when designing new APIs, reviewing API specifications, or establishing API design standards. | api-design-principles | /home/ferenoch/.agents/skills/api-design-principles/SKILL.md |
| Use when creating Node.js servers, REST APIs, GraphQL backends, or microservices architectures. | nodejs-backend-patterns | /home/ferenoch/.agents/skills/nodejs-backend-patterns/SKILL.md |
| Use when implementing complex type logic, creating reusable type utilities, or ensuring compile-time type safety in TypeScript projects. | typescript-advanced-types | /home/ferenoch/.agents/skills/typescript-advanced-types/SKILL.md |
| Use when implementing E2E tests, debugging flaky tests, or establishing testing standards. | e2e-testing-patterns | /home/ferenoch/.agents/skills/e2e-testing-patterns/SKILL.md |
| Use when setting up CI/CD with GitHub Actions, automating development workflows, or creating reusable workflow templates. | github-actions-templates | /home/ferenoch/.agents/skills/github-actions-templates/SKILL.md |
| Use when integrating OpenRouter SDK, calling models via callModel, implementing tools with Zod, or configuring OpenRouter providers. | openrouter-typescript-sdk | /home/ferenoch/.config/opencode/skills/openrouter-typescript-sdk/SKILL.md |
| Use when the user asks to build web components, pages, artifacts, posters, or applications requiring distinctive, production-grade frontend interfaces. | frontend-design | /home/ferenoch/.agents/skills/frontend-design/SKILL.md |
| Use for interface design tasks like dashboards, admin panels, SaaS apps, tools, and data interfaces (NOT for marketing design). | interface-design | /home/ferenoch/.agents/skills/interface-design/SKILL.md |
| Use when building adaptive interfaces, implementing fluid layouts, or creating component-level responsive behavior. | responsive-design | /home/ferenoch/.agents/skills/responsive-design/SKILL.md |

---

## Compact Rules

Pre-digested rules per skill. Delegators copy matching blocks into sub-agent prompts as `## Project Standards (auto-resolved)`.

### dynamic-model-selector
- Use sonnet 4.6 for `sdd-explore` and `sdd-apply` by default.
- Use gemini 3.1 Pro for `sdd-propose` and `sdd-spec`.
- Use opus 4.6 for `sdd-design`, and escalate any phase to opus 4.6 for high-complexity work.
- Treat new architecture, critical debugging, security, risky refactors, and complex business rules as high complexity.
- Use GPT 5.3-codex for `sdd-tasks` and `sdd-verify`; use haiku 4.5 for `sdd-archive`.

### judgment-day
- Resolve relevant compact rules from this registry BEFORE launching judges.
- Run exactly two blind reviews in parallel; neither judge knows about the other.
- Classify findings as `CRITICAL`, `WARNING (real)`, `WARNING (theoretical)`, or `SUGGESTION`.
- Only confirmed CRITICALs and real WARNINGs require fixes; theoretical warnings are INFO only.
- After fixes, re-judge immediately; never approve before re-judgment completes.
- After two fix iterations, ask the user whether to continue instead of looping forever.

### copilot-bridge
- When work enters a specialized domain, load the matching Copilot agent context before advising.
- Map domain keywords to the most relevant specialist instead of using generic advice.
- Read the specialist agent file, extract patterns, then adapt them to the current repo.
- Use backend/database/security/testing specialists for architecture-heavy tasks.
- Apply agent knowledge to the actual codebase; never paste patterns blindly.

### issue-creation
- Always search for duplicates before creating a new issue.
- Use the correct issue template; blank issues are not allowed.
- New issues require `status:needs-review`; PRs must wait for `status:approved`.
- Questions belong in Discussions, not Issues.
- Fill every required field, including repro steps or problem statement and affected area.

### branch-pr
- Every PR MUST link an approved issue and include exactly one `type:*` label.
- Branch names MUST match `type/description` using lowercase `a-z0-9._-` only.
- Use conventional commits that match the allowed regex and map cleanly to PR type labels.
- Fill the PR template completely: linked issue, type, summary, changes table, test plan, checklist.
- Run required validations before submission and do not open blank or unlabeled PRs.

### go-testing
- Prefer table-driven tests for pure functions and multiple cases.
- Test Bubbletea state transitions by calling `Update()` directly.
- Use `teatest` for full interactive TUI flows.
- Use golden files for view rendering snapshots.
- Cover success and error paths explicitly, and use `t.TempDir()` for filesystem isolation.

### skill-creator
- Create a skill only for reusable, non-trivial patterns that need AI guidance.
- Follow the required `SKILL.md` frontmatter and structure exactly.
- Put reusable code/templates in `assets/`; point docs to local files in `references/`.
- Keep examples minimal and actionable; avoid long explanations and troubleshooting sections.
- Register the new skill in project instructions after creation.

### embedding-strategies
- Match the embedding model to the use case and domain; do not reuse one model blindly everywhere.
- Chunk on semantic boundaries and respect token limits; over-chunking destroys context.
- Normalize embeddings for cosine similarity search.
- Batch embedding requests and cache stable embeddings to reduce cost and latency.
- Keep metadata with each chunk for filtering, debugging, and provenance.
- Never mix embeddings from different models in the same vector space.

### vector-index-tuning
- Choose index type by scale: Flat for tiny sets, HNSW for mid-scale, HNSW + quantization for large corpora.
- Tune `M`, `efConstruction`, and `efSearch` as a recall/latency/memory tradeoff, not in isolation.
- Benchmark with real production-like queries before tuning.
- Use quantization when memory pressure matters, but measure recall impact.
- Monitor recall over time because data drift can silently degrade results.
- Plan for tiered storage or other scaling tactics before hitting extreme corpus sizes.

### postgresql-table-design
- Define a `PRIMARY KEY` for reference tables, preferring `BIGINT GENERATED ALWAYS AS IDENTITY` or `UUID` (only when global uniqueness is strictly needed).
- Normalize to 3NF first to eliminate redundancy; denormalize only for measured, high-ROI reads.
- Add `NOT NULL` constraints everywhere semantically required and use `DEFAULT` values.
- Manually create indexes for access paths you actually query, especially foreign key columns, as PostgreSQL does not auto-index them.
- Prefer `TIMESTAMPTZ` for events, `NUMERIC` for exact decimals/money, `TEXT` for strings, and `DOUBLE PRECISION` for floats.
- Keep in mind PostgreSQL gotchas: unquoted identifiers are lowercased, and `UNIQUE` allows multiple `NULL`s unless explicitly restricted.

### error-handling-patterns
- Choose the appropriate error handling philosophy: Exceptions (try-catch) for standard flows, or Result/Option Types for functional, explicit success/failure handling.
- Design robust error handling strategies that gracefully handle failures and avoid disrupting control flow unpredictably.
- Implement retry and circuit breaker patterns to build fault-tolerant distributed systems.
- Create clear, actionable error messages that provide excellent debugging experiences for developers and safe feedback for users.
- Ensure async and concurrent errors are caught and propagated correctly without causing unhandled promise rejections or application crashes.

### prompt-engineering-patterns
- Utilize advanced patterns like few-shot learning, chain-of-thought, and tree-of-thought to implement structured reasoning and improve reliability.
- Construct effective demonstrations with input-output pairs, balancing example count with context window constraints.
- Implement dynamic example selection and retrieval from knowledge bases to handle edge cases strategically.
- Create reusable prompt templates with variable interpolation for complex production LLM applications.
- Use structured outputs (like JSON mode) for reliable parsing, integration, and consistent behavior.

### vercel-react-best-practices
- Follow Vercel's performance optimization guidelines for React and Next.js applications across all component and page development.
- Prioritize eliminating waterfalls (CRITICAL priority) in data fetching to ensure parallel execution where possible.
- Optimize bundle size (CRITICAL priority) to improve initial load times and overall application performance.
- Apply server-side performance improvements (HIGH priority) for optimal rendering and resource delivery.
- Implement best practices for client-side data fetching (MEDIUM-HIGH priority) to ensure a smooth, responsive user experience.

### api-design-principles
- Follow Resource-Oriented Architecture: use nouns for resources (e.g., users, orders) rather than verbs.
- Use standard HTTP methods accurately for actions (GET, POST, PUT, PATCH, DELETE).
- Ensure URLs represent logical resource hierarchies and maintain consistent naming conventions across the API.
- Build intuitive, scalable, and maintainable REST and GraphQL APIs tailored to specific use cases like mobile or third-party integrations.
- Create comprehensive, developer-friendly API documentation and review specifications prior to implementation.

### nodejs-backend-patterns
- Build scalable, production-ready Node.js applications using modern frameworks like Express or Fastify.
- Implement robust middleware patterns for logging, request validation, and security (e.g., using Helmet, CORS).
- Establish consistent error handling, authentication, and authorization mechanisms across all endpoints.
- Design modular, maintainable architectures suitable for REST, GraphQL, or microservices.
- Ensure secure and efficient database integration (SQL/NoSQL) and handle background job processing appropriately.

### typescript-advanced-types
- Master and apply TypeScript's advanced type system, including generics, conditional types, mapped types, and template literals.
- Create reusable, type-flexible components while maintaining strict type safety using Generics.
- Implement complex type inference logic and reusable type utilities for robust libraries and APIs.
- Design strongly-typed configuration objects and type-safe API clients.
- Use utility types to ensure compile-time type safety across form validation, state management, and data transformations.

### e2e-testing-patterns
- Build reliable, fast, and maintainable end-to-end test suites using tools like Playwright or Cypress.
- Focus E2E coverage on critical user journeys (login, checkout, signup), complex interactions, and real API integrations.
- Actively debug flaky or unreliable tests to ensure CI/CD pipelines provide high confidence for deployments.
- Validate cross-browser compatibility, responsive designs, and accessibility requirements automatically.
- Establish strict E2E testing standards to catch regressions before they reach production users.

### github-actions-templates
- Create efficient, production-ready, and secure GitHub Actions workflows for continuous integration and deployment.
- Automate code testing, linting, building, and deploying across various tech stacks and environments.
- Build Docker images securely and push them to designated container registries.
- Implement matrix builds to parallelize and test code across multiple OS and language environments simultaneously.
- Integrate security scans and orchestrate automated deployment pipelines (e.g., to Kubernetes clusters).

### openrouter-typescript-sdk
- Install SDK with `npm install @openrouter/sdk` and initialize with `new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })`
- Use `callModel()` as the primary interface — provides type safety, auto tool execution, and multi-turn support
- Accepts flexible input: string (auto-converts to user message), message array (multi-turn), or multimodal content
- Get responses via `getText()` (full text after tools), `getTextStream()` (streaming), or `getResponse()` (full object with usage)
- Define tools using `tool()` from SDK with Zod schemas for `inputSchema` and `outputSchema` — provides runtime validation and TypeScript inference
- Set stop conditions to prevent runaway costs: `stopWhen: [stepCountIs(10), maxCost(1.00)]`
- For streaming, use `getFullResponsesStream()` for event types or `getToolCallsStream()` for tool execution
- Handle errors by status code: 401 (invalid key), 402 (no credits), 429 (rate limited with backoff retry), 503 (model unavailable, try fallback)
- For user-facing apps, implement OAuth PKCE flow using `createAuthCode()` and `exchangeAuthCodeForAPIKey()` instead of storing user keys
- Convert between ecosystems using `fromChatMessages()`/`toChatMessage()` for OpenAI, `fromClaudeMessages()`/`toClaudeMessage()` for Claude format
- Use dynamic parameters with function callbacks based on `TurnContext`: `model: (ctx) => ctx.numberOfTurns > 3 ? 'openai/gpt-4' : 'openai/gpt-4o-mini'`
- Access 300+ models through OpenRouter; list available via `client.models.list()` and check credits with `client.credits.getCredits()`

### frontend-design
- Commit to a BOLD aesthetic direction (e.g., brutally minimal, maximalist chaos, retro-futuristic, editorial) based on the project's purpose and constraints.
- Avoid generic "AI slop" aesthetics; make intentional, highly differentiated, and memorable design choices.
- Implement working, production-grade, and functional code with exceptional attention to aesthetic and interactive details.
- Choose beautiful, unique typography, pairing distinctive display fonts with refined body fonts.
- Ensure visual cohesion, precise refinement, and a clear conceptual direction across the entire interface.

### interface-design
- Focus exclusively on craft, consistency, and usability for interactive products, tools, and utility interfaces.
- Avoid falling back to generic dashboard templates or defaults (e.g., standard warm colors on cold structures).
- Explicitly explore the domain, name a signature, and state your intent before generating code to ensure a tailored solution.
- Ensure the interface directly solves the specific user problem and optimizes data presentation rather than just applying a standard layout.
- Maintain high precision in layout structure, information architecture, and the design of interactive components.

### responsive-design
- Implement modern responsive layouts using a mobile-first approach and appropriate CSS breakpoint strategies.
- Use container queries (using units like cqi, cqw, cqh) for component-level responsiveness that is independent of the viewport.
- Create fluid typography and spacing scales that adapt seamlessly and proportionally to any screen size.
- Build complex, robust, and flexible layouts leveraging modern CSS Grid and Flexbox features.
- Apply effective adaptive behaviors for images, media, and data displays (like tables) to ensure accessibility across devices.

---

## Project Conventions

| File | Path | Notes |
|------|------|-------|
| — | — | No project-level convention index files detected in the repository root (`AGENTS.md`, `agents.md`, `CLAUDE.md`, `.cursorrules`, `GEMINI.md`, `copilot-instructions.md`). |

Read the convention files listed above for project-specific patterns and rules. All referenced paths have been extracted — no need to read index files to discover more.
