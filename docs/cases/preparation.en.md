# Baseline preparation

[中文](preparation.md) · [Case index](README.en.md)

**Date: 2026-10-12**

## Starting point

- Source: `huangyingting/ai-native-sdlc`
- Source commit: `b30e6bc3a693f674d48f1a9f76952176214eae9e`
- Target: `huangyingting/ai-native-sdlc-demo`
- Repository identity: `1415043318`, created `2026-10-12T04:14:53Z`
- Initial baseline commit: `b8128949afaf3f078b70c057d8eea5ead0ecdcf1`
- Reviewer: `huangyingting`, authorizing product decisions and approvals
- Workflow profile: `decisions-v1`, single-owner review policy
- Application: existing service desk, without ticket ownership or readiness
- Engineering fixture: existing owner model, without proxy ownership

## Local application validation

The service desk passed **26 tests**, lint and a production build with
Node.js **24.18.1**. The engineering fixture passed **15 tests**.
These results validate the starting applications; they do not establish that
the requested ownership or proxy features have been implemented.

Repository automation passed **456 tests**. Hosted
[Repository CI](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38203017609)
and [IT Service Desk CI](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38203017613)
also passed for the initial baseline. Application CI includes container
verification, not an online deployment or user acceptance.

## Installation correction

During preparation of the shared baseline, `npm ci` failed with `EALLOWREMOTE`:
456 lockfile tarball URLs referenced a package mirror rather than the configured
npm registry. Changing npm's registry-host replacement option did not alter the
lockfile. The download prefix was normalized to `https://registry.npmjs.org/`.
A structural comparison confirmed all versions, dependency relationships and
integrity hashes remained unchanged. `npm ci` then succeeded.

The npm installation audit reported **8 advisories: 7 high and 1 critical**.
These are unresolved dependency findings, not verified exploitability or a
security approval. No automatic dependency upgrade or `npm audit fix --force`
was performed. Assess them before production use.

This repository starts with the corrected lockfile. A fresh `npm ci` succeeded
and reported the same eight unresolved advisories.

## Automation credential

**Status on 2026-10-12:** the repository secret was configured at
`04:27:13Z` (12:27:13 Beijing time). Its presence and automated setup checks
were verified without reading its value. The first Tests handoff failed with a
token-access error. After the operator corrected permissions, the
[retry succeeded](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38206744511)
without repeating document approvals. Tests assignment and the later
[Implementation assignment](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38210668893)
both succeeded. This verifies those operations, not every future token-dependent action.

`COPILOT_ASSIGN_TOKEN` must be configured before assigning reviewed coding tasks.
Document generation uses the workflow's own GitHub token and does not require
copying a personal token into a prompt or Issue.

1. Open GitHub **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens**.
2. Create a token with resource owner `huangyingting`, a suitable expiration,
   and access only to the current `ai-native-sdlc-demo` repository.
3. Grant **Actions**, **Contents**, **Issues** and **Pull requests** read/write
   access; **Metadata** remains read-only.
4. Open this repository's **Settings → Secrets and variables → Actions →
   New repository secret**.
5. Save the value as **`COPILOT_ASSIGN_TOKEN`**. Do not put it in an Issue,
   commit, screenshot or chat message.

If reusing a fine-grained token, verify its selected repository: a newly created
repository is a different resource even when its name matches a deleted one.

## Package access during delivery

The first executable publication attempt built the merged image, but GHCR
rejected the upload with `permission_denied: write_package`. The job log
confirmed that its `GITHUB_TOKEN` had `Packages: write`; that declaration did
not by itself grant access to the existing package.

The operator configured the current repository's access under the package's
**Package settings → Manage Actions access**, with **Write** permission.
[Publication attempt 3](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38215333786/attempts/3)
then succeeded without changing application code or replacing a token.

When recreating a repository, check package Actions access separately from
repository secrets. Do not delete the package, make it public, or send a token
through chat merely to work around an access failure.

## Review and acceptance

The [ownership requirement](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1)
records the current document version and decisions. Baseline checks do not
approve that document, grant production readiness or replace application acceptance.
