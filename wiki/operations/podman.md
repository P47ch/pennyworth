---
title: Podman Deployment and Operations
type: runbook
status: current
updated: 2026-09-17
source_ids: [container-definitions, environment-template, podman-docs, package-manifest]
tags: [podman, containers, rootless, operations]
---

# Podman Deployment and Operations

Pennyworth uses the same `Dockerfile` and Compose definitions with Docker or Podman. Images have fully qualified registry names, bind mounts include private SELinux labels, and development dependencies use a container-managed volume.

Podman's `podman compose` delegates Compose behavior to an installed provider. Verify both engine and provider:

```bash
podman info
podman compose version
```

Do not mix `docker compose` and `podman compose` within one active Pennyworth deployment.

## Windows and macOS

Podman requires a managed Linux virtual machine on Windows and macOS. Create/start it once:

```bash
podman machine init --now
```

Start an existing machine after a host restart:

```bash
podman machine start
```

Linux usually runs Podman directly and does not require `podman machine`.

## Compose profiles

Use the same `.env` and security requirements described in [`deployment.md`](deployment.md).

| Use case | Compose file | Start command |
| --- | --- | --- |
| Development app and database | `compose.dev.yml` | `podman compose --env-file .env -f compose.dev.yml up` |
| Private-LAN HTTP, managed PostgreSQL | `deploy/compose.prod.yml` | `podman compose --env-file .env -f deploy/compose.prod.yml up --build -d` |
| Private-LAN HTTP, external PostgreSQL | `deploy/compose.external-db.yml` | `podman compose --env-file .env -f deploy/compose.external-db.yml up --build -d` |

Production profiles apply migrations and initialize the administrator before the app starts. For a new development volume, follow [`local-development.md`](local-development.md#app-and-postgresql-in-containers), replacing `docker compose` with `podman compose`.

The external-database profile runs only the app over HTTP and does not manage PostgreSQL. Its `DATABASE_URL` must use a private hostname or address reachable from the Podman container; `localhost` points to the container and is not the host database. Keep its published port private to the LAN.

## Routine management

Keep the same environment and Compose file for every command:

```bash
podman compose --env-file .env -f deploy/compose.prod.yml ps
podman compose --env-file .env -f deploy/compose.prod.yml logs -f app postgres
podman compose --env-file .env -f deploy/compose.prod.yml restart app
podman compose --env-file .env -f deploy/compose.prod.yml stop
podman compose --env-file .env -f deploy/compose.prod.yml start
podman compose --env-file .env -f deploy/compose.prod.yml down
```

`down` preserves named volumes. Do not add `--volumes` unless permanent database deletion is explicitly intended.

Update with:

```bash
podman compose --env-file .env -f deploy/compose.prod.yml build --pull app
podman compose --env-file .env -f deploy/compose.prod.yml pull postgres
podman compose --env-file .env -f deploy/compose.prod.yml up --build -d
podman compose --env-file .env -f deploy/compose.prod.yml exec app npm run db:deploy
```

The application image is built locally by default; pulling is limited to the managed PostgreSQL service. For the external-database profile, omit the `pull postgres` command and use that profile's Compose filename for the remaining commands.

Reset a forgotten administrator password from an interactive server terminal with:

```bash
podman ps --format "table {{.Names}}\t{{.Image}}"
podman exec -it APP_CONTAINER npm run auth:reset-password -- --email admin@example.com
```

Replace `APP_CONTAINER` with the application container name shown by `podman ps`. The command is independent of the Compose provider and filename. The password is prompted twice without being displayed, and a successful reset invalidates all existing sessions. See [`deployment.md`](deployment.md#forgotten-administrator-password) for the recovery contract.

## Host reboot behavior

Production services use `restart: unless-stopped`. On Linux, Podman applies that policy after reboot through `podman-restart.service`. For rootless deployment:

```bash
systemctl --user enable podman-restart.service
sudo loginctl enable-linger ACCOUNT_NAME
```

Enable the system service for a deliberately rootful deployment. On Windows/macOS, the Podman machine must be running before containers restart; configure Podman Desktop or host startup accordingly.

## Rootless ports and SELinux

The application port `3000` and development PostgreSQL port `5432` normally work rootless. Change `APP_PORT` if port 3000 is occupied. Pennyworth does not require a privileged container.

The development source mount uses Podman's private `Z` SELinux label. Named volumes hold managed PostgreSQL data and development container dependencies.

## Moving between Docker and Podman

Docker and Podman do not share images, networks, containers, or named volumes. Changing the command creates a separate database volume; it does not migrate data.

1. Create current JSON and PostgreSQL backups.
2. Stop the old engine's stack so ports cannot collide.
3. Start the new stack and verify readiness/first login.
4. Restore through the procedures in [`backup-and-restore.md`](backup-and-restore.md).
5. Keep the old volume until data and restore tests are verified.

Choose one active engine per deployment. Do not operate separate Docker and Podman databases as if they were one Pennyworth instance.

## Verification status

All shared Compose files pass Docker Compose parsing and the Dockerfile passes a static Docker build check. A live Podman smoke test remains pending because Podman was not installed on the development workstation during the 2026-07-18 portability work.

## Related pages

- [`deployment.md`](deployment.md)
- [`backup-and-restore.md`](backup-and-restore.md)
- [`local-development.md`](local-development.md)
- [`../product/status-and-roadmap.md`](../product/status-and-roadmap.md)

## Sources

- [`container-definitions`](../sources.md#sourcecontainer-definitions)
- [`environment-template`](../sources.md#sourceenvironment-template)
- [`podman-docs`](../sources.md#sourcepodman-docs)
- [`package-manifest`](../sources.md#sourcepackage-manifest)
