Create or revise only
`docs/delivery-runs/brownfield-human-gated-delivery/{{intent}}/spec.md`.

Translate the parent human-authored Intent into a technology-aware behavioral
specification. Do not rewrite the Intent or create a separate intent artifact.
Do not change application code, tests, configuration, or other documentation.

## Human review loop

Read the parent Intent and the review discussion before each revision. Surface
open questions and proposed options in the PR description; do not silently
treat unanswered questions as agreed requirements.

When the Human requests changes or asks `@copilot` to revise, update this
specification in the same pull request and branch. Summarize the changes and
remaining questions for re-review, retain the metadata below, and keep
acceptance IDs stable where the behavior is unchanged.

Repeat as many feedback rounds as needed. Only explicit Human approval of the
latest revision and passing required checks permit merging. Comments, resolved
threads, and passing CI alone are not approval. Do not start the next stage,
approve or merge your own PR, or close the stage Issue. Lifecycle automation
advances after the approved PR merges.

## Pull-request presentation

Use the title
`[Brownfield Delivery #{{intent}}][Spec review] <short intent title>`.
Keep this as a separate document-review PR, not a combined Spec/Plan or code PR.

Include these sections in the PR description before the lifecycle metadata:

- `## Summary`: explain the proposed behavior and summarize changes since the
  previous review. Do not reproduce the entire specification.
- `## Review document`: link to the rendered specification using
  `https://github.com/<owner>/<repo>/blob/<current-head-sha>/docs/delivery-runs/brownfield-human-gated-delivery/{{intent}}/spec.md`.
  Resolve the repository and actual PR head SHA from GitHub; do not guess them
  or link to `main`. Update the link after every revision.
- `## Open questions`: list decisions requiring Human input, distinguishing
  proposed options from agreed behavior. Write "None" only if none remain.
- `## Review checklist`: include the following unchecked reviewer reminders:
  - Intent, scope, and non-goals match the requested outcome.
  - Open questions and proposed assumptions have been resolved.
  - Acceptance scenarios cover normal, error, and compatibility behavior.
  - Only the specification changed; no implementation or test code was added.

Also link back to the parent Intent as the progress hub and to this stage's
Issue. The checklist is guidance, not an approval mechanism; the Human must
submit a formal approving review of the latest revision. Explain that this
stage runs document/scope checks, not application builds or container tests.

## Artifact format

Use these exact top-level sections:

- `# Specification`
- `## Intent`
- `## Scope`
- `## Non-goals`
- `## Actors`
- `## Constraints`
- `## Acceptance scenarios`

Give every scenario a stable heading such as `### AC-1: Description` and include
explicit `**Given**`, `**When**`, and `**Then**` lines. Cover error and
compatibility behavior, not only the happy path.

The pull-request body must include these metadata lines exactly, alongside a
summary and any open questions for Human review:

```text
Delivery Demo: brownfield-human-gated-delivery
Delivery Intent: #{{intent}}
Delivery Stage: spec
Delivery Stage Issue: #{{stage_issue}}
```

Do not use closing keywords.
