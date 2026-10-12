# Northstar IT Service Desk

A small, realistic enterprise IT application for demonstrating an
Issue-to-PR workflow with GitHub Copilot.

## Included workflow

- View and filter IT incidents and service requests.
- Create a ticket with server-side validation.
- View ticket details.
- Move a ticket through open, in-progress, resolved, and closed states.
- Persist data in a local SQLite database.

Search matches titles, requester names, and ticket references such as `INC-0001`
(case-insensitive). Numeric IDs and shortened references such as `1`, `0001`,
and `inc-1` also work; surrounding whitespace is ignored. Status and priority
filters still apply to search results.

The custom dropdowns keep keyboard focus on a labeled combobox. Open with
Enter, Space, or an arrow key; navigate with arrow keys, Home/End, or
typeahead. Enter/Space commits, Escape cancels uncommitted navigation, and
Tab/Shift+Tab commits and moves focus normally. Clicking outside or moving
focus away also commits and closes the popup. Menus remain visible above
short or empty ticket queues.

The application intentionally stops at a practical first release. Assignment,
SLA policies, comments, audit history, access control, notifications, and
reporting are suitable follow-up GitHub Issues for live Copilot demos.

## Run locally

Node.js 24 or newer is required because the demo uses the built-in
`node:sqlite` module.

```powershell
npm install
npm run dev
```

Open <http://localhost:3000>.

The database is created and seeded automatically at `data/service-desk.db`.
For disposable local development only, deleting that file resets demo data.
Do not reset a shared checkout for a presentation; use an isolated prepared
copy as described below.

## Validate

```powershell
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

Unit tests use in-memory databases and a jsdom environment for dropdown and
dashboard regressions; they do not modify `data/service-desk.db`. The
container smoke check targets the stable dashboard HTML marker
`data-testid="service-desk-dashboard"`, not the visible heading text.

Pull-request CI runs for all changed paths, including documentation, so the
required `validate` and `container-smoke` checks cannot remain missing. This
small demo favors reliable required checks over PR path-filter optimization;
push CI remains path-scoped. New Intent Spec/Plan reviews run in
**Brownfield Delivery · Documents** on the parent Issue: only document
structure and scope are validated, without application tests, builds, or
container smoke jobs. Legacy Spec/Plan PRs on existing lifecycle branches
continue to skip application checks. Controlled-Red Tests PRs retain their
separate TDD validation instead of normal Green checks.
PRs targeting the default branch always run the Green checks, regardless of
stage text in the PR body.
After installing demo dependencies, CI also exercises the lifecycle reporter
against real Vitest setup/teardown failures and legitimate Red/Green tests.

## Suggested Brownfield Delivery Intent

Choose **Brownfield human-gated delivery: Submit an intent** under
**Issues > New issue**. Its title and all five fields are prefilled with this
outcome: clarify ticket ownership so agents and team leads can understand
responsibility and coordinate handoffs. The Human reviews and submits the
Intent; AI writes the Spec, not the Intent. The form captures the problem,
proposed outcome, affected users and systems, constraints, and open questions:

- can a ticket remain unassigned?
- should owners come from a predefined local list or be entered freely?
- is ownership visibility enough, or is filtering by owner needed?

After repository setup, submit the defaults to start the Spec stage, or edit
them for another feature. Resolve these questions through Spec review.
For new Intents, remain on the parent Issue to read full rendered Spec/Plan
revision comments, discuss open questions, and submit explicit commands:

```text
/sdlc revise spec
Tickets may remain unassigned. Clarify how existing ticket data is preserved.
```

Use `/sdlc revise plan` with feedback to revise the Plan, and approve only the
latest version with commands such as `/sdlc approve spec v2` or
`/sdlc approve plan v1`. These are custom repository Actions commands, not
built-in `@copilot` commands. Ordinary discussion does not invoke AI or approve
a stage. `/sdlc retry` recovers document generation/handoff only; it does not rerun
engineering CI, Advance, or Publish.

Read-only Copilot CLI generates documents in Actions; separate trusted jobs
publish revisions and record Human approval snapshots in Git on
`brownfield-documents/<intent>`. A Spec revision before handoff invalidates its
approvals and the Plan. Fully approving the Plan freezes documents and creates
the engineering branch from the approved document commit, then assigns only
TDD Tests to Coding Agent. Tests and Implementation still use Human-reviewed
PRs, controlled Red/Green checks, and verified image delivery; they cannot alter
approved documents or approval state.

Smoke success for any Issue-based (`issue-v1`) run, including one started before
the acceptance upgrade, leaves the Intent open for **Human acceptance**.
Test the exact verified image against the approved acceptance
scenarios, then submit a new, unedited parent-Issue comment:

```text
/sdlc accept sha256:<64hex>
<Describe the scenarios actually exercised and observed results.>
```

Replace the placeholder with the current published digest. Acceptance uses the
configured Implementation reviewer identities/quorum and binds to the current
verification's digest, merge SHA, Actions run ID, and attempt. A new verification
invalidates earlier acceptance. Use `/sdlc reject sha256:<64hex>` with actual
observations to reject it; another verification attempt is required before
acceptance. An already completed, accepted run is terminal; another delivery
requires a new Intent. After merge, code or scope corrections belong in a linked new Intent,
not edits to sealed documents. Only Human acceptance completes Issue-based runs and
removes the engineering branch; document and run-record branches remain.

Existing document-PR Intents remain in **legacy Spec/Plan PR mode**; there is no
automatic migration or change to their original completion behavior. An
engineering branch created by Issue-based handoff does not make a run legacy.

## Repeatable presentation

From the repository root, `npm run demo:brownfield -- help` opens the
[presentation toolkit](../../tools/brownfield-demo/README.md) command reference.
Demo-specific [scenario manifests](.github/brownfield-human-gated-delivery/scenarios/)
describe the normal, Spec-change/Plan-invalidation, and recovery rehearsals.
Prepare a pinned source commit into a separate, nonexistent destination; do not
copy secrets, local SQLite data, or reset the source checkout. Remote creation
and publication remain explicit operator actions.

Use read-only preflight before spending model time. Show the delivered image
by verified digest, not a mutable tag or a previously running development
server; clean up only toolkit-managed containers. The Environment's smoke check
does not create a live hosted service. Read-only HTML replay is rendered from
real run evidence with escaped content, not simulated approvals or test results.
Follow the [presenter runbook](../../docs/brownfield-human-gated-delivery-walkthrough.md#presenter-runbook-and-readiness):
configured prerequisites are not proof of Demo Ready, and three completed
isolated runs have not yet been established.

See the
[Brownfield Human-Gated Delivery demo](../../docs/brownfield-human-gated-delivery.md)
for the complete Intent, Spec, Plan, TDD, implementation, and delivery loop.
