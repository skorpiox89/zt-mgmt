# Unified ztncui API And Schema Draft

## Architecture

- Frontend: `Vue 3 + TypeScript + Vite + vue-vben-admin`
- Backend: `Node.js + TypeScript + NestJS`
- Database: `MySQL 8.4`
- Optional cache/session store: `Redis`
- Upstream: multiple `ztncui` web consoles

The frontend only talks to the unified backend. The backend logs into each
`ztncui`, stores the session cookie, and translates platform operations into
upstream `ztncui` web requests.

## Integration Mapping To ztncui

The following upstream routes are sufficient for MVP:

- `POST /login`
- `GET /controller/networks`
- `POST /controller/network/create`
- `GET /controller/network/:nwid`
- `POST /controller/network/:nwid/easy`
- `POST /controller/network/:nwid/private`
- `POST /controller/network/:nwid/name`
- `POST /controller/network/:nwid/delete`
- `POST /controller/network/:nwid/members`
- `POST /controller/network/:nwid/member/:id/delete`

Notes:

- `Member name` maps to the field shown in the `ztncui` members page.
- `ztncui` stores `Member name` in its own local storage by member ID.
- Member authorization is written back to the ZeroTier controller by `ztncui`.

## API Response Envelope

All platform APIs should use one response envelope:

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

## Platform APIs

### Auth

#### `POST /api/auth/login`

Request:

```json
{
  "username": "admin",
  "password": "123456"
}
```

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "user": {
      "id": 1,
      "username": "admin"
    },
    "token": "session-or-jwt-token"
  }
}
```

#### `POST /api/auth/logout`

#### `GET /api/auth/me`

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "id": 1,
    "username": "admin"
  }
}
```

### Controllers

#### `GET /api/controllers`

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [
      {
        "id": 1,
        "name": "China",
        "region": "CN",
        "baseUrl": "http://1.2.3.4:30980",
        "username": "admin",
        "subnetPoolCidr": "10.10.0.0/16",
        "subnetPrefix": 24,
        "status": "online",
        "lastCheckedAt": "2026-04-14T07:30:00Z"
      }
    ]
  }
}
```

#### `POST /api/controllers`

Request:

```json
{
  "name": "China",
  "region": "CN",
  "baseUrl": "http://1.2.3.4:30980",
  "username": "admin",
  "password": "secret",
  "subnetPoolCidr": "10.10.0.0/16",
  "subnetPrefix": 24
}
```

#### `PUT /api/controllers/:id`

#### `DELETE /api/controllers/:id`

#### `POST /api/controllers/:id/test`

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "success": true,
    "controllerHome": "/controller",
    "controllerAddress": "c28aedacfd",
    "version": "1.14.1"
  }
}
```

### Networks

#### `GET /api/networks`

Query params:

- `controllerId`
- `region`
- `keyword`

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [
      {
        "controllerId": 1,
        "controllerName": "China",
        "region": "CN",
        "networkId": "c28aedacfd3473e8",
        "networkName": "dev",
        "memberCount": 7
      }
    ]
  }
}
```

#### `POST /api/networks`

Request:

```json
{
  "controllerId": 1,
  "networkName": "office-vpn"
}
```

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "controllerId": 1,
    "networkId": "c28aedacfd123456",
    "networkName": "office-vpn",
    "networkCidr": "10.10.42.0/24",
    "poolStart": "10.10.42.1",
    "poolEnd": "10.10.42.254",
    "private": true
  }
}
```

#### `GET /api/networks/:controllerId/:networkId`

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "controllerId": 1,
    "controllerName": "China",
    "networkId": "c28aedacfd3473e8",
    "networkName": "dev",
    "private": true,
    "routes": [
      {
        "target": "10.0.42.0/24",
        "via": null
      }
    ],
    "ipAssignmentPools": [
      {
        "ipRangeStart": "10.0.42.1",
        "ipRangeEnd": "10.0.42.254"
      }
    ],
    "memberCount": 7
  }
}
```

#### `PATCH /api/networks/:controllerId/:networkId/name`

Request:

```json
{
  "networkName": "dev-new"
}
```

#### `DELETE /api/networks/:controllerId/:networkId`

### Members

#### `GET /api/networks/:controllerId/:networkId/members`

Response:

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "items": [
      {
        "memberId": "0c3e9836ed",
        "memberName": "SHOE-SERVER",
        "authorized": true,
        "activeBridge": false,
        "ipAssignments": ["10.0.42.153"],
        "online": true,
        "version": "1.16.1",
        "physicalAddress": "120.235.183.60",
        "latency": 28
      }
    ]
  }
}
```

#### `PATCH /api/networks/:controllerId/:networkId/members/:memberId/auth`

Request:

```json
{
  "authorized": false
}
```

#### `PATCH /api/networks/:controllerId/:networkId/members/:memberId/name`

Request:

```json
{
  "memberName": "Office-PC"
}
```

#### `DELETE /api/networks/:controllerId/:networkId/members/:memberId`

## Database Draft

MVP should keep only local admin and controller configuration data.
Network and member business data should not be fully persisted locally.

### `admin_users`

```sql
CREATE TABLE admin_users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### `controllers`

```sql
CREATE TABLE controllers (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  region VARCHAR(32) NOT NULL,
  base_url VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL,
  password_enc TEXT NOT NULL,
  subnet_pool_cidr VARCHAR(32) NOT NULL,
  subnet_prefix TINYINT NOT NULL DEFAULT 24,
  status VARCHAR(16) NOT NULL DEFAULT 'unknown',
  last_checked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_controller_name (name)
);
```

### Optional `admin_sessions`

```sql
CREATE TABLE admin_sessions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_admin_sessions_user
    FOREIGN KEY (user_id) REFERENCES admin_users(id)
);
```

## Backend Module Suggestion

Recommended backend modules:

- `auth`
- `controllers`
- `networks`
- `members`
- `ztncui-client`
- `subnet-allocator`

Recommended core class:

- `ZtncuiClient`

Suggested methods:

- `login()`
- `ensureSession()`
- `listNetworks()`
- `getNetworkDetail()`
- `createNetwork()`
- `setNetworkPrivate()`
- `easySetupNetwork()`
- `renameNetwork()`
- `deleteNetwork()`
- `listMembers()`
- `setMemberAuth()`
- `setMemberName()`
- `deleteMember()`

## Create Network Internal Flow

For `POST /api/networks`, the backend should:

1. Load controller config.
2. Login to target `ztncui`.
3. Create empty network.
4. Read the created network ID.
5. Load existing networks for that controller.
6. Allocate the next available `/24` from the controller subnet pool.
7. Compute:
   - `networkCIDR`
   - `poolStart`
   - `poolEnd`
8. Set network `private = true`.
9. Call `easy setup`.
10. Return the initialized network detail.

Important requirement:

- lock network creation per controller to avoid duplicate subnet allocation in
  concurrent requests

## Parsing And Session Notes

- Use a cookie jar for each controller session.
- Re-login automatically when session expires.
- Parse list and detail pages from HTML if needed.
- Prefer stable upstream routes already confirmed in `ztncui`.
- Mask controller passwords in logs.

## Security Notes

- Store controller passwords encrypted, not plain text.
- Keep upstream cookies server-side only.
- Do not expose controller credentials to the frontend.
- Avoid printing upstream raw HTML and sensitive headers in application logs.
