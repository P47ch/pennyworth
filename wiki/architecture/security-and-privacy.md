---
title: Security and Privacy
type: security
status: current
updated: 2026-09-16
source_ids: [project-contract, application-source, database-schema, migrations, container-definitions, environment-template, test-suite]
tags: [security, privacy, authentication, integrity]
---

# Security and Privacy

Pennyworth stores sensitive financial data. Its current deployment model assumes a private, trusted home LAN with no public port forwarding. Remote clients must enter through an authenticated encrypted VPN.

## Authentication and sessions

- There is no public registration flow.
- Passwords are hashed with bcrypt cost 12. Newly set passwords must be at least 12 characters and no more than 72 UTF-8 bytes, matching bcrypt's effective input limit. Existing bcrypt hashes remain verifiable for compatibility; a future Argon2id migration must use an explicit versioned-hash change.
- Login attempts use Fastify rate limiting.
- Unknown-email logins still perform an expensive bcrypt comparison, reducing account-enumeration timing differences. Inactive accounts receive the same generic failure as invalid credentials.
- Sessions are signed cookie payloads containing user ID, session version, and expiry.
- Session cookies are `HttpOnly`, `SameSite=Strict`, path-scoped to `/`, and are marked `Secure` when `TRANSPORT_SECURITY=https`; trusted private HTTP deliberately leaves that attribute off.
- Password changes increment `sessionVersion`, invalidating older signed sessions.
- Administrators can create members, reset another user's password, and activate or deactivate access. Generated temporary passwords are rendered once, require replacement before ledger access, and are never stored in plaintext.
- A member who forgets a password asks an application administrator for a generated temporary password, which invalidates existing sessions and must be replaced after login. The only administrator can recover through the operator console command; it requires an interactive terminal, reads the replacement password without echoing it or accepting it in arguments/environment variables, applies the shared password policy, and invalidates existing sessions.
- Production rejects the known development session secret and secrets shorter than 32 characters.

## Request and browser protection

- Mutating form posts require a double-submit CSRF token. The CSRF cookie is `HttpOnly`, `SameSite=Strict`, signed, and marked `Secure` when `TRANSPORT_SECURITY=https`; trusted private HTTP deliberately leaves that attribute off.
- Server-side validation is authoritative; browser validation only improves usability.
- The server emits a restrictive Content Security Policy: self-only scripts/styles/connections, no objects, no framing, and self-only forms.
- Responses also set `X-Content-Type-Options`, same-origin referrer policy, frame denial, and a permissions policy disabling camera, microphone, and geolocation.
- Non-static responses use `Cache-Control: no-store`.
- Current production profiles deliberately permit HTTP cookies for an isolated private LAN. Network traffic, including credentials and financial data, is not encrypted after it leaves any VPN tunnel.
- Certificate-free private HTTP is an accepted low residual risk only while the application is unreachable from the public internet and unintended network segments. `HttpOnly`, `SameSite=Strict`, signing, and CSRF protection remain mandatory but do not replace transport encryption.
- A centralized error handler logs full unhandled exceptions only on the server and renders a generic HTML error page with a request ID. Database codes, query details, stack traces, and exception messages are not included in browser responses.

## Ownership and database integrity

Services check that referenced accounts, categories, tags, assets, budgets, rules, and recurring records belong to the current user. Updates and deletes use composite `(id, userId)` selectors, and PostgreSQL independently enforces same-user composite foreign keys across ledger, automation, and investment records.

Family-user support retains `User` as the tenant boundary: authenticated users cannot read or modify another user's financial records, and there is no household-wide shared ledger. Application administrators manage authentication access but receive no application-level view into another user's ledger. The home-lab operator remains a trusted infrastructure administrator with container and database access, including the ability to reset a user's password.

Database constraints reject malformed transaction shapes, non-positive financial values, same-account transfers, categorized transfers, invalid investment combinations, cross-user references, and invalid derived position values. Category parent ownership is database-enforced, while services and restore validation reject hierarchy cycles.

This defense in depth protects normal forms, imports, maintenance scripts, restore operations, and direct database writes.

## Secrets and logging

Secrets belong in environment variables and must not be committed or logged. Important production secrets are `DATABASE_URL`, `SESSION_SECRET`, `POSTGRES_PASSWORD`, and `INITIAL_ADMIN_PASSWORD`. Financial form payloads and backup bodies should not be logged unnecessarily.

PostgreSQL must remain on loopback, a private container network, an encrypted tunnel, or an explicitly restricted private network; it must not be published to the internet.

## Backup boundary

JSON backup export is user-scoped application data. Restore requires preview and explicit confirmation, validates references and cycles before replacement, and runs transactionally. SQL dumps are the full-server recovery mechanism. Both contain sensitive financial data and require private storage and tested recovery. See [`../operations/backup-and-restore.md`](../operations/backup-and-restore.md).

## Operational requirements

- Use a generated session secret and strong database/admin passwords.
- Production startup requires an explicit `TRANSPORT_SECURITY` choice: `trusted-private-http` for the accepted private-network boundary or `https` when TLS is provided by the deployment path. The current app emits `Secure` cookies only for the `https` mode.
- Prefer binding the HTTP service to the intended private or VPN interface. If it must bind to all interfaces, use the host firewall to restrict source networks.
- Isolate the HTTP service to a trusted LAN, require authenticated VPN access for remote clients, and never publish its port to the internet.
- Prefer terminating the VPN on the Pennyworth host; otherwise recognize that the VPN-gateway-to-application LAN hop remains plaintext.
- Apply Prisma migrations before starting a new version.
- Keep database volumes and backups private.
- Test restore with non-production data.
- Run the guarded integration tests against a database or schema whose name explicitly contains `test`.
- Do not add analytics or telemetry without an explicit product decision.

## Known boundaries

Pennyworth is not a hardened public SaaS. Administrator-provisioned, isolated family accounts are intended only for the same trusted private installation. Public exposure, port forwarding, guest or untrusted LAN access, browser access outside the VPN, public registration, email-delivered recovery, and shared household finances remain outside this trust model and would require a separate security design.

## Related pages

- [`data-and-financial-model.md`](data-and-financial-model.md)
- [`../operations/deployment.md`](../operations/deployment.md)
- [`../operations/testing-and-performance.md`](../operations/testing-and-performance.md)
- [`../operations/backup-and-restore.md`](../operations/backup-and-restore.md)

## Sources

- [`project-contract`](../sources.md#sourceproject-contract)
- [`application-source`](../sources.md#sourceapplication-source)
- [`database-schema`](../sources.md#sourcedatabase-schema)
- [`migrations`](../sources.md#sourcemigrations)
- [`container-definitions`](../sources.md#sourcecontainer-definitions)
- [`environment-template`](../sources.md#sourceenvironment-template)
- [`test-suite`](../sources.md#sourcetest-suite)
