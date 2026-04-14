SHELL := /bin/bash

PNPM := pnpm
ROOT_DIR := $(CURDIR)
ENV_FILE := $(ROOT_DIR)/.env

.PHONY: help env install build lint server-build server-dev server-start web-build web-dev web-preview dev prisma-generate prisma-migrate clean

help: ## Show available targets
	@grep -E '^[a-zA-Z0-9_.-]+:.*## ' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*## "}; {printf "\033[36m%-16s\033[0m %s\n", $$1, $$2}'

env: ## Create .env from .env.example if it does not exist
	@if [ -f "$(ENV_FILE)" ]; then \
		echo ".env already exists"; \
	else \
		cp .env.example .env; \
		echo "Created .env from .env.example"; \
	fi

install: ## Install workspace dependencies
	$(PNPM) install

build: ## Build server and web
	$(PNPM) build

lint: ## Type-check server and web
	$(PNPM) lint

server-build: ## Build the NestJS server
	$(PNPM) --filter @zt-mgmt/server build

server-dev: ## Start the NestJS server in watch mode using values from .env
	@test -f "$(ENV_FILE)" || (echo "Missing .env. Run 'make env' first." && exit 1)
	@set -a; source "$(ENV_FILE)"; set +a; $(PNPM) --filter @zt-mgmt/server start:dev

server-start: ## Start the built NestJS server using values from .env
	@test -f "$(ENV_FILE)" || (echo "Missing .env. Run 'make env' first." && exit 1)
	@set -a; source "$(ENV_FILE)"; set +a; $(PNPM) --filter @zt-mgmt/server start

web-build: ## Build the Vue web app
	$(PNPM) --filter @zt-mgmt/web build

web-dev: ## Start the Vue web app using values from .env
	@test -f "$(ENV_FILE)" || (echo "Missing .env. Run 'make env' first." && exit 1)
	@set -a; source "$(ENV_FILE)"; set +a; $(PNPM) --filter @zt-mgmt/web dev

web-preview: ## Preview the built Vue web app using values from .env
	@test -f "$(ENV_FILE)" || (echo "Missing .env. Run 'make env' first." && exit 1)
	@set -a; source "$(ENV_FILE)"; set +a; $(PNPM) --filter @zt-mgmt/web preview

dev: ## Start server and web together using values from .env
	@test -f "$(ENV_FILE)" || (echo "Missing .env. Run 'make env' first." && exit 1)
	@set -a; source "$(ENV_FILE)"; set +a; \
	trap 'kill 0' EXIT INT TERM; \
	$(PNPM) --filter @zt-mgmt/server start:dev & \
	$(PNPM) --filter @zt-mgmt/web dev & \
	wait

prisma-generate: ## Generate Prisma client for the server
	@test -f "$(ENV_FILE)" || (echo "Missing .env. Run 'make env' first." && exit 1)
	@set -a; source "$(ENV_FILE)"; set +a; $(PNPM) --filter @zt-mgmt/server prisma:generate

prisma-migrate: ## Run Prisma migrations for the server
	@test -f "$(ENV_FILE)" || (echo "Missing .env. Run 'make env' first." && exit 1)
	@set -a; source "$(ENV_FILE)"; set +a; $(PNPM) --filter @zt-mgmt/server prisma:migrate

clean: ## Remove build output
	rm -rf apps/server/dist apps/web/dist
