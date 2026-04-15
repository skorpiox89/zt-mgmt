# Progress Log

## 2026-04-15

### Completed

- Added Prisma 7 config via `apps/server/prisma.config.ts`.
- Added Prisma runtime wiring in NestJS:
  - `PrismaModule`
  - `PrismaService`
- Switched `Controller` persistence from in-memory storage to `Prisma + MySQL`.
- Updated controller, network, and member service call chains to use async
  database-backed controller lookup.
- Installed Prisma runtime dependencies for the server:
  - `@prisma/client`
  - `@prisma/adapter-mariadb`
  - `dotenv`
- Added the initial MySQL migration files under:
  - `apps/server/prisma/migrations/20260415000000_init_mysql_persistence/`
- Created a dedicated local MySQL database and project user for this project:
  - database: `zt_mgmt`
  - user: `zt_mgmt`
- Verified:
  - `pnpm --filter @zt-mgmt/server prisma:generate`
  - `pnpm --filter @zt-mgmt/server exec prisma db push`
  - `pnpm --filter @zt-mgmt/server exec prisma migrate dev`

## 2026-04-14

### Completed

- Confirmed real `ztncui` login behavior against a live controller.
- Confirmed the upstream `ztncui` routes needed for MVP:
  - login
  - network list
  - network create
  - network easy setup
  - network rename
  - network delete
  - member list
  - member authorization
  - member name
  - member delete
- Wrote MVP and implementation docs:
  - `docs/unified-ztncui-mvp.md`
  - `docs/unified-ztncui-api-schema.md`
  - `docs/unified-ztncui-project-structure.md`
- Initialized the repository as a `pnpm` workspace.
- Added backend skeleton:
  - `NestJS + TypeScript`
  - auth module
  - controller module
  - network module
  - member module
  - `ztncui` HTTP client module
  - subnet allocation service
  - Prisma schema for `AdminUser` and `Controller`
- Added frontend skeleton:
  - `Vue 3 + TypeScript + Vite`
  - login page
  - controller management page
  - network list page
  - network detail/member management page
- Installed workspace dependencies and generated `pnpm-lock.yaml`.
- Verified successful builds:
  - `pnpm --filter @zt-mgmt/server build`
  - `pnpm --filter @zt-mgmt/web build`
- Added `Makefile` targets for:
  - env bootstrap
  - install
  - build
  - lint
  - server dev/start
  - web dev/preview
  - combined dev
  - Prisma generate/migrate

### Current Status

The repository now has a runnable development skeleton for local testing.

What already works:

- platform login API
- controller CRUD API
- controller connection test flow
- aggregated network API skeleton
- network create/rename/delete API skeleton
- member list/auth/name/delete API skeleton
- frontend pages wired to backend API endpoints
- controller configuration persistence via Prisma + MySQL

What is still temporary:

- no end-to-end local run was completed in this environment because the sandbox
  here does not permit binding local ports

### Suggested Next Step

Run the local stack against the dedicated MySQL database and verify controller
CRUD persists across restarts, then validate one full real-controller flow:

1. `make build`
2. `make dev`
3. add a controller in the UI
4. restart the server
5. confirm the controller record still exists
6. run controller connection test
7. create one network and verify member operations end to end

If local ports are unavailable in the environment, at minimum run:

1. `make prisma-generate`
2. `make build`
3. targeted API smoke tests against the running server

### Local Start Commands

Useful commands after editing `.env`:

- `make help`
- `make env`
- `make install`
- `make build`
- `make server-dev`
- `make web-dev`
- `make dev`
