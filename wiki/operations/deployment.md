---
title: Production Deployment
type: runbook
status: current
updated: 2026-09-15
source_ids: [container-definitions, environment-template, package-manifest, operational-scripts, application-source, project-contract]
tags: [deployment, docker, podman, http, production]
---

# Production Deployment

Pennyworth production runs the compiled non-root Node image with PostgreSQL. The current production profiles publish HTTP directly and explicitly disable the cookie `Secure` flag so login works without TLS. They are trusted-private-network deployments, remote access must enter through an authenticated encrypted VPN, and they must not be exposed to the internet.

## Required configuration

Create `.env` from `.env.example` and replace every placeholder. At minimum, set:

```text
POSTGRES_USER=pennyworth
POSTGRES_PASSWORD=replace-with-a-strong-database-password
POSTGRES_DB=pennyworth
DATABASE_URL=postgresql://pennyworth:THE_SAME_DATABASE_PASSWORD@postgres:5432/pennyworth?schema=public
SESSION_SECRET=replace-with-a-generated-secret-at-least-32-characters
INITIAL_ADMIN_EMAIL=admin@example.com
INITIAL_ADMIN_PASSWORD=replace-with-a-password-of-at-least-12-characters
PRIMARY_CURRENCY=EUR
APP_TIME_ZONE=Europe/Rome
APP_BIND_ADDRESS=192.168.1.10
TRANSPORT_SECURITY=trusted-private-http
UPDATE_CHECK_ENABLED=false
UPDATE_CHANNEL=prerelease
UPDATE_CHECK_INTERVAL_HOURS=24
```

Replace the example bind address with the Pennyworth host's intended private or VPN-interface address. Prefer a VPN address when the VPN terminates on the application host. If the VPN terminates on a router, access is encrypted only as far as that router and the remaining LAN hop is plaintext.

Generate a session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Production startup validates the database URL, port, currency, timezone, session secret, and explicit transport-security decision. It applies migrations, initializes the administrator idempotently, then starts the compiled app.

### Optional release checks

`UPDATE_CHECK_ENABLED` remains `false` unless the operator enables it. With `true`, the application makes a server-to-server HTTPS request to GitHub for public release metadata; GitHub can observe the server's public IP address and ordinary request headers, but Pennyworth sends no user, financial, database, or installation-specific data. `UPDATE_CHANNEL=prerelease` includes prereleases and stable releases; set `stable` to ignore prereleases. `UPDATE_CHECK_INTERVAL_HOURS` is an integer from 1 through 168 and defaults to 24. Outbound DNS and HTTPS access to GitHub are therefore required only for enabled checks; update checking is not part of the health checks.

## Accepted private HTTP boundary

Pennyworth intentionally avoids certificate management for its home-lab profile. The absence of HTTPS is accepted as a low residual risk only when all of these controls are maintained:

- no public DNS exposure or router port forwarding to the application;
- a bind address limited to the intended private/VPN interface, or equivalent host-firewall restrictions when `0.0.0.0` is unavoidable;
- remote access only through an authenticated encrypted VPN;
- trusted LAN clients and network infrastructure;
- PostgreSQL restricted to its container network or specifically authorized private database path;
- strong unique secrets and the existing signed, `HttpOnly`, `SameSite=Strict`, CSRF-protected cookie controls.

Verify the boundary from separate network locations: an authorized private/VPN client must connect, while a public-internet client and a client on every unintended interface or segment must fail. Reassess this decision and add HTTPS before permitting public access, guest or untrusted LAN clients, or browser access outside the VPN.

## Managed PostgreSQL production profile

Use this profile when Compose should manage both Pennyworth and PostgreSQL:

```bash
docker compose --env-file .env -f deploy/compose.prod.yml up --build -d
docker compose --env-file .env -f deploy/compose.prod.yml ps
```

It publishes the app on `APP_PORT` (default `3000`) and keeps PostgreSQL inside the Compose network. Open `http://SERVER_PRIVATE_IP:3000`. PostgreSQL is bound only inside Compose and is not published by this production profile.

## Private-LAN HTTP with an existing PostgreSQL server

Use `deploy/compose.external-db.yml` when PostgreSQL is already managed on the home server or another private-LAN machine and HTTP is currently sufficient. This profile starts only Pennyworth and does not create, stop, upgrade, back up, or remove PostgreSQL.

The profile publishes the app directly on `APP_PORT`; authentication cookies are configured for the supported HTTP topology. Passwords and financial pages are unencrypted on the network. Restrict access to a trusted private LAN, do not forward the port on the router, and do not expose it through a public firewall rule.

Create a dedicated database and owner using the administration method for the existing server:

```sql
CREATE USER pennyworth WITH PASSWORD 'replace-with-a-strong-password';
CREATE DATABASE pennyworth OWNER pennyworth;
```

The database owner must be allowed to create and alter objects in its Pennyworth database because application startup runs Prisma migrations. Restrict PostgreSQL and the host firewall to the application server or container network; never publish port `5432` to the internet.

Set `DATABASE_URL` to an address reachable **from the app container**:

```text
DATABASE_URL=postgresql://pennyworth:ENCODED_PASSWORD@192.168.1.50:5432/pennyworth?schema=public
```

If PostgreSQL runs on the same machine, do not use `localhost`: that means the app container itself. Use a stable private address or hostname belonging to the server and configure PostgreSQL `listen_addresses`, `pg_hba.conf`, and the firewall for the actual container source network. If PostgreSQL runs on another LAN machine, use that machine's private DNS name or address. Percent-encode special URL password characters; a generated hexadecimal database password avoids URL-encoding ambiguity.

Start and inspect the external-database profile:

```bash
docker compose --env-file .env -f deploy/compose.external-db.yml up --build -d
docker compose --env-file .env -f deploy/compose.external-db.yml ps
docker compose --env-file .env -f deploy/compose.external-db.yml logs -f app
```

By default, browse to:

```text
http://SERVER_PRIVATE_IP:3000
```

Set `APP_BIND_ADDRESS` to the server's intended private or VPN-interface address when the container engine supports binding that address. Use the default `0.0.0.0` only when necessary and enforce the same source-network restriction with the host firewall. `APP_PORT` changes the published host port.

Before first startup, test the `DATABASE_URL` from a container or other client on the same network path. `/readyz` returns `503` until the external database is reachable. Backups and PostgreSQL upgrades are the external database administrator's responsibility; Pennyworth's JSON export remains an additional application-level backup.

## Production checklist

- Strong and unique database, session, and administrator secrets.
- An explicitly isolated trusted private LAN with authenticated VPN-only remote access; traffic after VPN termination is unencrypted.
- The application bound to the intended private/VPN address, or equivalent host-firewall restrictions verified from an unintended network.
- No router port forwarding or public firewall rule for the application port.
- PostgreSQL private to the Compose network or an encrypted/restricted database path.
- Migrations applied and `/readyz` returning success.
- First login followed by administrator password review.
- Current JSON and SQL backups stored privately.
- A restore rehearsal using non-production data.
- Database volumes retained across rebuilds.

## Updates

Create JSON and SQL backups first. The default application image is built locally, so update the managed-PostgreSQL profile without trying to pull `pennyworth-app:latest` from a registry:

```bash
docker compose --env-file .env -f deploy/compose.prod.yml build --pull app
docker compose --env-file .env -f deploy/compose.prod.yml pull postgres
docker compose --env-file .env -f deploy/compose.prod.yml up --build -d
docker compose --env-file .env -f deploy/compose.prod.yml exec app npm run db:deploy
```

For the external-database profile, rebuild and restart only the application:

```bash
docker compose --env-file .env -f deploy/compose.external-db.yml build --pull app
docker compose --env-file .env -f deploy/compose.external-db.yml up --build -d
docker compose --env-file .env -f deploy/compose.external-db.yml exec app npm run db:deploy
```

The app runs `db:deploy` during startup; the explicit command is an audit step. Verify health, readiness, login, balances, and recent activity after the update. Recovery procedures are in [`backup-and-restore.md`](backup-and-restore.md).

## Forgotten administrator password

Password recovery uses access to the Pennyworth server as proof of identity; it does not require email delivery. Find the running application container, then run the reset command directly in it:

```bash
docker ps --format "table {{.Names}}\t{{.Image}}"
docker exec -it APP_CONTAINER npm run auth:reset-password -- --email admin@example.com
```

Replace `APP_CONTAINER` with the container name shown by `docker ps`. This engine-level command is independent of the Compose filename, project name, and current working directory. It works for both managed- and external-database deployments. The command prompts for the new password twice without displaying it. It does not accept the password as an argument or environment variable. A successful reset replaces the bcrypt hash and increments the user's session version, so every existing browser session must sign in again.

Do not change `INITIAL_ADMIN_PASSWORD` to recover an existing account. Initial administrator setup is idempotent and deliberately does not overwrite an existing user's password.

## Troubleshooting

**`localhost` fails inside the app container:** use Compose service name `postgres` for managed profiles. For the external-database profile, use the existing server's container-reachable private hostname or address.

**Production rejects `SESSION_SECRET`:** use a generated value at least 32 characters long and different from the development secret.

**Password reset reports that an interactive terminal is required:** include `-it` in the `docker exec` or `podman exec` command and run it from an attached server terminal.

**Prisma migration lock timeout:** stop a genuinely stuck migration process, retry, and inspect PostgreSQL advisory locks before forcing cleanup.

**Container engine cannot pull/start:** confirm `docker compose` is available, or verify `podman info` and `podman compose version` for Podman.


## Related pages

- [`backup-and-restore.md`](backup-and-restore.md)
- [`podman.md`](podman.md)
- [`local-development.md`](local-development.md)
- [`../architecture/security-and-privacy.md`](../architecture/security-and-privacy.md)

## Sources

- [`container-definitions`](../sources.md#sourcecontainer-definitions)
- [`environment-template`](../sources.md#sourceenvironment-template)
- [`package-manifest`](../sources.md#sourcepackage-manifest)
- [`operational-scripts`](../sources.md#sourceoperational-scripts)
- [`application-source`](../sources.md#sourceapplication-source)
- [`project-contract`](../sources.md#sourceproject-contract)
