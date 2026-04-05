# Agent Skill Registry

This registry tracks the customized active skills and their compact rules for this project.

## Available Skills

### `embedding-strategies`
**Trigger**: Use when choosing embedding models, implementing chunking strategies, or optimizing embedding quality for specific domains.
**Compact Rules**:
- Match the embedding model to the specific use case (e.g., Voyage AI for Claude apps, specific code or finance models).
- Chunk documents thoughtfully to preserve semantic boundaries, respecting token limits.
- Normalize embeddings if using cosine similarity search.
- Batch embedding requests for greater efficiency rather than doing them one-by-one.
- Cache embeddings to avoid recomputing for static content.
- Include essential metadata with chunks to enable effective filtering and debugging downstream.

### `vector-index-tuning`
**Trigger**: Use when tuning HNSW parameters, selecting quantization strategies, or scaling vector search infrastructure.
**Compact Rules**:
- Select the appropriate index type based on dataset size: Flat for <10K, HNSW for 10K-1M, HNSW+Quantization for 1M-100M.
- Tune HNSW parameters (`M`, `efConstruction`, `efSearch`) to balance recall, memory consumption, and build/search latency.
- Apply quantization strategies (FP16, INT8, Product Quantization, Binary) to achieve significant memory savings on large datasets.
- Profile and benchmark performance with real production queries instead of synthetic data before over-optimizing.
- Monitor index recall continuously, as it can degrade over time due to data drift.
- Consider tiered storage (hot/cold data separation) when scaling to billions of vectors.

### `postgresql-table-design`
**Trigger**: Use this skill when designing or reviewing a PostgreSQL-specific schema.
**Compact Rules**:
- Define a `PRIMARY KEY` for reference tables, preferring `BIGINT GENERATED ALWAYS AS IDENTITY` or `UUID` (only when global uniqueness is strictly needed).
- Normalize to 3NF first to eliminate redundancy; denormalize only for measured, high-ROI reads.
- Add `NOT NULL` constraints everywhere semantically required and use `DEFAULT` values.
- Manually create indexes for access paths you actually query, especially foreign key columns, as PostgreSQL does not auto-index them.
- Prefer `TIMESTAMPTZ` for events, `NUMERIC` for exact decimals/money, `TEXT` for strings, and `DOUBLE PRECISION` for floats.
- Keep in mind PostgreSQL gotchas: unquoted identifiers are lowercased, and `UNIQUE` allows multiple `NULL`s unless explicitly restricted.

### `error-handling-patterns`
**Trigger**: Use when implementing error handling, designing APIs, or improving application reliability.
**Compact Rules**:
- Choose the appropriate error handling philosophy: Exceptions (try-catch) for standard flows, or Result/Option Types for functional, explicit success/failure handling.
- Design robust error handling strategies that gracefully handle failures and avoid disrupting control flow unpredictably.
- Implement retry and circuit breaker patterns to build fault-tolerant distributed systems.
- Create clear, actionable error messages that provide excellent debugging experiences for developers and safe feedback for users.
- Ensure async and concurrent errors are caught and propagated correctly without causing unhandled promise rejections or application crashes.

### `prompt-engineering-patterns`
**Trigger**: Use when optimizing prompts, improving LLM outputs, or designing production prompt templates.
**Compact Rules**:
- Utilize advanced patterns like few-shot learning, chain-of-thought, and tree-of-thought to implement structured reasoning and improve reliability.
- Construct effective demonstrations with input-output pairs, balancing example count with context window constraints.
- Implement dynamic example selection and retrieval from knowledge bases to handle edge cases strategically.
- Create reusable prompt templates with variable interpolation for complex production LLM applications.
- Use structured outputs (like JSON mode) for reliable parsing, integration, and consistent behavior.

### `vercel-react-best-practices`
**Trigger**: Use when writing, reviewing, or refactoring React/Next.js code to ensure optimal performance patterns.
**Compact Rules**:
- Follow Vercel's performance optimization guidelines for React and Next.js applications across all component and page development.
- Prioritize eliminating waterfalls (CRITICAL priority) in data fetching to ensure parallel execution where possible.
- Optimize bundle size (CRITICAL priority) to improve initial load times and overall application performance.
- Apply server-side performance improvements (HIGH priority) for optimal rendering and resource delivery.
- Implement best practices for client-side data fetching (MEDIUM-HIGH priority) to ensure a smooth, responsive user experience.

### `api-design-principles`
**Trigger**: Use when designing new APIs, reviewing API specifications, or establishing API design standards.
**Compact Rules**:
- Follow Resource-Oriented Architecture: use nouns for resources (e.g., users, orders) rather than verbs.
- Use standard HTTP methods accurately for actions (GET, POST, PUT, PATCH, DELETE).
- Ensure URLs represent logical resource hierarchies and maintain consistent naming conventions across the API.
- Build intuitive, scalable, and maintainable REST and GraphQL APIs tailored to specific use cases like mobile or third-party integrations.
- Create comprehensive, developer-friendly API documentation and review specifications prior to implementation.

### `nodejs-backend-patterns`
**Trigger**: Use when creating Node.js servers, REST APIs, GraphQL backends, or microservices architectures.
**Compact Rules**:
- Build scalable, production-ready Node.js applications using modern frameworks like Express or Fastify.
- Implement robust middleware patterns for logging, request validation, and security (e.g., using Helmet, CORS).
- Establish consistent error handling, authentication, and authorization mechanisms across all endpoints.
- Design modular, maintainable architectures suitable for REST, GraphQL, or microservices.
- Ensure secure and efficient database integration (SQL/NoSQL) and handle background job processing appropriately.

### `typescript-advanced-types`
**Trigger**: Use when implementing complex type logic, creating reusable type utilities, or ensuring compile-time type safety in TypeScript projects.
**Compact Rules**:
- Master and apply TypeScript's advanced type system, including generics, conditional types, mapped types, and template literals.
- Create reusable, type-flexible components while maintaining strict type safety using Generics.
- Implement complex type inference logic and reusable type utilities for robust libraries and APIs.
- Design strongly-typed configuration objects and type-safe API clients.
- Use utility types to ensure compile-time type safety across form validation, state management, and data transformations.

### `e2e-testing-patterns`
**Trigger**: Use when implementing E2E tests, debugging flaky tests, or establishing testing standards.
**Compact Rules**:
- Build reliable, fast, and maintainable end-to-end test suites using tools like Playwright or Cypress.
- Focus E2E coverage on critical user journeys (login, checkout, signup), complex interactions, and real API integrations.
- Actively debug flaky or unreliable tests to ensure CI/CD pipelines provide high confidence for deployments.
- Validate cross-browser compatibility, responsive designs, and accessibility requirements automatically.
- Establish strict E2E testing standards to catch regressions before they reach production users.

### `github-actions-templates`
**Trigger**: Use when setting up CI/CD with GitHub Actions, automating development workflows, or creating reusable workflow templates.
**Compact Rules**:
- Create efficient, production-ready, and secure GitHub Actions workflows for continuous integration and deployment.
- Automate code testing, linting, building, and deploying across various tech stacks and environments.
- Build Docker images securely and push them to designated container registries.
- Implement matrix builds to parallelize and test code across multiple OS and language environments simultaneously.
- Integrate security scans and orchestrate automated deployment pipelines (e.g., to Kubernetes clusters).

### `frontend-design`
**Trigger**: Use when the user asks to build web components, pages, artifacts, posters, or applications requiring distinctive, production-grade frontend interfaces.
**Compact Rules**:
- Commit to a BOLD aesthetic direction (e.g., brutally minimal, maximalist chaos, retro-futuristic, editorial) based on the project's purpose and constraints.
- Avoid generic "AI slop" aesthetics; make intentional, highly differentiated, and memorable design choices.
- Implement working, production-grade, and functional code with exceptional attention to aesthetic and interactive details.
- Choose beautiful, unique typography, pairing distinctive display fonts with refined body fonts.
- Ensure visual cohesion, precise refinement, and a clear conceptual direction across the entire interface.

### `interface-design`
**Trigger**: Use for interface design tasks like dashboards, admin panels, SaaS apps, tools, and data interfaces. (NOT for marketing design).
**Compact Rules**:
- Focus exclusively on craft, consistency, and usability for interactive products, tools, and utility interfaces.
- Avoid falling back to generic dashboard templates or defaults (e.g., standard warm colors on cold structures).
- Explicitly explore the domain, name a signature, and state your intent before generating code to ensure a tailored solution.
- Ensure the interface directly solves the specific user problem and optimizes data presentation rather than just applying a standard layout.
- Maintain high precision in layout structure, information architecture, and the design of interactive components.

### `responsive-design`
**Trigger**: Use when building adaptive interfaces, implementing fluid layouts, or creating component-level responsive behavior.
**Compact Rules**:
- Implement modern responsive layouts using a mobile-first approach and appropriate CSS breakpoint strategies.
- Use container queries (using units like cqi, cqw, cqh) for component-level responsiveness that is independent of the viewport.
- Create fluid typography and spacing scales that adapt seamlessly and proportionally to any screen size.
- Build complex, robust, and flexible layouts leveraging modern CSS Grid and Flexbox features.
- Apply effective adaptive behaviors for images, media, and data displays (like tables) to ensure accessibility across devices.