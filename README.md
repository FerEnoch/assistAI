<div align="center">

# AssistAI

**AI-powered writing assistant for legal professionals, grounded in your own documents.**

[![CI](https://img.shields.io/github/actions/workflow/status/your-org/assist-ai/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/your-org/assist-ai/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D10-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

---

Generic AI copilots are fast but shallow. They don't know your writing style, your preferred legal phrasing, or the precedents you cite most often. AssistAI brings inline completions grounded in **your own documents** -- so every suggestion comes from context you trust.

[Getting Started](#getting-started) | [Architecture](#architecture) | [Development](#development) | [Contributing](#contributing) | [License](#license)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Quickstart](#quickstart)
  - [Environment Variables](#environment-variables)
- [Architecture](#architecture)
  - [Project Structure](#project-structure)
  - [Key Design Decisions](#key-design-decisions)
  - [Data Flow](#data-flow)
- [Development](#development)
  - [Available Commands](#available-commands)
  - [Testing](#testing)
  - [CI Pipeline](#ci-pipeline)
- [Current Status](#current-status)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

AssistAI is an open-source writing assistant designed for Spanish-speaking legal professionals. It provides copilot-style inline text completions powered by Retrieval-Augmented Generation (RAG) against the user's own document corpus.

Instead of relying on generic language model knowledge, AssistAI retrieves relevant passages from your connected documents (Google Drive) and uses them to ground every suggestion. An evidence panel shows exactly which documents informed each completion, building trust through transparency.

**Primary audience**: Spanish-speaking legal professionals who draft contracts, briefs, motions, and other domain-specific documents.

---

## Features

- **Inline ghost-text completions** -- Tab-to-accept interaction modeled after GitHub Copilot, but for legal writing
- **Document-grounded RAG** -- Suggestions are retrieved from your own corpus, not just general model knowledge
- **Evidence panel** -- See which documents and passages informed each suggestion
- **Google Drive integration** -- Connect your Drive, select folders, and index PDF, DOCX, TXT, and Markdown files
- **BYO model endpoint** -- Use your own inference endpoint or managed inference through OpenRouter
- **Privacy-first design** -- AES-256-GCM encryption at rest, narrow OAuth scopes, no continuous Drive sync
- **Spanish-first UX** -- Interface copy, error messages, and editor states designed for Spanish-speaking users

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 6, Tiptap editor, TypeScript |
| Backend | NestJS 11 (API + Worker), TypeORM, BullMQ |
| Database | PostgreSQL 17 with pgvector (vector search) |
| Cache / Queue | Redis 7 |
| AI | OpenAI text-embedding-3-small (1024d), OpenRouter / BYO for completions |
| Security | AES-256-GCM, CSRF (csrf-csrf), SSRF validation, rate limiting |
| Testing | Vitest, ESLint, TypeScript strict mode |
| CI | GitHub Actions (lint + typecheck + test in parallel) |
| Infrastructure | Docker Compose, pnpm monorepo |

---

## Getting Started

### Prerequisites

| Requirement | Version |
|------------|---------|
| Node.js | >= 20 |
| pnpm | >= 10 |
| Docker + Docker Compose | Latest stable |

### Quickstart

```bash
# 1. Clone the repository
git clone https://github.com/your-org/assist-ai.git
cd assist-ai

# 2. Copy environment config
cp .env.example .env
# Edit .env with your API keys and secrets (see below)

# 3. Install dependencies
make install

# 4. Start infrastructure (PostgreSQL + Redis)
make infra

# 5. Build shared packages
make packages

# 6. Run database migrations
make db-migrate

# 7. Start all dev servers
make dev
```

After startup, the services will be available at:

| Service | URL |
|---------|-----|
| Web (Editor) | http://localhost:5173 |
| API | http://localhost:3000 |
| Worker | http://localhost:3001 |

Verify everything is running:

```bash
make health
```

### Environment Variables

Copy `.env.example` to `.env` and configure the following:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `SESSION_SECRET` | Yes | Random string, >= 32 characters |
| `CSRF_SECRET` | Yes | Random string, >= 32 characters |
| `JWT_SECRET` | Yes | Random string, >= 32 characters |
| `CREDENTIAL_ENCRYPTION_KEY` | Yes | 64 hex chars (32 bytes). Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `OPENAI_API_KEY` | Yes | For embeddings (text-embedding-3-small) |
| `OPENROUTER_API_KEY` | No | For managed inference (or use BYO endpoint) |
| `RESEND_API_KEY` | No | For magic link emails |

---

## Architecture

AssistAI follows a **modular monolith** architecture -- NestJS modules provide internal separation without the operational overhead of microservices. This is a deliberate choice for the MVP stage, optimizing for fast iteration and simple deployment.

```
                                 +------------------+
                                 |   Google Drive   |
                                 +--------+---------+
                                          |
                                    OAuth + Files
                                          |
+----------------+    REST/SSE    +-------v--------+    BullMQ     +----------------+
|                | ------------->  |                | ----------->  |                |
|   Web Client   |                |    API Server   |               |     Worker     |
|   (React +     | <-----------   |    (NestJS)    | <-----------  |    (NestJS)    |
|    Tiptap)     |  Completions   |                |   Job Results |                |
|                |                +-------+--------+               +-------+--------+
+----------------+                        |                                |
                                          |                                |
                                   +------v------+                         |
                                   |             | <-----------------------+
                                   | PostgreSQL  |    Embeddings + Chunks
                                   | + pgvector  |
                                   |             |
                                   +------+------+
                                          |
                                   +------v------+
                                   |    Redis    |
                                   |  (Sessions  |
                                   |  + Queues)  |
                                   +-------------+
```

### Project Structure

```
assist-ai/
├── apps/
│   ├── api/              # NestJS REST API
│   │   └── src/
│   │       ├── auth/         # Magic link auth, sessions
│   │       ├── completion/   # Completion orchestration, SSE streaming
│   │       ├── document/     # Document management
│   │       ├── retrieval/    # Vector search, RAG pipeline
│   │       ├── security/     # CSRF, rate limiting, SSRF
│   │       ├── source/       # Google Drive integration
│   │       ├── provider/     # Model endpoint management
│   │       └── workspace/    # Multi-tenant workspace model
│   │
│   ├── worker/           # NestJS background worker
│   │   └── src/
│   │       ├── indexing/     # Document parsing, chunking, embeddings
│   │       └── jobs/         # BullMQ job processors
│   │
│   └── web/              # React + Vite frontend
│       └── src/
│           ├── editor/       # Tiptap editor, ghost-text, evidence panel
│           ├── auth/         # Auth flows, CSRF
│           └── pages/        # Application pages
│
├── packages/
│   ├── shared/           # Config, crypto (AES-256-GCM), observability
│   └── entities/         # TypeORM entities (12 models)
│
├── docker-compose.yml    # PostgreSQL (pgvector) + Redis
├── Makefile              # Development commands
└── .github/workflows/    # CI pipeline
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Modular monolith over microservices | MVP needs fast iteration; ingestion, retrieval, and completion are tightly coupled at this stage |
| pgvector in PostgreSQL over separate vector DB | One fewer service to operate; pgvector HNSW is sufficient for MVP-scale corpus sizes |
| SSE over WebSockets for streaming | Completions are unidirectional server-to-client; SSE is simpler and works through proxies |
| Express sessions + Redis over JWT | Session revocation is trivial; no token refresh complexity; secure httpOnly cookies |
| csrf-csrf (Double Submit Cookie) over csurf | csurf is deprecated and unmaintained; csrf-csrf is actively maintained |
| pdfjs-dist over pdf-parse | pdf-parse is unmaintained and has known vulnerabilities; pdfjs-dist is Mozilla's maintained library |

### Data Flow

**Document Ingestion:**

1. User connects Google Drive via OAuth and selects folders/files
2. API registers content sources and enqueues ingestion jobs via BullMQ
3. Worker fetches files, parses content (PDF, DOCX, TXT, MD), applies recursive text splitting
4. Worker generates embeddings via OpenAI text-embedding-3-small (1024 dimensions)
5. Chunks and embeddings are stored in PostgreSQL with pgvector HNSW index

**Completion:**

1. User types in the Tiptap editor; after 750ms debounce, a completion request fires
2. API retrieves relevant chunks via pgvector cosine similarity search
3. Prompt is assembled with retrieved context and sent to the model (OpenRouter or BYO endpoint)
4. Response streams back via SSE; ghost text renders inline
5. User presses Tab to accept or Escape/continues typing to dismiss
6. Evidence panel shows which source documents contributed to the suggestion

---

## Development

### Available Commands

```
make help          # Show all available commands

# Setup
make install       # Install all dependencies
make packages      # Build shared libraries (required before dev/build)

# Development
make dev           # Start all dev servers (API + Worker + Web)
make stop          # Kill all dev server processes
make health        # Health check all running services

# Quality
make test          # Run all tests
make typecheck     # Type-check all projects
make lint          # Lint all source files
make check         # Run typecheck + lint + test

# Infrastructure
make infra         # Start PostgreSQL + Redis containers
make infra-down    # Stop and remove infrastructure containers
make infra-logs    # Tail infrastructure container logs

# Database
make db-migrate    # Run pending TypeORM migrations
make db-revert     # Revert last TypeORM migration

# Build
make build         # Build all workspace projects
make clean         # Remove all dist/ and build/ artifacts
make ci            # Full CI pipeline (clean -> install -> check -> build)
```

### Testing

Tests run with Vitest across all workspace packages:

```bash
# Run all tests
make test

# Run tests for a specific package
pnpm --filter @assistai/api test
pnpm --filter @assistai/shared test
```

### CI Pipeline

GitHub Actions runs three jobs **in parallel** on every push and pull request to `main`:

- **Lint** -- ESLint across all workspace packages
- **Typecheck** -- TypeScript strict mode compilation
- **Test** -- Full Vitest suite

---

## Current Status

> **This project is in MVP / active development.** It is not production-ready.

**What works:**

- Monorepo setup with all three applications building and running
- Magic link authentication with secure session management
- CSRF protection (Double Submit Cookie pattern)
- Google Drive OAuth integration and source registration
- Document ingestion pipeline (PDF, DOCX, TXT, Markdown)
- Chunking and embedding generation with pgvector storage
- Vector similarity retrieval
- Tiptap editor with inline ghost-text completions via SSE
- Evidence panel showing source attribution
- BYO model endpoint configuration
- Health checks across all services
- 178 tests passing, full typecheck and lint clean
- CI pipeline running

**What is not yet complete:**

- Production deployment configuration
- Email delivery for magic links (requires Resend configuration)
- Advanced document sync (currently one-time import, no continuous sync)
- Onboarding flow polish
- Performance optimization for large corpora
- Monitoring and alerting for production

---

## Roadmap

These items are explicitly deferred from the MVP and planned for future development:

- [ ] Continuous Google Drive sync
- [ ] Real-time collaborative editing
- [ ] Team workspaces with role-based access
- [ ] Side chat / conversational assistant
- [ ] Fine-tuning on user corpus
- [ ] SSO and enterprise authentication (SAML, SCIM)
- [ ] OCR support for scanned PDFs
- [ ] Mobile application
- [ ] Multi-provider routing with fallback chains
- [ ] Billing and subscription management

---

## Contributing

Contributions are welcome. Before opening a pull request:

1. Fork the repository and create your branch from `main`
2. Run `make check` to ensure typecheck, lint, and tests pass
3. If you add functionality, add corresponding tests
4. Write clear commit messages following [Conventional Commits](https://www.conventionalcommits.org/)
5. Open a pull request describing what your change does and why

For larger changes, please open an issue first to discuss the approach.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

Built for legal professionals who need AI they can trust.

</div>
