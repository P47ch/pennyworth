---
title: Local Development
type: runbook
status: current
updated: 2026-09-04
source_ids: [package-manifest, environment-template, container-definitions, operational-scripts, project-contract]
tags: [development, setup, postgres]
---

# Local Development

## Requirements

- Node.js 22 or newer.
- npm.
- PostgreSQL 16, directly installed or supplied by Docker/Podman Compose. Newer major versions may work but are not currently part of the documented verification baseline.
- Docker with Docker Compose, or Podman with a Compose provider, when using containers.

Copy `.env.example` to `.env` and replace relevant placeholders. The core local variables are:

```text
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
SESSION_SECRET="development-only-secret-change-me"
APP_PORT="3000"
APP_HOST="0.0.0.0"
APP_TIME_ZONE="Europe/Rome"
INITIAL_ADMIN_EMAIL="admin@example.com"
INITIAL_ADMIN_PASSWORD="replace-with-a-password-of-at-least-12-characters"
PRIMARY_CURRENCY="EUR"
```

`DATABASE_URL` uses `localhost` when Node runs on the host, `postgres` when the app and database share a Compose project, and an SSH-tunnel endpoint when PostgreSQL runs on another machine.

## Host Node with container PostgreSQL

The root `compose.yml` is the default development profile, so Compose discovers it without a `-f` option.

Start only PostgreSQL:

```bash
docker compose up -d postgres
```

Use the host-published database address:

```text
DATABASE_URL="postgresql://pennyworth:pennyworth_dev@localhost:5432/pennyworth?schema=public"
```

Prepare and run the app:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000` or the configured `APP_PORT`.

## App and PostgreSQL in containers

Start the development stack:

```bash
docker compose up
```

The app uses `postgres` as the database hostname inside the Compose network. For a new named database volume, use another terminal after services start:

```bash
docker compose exec app npm run db:deploy
docker compose exec app npm run db:seed
```

The source tree is bind-mounted at `/app`; Linux dependencies use the separate `app-node-modules` named volume so Windows host packages are not reused inside the container.

## PostgreSQL on another machine

The base Compose profile publishes PostgreSQL only on `127.0.0.1` of its host. Use a strong password there, start only `postgres`, then create an encrypted tunnel from the application machine:

```bash
ssh -N -L 5433:127.0.0.1:5432 USER@POSTGRES_HOST_OR_IP
```

Point local Node at the tunnel:

```text
DATABASE_URL="postgresql://pennyworth:STRONG_DATABASE_PASSWORD@127.0.0.1:5433/pennyworth?schema=public"
```

Keep the tunnel supervised for unattended use, or use an encrypted private VPN with strict host access. Do not publish PostgreSQL port `5432` directly to the LAN or internet.

## First login

Both `db:seed` and `db:init-admin` create the configured administrator. `db:seed` also creates example accounts/categories and is intended for development. Production startup uses the compiled `db:init-admin` script and does not load demo financial data.

Initialization requires `INITIAL_ADMIN_PASSWORD`, rejects known defaults, requires at least 12 characters, and does not overwrite an existing user's password. Change the password from Security after first login if it was shared operationally.

After signing in as the administrator, open **Settings > Users** to add trusted family members. Pennyworth displays a generated temporary password once; transfer it privately. The member must replace it on first login before any ledger page is available. Administrators can later reset that password or deactivate the account without deleting its financial data.

## Project commands

```bash
npm run dev                  # watch and run TypeScript server
npm run build                # compile TypeScript
npm run start                # run compiled server
npm run test                 # unit tests
npm run test:typecheck       # type-check tests
npm run typecheck            # type-check application
npm run test:integration     # guarded PostgreSQL/Fastify integration suite
npm run audit:a11y           # live authenticated browser audit
npm run db:generate          # generate Prisma Client
npm run db:migrate           # create/apply development migration
npm run db:deploy            # apply existing migrations
npm run db:seed              # seed development data
npm run db:init-admin        # initialize production administrator
npm run wiki:lint            # validate LLM wiki structure
```

See [`testing-and-performance.md`](testing-and-performance.md) before running destructive test or performance data tools.

## Related pages

- [`deployment.md`](deployment.md)
- [`podman.md`](podman.md)
- [`testing-and-performance.md`](testing-and-performance.md)
- [`../architecture/system-overview.md`](../architecture/system-overview.md)

## Sources

- [`package-manifest`](../sources.md#sourcepackage-manifest)
- [`environment-template`](../sources.md#sourceenvironment-template)
- [`container-definitions`](../sources.md#sourcecontainer-definitions)
- [`operational-scripts`](../sources.md#sourceoperational-scripts)
- [`project-contract`](../sources.md#sourceproject-contract)
