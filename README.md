# ai-native-sdlc-demo

Demonstrations and tooling for exploring AI-native software delivery with
GitHub Copilot CLI, dynamic agent orchestration, OpenTelemetry traces, and
Issue-to-PR workflows.

This prepared demo contains the delivered ticket-ownership increment. To start
a fresh ownership scenario, prepare a new repository from the ownership-free
[source repository](https://github.com/huangyingting/ai-native-sdlc), not from
this implemented application. The completed run remains a `development-test`,
not independent Human acceptance or Demo Ready.

## Start here

| What you want to do | Where to begin |
|---|---|
| Understand or present the completed ownership demo | [Illustrated case study](docs/brownfield-human-gated-delivery-case-study.md), then its [presentation and reproduction steps](docs/brownfield-human-gated-delivery-case-study.md#7-how-to-present-or-reproduce-the-result) |
| Run a new AI-native delivery cycle | **[Step-by-step walkthrough: start with preparation](docs/brownfield-human-gated-delivery-walkthrough.md#1-prepare-the-repository)** |
| Run only the service-desk application | [Application quick start](demos/it-service-desk/README.md) |
| Explore Copilot orchestration patterns | [Agent orchestration guide](docs/copilot-cli-agent-orchestration-patterns.md) |

For a fresh ownership run, use the ownership-free **source** to prepare a
**new isolated repository**. The existing
[completed demo](https://github.com/huangyingting/ai-native-sdlc-demo) already
has ownership; use it for inspection or replay, not as a fresh baseline.
The walkthrough is the main path. The [toolkit README](tools/brownfield-demo/README.md)
and [setup reference](docs/brownfield-human-gated-delivery.md) provide command
details and troubleshooting when that path links to them.

## Projects

- [`demos/it-service-desk/`](demos/it-service-desk/) — independent Next.js and
  SQLite service-desk demonstration.
- [`tools/trace-viewer/`](tools/trace-viewer/) — dependency-free trace model,
  renderer, composite action, and GitHub Pages client.
- [`tools/brownfield-demo/`](tools/brownfield-demo/README.md) — isolated demo
  preparation, read-only preflight, digest-bound container presentation, and
  replay from real delivery evidence.
- [`.github/`](.github/) — issue forms, workflow automation, and publishing
  adapters.

## Validate

Use Node.js 24 and run:

```sh
npm test
```

Each demo owns its dependencies and additional validation commands.

## Set up the brownfield demo

For a first run, follow the walkthrough's
[ordered operator setup](docs/brownfield-human-gated-delivery-walkthrough.md#1-prepare-the-repository):
prepare, inspect, publish, configure, then preflight. Setup alone does not
create a repository or publish its workflows.

After publishing your new repository, an explicitly single-owner preview is:

```sh
npm run setup:brownfield -- --repo OWNER/NEW_DEMO_REPO --single-owner
```

Replace `OWNER/NEW_DEMO_REPO` with that selected repository, not the source.
This previews prerequisites without changing GitHub. **Full `--apply` creates
missing managed rulesets, including protection for an unprotected `main`.**
Do not assume the target is unprotected or replace its existing policy.
This demo already uses managed `main` protections and the explicit
`--single-owner` policy; inspect the preview before applying changes.
The original source repository's `main` is intentionally unprotected; do not
apply full setup there without explicit agreement. See the
[setup guide](docs/brownfield-human-gated-delivery.md#run-the-setup-script)
for secure token entry, existing-Intent recovery, and remaining manual checks.
If you are the only Human reviewer, use the explicit
[`--single-owner` demo mode](docs/brownfield-human-gated-delivery.md#single-owner-demo-mode)
for the TDD Tests and Implementation PR gates without GitHub's native
independent-review requirement. New Spec/Plan reviews take place on the parent
Intent Issue and do not have that native PR restriction.

For new Intents, **Brownfield Delivery · Documents** publishes full rendered
Spec and Plan revisions on that Issue. Humans explicitly submit custom
`/sdlc revise spec` or `/sdlc revise plan` commands with feedback, then approve
the latest version with commands such as `/sdlc approve spec v2` and
`/sdlc approve plan v1`. Ordinary discussion does not run AI or approve a stage.
Revisions and approval snapshots are saved in Git before handoff to the
existing Tests/Implementation PR flow. Legacy document-PR Intents remain in
Spec/Plan PR mode; they are not automatically migrated.

The workflows, including `brownfield-human-gated-delivery-documents.yml`, must
already be published on remote `main` and registered by GitHub. Setup cannot
register a missing workflow; it can enable an existing disabled workflow.
Setup also requires the trusted `runs.mjs`, `run-core.mjs`, and `state-store.mjs`
modules under `.github/brownfield-human-gated-delivery/scripts/` on remote `main`.
Document generation uses read-only Copilot CLI in Actions and additionally
requires `copilot-requests: write` and Copilot CLI entitlement; it never receives
the existing write-enabled `COPILOT_ASSIGN_TOKEN`. See the setup guide before
running this workflow; local documentation does not establish remote deployment.

For all Issue-based (`issue-v1`) runs, including existing ones after upgrade,
a verified image is **awaiting Human acceptance**, not
complete. A configured Implementation reviewer tests the exact published digest
and submits `/sdlc accept sha256:<64hex>` with observed results on subsequent
lines; the configured quorum must accept the current verification attempt.
Only that acceptance closes the Intent and removes its engineering branch.
Document and trusted run-record branches remain for replay. Run controls and
rejection are documented in the [command reference](docs/brownfield-human-gated-delivery.md#run-controls-and-human-acceptance).
Only legacy document-PR runs keep their original automatic-close behavior.

Start the presentation toolkit with `npm run demo:brownfield -- help`; use its
[README](tools/brownfield-demo/README.md) for exact commands and safety boundaries.
The [presenter runbook](docs/brownfield-human-gated-delivery-walkthrough.md#presenter-runbook-and-readiness)
requires three actual completed isolated rehearsals before claiming **Demo
Ready**. An [illustrated case study](docs/brownfield-human-gated-delivery-case-study.md)
records a completed, explicitly authorized `development-test` run, including
its real image, failures, and recovery. It does not count toward genuine Human
acceptance or the three-live-run readiness gate.

## Documentation

- [Illustrated delivery case study](docs/brownfield-human-gated-delivery-case-study.md)
  — the actual ownership rehearsal, architecture, screenshots, review decisions,
  failures and fixes, and linked evidence with explicit limitations.
- [Step-by-step brownfield demo](docs/brownfield-human-gated-delivery-walkthrough.md)
  — run the human Intent, iterative Spec/Plan reviews, TDD, and verified delivery
  demonstration through GitHub Web, then accept the verified result.
- [Repository guide](docs/repository-guide.md) — structure, local development,
  workflows, trace publishing, security, and operations.
- [Brownfield Human-Gated Delivery demo](docs/brownfield-human-gated-delivery.md)
  — safely evolve an existing application through Intent, Spec, Plan, TDD,
  implementation, delivery, and Human Review gates.
- [Agent orchestration patterns](docs/copilot-cli-agent-orchestration-patterns.md)
  — pattern selection, execution diagrams, and trace evidence.
- [Adding a demo](docs/repository-guide.md#adding-a-demo)
- [IT service desk](demos/it-service-desk/README.md)
- [Trace viewer](tools/trace-viewer/README.md)
- [Agent instructions](AGENTS.md)
