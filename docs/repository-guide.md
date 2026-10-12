# Repository guide

This guide covers the repository structure, local development, GitHub
workflows, trace processing, publishing, and operational safeguards.

For the end-to-end delivery method rather than repository administration, start
with the [illustrated AI-native SDLC handbook (English / 中文)](ai-native-sdlc/README.md).
It connects the actual demos, screenshots and evidence into six paired chapters
and an ordered presentation/workshop.

## Repository structure

The repository keeps runnable demonstrations separate from reusable tooling:

- [`.github/`](../.github/) contains issue forms, workflows, MCP configuration,
  and small Node.js adapters for request preparation, issue comments, and Pages
  publishing.
- [`demos/`](../demos/) contains independently installable applications. Each
  demo owns its manifest, lockfile, runtime requirements, documentation, and
  path-scoped CI.
- [`tools/trace-viewer/`](../tools/trace-viewer/) contains the dependency-free
  trace model, renderer, local composite action, and shared Pages client.
- [`tools/brownfield-demo/`](../tools/brownfield-demo/README.md) contains the
  reusable preparation, preflight, container-presentation, and replay CLI.
  Demo-owned scenario manifests live under
  [`demos/it-service-desk/.github/brownfield-human-gated-delivery/scenarios/`](../demos/it-service-desk/.github/brownfield-human-gated-delivery/scenarios/).
- [`docs/`](./) contains operational and orchestration documentation.
- [`AGENTS.md`](../AGENTS.md) defines repository-wide agent guidance. Nested
  instruction files add project-specific rules.

Demo projects are intentionally not npm workspaces. This allows future
TypeScript and JavaScript demonstrations to use different frameworks,
dependency versions, and runtimes without coupling their dependency graphs.
The root package remains dependency-free and exposes repository checks and the
brownfield setup and presentation commands.

## Naming conventions

- Use lowercase kebab-case for project folders, scripts, workflows, issue
  forms, and documentation files.
- Name scripts for the artifact or action they produce, such as
  `build-demo-result-comment.mjs`, `render-trace-report.mjs`, and
  `publish-trace-site.mjs`.
- Include `copilot-cli` in filenames for workflows and forms that specifically
  invoke Copilot CLI.
- Use singular names for domain modules, such as `ticket.ts`, and role-based
  suffixes for implementations such as `ticket-store.ts`.
- Keep framework-required names such as `page.tsx`, `layout.tsx`, `actions.ts`,
  `action.yml`, and `index.html`.
- Use **Copilot CLI Trace Viewer** for the interactive product, **trace report**
  for one rendered run, **trace site** for the published report collection,
  and **dependency graph** for the agent/model/tool visualization.

## Adding a demo

Each demo is a self-contained project under `demos/<demo-name>/`. When adding
one:

1. Include a project README, manifest, and package-manager lockfile.
2. Document the required runtime.
3. Define test, lint, and build scripts in the project manifest.
4. Add a path-scoped workflow under `.github/workflows/`.
5. Add the demo to the project list in the root README.

Keep demo dependencies inside the demo project. Do not add them to the root
package.

## Local development

Node.js 24 is the recommended repository runtime.

Run repository automation and trace-viewer tests from the root:

```sh
npm test
```

Validate the IT service desk independently:

```sh
cd demos/it-service-desk
npm ci
npm test
npm run lint
npm run build
```

The service desk uses the built-in `node:sqlite` module. It creates and seeds
`data/service-desk.db` automatically; delete that local file to reset the
data.

## Brownfield Human-Gated Delivery demo

The IT service desk is the existing application in a brownfield, human-gated
delivery loop. For new Intents, the parent Issue is the Spec/Plan review hub:
full rendered Markdown revision comments, current document links, discussion,
and explicit Human commands all stay there until engineering handoff.
**Brownfield Delivery · Documents**
(`brownfield-human-gated-delivery-documents.yml`) runs read-only Copilot CLI
generation in Actions, with separate trusted publication and approval jobs.
It does not build the application or introduce an external service, UI, or
application dependency. The optional local presentation toolkit is separate
from this Actions workflow.

The repository's custom Actions commands are `/sdlc revise spec` and
`/sdlc revise plan` followed by feedback on subsequent lines, and versioned
approvals such as `/sdlc approve spec v2` and `/sdlc approve plan v1`.
Submit them as new top-level Human comments on the parent Intent. They are
not built-in `@copilot` commands; ordinary discussion does not invoke AI or
approve a document. `/sdlc retry` recovers document generation/handoff only,
without supplying new feedback; failed engineering CI, Advance, or Publish
requires rerunning the actual failed Action after its cause is fixed.
Each run reconciles a durable command queue, so a rerun or manual
Documents dispatch with `issue_number` can recover without losing commands
from superseded pending runs.

Each revision and approval is saved on `brownfield-documents/<intent>` under
`docs/delivery-runs/brownfield-human-gated-delivery/<intent>/` as `spec.md`,
`plan.md`, and `document-review.json`. Recorded approvals bind the reviewed
document version/hash to the approving command's ID/body and Human
ID/login/time; they do not store a separate immutable rendered-revision comment
ID/body snapshot. Editing or deleting a processed approval comment does not
revoke it. Only current configured Humans with repository write access, including
configured team members, can satisfy `minimumApprovals`; bots cannot. Issue
approval has no native PR independent-review restriction.

A Spec revision before handoff invalidates Spec approvals and the existing
Plan. Each Plan links its approved Spec. Once the Plan is fully approved,
documents freeze and automation creates `brownfield-delivery/<intent>` at the
approved document commit, closes internal Spec/Plan tracking issues, and assigns
only TDD Tests to Coding Agent. Tests and Implementation PRs preserve all
approved document and approval-state blobs. Controlled Red, Green, GHCR
publishing, and temporary container verification still apply. For all
Issue-based (`issue-v1`) runs, including existing ones after upgrade, smoke
success leaves the Intent open for **Human acceptance**
under the configured Implementation reviewer policy/quorum. Accept/reject
commands include the exact `sha256:<64hex>` digest and actual observed results,
and are bound to the current verified merge SHA, Actions run ID, and attempt.
Only acceptance completes the run and removes the engineering branch;
reverification invalidates earlier acceptance, and rejection blocks acceptance
until another verification attempt.

The mutable operational record is separate from sealed `document-review.json`:
`brownfield-runs/<intent>` stores
`docs/delivery-runs/brownfield-human-gated-delivery/<intent>/run-state.json`.
Trusted workflow-bot ledger attestations protect this record's provenance.
Missing required attested document/run branches fail explicitly; recovery must
not reset approval history.
Document and run branches remain for replay. Writers can submit new, unedited
`/sdlc help`, `/sdlc status`, `/sdlc pause`, `/sdlc resume`, and `/sdlc cancel`
comments on the Intent. Pause/cancel gate future work, keep policy pending, and
disable auto-merge; they gate subsequent document publication, publish
resolution, and stage advancement, not already-running work or prior merges.
The Documents workflow routes these commands and reports run-control/cleanup
failures separately from generation failures.
Cancellation is terminal and retains Issues, PRs, and branches. Continue through
a new Intent, also used for linked code/scope remediation after merge.
Existing legacy document-PR Intents retain their original completion behavior,
without retroactive migration. See the
[command contract](./brownfield-human-gated-delivery.md#run-controls-and-human-acceptance).

Use the [step-by-step walkthrough](./brownfield-human-gated-delivery-walkthrough.md)
to run the demo in GitHub Web. See
[Brownfield Human-Gated Delivery demo](./brownfield-human-gated-delivery.md)
for reviewer configuration, credentials, branch rules, stage artifacts, and
failure behavior. This lifecycle combines read-only document generation with
write-enabled Coding Agent engineering stages. It remains separate from the
read-only Copilot CLI orchestration demonstrations below.

For repeatable prerequisite configuration, use
[`npm run setup:brownfield`](./brownfield-human-gated-delivery.md#run-the-setup-script).
It previews changes unless explicitly passed `--apply`, preserves existing
protections by default, and reports prerequisites that require manual
configuration. The explicit
[`--single-owner` mode](./brownfield-human-gated-delivery.md#single-owner-demo-mode)
changes native approval counts to zero while retaining the configured Human
approval policy for PR stages. It is not needed for new Issue document approvals.
Setup cannot register a missing Actions workflow. Publish reviewed workflow
files to remote `main` and let GitHub register them first; setup can verify
registration and enable an existing disabled workflow. Copilot CLI generation additionally needs
`copilot-requests: write` and CLI entitlement, not the write-enabled assignment
token. Managed rulesets cover only `main` and `brownfield-delivery/**`.
Full setup also checks that the trusted `runs.mjs`, `run-core.mjs`, and
`state-store.mjs` modules are published on `main`.
Document and run-record branches need trusted automation writes, not a ruleset
bypass. **Full `--apply` creates missing managed rulesets, including `main`
protection.** This repository's `main` is intentionally unprotected; do not run
full apply there without explicit agreement. Read-only previews do not write.

### Presentation and readiness

Start with `npm run demo:brownfield -- help` and follow the
[toolkit README](../tools/brownfield-demo/README.md) for exact options. Prepare
a pinned source commit in a separate, nonexistent directory; never copy secrets
or local databases, reset the source checkout, or implicitly create a remote.
Reviewer configuration must be explicitly updated and published for the demo
repository. Read-only preflight distinguishes configured settings from proven
readiness and cannot prove token permissions, billing, or end-to-end behavior.

Present the verified image by digest, clean up only toolkit-managed containers,
and generate escaped, read-only HTML replay from actual run evidence. Neither
the toolkit nor smoke verification automatically deploys a live hosted service.
The [presenter runbook](./brownfield-human-gated-delivery-walkthrough.md#presenter-runbook-and-readiness)
requires three completed isolated runs: normal delivery, Spec change with Plan
invalidation, and failure recovery. Record genuine Human approvals, test results,
and evidence links; no completed live rehearsal is established by this update.

## Copilot CLI demonstration workflow

The **Copilot CLI Agent Demos** workflow can run through manual dispatch or an
authorized issue carrying the `copilot-agent-demo` label. Each dedicated issue
form represents one orchestration pattern, exposes an editable task, and uses
an internal `copilot-pattern:*` label for routing.

The workflow:

1. Validates and prepares the selected task and orchestration contract.
2. Runs Copilot CLI with the selected orchestrator and subagent models.
3. Captures OpenTelemetry JSONL in the runner's temporary directory.
4. Builds a Job Summary, canonical trace data, an offline HTML report, and a
   dependency graph.
5. Uploads the report artifact and posts the result and trace diagnostics back
   to the originating issue.
6. Publishes successful canonical trace data through the separate Pages
   workflow.

The available patterns are direct execution, parallel delegation,
critic-reviser, and sequential pipeline. See
[Copilot CLI agent orchestration patterns](./copilot-cli-agent-orchestration-patterns.md)
for their execution models, selection guidance, and validation evidence.

## Models and execution

Every run selects an **Orchestrator model** and a **Subagent model**. Both
currently default to `gpt-6-luna`. The orchestrator plans delegation and
synthesizes the final response; dynamically created subagents are instructed
to use the selected subagent model.

Parallel demonstrations use `--fleet`. Sequential demonstrations allow the
orchestrator to create each subagent after the preceding stage returns.
Validation uses observed OpenTelemetry evidence rather than predetermined
agent names.

The repository owner needs a Copilot entitlement and available usage.
Organization repositories also need the Copilot CLI organization billing
policy.

## Tool and network access

The workflow authenticates Copilot with the run's short-lived `GITHUB_TOKEN`
and grants only the permissions required by the workflow. The checked-in
[`.github/mcp.json`](../.github/mcp.json) exposes two read-only tools from the
public Microsoft Learn MCP server.

External URLs are not preapproved by the generic workflow. The default
parallel AWS/Azure scenario can explicitly allow `docs.aws.amazon.com`; Azure
research uses Microsoft Learn MCP. Select **Block all external URLs** when a
task does not require AWS documentation.

## Trace viewer

[`tools/trace-viewer/`](../tools/trace-viewer/) is both a local composite action
and a standalone command-line implementation:

- `trace-model.mjs` normalizes direct CLI JSONL and OTLP
  `resourceSpans[].scopeSpans[].spans[]` envelopes.
- `html-renderer.mjs` renders trace and dependency views.
- `render-trace-report.mjs` generates summaries, HTML, and canonical trace data.
- `capture-dependency-graph.mjs` captures the graph used in issue comments.
- `web/` contains the shared GitHub Pages application.

The viewer supports correlated trace and dependency selection, filtering,
model-aware cost, inspector rollups, and SVG/PNG graph export. Missing or
malformed traces fail visibly, including when Copilot itself fails.

OpenTelemetry status `UNSET` (`code: 0`) is treated as successful unless an
error status or error attribute is present. Failed spans retain their failure
reason even when message capture is disabled. A fast failed tool call can be
an intentional permission-policy rejection rather than an infrastructure
failure.

## Message capture and redaction

Detailed request and response capture is enabled by default for demonstration
forms. Select **Metadata only** when payloads should not be included in the
public report or artifact.

Raw OpenTelemetry JSONL is never uploaded. The trace model can hydrate large
Copilot tool results only from approved runner-temporary files, redacts the
content, and embeds payloads up to a 1 MiB safety ceiling. Absolute runner
paths are not published.

Redaction is best-effort. Treat GitHub Pages reports, workflow artifacts, and
Job Summaries as public in this repository, and use metadata-only mode for
private prompts, sensitive repositories, or sessions that may contain
secrets.

## Cost calculation

The viewer uses `gen_ai.usage.cost` when OpenTelemetry provides it. Otherwise,
it normalizes the observed model name, reads
[`model-pricing.json`](../tools/trace-viewer/model-pricing.json), selects the
default or long-context tier, and estimates cost from observed input, output,
and cache token counts.

Unknown models and calls without token usage display `—` and are excluded from
the total instead of inheriting an unrelated model's rate. Workflows can pass
`pricing-path` to replace the bundled catalog.

## GitHub Pages publishing

Each successful demo run uploads a `copilot-trace-viewer` artifact containing
the offline HTML report and canonical trace data. The Pages publisher:

1. Downloads the artifact with its workflow token.
2. Validates the canonical schema.
3. Publishes only `trace-data.json` under `/traces/<run-id>.json`.
4. Refreshes the shared `/viewer/` application from the newest successful run.

The browser never receives a GitHub token and does not fetch Actions artifacts
directly. GitHub Pages deploys from the root of the `gh-pages` branch.
Publishing is serialized so concurrent runs cannot overwrite one another, and
each run keeps an immutable trace URL.

Issue comments always include a Mermaid dependency graph. To additionally use
a generated PNG, configure `AGENT_TRACE_MEDIA_TOKEN` with a user token that
can access the repository. The short-lived Actions token is not accepted by
the user-attachments endpoint, so the workflow falls back to Mermaid when the
optional token or upload is unavailable.

## References

- [Copilot CLI in GitHub Actions](https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli-in-actions)
- [Copilot CLI tool permissions](https://docs.github.com/en/copilot/how-tos/copilot-cli/use-copilot-cli/allowing-tools)
- [Copilot CLI workspace MCP configuration](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers)
- [Microsoft Learn MCP tools](https://learn.microsoft.com/en-us/training/support/mcp-developer-reference)
- [Copilot Actions billing](https://docs.github.com/en/copilot/concepts/agents/copilot-cli/copilot-cli-in-github-actions)
