# 6. Workshop and adoption playbook

[Guide index](../README.md) · [中文](../zh/06-workshop.md) ·
[Previous](05-engineering-judgment.md) · [Evidence register](../evidence.md)

## 6.1 Choose the mode before opening a terminal

| Mode | What you do | What you may claim |
|---|---|---|
| Read-only presentation | Open this guide, screenshots and existing evidence pages | “This historical run observed…” |
| Local isolated verification | Start a reviewed digest or run fixed offline checks in fresh resources | Only the behavior checked in this new local run |
| New AI delivery / experiment | Use a new repository/output directory, configured identities, actual model calls and complete verification | The new run's recorded outcome, including failure and human intervention |

Reading this guide does not require provisioning another website. The
[public Trace Viewer](https://huangyingting.github.io/ai-native-sdlc/) already
provides interactive execution inspection. The business application's old
localhost URLs are not public services and were unavailable when this guide
was prepared. Use dated screenshots or deliberately start a new isolated
instance; do not pretend a screenshot is a currently live application.

## 6.2 A 60-minute, page-by-page presentation

[![Existing public trace collection linking to an actual direct-execution report](../../assets/ai-native-sdlc-handbook/trace-site.png)](https://huangyingting.github.io/ai-native-sdlc/)

**Figure J1.** The existing report collection, viewed October 12, 2026.
At capture time it listed one direct-execution report, not completed evidence
for every supported orchestration pattern. Open its report for interactive detail.

Open these pages in separate tabs before the session. No comments, approvals,
workflow reruns or mutations are needed for this route.

| Time | Page to show | Presenter explanation | Ask the audience |
|---|---|---|---|
| 0–5 min | [Historical queue](../../assets/brownfield-case-study/ticket-queue.png) and [chapter 1](01-operating-model.md) | Visible ownership is the result; the process is the evidence chain behind it | What does this screenshot fail to prove? |
| 5–15 min | [huangyingting/ai-native-sdlc-discovery-demo#1](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/1), then [blocked approval](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/1#issuecomment-5862230300) | Read the problem and unresolved choices; show why AI cannot just select product policy | What changes if ownership is mandatory? |
| 15–22 min | [Sealed review state](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/blob/073c6fb0831e38d5513e22ac193a7bdaac2918cf/docs/delivery-runs/brownfield-human-gated-delivery/1/document-review.json) and [chapter 2](02-intent-spec-plan.md) | Decision → Spec version → linked Plan → freeze | Which downstream approval becomes stale if Spec changes? |
| 22–32 min | [Tests PR](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/6) and [Red attempt 2](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36372294023/attempts/2) | Review actual assertions, not only counts; explain green validation of expected Red | Why does unchanged timestamp not prove no write? |
| 32–39 min | [Implementation PR](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/7), [publish verification](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36381916918/attempts/2), [chapter 4](04-deploy-operate.md) | Explicitly switch from ownership increment to later readiness increment; trace each one's own digest | Is the artifact download hash the image digest? |
| 39–48 min | [Failed maintenance](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/14), [continuation](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/17), [reliability run](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36388446065) | Preserve failed contracts; separate recovery from preventive closure | Why not quietly “fix” frozen tests? |
| 48–56 min | [Engineering report](../../engineering-judgment-rehearsal.md) and [chapter 5](05-engineering-judgment.md) | All six repairs passed; no complete evidence package passed | Is this product failure, evidence failure, or both? |
| 56–60 min | [Actual direct trace](https://huangyingting.github.io/ai-native-sdlc/viewer/?run=36092002982) and the adoption checklist below | Traces explain work; independent checks establish outcomes | What is the smallest trustworthy loop your team can start? |

For a 20-minute introduction, use the queue, blocked approval, Tests PR,
publication/acceptance distinction and 6/6-versus-0/6 experiment result.
For a half-day workshop, add the exercises below. Do not promise a complete
cloud delivery within a fixed presentation slot: model queues, review,
permissions and builds are external dependencies.

### Page-reading checklist

- **Issue:** original problem → latest hub → full revision → decisions → approval.
- **PR:** base/head → files → review → checks → merge, in that order.
- **Actions:** exact source → run/attempt → required jobs → logs/summary →
  reviewed artifacts; sign in with your normal authorized account if logs require it.
- **Application:** fixture → user action → resulting state → persistence and
  negative checks, not merely loading the home page.
- **Trace:** identity → hierarchy → time overlap → errors → measured usage →
  what remains unverified.

## 6.3 Route A: free of real model calls

From the source repository root, use Node.js 24:

```sh
npm test
npm --prefix demos/engineering-lab test
node tools/brownfield-demo/cli.mjs --help
node tools/brownfield-demo/cli.mjs scenario list
node tools/engineering-demo/cli.mjs --help
```

These checks/help commands do not call Copilot. Follow each project's dependency
instructions if a required package is missing; demo dependencies stay in the
demo, not the root.

The historical validation baseline was 456 repository tests and 15 fixture
tests. Your checkout may evolve: report its actual counts, not copied numbers.
`scenario list` describes plans and marks them `planned-not-evidence`; listed
scenarios are not completed runs.

Exercises without model calls:

1. Compare the actual Intent to the latest Spec: locate a decision-to-criterion
   mapping and one explicit non-goal.
2. Read the Tests review and propose one implementation that a weak assertion
   would accidentally accept.
3. Compare the failed maintenance and continuation: identify what changed and
   which historical records remained intact.
4. Explain why the engineering pilot is not “all failed” or “all accepted.”

## 6.4 Route B: a new full delivery

Use the existing [ordered operator walkthrough](../../brownfield-human-gated-delivery-walkthrough.md#1-prepare-the-repository)
for complete setup. The sequence matters:

1. Choose a reviewed **full 40-hex source commit**, still ownership-free and
   containing current orchestration. Do not use the completed demo baseline.
2. Choose a new external destination, new agreed remote and explicit review
   mode. Destination must not exist; its parent must exist.
3. Export the fixed scenario:

   ```sh
   node tools/brownfield-demo/cli.mjs prepare \
     --source /absolute/path/to/ai-native-sdlc \
     --source-ref FULL_40_HEX_COMMIT \
     --dest /absolute/path/to/new-isolated-demo \
     --reviewer YOUR_GITHUB_LOGIN \
     --scenario ownership-standard
   ```

4. Inspect the export/provenance for content safe to publish. Preparation
   does not initialize Git, create a remote or push.
5. Deliberately initialize/publish the reviewed export. Verify remote `main`,
   workflow registration and configured reviewer access.
6. Preview setup **from the new checkout**, resolve permissions, Copilot
   entitlement, image access and proposed branch protections. Apply only
   explicitly agreed changes using the secure credential flow.
7. Run read-only preflight and hand off to actual eligible reviewers.
8. Submit a new Intent and follow chapters 2–4 to real acceptance.

Use `--single-owner` only for an explicitly chosen single-owner rehearsal,
consistently across prepare/setup/preflight as documented. It is not independent
review. Never apply full setup to the intentionally unprotected source main
by mistake, paste tokens into commands/chat, or force-push over a completed run.

**Where to stop:** unresolved access/billing, missing registered workflows,
baseline mismatch, unavailable reviewers, failed required checks, unverified
digest or failed cleanup. Do not bypass a gate to finish a presentation.

## 6.5 Route C: smaller focused experiments

### Change impact and strategy evaluation

Prerequisites: Node.js 24, Docker, Git, authenticated Copilot CLI and explicitly
accepted usage costs. Review the [qualified CLI version and transport](../../engineering-judgment-demos.md#2-prerequisites);
an installed newer CLI is not automatically qualified.

The historical fixture is source commit
`540cacd2a10be5ed326479fd959d21eec5d4997c`. Source and execution-tool revisions
are separate identities. Use new output directories and the same immutable
runtime across comparison cells.

Follow the exact [impact commands](../../engineering-judgment-demos.md#3-change-impact-and-consistency-loop):

1. `impact-propose`: real model call; read the complete candidate.
2. `impact-approve`: local operator receipt for the exact `proposalHash`;
   never approve solely because generation exited zero.
3. `impact-implement`: second real call; restricted tests/oracle decide the result.
4. Optional `benchmark`: nine planned real calls over six fixed cells.

These are CLI experiments, not a separate web UI or automatic GitHub delivery.
Full syntax is available via the help command above. Record output, approval,
usage, candidate/test/oracle results, code/tool identities and all failures.
Exit 0 can mean **awaiting operator review** for a proposal; exit 2 means
completed with failed candidates; exit 1 means error.

### Reliability without another model run

With access to the completed readiness source and image, follow
[qualification](../../brownfield-reliability-loops.md#3-start-here-qualify-the-tests),
then [runtime rehearsal](../../brownfield-reliability-loops.md#4-run-real-image-verification-admission-recovery-and-monitoring).
These execute real tests/Docker/HTTP/SQLite, not Copilot calls. Image/dependency
downloads and compute may still incur costs.

Do not qualify the ownership-free source as though it had readiness. Do not
reuse accepted volumes, inject faults into shared workloads, or count a
generated maintenance draft as reviewed preventive work.

## 6.6 Recovery and evidence handoff

| Situation | Supported response |
|---|---|
| Document generation/handoff failed | Diagnose it, then use documented `/sdlc retry` or Documents dispatch for the same Intent |
| Engineering CI/Advance/Publish failed | Correct the cause and rerun the actual failed Action; document retry does not repair these jobs |
| Need to pause an active run | Use supported `/sdlc pause` and later `/sdlc resume`, not ad hoc state edits |
| Frozen scope is wrong | Explicit new Intent/continuation; preserve the cancelled evidence |
| Evidence artifact expired | Use durable report/commit/Issue references; label raw evidence unavailable, never fabricate replacement logs |
| Local application unavailable | Show dated screenshots or start a deliberately isolated instance; do not claim current health |

For each run preserve:

```text
Repository + Intent URL + execution mode
Source/tool commit + scenario/input hash
Decisions + Spec/Plan versions/hashes + approval identities
Tests/implementation heads + Red/Green run/attempts
Merge SHA + image digest + verification run/attempt
Actual acceptance observations + limitations
Failures/retries/interventions + measured usage
Resource ownership + cleanup result + operational follow-up
```

Keep private prompts, raw CLI events, databases, payloads and logs outside Git.
Redaction is not proof that arbitrary free text contains no sensitive material.
Publish reviewed summaries and references instead.

## 6.7 Adopt one trustworthy loop before scaling

| Step | Team agreement | Observable result |
|---|---|---|
| 1. Select a small real change | Owner, scope, baseline, non-goals | A reviewed Intent, not an “AI adoption” slogan |
| 2. Make ambiguity explicit | Who decides and what blocks progress | A decision register and testable criteria |
| 3. Separate proposals from authority | Allowed tools/files, review and execution roles | AI cannot silently approve or expand scope |
| 4. Require independent verification | Legacy behavior, negative cases and evidence identity | Repeatable checks, not model assertions |
| 5. Accept the exact artifact | Deployment/recovery owner and acceptance procedure | Digest-bound observations |
| 6. Observe and measure | Operational feedback and quality/cost definitions | A reviewed follow-up and comparable results |

Useful team metrics include first-pass acceptance, escaped regressions,
unsupported assumptions caught, review rework, elapsed lead time, interventions
and actual model usage. Establish a real baseline and measurement rules first.
The repository does not supply measured customer ROI.

Before claiming **Demo Ready** under this repository's existing policy, complete
three genuine isolated Human-led scenarios: normal delivery, explicit Spec
revision/Plan invalidation, and recoverable failure. Historical scripted
development-test runs do not satisfy that certification.

The best takeaway is not “AI removes every gate.” It is:
**make useful proposals cheap, make unsupported transitions difficult, and
make every outcome inspectable.**

[Back to the guide](../README.md) · [Open the evidence and screenshot register](../evidence.md).
