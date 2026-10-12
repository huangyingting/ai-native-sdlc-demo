# Ownership acceptance — record observations, never pre-check these boxes

Use only the fixed `ownership.json` feature. Repeat each variant in its own
isolated repository from the same full source commit, not against an already
implemented main branch. The standard, Spec revision, and failure-recovery
variants are planned scenarios, **not three completed live runs**.

## Before starting

- [ ] Record source commit, prepared provenance, scenario ID, repository,
  Intent URL, reviewer identity, and whether explicit single-owner mode is used.
- [ ] Preflight automated checks pass; operator verifies every manual item.
- [ ] Save approved Spec/Plan versions and immutable document links.
- [ ] Record actual controlled-Red and Green runs, Human reviews, merged PR,
  merge commit, publish/verify workflow URL, and full GHCR digest.

## Application observations

- [ ] A fresh managed `run` reports `dataset.verified: true`: its dashboard
  request provisioned the application's four seed rows, and a read-only probe
  confirmed IDs, original fields and exact fixed timestamps from the manifest.
  This is not proof of ownership fields or old-schema migration.
- [ ] AC-1: Test migration against the **old schema**, not merely fresh seed
  insertion. Preserve all four original records and timestamps. Show no owner
  before implementation and Unassigned afterward. Initial summary is 2 open,
  1 in progress, 1 resolved, and 2 active high/critical.
- [ ] AC-2: On INC-0001, assign Avery Stone, reassign Jordan Lee, then clear.
  Reload both pages after each operation. Restart the same labeled container
  with its existing volume and show persistence. Do not use cleanup between
  persistence observations.
- [ ] AC-3: Assign INC-0001 and INC-0003 to Avery Stone; INC-0002 to Jordan Lee;
  leave INC-0004 unassigned. Verify exact reference sets, not just counts:
  All=4, Avery={0001,0003}, Jordan={0002}, Unassigned={0004}.
  Avery+open+high+`inc-1`={0001}; Avery+critical={}. Clearing owner keeps
  existing filters and their behavior.
- [ ] AC-4: Keyboard-test labeled controls. Record storage/server tests showing
  forged `not-in-roster` and nonexistent ticket IDs cannot mutate data.
- [ ] AC-5: On a separate fresh dataset, create the exact ticket in the
  manifest. It starts open/unassigned; verify pre-existing status and search
  workflows. Do not count this extra ticket in AC-3.

Fresh image smoke tests **do not prove migration**. The implementation's real
tests must exercise an old-schema database with persisted records and show
those records survive. The toolkit does not edit SQLite files or seed a fake
ownership implementation.

## Variant evidence

- [ ] Standard: actual versioned Spec/Plan approvals, Red/Green, protected
  merge, successful image verification, and explicit Human delivery acceptance.
- [ ] Spec revision: actual feedback comment, new Spec version, approval only
  of the revised version, corresponding Plan, and identical final observations.
  Do not claim revocation of a prior approval if v1 was never approved.
- [ ] Failure recovery: actual failing run URL/error, root cause, operator
  remediation, real retry, preserved gates, and identical final observations.
  If a genuine failed run is absent, mark this variant **not demonstrated**.

## Delivery decision

- [ ] A configured Human records tested digest, AC observations, remaining
  limitations, and an explicit acceptance or rejection on the Intent.
- [ ] Runtime acceptance record matches actual Human comment IDs and successful
  publish/verify evidence. Neither merged code nor a closed Issue alone means
  acceptance.
- [ ] Export replay HTML and machine-readable evidence; confirm they say
  **read-only snapshot, not live**. Do not substitute replay for a live run.
- [ ] After all three real variants, run the toolkit's `readiness` command
  against their explicit repository/Intent pairs. Use `--repos` with
  `--intents` for separate isolated repositories. A single run, a retry, a
  declared scenario name, or an unchecked success claim must remain `0/3`.
  Require trusted document/run ledgers, actual Human comments, actual failed
  Actions evidence for recovery, and the same original source provenance.
