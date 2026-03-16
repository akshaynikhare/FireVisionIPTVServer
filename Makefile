# FireVision IPTV Server — Local Docker Makefile
# Usage: make help

APP_NAME    := firevision-iptv
IMAGE       := ghcr.io/akshaynikhare/firevisioniptvserver
TAG         := latest
COMPOSE     := docker compose
COMPOSE_PROD:= docker compose -f docker-compose.production.yml

.PHONY: help build up down restart logs shell status clean \
        build-prod up-prod down-prod logs-prod \
        dev test lint lint-fix typecheck \
        db-reset db-drop db-shell

# ─── Help ────────────────────────────────────────────────────
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ─── Local Docker (dev compose) ─────────────────────────────
build: ## Build all containers (dev)
	$(COMPOSE) build

build-no-cache: ## Build all containers without cache
	$(COMPOSE) build --no-cache

up: ## Start all services in background
	$(COMPOSE) up -d

up-build: ## Build and start all services
	$(COMPOSE) up -d --build

down: ## Stop all services
	$(COMPOSE) down

restart: ## Restart all services
	$(COMPOSE) restart

logs: ## Tail logs from all services
	$(COMPOSE) logs -f

logs-api: ## Tail logs from API service only
	$(COMPOSE) logs -f api

logs-mongo: ## Tail logs from MongoDB only
	$(COMPOSE) logs -f mongodb

logs-redis: ## Tail logs from Redis only
	$(COMPOSE) logs -f redis

shell: ## Open shell in API container
	$(COMPOSE) exec api sh

status: ## Show running containers
	$(COMPOSE) ps

# ─── Production Docker ───────────────────────────────────────
build-prod: ## Build production image
	docker build -t $(IMAGE):$(TAG) .

up-prod: ## Start production stack
	$(COMPOSE_PROD) up -d

down-prod: ## Stop production stack
	$(COMPOSE_PROD) down

logs-prod: ## Tail production logs
	$(COMPOSE_PROD) logs -f

# ─── Cleanup ─────────────────────────────────────────────────
clean: ## Stop services and remove volumes
	$(COMPOSE) down -v

clean-images: ## Remove dangling images
	docker image prune -f

clean-all: ## Full cleanup (containers, volumes, images)
	$(COMPOSE) down -v --rmi local
	docker image prune -f

# ─── Database ───────────────────────────────────────────────
db-reset: ## Drop database and restart API (re-creates super admin)
	$(COMPOSE) exec mongodb mongosh --quiet --eval 'db.getSiblingDB("firevision-iptv").dropDatabase()' && \
	$(COMPOSE) restart api
	@echo "Database reset. Super admin will be re-created on startup."

db-drop: ## Drop database only (no restart)
	$(COMPOSE) exec mongodb mongosh --quiet --eval 'db.getSiblingDB("firevision-iptv").dropDatabase()'
	@echo "Database dropped."

db-shell: ## Open MongoDB shell
	$(COMPOSE) exec mongodb mongosh firevision-iptv

# ─── Local Development (no Docker) ──────────────────────────
dev: ## Start backend + frontend locally (no Docker)
	npm run dev

test: ## Run all tests
	npm test

test-backend: ## Run backend tests only
	npm run test:backend

test-frontend: ## Run frontend tests only
	npm run test:frontend

test-e2e: ## Run Playwright E2E tests
	npm run test:e2e

lint: ## Run ESLint
	npm run lint

lint-fix: ## Run ESLint with auto-fix
	npm run lint:fix

typecheck: ## Run TypeScript type checking
	npm run typecheck
