# Unified ztncui MVP

## Background

This project is an internal unified management console for multiple `ztncui`
instances. Each `ztncui` manages a different region, such as Mainland China or
the United States.

The unified platform is for internal use only. Platform administrators maintain
all controller configurations. End users do not manage controller credentials.

Frontend framework: `vue-vben-admin`.

## Selected Tech Stack

- Frontend: `Vue 3 + TypeScript + Vite + vue-vben-admin`
- Backend: `Node.js + TypeScript + NestJS`
- Database: `MySQL 8.4`
- Optional cache/session store: `Redis`

Reason for this stack:

- `vue-vben-admin` is already aligned with `Vue 3 + TypeScript`.
- The backend is mainly an I/O service for login, cookie/session reuse, HTTP
  requests, and HTML parsing across multiple `ztncui` instances.
- Using `TypeScript` on both frontend and backend reduces type mismatch and
  speeds up development.
- `NestJS` gives enough structure without introducing unnecessary complexity for
  an internal admin platform.
- `MySQL 8.4` is already available locally and is fully sufficient for the MVP.

## Confirmed Facts

The following points were confirmed during research:

- `ztncui` is open source.
- `ztncui` exposes the web routes needed by this MVP.
- `ztncui` itself talks to the local ZeroTier controller API on the same host.
- In the current environment, the available integration method is still the
  `ztncui` web login plus its existing web routes.
- `Member name` in `ztncui` is the display name stored by `ztncui`, not a
  ZeroTier native member field.

Relevant upstream references:

- `README.md`
- `src/routes/zt_controller.js`
- `src/controllers/zt.js`
- `src/controllers/networkController.js`

## Goals

- Let a platform administrator maintain multiple `ztncui` controllers.
- Let the platform log into each configured `ztncui`.
- Show a unified network list across controllers.
- Support creating a network and auto-initializing it.
- Support network rename and delete.
- Support viewing network members.
- Support member authorization toggle.
- Support editing `Member name`.
- Support member delete.

## Non-goals For MVP

- Multi-tenant support.
- Per-user controller credentials.
- Advanced ZeroTier configuration pages such as DNS, routes editor, rules,
  bridge tuning, IPv6 tuning, and bulk actions.
- Local persistence of all network/member business data.
- Full sync platform or task orchestration system.

## User Role

Only one role is required for MVP:

- `platform_admin`

This role can:

- log into the platform
- maintain controllers
- create, rename, and delete networks
- manage members

## Functional Scope

### 1. Platform Login

- Platform administrator can log in to the unified platform.
- Platform administrator can log out.

### 2. Controller Management

- Add controller with:
  - name
  - region
  - base URL
  - ztncui username
  - ztncui password
  - subnet pool CIDR
  - subnet prefix
- Edit controller.
- Delete controller.
- Test connectivity and login.
- Show controller status and last checked time.

### 3. Unified Network Management

- Show aggregated network list from all configured controllers.
- Support filtering by controller, region, and network name.
- Open one network detail page.
- Create a new network on a target controller.
- Auto-initialize the new network after creation.
- Rename network.
- Delete network with confirmation.

### 4. Member Management

- Show members of a selected network.
- Show `Member name`, member ID, authorized state, online state, IP
  assignments, and peer info if available.
- Toggle authorization.
- Edit `Member name`.
- Delete member with confirmation.

## Auto Initialization Rule

Network creation should be simplified for the administrator. The create form
only needs:

- target controller
- network name

The backend then does all initialization automatically:

1. Create empty network.
2. Set `private = true`.
3. Allocate the next available subnet from the controller subnet pool.
4. Configure network CIDR.
5. Configure assignment pool start and end.
6. Enable IPv4 auto assignment.

For MVP the rule should be fixed and simple:

- each controller owns one subnet pool, for example `10.10.0.0/16`
- subnet prefix is `24`
- pool start is `.1`
- pool end is `.254`

## Recommended Page Structure

Based on `vue-vben-admin`, use the following pages:

- Login
- Controller Management
- Network Management
- Network Detail

Recommended menu:

- `Controller Management`
- `Network Management`

`Network Detail` should be a routed detail page, not a top-level menu item.

## Main User Flows

### Add Controller

1. Open `Controller Management`.
2. Click add.
3. Fill in controller info.
4. Save.
5. Run connection test.
6. Mark controller as available if login succeeds.

### Create Initialized Network

1. Open `Network Management`.
2. Click create network.
3. Select target controller.
4. Enter network name.
5. Submit.
6. Backend creates the network, allocates subnet, sets private, runs easy
   setup, and returns the new network detail.

### Manage Members

1. Open a network detail page.
2. View the member table.
3. Toggle authorization as needed.
4. Update `Member name` if needed.
5. Delete member if needed.

## UX Notes

- Network delete and member delete must have a confirmation dialog.
- `Member name` should be labeled exactly as `Member name`.
- Add a small helper text for `Member name`:
  `This maps to ztncui Member name`.
- For create network, do not expose manual CIDR inputs in MVP.
- Show controller name and region on network pages to reduce operator mistakes.

## Error Handling

The UI and backend should handle at least:

- controller unreachable
- login failed
- session expired
- create network failed
- auto initialization failed
- member operation failed

The UI should show actionable error messages. Do not expose raw stored
passwords or upstream secrets in logs or responses.

## Delivery Todo List

1. Scaffold `vue-vben-admin` pages and routes.
2. Implement platform admin login.
3. Implement controller CRUD.
4. Implement controller login test.
5. Implement backend `ztncui` session management.
6. Implement aggregated network list.
7. Implement create-and-initialize network flow.
8. Implement network rename.
9. Implement network delete.
10. Implement network detail page.
11. Implement member list.
12. Implement member authorization toggle.
13. Implement `Member name` update.
14. Implement member delete.
15. Add basic security for controller password encryption and log masking.

## Implementation Notes

- The frontend should never call `ztncui` directly.
- The backend should maintain `ztncui` sessions and cookies.
- Network and member business data should be fetched live from controllers,
  rather than fully persisted locally in MVP.
- Network creation should lock per controller to avoid duplicate subnet
  allocation under concurrent requests.
