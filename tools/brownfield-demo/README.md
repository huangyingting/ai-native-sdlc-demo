# Repeatable brownfield demo toolkit

A dependency-free **Node.js 24+** CLI for the IT service desk's fixed ownership
feature. It prepares an isolated source tree, performs read-only readiness
checks, runs an exact delivered image locally, and exports actual GitHub
evidence. It never creates a remote repository, dispatches a workflow, edits
GitHub, approves work, resets the source, or commits/pushes.

This is a reusable utility, not an npm workspace or application dependency.
Run from the repository root:

```sh
node tools/brownfield-demo/cli.mjs --help
node tools/brownfield-demo/cli.mjs scenario list
node tools/brownfield-demo/cli.mjs scenario show ownership-standard
node --test tools/brownfield-demo/tests/*.test.mjs
```

## 1. Choose one fixed scenario

Data, the Human Intent template, and the unfilled acceptance checklist live in
[`demos/it-service-desk/.github/brownfield-human-gated-delivery/scenarios/`](../../demos/it-service-desk/.github/brownfield-human-gated-delivery/scenarios/).

| ID | Difference in the process, not the feature |
| --- | --- |
| `ownership-standard` | Normal versioned Human review, Red/Green, merge, image verification, Human acceptance |
| `ownership-spec-revision` | Actual Spec feedback and revision; approve only the revised version before the same delivery |
| `ownership-failure-recovery` | Actual failure, diagnosed cause, operator remediation and real retry without bypassing gates |

All variants use exactly two local owners (Avery Stone and Jordan Lee),
unassigned-by-default tickets, detail assignment/reassignment/clearing, and an
owner filter intersecting existing filters. AC-1 through AC-5 specify records,
reference sets, invalid inputs, migration preservation and persistence.
No authentication, SLA, notification, external identity or other feature is
implicitly included. The data manifest is **not** a Spec, implementation,
approval, populated database, or completed-run claim.

## 2. Prepare from a full immutable source commit

Choose a reviewed commit containing the toolkit **and** current orchestration
but still missing ownership. Do not use a commit where the feature is already
implemented. Paste the full lowercase 40-character Git commit:

```sh
node tools/brownfield-demo/cli.mjs prepare \
  --source /absolute/path/to/ai-native-sdlc \
  --source-ref FULL_40_HEX_COMMIT \
  --dest /absolute/path/to/new-isolated-demo \
  --reviewer YOUR_GITHUB_LOGIN \
  --scenario ownership-standard
```

`FULL_40_HEX_COMMIT` and the paths/login above are placeholders. A branch,
`HEAD`, short SHA, revision expression, tag, or nonexistent commit is rejected.
The destination parent must already exist. The destination must not exist and
must be outside the source repository, including symlink aliases. Existing
files, directories and dangling symlinks are never overwritten.

Preparation:

1. Resolves exactly the supplied commit, with Git replacement objects disabled.
2. Inspects its tracked tree and reads `git archive` in memory. No checkout,
   source reset, remote fetch, or copying of the local working tree occurs.
3. Rejects links, submodules, traversal, Git internals, special tar entries and
   path collisions. Supports Git's ordinary tar and path PAX headers. Archives
   are bounded at 128 MiB; unsupported archives fail closed before destination
   creation.
4. Omits common secret/config and local-data paths (including `.env` except
   `.env.example`/`.sample`/`.template`, credentials, private-key extensions,
   `.npmrc`, SQLite files, logs, dependencies and build output). Untracked files
   never enter the archive. Git `export-ignore` omissions are recorded.
5. Checks exact SHA-256 fingerprints of the six known ownership-free
   application surfaces, the Docker port/database contract, all eight
   orchestration/CI workflow files (including Issue document review), setup,
   and `run-core.mjs`, `runs.mjs`, `state-store.mjs`. A historical commit that
   lacks the new orchestration is **not ready**, even if its app is correct.
6. Changes only `stages.{spec,plan,tests,implementation}.reviewers.users/teams`
   in the known delivery config. Single-reviewer replacement refuses
   policies needing multiple approvals. It never replaces free text, fixture
   owners, code, or documentation.
7. Creates `brownfield-demo-provenance.json` with source path/commit, reviewer,
   scenario, explicit solo-mode choice, omissions and export time.

**Default is not solo mode.** Add `--single-owner` only for an explicitly
single-Human rehearsal. It records this choice; it does not weaken local or
remote policy. Later setup/preflight must select the same mode. Solo mode is
not independent two-person review.

No Git repository is initialized. Inspect the export, then initialize,
commit and publish it separately in a **new isolated repository** using your
normal reviewed process. Do not publish over the source repository. The
provenance includes the local source path; review that before publication.
Omission rules are not a secret scanner: sensitive text already committed
under innocent names cannot be reliably detected. Review the prepared tree
before committing. Never publish replay evidence containing private data
without checking it.

## 3. Read-only preflight on the isolated GitHub repository

```sh
node tools/brownfield-demo/cli.mjs preflight --repo OWNER/REPO
# Only if prepare also explicitly selected solo mode:
node tools/brownfield-demo/cli.mjs preflight --repo OWNER/REPO --single-owner
```

GitHub.com `OWNER/REPO` is mandatory; implicit `gh` repository selection and
arbitrary hosts/URLs are rejected. `gh` must already be authenticated.

Preflight checks Node/Git/gh/Docker CLI availability, pins main for baseline and
provenance inspection, checks Human configuration and active workflows, and
imports the repository's **local trusted** setup preview. That supported
preview checks ruleset status-check contexts/GitHub Actions identity, settings,
secret **names** (never values), reviewer access and Copilot assignability.
Its injected GitHub adapter permits GET and query-only GraphQL; write methods
are rejected even if a setup implementation accidentally attempts them.
`--apply` and `--set-token` do not exist in this CLI.

Suggested setup changes, preview exceptions, access denial or missing checks
are incomplete—not success. To fix them, review and run the separate setup
workflow/tool manually outside this utility, then repeat preflight.

The JSON output distinguishes:

- `automatedReady`: the supported automated checks passed.
- `readyForLiveRun: false`: manual checks cannot be silently certified here.
- `manualChecks`: credential expiry/scopes/entitlement, billing, inherited
  protection, team access, Environment gates, GHCR access and other operator
  checks. CLI presence does not prove Docker daemon access.

Once an image exists, optional `--image ghcr.io/owner/image@sha256:...` validates
its immutable reference syntax only. It does not attest publication or pretend
an artifact exists. Preflight is for a **fresh** prepared baseline; after the
ownership feature lands, its fingerprint check deliberately fails. Use replay
to inspect completed or in-progress runs instead of calling them fresh.

Before the first Intent, run **IT Service Desk CI** from the Actions tab using
**Run workflow** on `main`. This executes tests, lint, build and container smoke
checks without a dummy code change. A new repository's initial push may only
change provenance/configuration relative to its imported history, so the
path-scoped application push trigger is not proof that application CI ran.

Exit codes: **0** command/automated check succeeded (manual checks remain),
**2** preflight/readiness incomplete, **1** invalid input, conflict or execution error.
JSON output may be redirected to a **new operator-selected file** for an
evidence bundle; ordinary shell redirection has its own overwrite semantics.

## 4. Run and inspect a real delivered digest locally

Use the actual digest from the run's publish/verify evidence, not a mutable tag:

```sh
node tools/brownfield-demo/cli.mjs run \
  --repo OWNER/REPO --intent 42 \
  --image ghcr.io/owner/repo-it-service-desk@sha256:FULL_64_HEX_DIGEST \
  --port 3100
```

The lowercase reference is validated before Docker executes. Ports are
integers 1024–65535. The CLI pulls only the exact GHCR digest, starts a uniquely
named container for the repository/Intent, binds **127.0.0.1**, and mounts an
isolated named volume at `/app/data`, with
`SERVICE_DESK_DB_PATH=/app/data/service-desk.db`. This matches the actual app
Dockerfile (container port 3000, non-root user).

Both `/api/health` (`status: ok`) and `/` (the stable
`data-testid="service-desk-dashboard"` marker) must pass within bounded
startup retries. Container identity, labels, data mount, running state, image
and port are checked. The first dashboard request calls the application's
existing `TicketStore.seed()` on the new isolated database: **that is the
provisioning step**, not merely a proposed dataset. Before returning success,
the CLI executes a fixed **read-only** `node:sqlite` probe inside the exact
managed container ID and compares all four IDs, titles, descriptions,
categories, priorities, statuses, requester fields and timestamps against the
scenario manifest. A mismatched or missing dataset fails without resetting it.
`dataset.verified: true` is emitted only after the actual rows match.

The original fixture timestamps are **fixed**, not runtime dates; the manifest
records their exact ISO values. Only subsequently created tickets and
mutations use the current runtime clock. The schema-independent probe does not
assume a future ownership column name: it returns `ownershipVerified: false`.
Check unassigned defaults, assignment, filtering and migration separately.

A successful smoke run still returns `accepted: false`.
It does not modify GitHub or prove ownership acceptance, old-schema migration,
or persistent feature behavior.

Names derive from repository/Intent; labels bind managed version, repository,
Intent and image. Existing resources cause an explicit conflict, even if
previously managed. There is no automatic overwrite/reset.

```sh
# Stop the exact managed container, retaining container and data:
node tools/brownfield-demo/cli.mjs stop --repo OWNER/REPO --intent 42

# Explicitly remove only that matching managed container and data volume:
node tools/brownfield-demo/cli.mjs stop --repo OWNER/REPO --intent 42 --cleanup
```

To observe persistence, use Docker to restart the exact returned container ID
after inspecting it, retaining its volume. Do not use cleanup between
persistence observations. A fresh `run` after explicit cleanup seeds the
app's original four deterministic tickets automatically; the toolkit never
changes application data directly. For AC-5 use another isolated
repository/Intent instance or explicitly clear only the managed test dataset
after recording AC-3. Old-schema migration still needs real implementation
tests—it cannot be proved by an empty-volume smoke test.

On failed startup, resources remain for diagnosis and the CLI prints the
scoped cleanup command. Stop validates **all** matching labels and mounts
before acting, addresses containers by immutable ID, and refuses mismatched
resources. It never runs `docker prune`, wildcard deletion, host mounts,
privileged containers, or repository-wide cleanup. Docker itself refuses
removal of a volume still in use. Private GHCR login remains the operator's
responsibility; this utility never requests or prints a credential.

For a safe local smoke test that leaves an inherited host port 3000 server and
its database alone, set `REPO`, `INTENT` and `IMAGE` to the real isolated
repository, Intent number and exact published digest, then run:

```sh
node tools/brownfield-demo/cli.mjs run \
  --repo "$REPO" --intent "$INTENT" --image "$IMAGE" --port 43127
# After inspecting the returned smoke/data verification result:
node tools/brownfield-demo/cli.mjs stop \
  --repo "$REPO" --intent "$INTENT" --cleanup
```

The toolkit contacts only `127.0.0.1:43127` in this example. It does not stop
an occupied port's server; a Docker port conflict fails and leaves only its
own labeled resources for explicit cleanup. No successful seeding is claimed
unless the local command was actually executed and its database probe passed.

After executing the acceptance checklist, a configured Human submits a new,
unedited Intent comment:

```text
/sdlc accept sha256:ACTUAL_64_HEX_DIGEST
Actual tested digest, AC-1 through AC-5 observations, and any limitations.
```

Use `/sdlc reject sha256:...` and concrete observations for failures. Never
paste the example as if it were observed evidence. Standard run controls
(`/sdlc status`, `help`, `pause`, `resume`, `cancel`) belong to the repository
automation, not this local CLI. Fix actual failed jobs before using the
supported retry/resume route for the stage.

## 5. Replay actual evidence without changing GitHub

```sh
node tools/brownfield-demo/cli.mjs replay \
  --repo OWNER/REPO --intent 42 --dest ./ownership-replay-42
```

The destination must not exist. Outputs:

- `index.html`: escaped, script-free, static snapshot with a restrictive CSP.
- `evidence.json`: actual Issue/sub-Issue comments, linked PR reviews/checks,
  related workflow runs, runtime record, and summary.
- `summary.json`: minimal machine-readable corroboration result and limitations.

Every page says **read-only replay — NOT LIVE**. No markdown/HTML from GitHub
is executed. Links are constructed for the explicit repository; existing
Spec/Plan documents link to immutable commits, not mutable branch URLs.
Evidence is private by default (files mode 0600); no web server is started.
Collection spans several GitHub requests, so it is a timestamped observation,
not an atomic snapshot. Access errors, truncated trees and pagination limits
fail rather than presenting a silently incomplete report.

The toolkit reads version-1 runtime records at
`brownfield-runs/<intent>` /
`docs/delivery-runs/brownfield-human-gated-delivery/<intent>/run-state.json`,
pinning the ref to its exact commit. It verifies the GitHub Actions audit
ledger author/editor and commit/state-hash receipt before trusting the record.
It supports numeric or string run IDs and attempt-bound acceptance metadata.

Completion requires an accepted/unrejected/verified trusted record, the real
matching implementation merge, the actual successful publish workflow, and
matching unedited digest-specific comments by configured Human reviewers.
The current Human policy must still match its recorded hash when present.
Missing/tampered records, bots, ordinary discussion, stale attempts, closed
Issues and merged code alone cannot create completion. Team-only authority
is conservatively left unverified. Records without live evidence remain
incomplete; a failed delivery with no digest is still replayable.

Replay verifies the recorded publication association, not registry signatures
or ownership behavior. The actual publish/verify workflow may still be
finishing when a very early Human accepts; wait for it to complete and review
any corroboration warning. A single replay does not claim three live variants
have been completed. Capture and review each independent real run separately.

## 6. Three-run evidence readiness gate

After actual Human acceptance, query three explicit Intents:

```sh
node tools/brownfield-demo/cli.mjs readiness --repo OWNER/REPO --intents 11,22,33
```

For the recommended separate isolated repositories, align each repository with
its corresponding Intent number (numbers may repeat across repositories):

```sh
node tools/brownfield-demo/cli.mjs readiness \
  --repos OWNER/NORMAL,OWNER/REVISION,OWNER/RECOVERY --intents 1,1,1
```

Use either `--repo` or `--repos`, never both. Both modes are bounded to three
explicit repository/Intent pairs; there is no global repository, Issue or
Actions search. The command writes no files or remote state; its JSON can be
captured separately. Once wired by the parent, the same entry point is
`npm run demo:brownfield -- readiness ...`.

This is an **all-or-nothing evidence gate**: `progress` and
`completedScenarios` remain **`0/3` and `0` until all three distinct accepted
runs satisfy the gate**, then become `3/3` and `3`. Partial findings appear
under `observedAcceptedRuns` and each run's reasons, not as completed scenarios.
Exit 2 means incomplete, including unreadable evidence or missing permissions.

The gate does not accept scenario names or user-supplied success booleans:

- Every run needs an attested runtime record, actual matching successful
  publication attempt and merge, and actual unedited configured Human
  digest-specific acceptance. Current `runId`/`runAttempt`, `policyHash`,
  `commentBody`, digest and failure-state metadata must agree.
- Spec/Plan records must be sealed, share the run's baseline, and match their
  **separately verified document audit ledger**. Actual immutable document
  content hashes, current reviewer policy, approval versions and Human
  approval comments must agree. Unsigned counters cannot count.
- **Normal:** Spec and Plan counters are both 1, with no recorded failure.
- **Revision:** Spec counter is greater than 1 and an actual unedited Human
  revision request has a successful trusted receipt before the current
  approval. A counter alone or rejected request cannot count.
- **Recovery:** a trusted failure event identifies a real completed failed
  Actions run/attempt in that repository, followed by a trusted recovery
  event and the verified accepted delivery. Earlier attempts are fetched
  explicitly when a rerun has replaced the current result. Pause/resume,
  cancellation, a success result, or an event name alone is not failure
  evidence. At most ten failures and twenty attempts per referenced run are
  inspected; larger histories are incomplete rather than silently truncated.
- The three runs need different repository/Intent pairs, implementation PRs,
  publication runs and merge records. One run cannot fill multiple variants;
  retries cannot inflate the count. Recovery takes classification precedence
  over revision when both occurred.
- Each run's own immutable starting baseline must still pass the known
  ownership-free fingerprints and required orchestration checks, including
  `run-core.mjs`, `runs.mjs`, and `state-store.mjs`. Prepared provenance must
  point to the **same full original source commit** for all three runs.
  Separate repositories can have different initial Git commits after their
  independent publication; those are not confused with the original source
  commit. A later baseline that already implements ownership does not qualify.

This gate corroborates process evidence, not the semantic correctness of every
Human observation. It never runs the scenarios for you, proves three runs
from a single replay, or certifies application acceptance from synthetic data.
Keep the actual checklist observations and real live-run recordings.

## Validation and parent wiring

Tests use Node's built-in runner and mocks for Docker/GitHub. Test artifacts
are created only under this utility and removed after each test. One test
reads a real `git archive` of the current commit without extracting it.
Another creates a test-only known-schema SQLite fixture in that artifact
directory and executes the real read-only seed probe, verifying unchanged
database bytes afterward; it never opens the application's local database.
Tests never start a daemon/container, authenticate, initialize Git, commit,
push, or write remotely.

```sh
node --test tools/brownfield-demo/tests/*.test.mjs
```

No root manifest, workflow, shared script or app dependency is changed by
this toolkit. Suggested **parent-owned** wiring:

- Root script `demo:brownfield`: `node tools/brownfield-demo/cli.mjs`
- Root test invocation: include `tools/brownfield-demo/tests/*.test.mjs` in
  the existing `node --test` command.
- CI paths: this utility and the scenario directory above.

The parent must commit current runtime orchestration together with the
ownership-free app before a full `--source-ref` can pass preparation. Do not
silently fall back to the working tree or old orchestration. When the baseline
application intentionally changes, review the absence of ownership, update
the six approved fingerprints and deterministic fixtures, and rerun tests.
