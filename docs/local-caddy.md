# Local Caddy Domains

This repository includes a root `Caddyfile` for local HTTPS domains:

- `https://zt-mgmt.dev` -> web upstream, default `127.0.0.1:4173`
- `https://api.zt-mgmt.dev` -> API upstream, default `127.0.0.1:3001`
- `https://zt-mgmt.dev/api/*` -> API upstream, so the default `VITE_API_BASE_URL=/api` keeps working

## Setup

Add local host records:

```bash
sudo sh -c 'printf "\n127.0.0.1 zt-mgmt.dev api.zt-mgmt.dev\n" >> /etc/hosts'
```

Trust Caddy's local CA once on the machine that opens the site:

```bash
sudo caddy trust
```

Start `zt-mgmt` with either local dev commands or Docker Compose:

```bash
make dev
```

```bash
docker compose up -d --build
```

Validate and run the Caddy config from the repository:

```bash
caddy validate --config Caddyfile
sudo caddy run --config Caddyfile
```

If you already run Caddy as a system service, install the config into a Caddy-readable path:

```bash
sudo install -m 0644 Caddyfile /etc/caddy/zt-mgmt.caddy
```

Then add this line to `/etc/caddy/Caddyfile` and reload Caddy:

```caddyfile
import /etc/caddy/zt-mgmt.caddy
```

```bash
sudo systemctl reload caddy
```

## Optional API Subdomain Base URL

The default `.env` value `VITE_API_BASE_URL=/api` works because the Caddyfile proxies `/api` on `zt-mgmt.dev` to the backend.

If you want browser requests from the web app to explicitly use the API subdomain, set this in `.env` and restart or rebuild the web app:

```env
VITE_API_BASE_URL=https://api.zt-mgmt.dev/api
```

If you changed exposed ports, override upstreams before starting Caddy:

```bash
ZT_MGMT_WEB_UPSTREAM=127.0.0.1:5173 \
ZT_MGMT_API_UPSTREAM=127.0.0.1:3001 \
caddy run --config Caddyfile
```
