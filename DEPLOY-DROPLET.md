# Deploy PasarEx LM to a single Droplet (Docker Compose)

Runs the whole stack on one Ubuntu droplet: nginx edge (both SPAs + API proxy),
NestJS API, PostgreSQL/PostGIS, and Redis.

## Prerequisites (on the droplet, one-time)
```bash
# Docker Engine + compose plugin
curl -fsSL https://get.docker.com | sh
```

## Deploy
```bash
# 1. get the code
git clone https://github.com/ClaudiaSherpa/LastMile.git /opt/pasarex
cd /opt/pasarex

# 2. configure secrets
cp .env.prod.example .env.prod
nano .env.prod            # set DB_PASSWORD, JWT secrets, PUBLIC_BASE_URL=http://<ip>, keys

# 3. build + start (migrations run automatically on API boot)
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build

# 4. seed once (staff logins + demo data) — TRUNCATEs, so only before go-live
docker compose --env-file .env.prod -f docker-compose.prod.yml exec api \
  sh -c "cd /repo && npm run seed:prod -w @sherpa/api"
```

Then browse `http://<droplet-ip>/` (driver), `http://<droplet-ip>/ops` (Ops console),
`http://<droplet-ip>/api/health`.

## Update to a new release
```bash
cd /opt/pasarex && git pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

## Notes
- Open ports 80 (and 443 if you add TLS) in the droplet firewall; the DB/Redis/API
  ports are NOT published — only nginx (80) is exposed.
- Redis is included, so the scheduled compliance scan + nightly score recompute run.
- For HTTPS + a domain, put Caddy/Traefik or certbot+nginx in front, then set
  PUBLIC_BASE_URL/CORS_ORIGINS to the https origin and rebuild.
- WhatsApp inbound: once the droplet is reachable, register the webhook:
  `curl -X POST http://<ip>/api/whatsapp/webhook/register -H "Authorization: Bearer <admin-JWT>" -H "Content-Type: application/json" -d '{"apiBaseUrl":"http://<ip>"}'`
