Read the approved
`docs/delivery-runs/brownfield-human-gated-delivery/{{intent}}/spec.md`, then
create or revise only
`docs/delivery-runs/brownfield-human-gated-delivery/{{intent}}/plan.md`.

## Human review loop

Read the approved specification and review discussion before each revision.
Surface open questions, trade-offs, and risks in the PR description. If a
planning decision would change approved behavior, stop and flag the conflict
for the Human; do not rewrite the specification or quietly change its scope.

When the Human requests changes or asks `@copilot` to revise, update this plan
in the same pull request and branch. Summarize the changes and remaining
questions for re-review, retain the metadata below, and keep task IDs stable
where the work is unchanged.

Repeat as many feedback rounds as needed. Only explicit Human approval of the
latest revision and passing required checks permit merging. Comments, resolved
threads, and passing CI alone are not approval. Do not start the next stage,
write tests or implementation, approve or merge your own PR, or close the stage
Issue. Lifecycle automation advances after the approved PR merges.

## Pull-request presentation

Use the title
`[Brownfield Delivery #{{intent}}][Plan review] <short intent title>`.
Keep this as a separate document-review PR, not a combined Spec/Plan or code PR.

Include these sections in the PR description before the lifecycle metadata:

- `## Summary`: explain the implementation approach and summarize changes since
  the previous review. Do not reproduce the entire plan.
- `## Review document`: link to the rendered plan using
  `https://github.com/<owner>/<repo>/blob/<current-head-sha>/docs/delivery-runs/brownfield-human-gated-delivery/{{intent}}/plan.md`.
  Resolve the repository and actual PR head SHA from GitHub; do not guess them
  or link to `main`. Update the link after every revision. Also link to the
  approved specification in this revision for context.
- `## Open questions`: list unresolved trade-offs, risks, or conflicts with
  the approved Spec. Write "None" only if none remain.
- `## Review checklist`: include the following unchecked reviewer reminders:
  - Every approved acceptance scenario maps to executable work.
  - Tasks are appropriately sized and dependencies are clear and acyclic.
  - Migration risks, existing-data compatibility, and validation are addressed.
  - Open questions are resolved and the approved Spec remains unchanged.
  - Only the plan changed; TDD and implementation have not started.

Also link back to the parent Intent as the progress hub and to this stage's
Issue. The checklist is guidance, not an approval mechanism; the Human must
submit a formal approving review of the latest revision. Explain that this
stage runs document/scope checks, not application builds or container tests.

## Artifact format

Use these exact top-level sections:

- `# Implementation plan`
- `## Acceptance mapping`
- `## Tasks`
- `## Risks and migrations`
- `## Validation`

Give every task a stable heading such as `### TASK-1: Description`. Each task
must include `Depends on:`, `Acceptance:`, `Surfaces:`, and `Validation:` lines.
Use `Depends on: none` for root tasks. Map every acceptance scenario to at
least one task and keep dependencies acyclic.

Do not change the approved specification, application code, tests, or
configuration.

The pull-request body must include these metadata lines exactly, alongside a
summary and any open questions for Human review:

```text
Delivery Demo: brownfield-human-gated-delivery
Delivery Intent: #{{intent}}
Delivery Stage: plan
Delivery Stage Issue: #{{stage_issue}}
```

Do not use closing keywords.
