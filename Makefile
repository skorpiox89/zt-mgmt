SHELL := /bin/bash

PNPM := pnpm
DOCKER ?= docker
DOCKER_BUILD_FLAGS ?=
CURL ?= curl
ROOT_DIR := $(CURDIR)
ENV_FILE := $(ROOT_DIR)/.env
COMPOSE_FILE := docker-compose.yaml
REGISTRY ?= registry.cn-hangzhou.aliyuncs.com/skorpiox89
IMAGE_TAG ?= latest
MYSQL_IMAGE ?= swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/mysql:8.4
SERVER_LOCAL_IMAGE ?= zt-mgmt-server:$(IMAGE_TAG)
WEB_LOCAL_IMAGE ?= zt-mgmt-web:$(IMAGE_TAG)
SERVER_IMAGE = $(REGISTRY)/zt-mgmt-server:$(IMAGE_TAG)
WEB_IMAGE = $(REGISTRY)/zt-mgmt-web:$(IMAGE_TAG)

# The remote environment is started on the customer machine itself. It uses
# images already published by image-push and retains its MySQL volume on down.
REMOTE_ENV_NAME ?= zt-mgmt-remote
REMOTE_ENV_FILE ?= $(ROOT_DIR)/.env.production
REMOTE_ENV_MYSQL_IMAGE ?= $(MYSQL_IMAGE)
REMOTE_ENV_SERVER_IMAGE ?= $(SERVER_IMAGE)
REMOTE_ENV_WEB_IMAGE ?= $(WEB_IMAGE)
REMOTE_ENV_MYSQL_PORT ?= 19075
REMOTE_ENV_SERVER_PORT ?= 19070
REMOTE_ENV_WEB_PORT ?= 19071
REMOTE_ENV_API_HEALTH_URL ?= http://127.0.0.1:$(REMOTE_ENV_SERVER_PORT)/api/health
REMOTE_ENV_WEB_URL ?= http://127.0.0.1:$(REMOTE_ENV_WEB_PORT)
REMOTE_ENV_CHECK_ATTEMPTS ?= 60
REMOTE_ENV_CHECK_INTERVAL ?= 2
REMOTE_ENV_COMPOSE = MYSQL_IMAGE="$(REMOTE_ENV_MYSQL_IMAGE)" SERVER_IMAGE="$(REMOTE_ENV_SERVER_IMAGE)" WEB_IMAGE="$(REMOTE_ENV_WEB_IMAGE)" MYSQL_PORT="$(REMOTE_ENV_MYSQL_PORT)" SERVER_PORT="$(REMOTE_ENV_SERVER_PORT)" WEB_PORT="$(REMOTE_ENV_WEB_PORT)" $(DOCKER) compose --env-file "$(REMOTE_ENV_FILE)" -p "$(REMOTE_ENV_NAME)" -f "$(COMPOSE_FILE)"

.PHONY: help env install build lint server-build server-dev server-start web-build web-dev web-preview dev prisma-generate prisma-migrate server-package server-push web-package web-push image image-push push clean redeploy remote-env-deploy remote-env-up remote-env-down remote-env-stop remote-env-reset remote-env-pull remote-env-config-check remote-env-check remote-env-status remote-env-server-logs remote-env-web-logs remote-env-mysql-logs

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

server-package: ## Build the server image for local use and registry publication
	$(DOCKER) build $(DOCKER_BUILD_FLAGS) --target server-runtime -t $(SERVER_LOCAL_IMAGE) -t $(SERVER_IMAGE) .

server-push: server-package ## Push the server image to the remote registry
	$(DOCKER) push $(SERVER_IMAGE)

web-package: ## Build the web image for local use and registry publication
	$(DOCKER) build $(DOCKER_BUILD_FLAGS) --target web-runtime -t $(WEB_LOCAL_IMAGE) -t $(WEB_IMAGE) .

web-push: web-package ## Push the web image to the remote registry
	$(DOCKER) push $(WEB_IMAGE)

image: server-package web-package ## Build server and web Docker images

image-push: server-push web-push ## Build and push server and web images to the remote registry

push: image-push ## Alias for image-push

clean: ## Remove build output
	rm -rf apps/server/dist apps/web/dist

redeploy: ## Pull and reconcile the complete local Docker Compose stack
	MYSQL_IMAGE=$(MYSQL_IMAGE) SERVER_IMAGE=$(SERVER_IMAGE) WEB_IMAGE=$(WEB_IMAGE) $(DOCKER) compose -f $(COMPOSE_FILE) pull
	MYSQL_IMAGE=$(MYSQL_IMAGE) SERVER_IMAGE=$(SERVER_IMAGE) WEB_IMAGE=$(WEB_IMAGE) $(DOCKER) compose -f $(COMPOSE_FILE) up -d --no-build --remove-orphans

remote-env-deploy: remote-env-pull ## Pull images and deploy MySQL, server, and web on this machine
	@echo "deploying remote image environment: $(REMOTE_ENV_NAME)"
	$(REMOTE_ENV_COMPOSE) up -d --no-build --remove-orphans
	$(MAKE) remote-env-check
	$(MAKE) remote-env-status

remote-env-up: remote-env-deploy ## Alias for remote-env-deploy

remote-env-down: remote-env-config-check ## Stop the remote image environment while preserving MySQL data
	$(REMOTE_ENV_COMPOSE) down --remove-orphans
	@echo "remote image environment stopped: $(REMOTE_ENV_NAME)"
	@echo "MySQL volume preserved. Use remote-env-reset to remove it."

remote-env-stop: remote-env-down ## Alias for remote-env-down

remote-env-reset: remote-env-config-check ## Remove the remote environment, including its MySQL volume, then redeploy
	$(REMOTE_ENV_COMPOSE) down --volumes --remove-orphans
	$(MAKE) remote-env-deploy

remote-env-pull: remote-env-config-check ## Pull all images required by the remote environment
	$(REMOTE_ENV_COMPOSE) pull

remote-env-config-check: ## Validate the remote environment configuration and production secrets
	@test -f "$(REMOTE_ENV_FILE)" || { echo "Missing remote environment file: $(REMOTE_ENV_FILE)"; exit 1; }
	@for key in MYSQL_ROOT_PASSWORD MYSQL_PASSWORD JWT_SECRET CONTROLLER_PASSWORD_KEY; do \
		value=$$(sed -n "s/^$${key}=//p" "$(REMOTE_ENV_FILE)" | tail -n 1); \
		case "$$value" in \
			''|root123456|zt_mgmt|replace-*|change-*) \
				echo "$(REMOTE_ENV_FILE): $$key must contain a non-default production secret"; exit 1;; \
		esac; \
	done

remote-env-check: remote-env-config-check ## Wait for API and Web health checks on this machine
	@set -e; \
	for url in "$(REMOTE_ENV_API_HEALTH_URL)" "$(REMOTE_ENV_WEB_URL)"; do \
		echo "checking $$url"; \
		ok=0; \
		attempt=1; \
		while test "$$attempt" -le "$(REMOTE_ENV_CHECK_ATTEMPTS)"; do \
			if $(CURL) -fsS "$$url" >/dev/null 2>&1; then \
				ok=1; \
				break; \
			fi; \
			sleep "$(REMOTE_ENV_CHECK_INTERVAL)"; \
			attempt=$$((attempt + 1)); \
		done; \
		if test "$$ok" != "1"; then \
			echo "remote-env-check failed: $$url"; \
			$(REMOTE_ENV_COMPOSE) ps || true; \
			$(REMOTE_ENV_COMPOSE) logs --tail 120 || true; \
			exit 1; \
		fi; \
	done; \
	echo "remote image environment checks passed"

remote-env-status: remote-env-config-check ## Show remote environment images, URLs, and service status
	@echo "remote image environment: $(REMOTE_ENV_NAME)"
	@echo "server image: $(REMOTE_ENV_SERVER_IMAGE)"
	@echo "web image:    $(REMOTE_ENV_WEB_IMAGE)"
	@echo "web:          $(REMOTE_ENV_WEB_URL)"
	@echo "api:          $(REMOTE_ENV_API_HEALTH_URL)"
	@echo "mysql:        127.0.0.1:$(REMOTE_ENV_MYSQL_PORT)"
	@$(REMOTE_ENV_COMPOSE) ps

remote-env-server-logs: remote-env-config-check ## Tail server logs from the remote environment
	$(REMOTE_ENV_COMPOSE) logs -f server

remote-env-web-logs: remote-env-config-check ## Tail web logs from the remote environment
	$(REMOTE_ENV_COMPOSE) logs -f web

remote-env-mysql-logs: remote-env-config-check ## Tail MySQL logs from the remote environment
	$(REMOTE_ENV_COMPOSE) logs -f mysql
