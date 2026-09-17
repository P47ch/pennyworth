---
title: Release Management
type: runbook
status: current
updated: 2026-09-05
source_ids: [release-policy, package-manifest, test-suite, ci-workflow, container-definitions, application-source]
tags: [release, versioning, semver, verification]
---

# Release Management

Pennyworth uses Semantic Versioning. `package.json` is the authoritative application-version source, and `package-lock.json` mirrors it. The current release is `0.8.0-alpha.1`, an actively changing pre-v1 public preview.

## Version selection

Before v1.0:

- `0.MINOR.PATCH` identifies a pre-v1 release line.
- Increment `PATCH` for compatible fixes on that line.
- Increment `MINOR` for meaningful features, behavior changes, database migrations, or deliberately incompatible application contracts.
- Use `alpha.N` while features or contracts are actively changing.
- Move to `beta.N` when the release scope is feature-complete and ready for wider self-hosted validation.
- Use `rc.N` only when no known blocker remains and the candidate is undergoing final release verification.

Versions are release identifiers, not completion percentages. Ordinary development commits do not each receive a new application version.

## Independent version systems

Do not couple these identifiers:

- **Application version:** Semantic Version such as `0.8.0-alpha.1`, sourced from `package.json` and shown in the application sidebar.
- **JSON backup schema:** integer such as `8`, governed by the published backup contract and restore compatibility.
- **Database migrations:** immutable timestamped directories under `prisma/migrations/`.

A change can affect one, two, or all three systems. Evaluate and update each according to its own contract.

## Prepare a release

1. Choose the exact version and move completed notes into a dated `CHANGELOG.md` entry.
2. Update both package files without creating an automatic Git tag:

   ```bash
   npm version <exact-version> --no-git-tag-version
   ```

3. Document breaking behavior, required migrations, backup compatibility, known limitations, and operator actions.
4. Run the local release checks:

   ```bash
   npm run test
   npm run test:integration
   npm run test:typecheck
   npm run typecheck
   npm run build
   npm audit --audit-level=high
   npm run wiki:lint
   ```

5. Run the browser accessibility audit against the built application and validate the affected Docker and Podman Compose profiles. Exercise backup and restore whenever data contracts or migrations changed.
6. Commit the exact release state with a message such as `release: v0.8.0-alpha.1`.
7. Create and push an annotated, immutable tag:

   ```bash
   git tag -a v0.8.0-alpha.1 -m "Pennyworth v0.8.0-alpha.1"
   git push origin v0.8.0-alpha.1
   ```

8. Create the corresponding GitHub Release from the tag and use the changelog entry as the basis for its notes.

CI remains executable truth for automated verification. A tag should identify the exact commit that passed the required checks; never move or reuse a published tag.

## Related pages

- [`testing-and-performance.md`](testing-and-performance.md)
- [`deployment.md`](deployment.md)
- [`backup-and-restore.md`](backup-and-restore.md)
- [`json-backup-format.md`](json-backup-format.md)
- [`../product/status-and-roadmap.md`](../product/status-and-roadmap.md)

## Sources

- [`release-policy`](../sources.md#sourcerelease-policy)
- [`package-manifest`](../sources.md#sourcepackage-manifest)
- [`test-suite`](../sources.md#sourcetest-suite)
- [`ci-workflow`](../sources.md#sourceci-workflow)
- [`container-definitions`](../sources.md#sourcecontainer-definitions)
- [`application-source`](../sources.md#sourceapplication-source)
