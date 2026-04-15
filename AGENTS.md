# Repository Guidelines

## Project Structure & Module Organization
`zt-mgmt` is a `pnpm` workspace. `apps/server` contains the NestJS API, with feature modules under `src/modules`, shared Nest helpers in `src/common`, and Prisma schema/migrations in `prisma/`. `apps/web` contains the Vue 3 admin UI, with API clients in `src/api`, Pinia stores in `src/stores`, layouts in `src/layouts`, and route views in `src/views`. `packages/shared/src` holds cross-app constants and types. Product and API notes live in `docs/`.

## Build, Test, and Development Commands
Use the `Makefile` first:

- `make env` creates `.env` from `.env.example`.
- `make install` installs workspace dependencies.
- `make dev` starts server and web together with `.env` loaded.
- `make lint` runs workspace type checks.
- `make build` builds both apps.
- `make prisma-generate` and `make prisma-migrate` update Prisma client/schema state.
- `docker compose up -d --build` starts MySQL, server, and web for integration checks.

Package-level fallbacks: `pnpm --filter @zt-mgmt/server start:dev` and `pnpm --filter @zt-mgmt/web dev`.

## Coding Style & Naming Conventions
Follow `.editorconfig`: UTF-8, LF, 2-space indentation, trim trailing whitespace. Keep TypeScript strict enough to pass `tsc`/`vue-tsc` without emit. Match existing naming patterns: Nest files use role suffixes such as `auth.service.ts`, `networks.controller.ts`, and DTOs under `dto/`; Vue layouts/components use PascalCase like `AppLayout.vue`, while route views stay feature-oriented under `src/views` (for example `views/networks/detail.vue`).

## Testing Guidelines
There is no workspace `test` script or coverage gate yet. Before opening a PR, run `make lint`, `make build`, and any affected Prisma command locally. For behavior changes, verify the relevant screen or endpoint manually. If you add server tests, prefer colocated `*.spec.ts` files using Nest's testing utilities.

## Commit & Pull Request Guidelines
Recent history mixes concise Chinese summaries with Conventional Commit prefixes such as `feat:`. Prefer short, imperative subjects; use `feat:`/`fix:` when the change type is clear. Keep PRs focused and include: a brief summary, linked issue or task, screenshots for `apps/web` UI changes, and notes for `.env`, Prisma schema, or migration updates.

## Security & Configuration Tips
Do not commit real secrets or controller credentials. Start from `.env.example`, replace default `JWT_SECRET`, `CONTROLLER_PASSWORD_KEY`, and admin credentials, and treat Prisma migrations in `apps/server/prisma/migrations` as required review points.
