.PHONY: help install build clean dev dev-apps stop \
       test typecheck lint check ci \
       infra infra-down infra-logs \
       db-migrate db-revert \
       packages health \
       prod prod-down prod-logs prod-restart

# ──────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────
SHELL := /bin/bash
.DEFAULT_GOAL := help

API_PORT   ?= 3000
WORKER_PORT ?= 3001
WEB_PORT   ?= 5173

# ──────────────────────────────────────────
# Help
# ──────────────────────────────────────────
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ──────────────────────────────────────────
# Setup
# ──────────────────────────────────────────
install: ## Install all dependencies
	pnpm install

packages: ## Build shared libraries (required before dev/build)
	pnpm --filter @assistai/shared build
	pnpm --filter @assistai/entities build

# ──────────────────────────────────────────
# Development
# ──────────────────────────────────────────
dev: ## Full dev start: infra → packages → apps (hot reload)
	@echo "🔧 Starting infrastructure..."
	@$(MAKE) infra
	@echo ""
	@echo "⏳ Waiting for infrastructure to be healthy..."
	@for i in 1 2 3 4 5 6 7 8 9 10; do \
		pg=$$(docker compose exec -T postgres pg_isready -U assistai -q 2>/dev/null && echo "ok" || echo ""); \
		rd=$$(docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG && echo "ok" || echo ""); \
		if [ "$$pg" = "ok" ] && [ "$$rd" = "ok" ]; then break; fi; \
		sleep 1; \
	done
	@docker compose exec -T postgres pg_isready -U assistai -q && echo "  Postgres: ✓" || (echo "  Postgres: ✗ FAILED" && exit 1)
	@docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG && echo "  Redis: ✓" || (echo "  Redis: ✗ FAILED" && exit 1)
	@echo ""
	@echo "📦 Building shared packages..."
	@$(MAKE) packages
	@echo ""
	@echo "🚀 Starting all dev servers..."
	pnpm dev

dev-apps: packages ## Start dev servers only (assumes infra is running)
	pnpm dev

stop: ## Kill all dev server processes
	-pkill -f "node.*dist/main" 2>/dev/null
	-pkill -f "nest" 2>/dev/null
	-pkill -f "vite" 2>/dev/null
	-fuser -k $(API_PORT)/tcp $(WORKER_PORT)/tcp $(WEB_PORT)/tcp 2>/dev/null
	@echo "All dev processes stopped"

# ──────────────────────────────────────────
# Build & Quality
# ──────────────────────────────────────────
build: packages ## Build all workspace projects
	pnpm build

clean: ## Remove all dist/ and build/ artifacts
	pnpm clean

test: ## Run all tests
	pnpm test

typecheck: ## Type-check all projects
	pnpm typecheck

lint: ## Lint all source files
	pnpm lint

check: packages typecheck lint test ## Run typecheck + lint + test

ci: clean install packages check build ## Full CI pipeline (clean → install → check → build)

# ──────────────────────────────────────────
# Infrastructure (Docker)
# ──────────────────────────────────────────
infra: ## Start Postgres + Redis containers
	docker compose up -d postgres redis
	@echo "Waiting for containers to be healthy..."
	@docker compose exec postgres pg_isready -U assistai -q && echo "Postgres: ready" || echo "Postgres: waiting..."
	@docker compose exec redis redis-cli ping | grep -q PONG && echo "Redis: ready" || echo "Redis: waiting..."

infra-down: ## Stop and remove infrastructure containers
	docker compose down

infra-logs: ## Tail infrastructure container logs
	docker compose logs -f postgres redis

# ──────────────────────────────────────────
# Database
# ──────────────────────────────────────────
db-migrate: ## Run pending TypeORM migrations
	pnpm --filter @assistai/api run migration:run

db-revert: ## Revert last TypeORM migration
	pnpm --filter @assistai/api run migration:revert

# ──────────────────────────────────────────
# Health checks
# ──────────────────────────────────────────
health: ## Check health of all running services
	@echo "=== API (port $(API_PORT)) ==="
	@curl -sf http://localhost:$(API_PORT)/health 2>/dev/null && echo || echo "NOT RUNNING"
	@echo ""
	@echo "=== Worker (port $(WORKER_PORT)) ==="
	@curl -sf http://localhost:$(WORKER_PORT)/health 2>/dev/null && echo || echo "NOT RUNNING"
	@echo ""
	@echo "=== Web (port $(WEB_PORT)) ==="
	@curl -sf -o /dev/null http://localhost:$(WEB_PORT)/ 2>/dev/null && echo "OK" || echo "NOT RUNNING"

# ──────────────────────────────────────────
# Production (Docker Compose)
# ──────────────────────────────────────────
prod: ## Build and start all services in production mode
	@echo "🐳 Building and starting production containers..."
	docker compose up -d --build
	@echo ""
	@echo "⏳ Waiting for services to start..."
	@sleep 5
	@echo "=== Container status ==="
	@docker compose ps
	@echo ""
	@echo "=== Health checks ==="
	@curl -sf http://localhost:$(API_PORT)/health 2>/dev/null && echo "API: ✓" || echo "API: starting..."
	@curl -sf -o /dev/null http://localhost:80/ 2>/dev/null && echo "Web: ✓" || echo "Web: starting..."
	@echo ""
	@echo "Production is up. Run 'make prod-logs' to tail logs."

prod-down: ## Stop all production containers
	docker compose down

prod-logs: ## Tail production container logs
	docker compose logs -f

prod-restart: ## Rebuild and restart production containers
	docker compose down
	@$(MAKE) prod
