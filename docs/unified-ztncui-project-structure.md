# Unified ztncui Project Structure

## Recommended Repository Style

Use a simple `pnpm` workspace monorepo.

Reasons:

- frontend and backend are both TypeScript
- shared DTO types and constants are easier to manage
- one repository is enough for an internal MVP
- this avoids introducing extra build orchestration too early

Recommended package manager:

- `pnpm`

## Recommended Top-Level Structure

```text
zt-mgmt/
  apps/
    web/
    server/
  packages/
    shared/
  docs/
  package.json
  pnpm-workspace.yaml
  .editorconfig
  .gitignore
  .env.example
```

## Workspace Layout

### `apps/web`

Frontend project based on `vue-vben-admin`.

Recommended structure:

```text
apps/web/
  src/
    api/
    router/
    stores/
    views/
      auth/
      controllers/
      networks/
    components/
      controller/
      network/
      member/
    utils/
    types/
  public/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
```

Suggested page-level split:

- `views/auth/login.vue`
- `views/controllers/index.vue`
- `views/networks/index.vue`
- `views/networks/detail.vue`

Suggested reusable UI components:

- `components/controller/controller-form-modal.vue`
- `components/network/create-network-modal.vue`
- `components/network/rename-network-modal.vue`
- `components/network/delete-network-modal.vue`
- `components/member/member-name-modal.vue`
- `components/member/delete-member-modal.vue`

Suggested API client files:

- `api/auth.ts`
- `api/controllers.ts`
- `api/networks.ts`
- `api/members.ts`

Suggested frontend types:

- `types/auth.ts`
- `types/controller.ts`
- `types/network.ts`
- `types/member.ts`

### `apps/server`

Backend project based on `NestJS + TypeScript`.

Recommended structure:

```text
apps/server/
  src/
    main.ts
    app.module.ts
    common/
      dto/
      guards/
      interceptors/
      filters/
      decorators/
      utils/
    config/
    modules/
      auth/
      users/
      controllers/
      networks/
      members/
      ztncui/
      subnet/
      health/
    prisma/
  test/
  package.json
  tsconfig.json
  nest-cli.json
```

If you prefer to keep Prisma outside `src`, this is also fine:

```text
apps/server/
  prisma/
    schema.prisma
    migrations/
```

### `packages/shared`

Only keep this package if shared types actually become useful.
For MVP, it can start very small.

Recommended structure:

```text
packages/shared/
  src/
    constants/
    types/
  package.json
  tsconfig.json
```

Initial candidates for sharing:

- response envelope type
- controller DTO shapes used by frontend
- network DTO shapes used by frontend
- member DTO shapes used by frontend

If this feels heavy at the beginning, skip `packages/shared` in phase 1 and add
it later.

## Backend Module Breakdown

### `auth`

Responsibility:

- platform admin login
- platform admin logout
- current user info
- JWT or session validation

Recommended files:

```text
modules/auth/
  auth.controller.ts
  auth.service.ts
  auth.module.ts
  dto/
    login.dto.ts
```

### `users`

Responsibility:

- platform admin account persistence
- password hash verification

This can stay minimal in MVP.

### `controllers`

Responsibility:

- CRUD for `ztncui` controller configs
- encrypt/decrypt controller passwords
- controller connection test
- controller status updates

Recommended files:

```text
modules/controllers/
  controllers.controller.ts
  controllers.service.ts
  controllers.module.ts
  dto/
    create-controller.dto.ts
    update-controller.dto.ts
```

### `networks`

Responsibility:

- aggregate network list across controllers
- get network detail
- create network
- auto-initialize network
- rename network
- delete network

Recommended files:

```text
modules/networks/
  networks.controller.ts
  networks.service.ts
  networks.module.ts
  dto/
    create-network.dto.ts
    rename-network.dto.ts
```

### `members`

Responsibility:

- list members for a network
- update authorization
- update `Member name`
- delete member

Recommended files:

```text
modules/members/
  members.controller.ts
  members.service.ts
  members.module.ts
  dto/
    update-member-auth.dto.ts
    update-member-name.dto.ts
```

### `ztncui`

Responsibility:

- upstream login
- session cookie jar management
- request encapsulation
- HTML parsing and upstream response normalization

This is the most important integration module.

Recommended files:

```text
modules/ztncui/
  ztncui.module.ts
  ztncui.client.ts
  ztncui-session.service.ts
  parsers/
    controller.parser.ts
    network.parser.ts
    member.parser.ts
```

Suggested `ZtncuiClient` methods:

- `login()`
- `ensureSession()`
- `getControllerHome()`
- `listNetworks()`
- `getNetworkDetail()`
- `createNetwork()`
- `setNetworkPrivate()`
- `easySetupNetwork()`
- `renameNetwork()`
- `deleteNetwork()`
- `listMembers()`
- `setMemberAuthorized()`
- `setMemberName()`
- `deleteMember()`

### `subnet`

Responsibility:

- calculate next available subnet inside a controller pool
- avoid subnet collision within the same controller

Recommended files:

```text
modules/subnet/
  subnet.module.ts
  subnet.service.ts
```

Initial rule for MVP:

- one controller has one subnet pool
- all allocations are `/24`
- allocate the first unused subnet in ascending order

### `health`

Responsibility:

- simple health endpoint
- optional DB readiness check

Recommended files:

```text
modules/health/
  health.controller.ts
  health.module.ts
```

## Common Backend Utilities

Recommended common pieces:

- response envelope interceptor
- auth guard
- exception filter
- password encryption utility for controller credentials
- pagination helper if needed later

Useful files:

```text
common/
  interceptors/response.interceptor.ts
  guards/jwt-auth.guard.ts
  filters/http-exception.filter.ts
  utils/crypto.util.ts
```

## Database Layer

Recommended ORM:

- `Prisma`

Reasons:

- works well with MySQL 8.4
- type-safe enough for both DTO and DB model work
- migration flow is simple for an MVP
- easier to keep schema readable

Recommended Prisma layout:

```text
apps/server/prisma/
  schema.prisma
  migrations/
  seed.ts
```

Initial models:

- `AdminUser`
- `Controller`

Optional later:

- `AdminSession`

Avoid adding local `Network` and `Member` tables in MVP unless caching becomes
necessary.

## Frontend Module Breakdown

### Router

Recommended route groups:

- `/login`
- `/controllers`
- `/networks`
- `/networks/:controllerId/:networkId`

### Views

#### Controller Management

Responsibilities:

- table list
- create/edit modal
- delete action
- test connection action

#### Network Management

Responsibilities:

- aggregated table
- search by controller, region, and keyword
- create network modal
- rename action
- delete action
- jump to detail

#### Network Detail

Responsibilities:

- basic network info card
- member list table
- member authorization switch
- member name edit
- member delete

## Suggested Frontend State

Keep frontend state simple.

Recommended stores:

- `auth store`
- optional `app store`

Do not over-store remote data in Pinia. For MVP, network and member data should
be page-level query state.

## Recommended Key Dependencies

### Frontend

- `vue`
- `vue-router`
- `pinia`
- `vue-vben-admin`

### Backend

- `@nestjs/common`
- `@nestjs/core`
- `@nestjs/config`
- `@nestjs/jwt`
- `@nestjs/passport`
- `passport`
- `passport-jwt`
- `class-validator`
- `class-transformer`
- `prisma`
- `@prisma/client`
- `got`
- `tough-cookie`
- `cheerio`
- `bcrypt` or `argon2`

## Environment Variables

Recommended backend env vars:

```text
NODE_ENV=development
PORT=3001
DATABASE_URL=mysql://root:password@127.0.0.1:3306/zt_mgmt
JWT_SECRET=replace-this
CONTROLLER_PASSWORD_KEY=replace-this
```

Optional later:

```text
REDIS_URL=redis://127.0.0.1:6379
```

Notes:

- `DATABASE_URL` should point to the local Docker MySQL 8.4 instance.
- `CONTROLLER_PASSWORD_KEY` is used to encrypt controller passwords at rest.

## Create Network Internal Module Flow

When `POST /api/networks` is called:

1. `networks.controller` validates request.
2. `networks.service` loads controller config.
3. `ztncui.client` ensures upstream session.
4. `ztncui.client` creates empty network.
5. `subnet.service` allocates next `/24`.
6. `ztncui.client` sets `private = true`.
7. `ztncui.client` calls `easy setup`.
8. `networks.service` returns normalized DTO.

For correctness:

- lock by controller ID during subnet allocation and create flow

## Suggested Development Order

1. Create monorepo skeleton.
2. Initialize `apps/server` with NestJS.
3. Initialize `apps/web` from `vue-vben-admin`.
4. Configure MySQL 8.4 connection with Prisma.
5. Implement platform login.
6. Implement controller CRUD and test login.
7. Implement `ztncui.client`.
8. Implement network list.
9. Implement create-and-initialize network.
10. Implement network detail and member management.

## Practical Notes

- Do not let the frontend store or see raw `ztncui` credentials.
- Do not attempt browser automation unless upstream HTML changes become too hard
  to parse. Plain HTTP client plus cookie jar is the correct MVP choice.
- Keep the first version on a known `ztncui` version range to reduce parser
  drift.
