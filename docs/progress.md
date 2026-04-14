# Progress Log

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

What is still temporary:

- controller data is still stored in memory inside the server service
- Prisma schema exists, but controller persistence is not yet wired to MySQL
- no database migration has been run yet
- no end-to-end local run was completed in this environment because the sandbox
  here does not permit binding local ports

### Suggested Next Step

Wire `Controller` persistence from in-memory storage to `Prisma + MySQL 8.4`,
then run:

1. `make env`
2. edit `.env`
3. `make install`
4. `make prisma-generate`
5. `make build`
6. `make dev`

### Local Start Commands

Useful commands after editing `.env`:

- `make help`
- `make env`
- `make install`
- `make build`
- `make server-dev`
- `make web-dev`
- `make dev`
