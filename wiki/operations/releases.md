---
title: Release Management
type: runbook
status: current
updated: 2026-10-08
source_ids: [release-policy, package-manifest, test-suite, ci-workflow, container-definitions, application-source]
tags: [release, versioning, semver, verification]
---

# Release Management

Pennyworth uses Semantic Versioning. `package.json` is the authoritative application-version source, and `package-lock.json` mirrors it. The current application version is `0.9.0-alpha.1`, an actively changing pre-v1 preview being prepared for release.

## Current release preparation

The dated [0.9.0-alpha.1 changelog entry](../../CHANGELOG.md#090-alpha1---2026-10-08) contains the release notes, four required migrations, backup compatibility, rollback requirements, and known limitations. This minor preview includes meaningful recurring and categorization changes as well as encrypted backups, optional update notifications, deletion confirmations, and interface fixes.

Package versions and documentation are prepared. The seven local automated release checks, Chromium accessibility audit, Docker production profiles, and JSON/encrypted/PostgreSQL recovery rehearsals passed on 2026-10-08; see [release verification](testing-and-performance.md#090-alpha1-release-verification) for the exact scope and the unresolved local Podman VM runtime limitation. Pull requests into `main` and `develop`, CI on the resulting release commit, an annotated tag, and a matching GitHub prerelease remain pending. Local working-tree checks do not replace CI on the final commit.

Operators upgrading from `0.8.0-alpha.1` should follow [deployment updates](deployment.md#updates), retain tested pre-upgrade JSON and PostgreSQL backups, and review [backup compatibility](json-backup-format.md) before starting the new application.

## Version selection

Before v1.0:

- `0.MINOR.PATCH` identifies a pre-v1 release line.
- Increment `PATCH` for compatible fixes on that line.
- Increment `MINOR` for meaningful features, behavior changes, database migrations, or deliberately incompatible application contracts.
- Use `alpha.N` while features or contracts are actively changing.
- Move to `beta.N` when the release scope is feature-complete and ready for wider self-hosted validation.
- Use `rc.N` only when no known blocker remains and the candidate is undergoing final release verification.

Versions are release identifiers, not completion percentages. Ordinary development commits do not each receive a new application version.

## Branch workflow

Pennyworth uses `main` for stable release history and `develop` as the integration branch. Changes normally reach `develop` through short-lived branches and pull requests. Branch names must follow Git Flow naming, use lowercase kebab-case after the prefix, and must not use agent or tool-specific prefixes:

- `feature/*` for new product behavior.
- `fix/*` for compatible defect corrections found during normal development.
- `chore/*` for dependencies, build tooling, CI, documentation maintenance, and other work that does not add product behavior.
- `release/*` for final version, changelog, documentation, and verification work before merging a release into both `main` and `develop`.
- `hotfix/*` for urgent corrections branched from `main` and merged back into both `main` and `develop`.

Create `feature/*`, `fix/*`, and `chore/*` branches from the current `develop` branch and target their pull requests back to `develop`. Delete short-lived branches after merging.

## Independent version systems

Do not couple these identifiers:

- **Application version:** Semantic Version such as `0.9.0-alpha.1`, sourced from `package.json` and shown in the application sidebar.
- **JSON backup schema:** integer such as `12`, governed by the published backup contract and restore compatibility.
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
6. Commit and push the exact release state with a message such as `release: v0.9.0-alpha.1`. Merge the release branch through pull requests into both `main` and `develop`, preserving the release commit in both branches with merge commits. Verify required CI on the resulting `main` release commit.
7. Check out that verified `main` commit and create and push an annotated, immutable tag:

   ```bash
   git tag -a v0.9.0-alpha.1 -m "Pennyworth v0.9.0-alpha.1"
   git push origin v0.9.0-alpha.1
   ```

8. Create the corresponding GitHub Release from the tag and use the changelog entry as the basis for its notes. Mark alpha, beta, and RC versions as prereleases. After publication, update current release-status documentation and append the publication result to the wiki log.

Every Pennyworth Git tag published as a release must have a matching GitHub Release whose tag is valid Semantic Versioning (an optional leading `v` is accepted). This is the public release metadata consumed by the optional administrator update check; drafts are ignored, stable-only installations ignore prereleases, and release prose is never interpreted as application metadata.

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
