# Intent, Spec, and Plan: Research and Demo Improvement Design

> **Source research reference.** This assessment predates the repository created
> on October 12. References to September Issues/PRs under `ai-native-sdlc-demo`
> belong to a previous repository with that name, not this delivery.
> See the [source assessment](https://github.com/huangyingting/ai-native-sdlc/blob/b30e6bc3a693f674d48f1a9f76952176214eae9e/docs/ai-native-sdlc-early-stage-research.md)
> and use the [case index](cases/README.md) for current work.

Assessment date: 2026-09-28.

For the later lifecycle, see the companion
[Build/Verify/Deploy/Operate analysis](ai-native-sdlc-delivery-operations-research.md)
and [three reliability loops](brownfield-reliability-loops.md).

**Status:** the research below is a dated baseline assessment. The first
discovery/decision slice is now implemented in source for newly initialized
`decisions-v1` runs; the remaining roadmap is still proposed. A subsequent
[discovery-to-maintenance rehearsal](./brownfield-discovery-maintenance-rehearsal.md)
records actual remote execution in an isolated repository, including blocked
premature approval, four decision-driven Spec revisions, accepted ownership
delivery, and linked operational feedback. It is explicitly `development-test`,
not independent Human review or measured review effectiveness.
The current operator instructions remain the
[walkthrough](./brownfield-human-gated-delivery-walkthrough.md) and
[delivery reference](./brownfield-human-gated-delivery.md).

## Executive summary

The largest early-stage AI-native SDLC risk is not slow document production.
It is the rapid conversion of an unverified goal, assumption, or constraint
into a convincing specification and implementation plan.

Our demo is stronger at controlling **how approved decisions advance** than
at discovering **whether those decisions are correct, complete, and worth
implementing**. Version-bound approvals, change invalidation, and artifact
preservation are valuable foundations, but they do not establish business
value, semantic completeness, or technical feasibility.

The recommended evolution is decision-centered, not document-centered:

1. Clarify the problem and success criteria without requiring users to write
   a specification.
2. Make questions, assumptions, and Human decisions explicit and traceable.
3. Present a short change-and-decision packet before the complete documents.
4. Ground plans in source evidence and bounded feasibility checks.

Keep GitHub as the collaboration and audit system. Do not start by building a
new portal, introducing more approval stages, or adding autonomous agents.

## 1. Research method and evidence boundaries

There is no established empirical ranking of the ten largest AI-specific
Intent/Spec/Plan problems. This is a qualitative prioritization for small
teams making brownfield changes through GitHub, based on impact, recurrence
suggested by the literature, and the cost of discovering a mistake late.
It is not a measured frequency ranking or an overall coverage percentage.

The evidence has four different strengths:

| Evidence | What it supports | What it does not establish |
|---|---|---|
| NaPiRE requirements-engineering research [S1] | Incomplete requirements and communication failures are longstanding, empirically observed problems | Their frequency in current AI-assisted workflows |
| DORA user-centric guidance and AI research [S2, S3] | User focus and organizational capabilities remain important when using AI | A causal ranking of the ten problems below |
| Practitioner trials of spec-driven development [S4] | Concrete examples of excessive specification and failures to use available context correctly | Universal tool behavior or comparative effectiveness |
| Spec Kit workflow definitions [S5-S8] | First-party designs that explicitly address clarification, consistency, research, and task organization | Proof that those workflows solve these problems in practice |
| Our implementation, tests, and delivery receipts | Specific mechanisms and observed behavior in this demo | Enterprise-scale discovery capability or effective independent Human review |

Many problems predate AI. AI amplifies them by making assumptions look
authoritative, propagating them across artifacts, and producing material
faster than Humans can review it. General coding-productivity results are
not used as evidence of early-stage requirement quality.

### Assessment baseline

- Source inspection:
  [`huangyingting/ai-native-sdlc` at `462a044`](https://github.com/huangyingting/ai-native-sdlc/tree/462a0441874a3299882086741496c3c7d5da57e4).
- Real run:
  [huangyingting/ai-native-sdlc-demo#3][intent], explicitly `development-test`.
- Frozen contract: Spec v2 and Plan v3 at
  [`4d9bef47`][contract], containing five acceptance scenarios and seven tasks.
- Fourteen targeted early-stage tests passed during the preceding research
  pass. This is a point-in-time observation, not a fresh full-suite result
  for this documentation change.
- Two in-memory probes examined structural validation limits. They did not
  modify repository files, GitHub comments, approvals, or persisted run state.

The completed run used authorized scripted reviewer actions. It is not
evidence of independent stakeholder review, genuine Human acceptance, or
three successful live rehearsals. See the
[case study](./brownfield-human-gated-delivery-case-study.md) for the full
execution and evidence boundaries.

## 2. Ten high-impact pain points and current coverage

**Coverage terms:** "strong within scope" means an implemented and exercised
mechanism, not a complete solution. "Partial" means relevant support exists
but a material gap remains. A required heading is not semantic enforcement.

| # | Pain point and stage | How AI amplifies it | Current demo coverage and remaining gap |
|---|---|---|---|
| 1 | **Solving the requested feature rather than the underlying problem.** Intent | A feature request can become a coherent Spec and Plan without establishing that the feature is valuable. | **Limited.** The form asks for a problem, outcome, users, and constraints, but not user evidence, a baseline/target, alternatives, or a reason not to act. |
| 2 | **Missing brownfield and implicit domain context.** Spec / Plan | Generic solutions can ignore existing components, historical constraints, and integration contracts. Reading context does not guarantee correct interpretation. | **Partial.** Generation reads a pinned source checkout and discussion. Important claims do not need source citations, and external constraints or context freshness are not verified. |
| 3 | **Plausible assumptions becoming confirmed requirements.** Spec | Fluent prose can hide uncertainty; downstream plans and tests then reinforce an invented decision. | **Partial.** Prompts require visible questions and prohibit invented Human decisions. There is no typed assumption/decision register or readiness gate for unresolved blockers. |
| 4 | **Acceptance criteria that are not objectively decidable.** Spec | Words such as "fast," "safe," and "compatible" sound complete without conditions, thresholds, or counterexamples. | **Partial.** AC IDs and Given/When/Then markers are enforced, and the sample includes concrete outcomes. Semantic completeness and measurable quality are not established by validation. |
| 5 | **Unresolved stakeholder conflicts and decision authority.** Intent / Spec | AI can smooth contradictory opinions into apparently consistent prose instead of exposing a trade-off. | **Partial.** Reviewer identity, team membership, quorum, and version gates exist. Conflict arbitration, decision rationale, and independent multi-role review have not been demonstrated. |
| 6 | **Missing nonfunctional requirements and exceptional behavior.** Spec | Happy paths are easy to describe; recovery, concurrency, accessibility, permissions, migration, and performance require deliberate discovery. | **Partial.** Prompts and the sample address invalid input, migration, and compatibility. There is no systematic quality-attribute assessment or general quantitative NFR gate. |
| 7 | **Change propagation and cross-artifact drift.** Spec to Plan | Individually plausible documents can describe different versions of the requirement, while old approvals remain visible. | **Strong within one Intent.** Spec revisions invalidate approvals and Plan; stale approvals fail; Plan binds the exact Spec; frozen blobs are preserved. Cross-Intent impact analysis after sealing is not implemented. |
| 8 | **Unverified feasibility presented as a certain plan.** Plan | A plausible architecture or API assumption can become a task list without testing the premise. | **Partial.** Tasks include surfaces and validation, with risks and migrations documented. No required feasibility evidence, alternative comparison, or bounded experiment exists. |
| 9 | **Incorrect task slicing, dependencies, and parallelism.** Plan | A tidy DAG can hide oversized tasks, missing increments, shared-file conflicts, and unrealistic sequencing. | **Strong structural support; partial practical coverage.** Unknown task/AC references, cycles, and unmapped ACs are rejected. Task usefulness, sizing, real dependencies, and safe parallel execution are not verified. |
| 10 | **Document inflation and reviewer fatigue.** Across stages | Generation scales faster than reading, comparison, and decision-making, creating approval without understanding. | **Partial.** Rendered Issue revisions, a progress hub, and revision summaries reduce navigation cost. There is no structured impact diff, decision inbox, or measured review-effort evidence. |

The research basis is complementary: [S1-S3] motivate goals and communication;
[S4] exposes context and review-burden risks; [S5-S6] describe ambiguity,
quality, and consistency checks; [S7-S8] describe research and task planning.
These sources do not establish that any one product solves all ten problems.

## 3. What our demo actually establishes

### Intent and generation

The [Intent form](../.github/ISSUE_TEMPLATE/brownfield-human-gated-delivery-intent.yml)
has five required fields: problem, outcome, affected users/systems,
constraints/non-goals, and open questions. The original Intent is retained as
a snapshot rather than silently rewritten after review begins.

The active Issue-review prompts are
[`spec-issue.md`](../.github/brownfield-human-gated-delivery/prompts/spec-issue.md)
and
[`plan-issue.md`](../.github/brownfield-human-gated-delivery/prompts/plan-issue.md),
not the legacy document-PR prompts. They request code grounding, visible
unresolved questions, revision summaries, and separation of proposals from
Human decisions.

The [document workflow](../.github/workflows/brownfield-human-gated-delivery-documents.yml)
separates read-only generation from trusted publication. Copilot receives
`view`, `glob`, and `rg`, not shell or write tools. It cannot interactively ask
the reviewer questions during generation. The
[orchestrator](../.github/brownfield-human-gated-delivery/scripts/documents.mjs)
supplies discussion and prior revisions, rejecting oversized context rather
than silently truncating it. Ordinary discussion is not approval and does not
automatically request regeneration.

This is a good trust boundary. It is not a structured discovery conversation.

### Approvals and change propagation

The [document state logic](../.github/brownfield-human-gated-delivery/scripts/document-core.mjs)
binds approvals to document version, content hash, reviewer-policy hash, and
Human identity. A Spec revision invalidates the Plan; Plan approval requires
the exact approved Spec. Full Plan approval seals the documents.

The real run exercised this behavior:

1. Spec v1 was approved.
2. [Revision feedback][spec-revision] distinguished clearing the owner filter
   from clearing a ticket's owner.
3. A stale approval of Spec v1 was [rejected by the workflow][stale-rejection].
4. Spec v2 and Plan v3 were subsequently approved and frozen.

This proves a useful version-governance behavior. It does not prove that the
approved requirement was the best business choice.

### Structural validation is not semantic validation

The [core validators](../.github/brownfield-human-gated-delivery/scripts/core.mjs)
check required sections, AC identifiers, Given/When/Then markers, task fields,
known references, acyclic dependencies, and AC-to-task coverage.

Two in-memory research probes made the boundary visible:

- A Spec with an explicitly unresolved question still passed structural
  validation and could receive a synthetic configured-reviewer approval.
- A Plan whose task surfaces were replaced with
  `imaginary/component/that-does-not-exist.ts` still passed structural
  validation.

These observations are not arguments for rejecting every open question or
every new file. Humans may consciously defer a question, and a new file is a
legitimate plan surface. The missing distinctions are **blocking versus
deferred**, and **existing evidence versus proposed change**.

Relevant regression coverage lives in
[`documents.test.mjs`](../.github/brownfield-human-gated-delivery/tests/documents.test.mjs)
and
[`core.test.mjs`](../.github/brownfield-human-gated-delivery/tests/core.test.mjs).
The semantic probes were exploratory checks, not committed regression tests
for new readiness rules.

## 4. Proposed experience: decisions before document volume

### Implementation status

The first slice now provides:

- A structured discovery brief and stable Q-n questions inside the Spec.
- Trusted version-bound `/sdlc decide spec vN Q-n` and
  `/sdlc defer spec vN Q-n` commands from configured Spec reviewers.
- Explicit deferment rationale, owner, follow-up, and accepted risk.
- Automatic Spec revision and invalidation of existing Spec approval/Plan.
- Required mapping of latest Human decision receipts to ACs or an explanation
  of why no AC changes are needed.
- Approval and handoff blocking for unanswered questions, and decision-context
  hashes on Spec/Plan approvals.
- A compact readiness packet with all question statuses and bound-record links.
- Persisted new-run enrollment; existing Issue and legacy PR runs are not
  migrated.

See the [operator contract](./brownfield-human-gated-delivery.md#discovery-and-decision-readiness)
and [walkthrough](./brownfield-human-gated-delivery-walkthrough.md#resolve-discovery-questions-first).
The original coverage table describes the inspected pre-change baseline, not
the current implementation.

The [subsequent executed example](./brownfield-discovery-maintenance-rehearsal.md)
now supplies live GitHub and runtime evidence for this slice. It also records
a maintenance Plan that invented an existing HTTP test harness; direct source
inspection caught that assumption before approval. This supports the need for
grounded review, not a claim that semantic plan validation is now automated.

This is deliberately narrower than the full design: questions currently
belong to Spec; all are blocking until a Human disposition; there is no
separate Plan question register, AI quality-review job, semantic impact diff,
path/feasibility gate, automated follow-up, or measured review improvement.
Referenced decisions and AC mappings do not prove correct interpretation.
New question discovery still depends on AI and Human review.

The sections below remain the design and rollout goals. Parts of Increment 1
and its minimal readiness packet are implemented as described above. Only the
linked rehearsal's explicitly observed results are demonstrated; later
increments, deferment follow-up, and independent Human scenario results must
not be inferred.

```text
Human Intent
  -> AI proposes a discovery brief and questions
  -> Human resolves or explicitly defers questions
  -> AI publishes Spec + decision/impact packet
  -> Spec readiness checks + explicit Human approval
  -> AI publishes evidence-grounded Plan + decision/impact packet
  -> Plan readiness checks + explicit Human approval
  -> Existing Tests -> Implementation -> Verification -> Human acceptance
```

Discovery remains inside the Spec review loop. The Human still authors the
Intent; there is no new mandatory Intent-approval ceremony. Provisional drafts
may be published with blockers visible, but must not appear ready to approve.
A Plan that exposes a Spec-level conflict sends the reviewer back through an
explicit Spec revision and the existing downstream invalidation behavior.

### GitHub's responsibilities

| Surface | Proposed responsibility |
|---|---|
| Parent Intent Issue | Human discussion, proposed options, explicit decisions, and versioned approval commands |
| One bot-maintained progress hub | Current blockers, decisions needed, changed ACs/tasks, and links to the latest immutable review packet |
| Full revision comments | Complete readable Spec/Plan, with a short review packet first |
| Document branch and trusted ledger | Durable revisions, decision receipts, provenance, and approval-bound evidence |
| GitHub Actions | Validate structure and readiness, reject stale/unauthorized actions, publish truthful outcomes |
| Tests and Implementation PRs | Preserve approved inputs and continue the existing controlled Red/Green gates |
| Replay and readiness tooling | Show the same decisions, bindings, and unresolved limitations rather than reconstructing them from summaries |

Do not create a separate Issue for every question by default. Do not turn
checkboxes, labels, reactions, or AI analysis into approval authority.
Start with the existing Issue, Markdown rendering, and dependency-free
automation; a separate UI should require evidence that GitHub cannot support
the interaction.

## 5. Four implementation increments

### Increment 1 (P0): discovery and explicit decision readiness

**Addresses:** pain points 1, 3, and 5; contributes to 4 and 6.

Extend the Intent guidance to request evidence and success measures while
allowing "unknown" answers. AI proposes a short discovery brief in the Spec:

- User/problem and source of the observation.
- Current baseline, intended outcome, and how improvement would be observed.
- Alternatives, including a smaller change or doing nothing.
- Confirmed constraints, non-goals, assumptions, and unresolved questions.

Do not require an invented ROI or unsupported numerical target. A missing
business baseline can become an explicit measurement task or a consciously
accepted limitation; it must not be represented as measured evidence.

Use a small typed review record alongside the existing document-state fields,
not a new database. Questions and assumptions need stable IDs, scope
(`spec` or `plan`), responsible person, evidence/source, options, impact,
blocking status, and disposition. A Human decision additionally records the
chosen outcome, rationale, actor, time, original command, and exact reviewed
context. AI may propose entries but cannot author trusted decision receipts.

**Proposed readiness rules:**

- Unresolved blockers prevent the affected stage's approval and handoff.
- A deferment requires an authorized Human, rationale, owner, follow-up point,
  and explicit acknowledgment of the remaining risk. It is not "resolved."
- AI cannot mark its own assumption confirmed or silently downgrade a blocker.
- Decisions follow existing stage-reviewer authorization; an assigned question
  owner does not automatically gain approval rights. Final stage quorum remains.
- A question response records a decision, not blanket Spec/Plan approval.
- A behavior-changing answer produces a new reviewable document revision.
  Changed decision context invalidates affected approval even if prose did not
  change. Plan-only investigation must not invalidate an unchanged approved Spec.
- Substantive Spec changes retain the existing Spec-to-Plan invalidation.
- Decision commands must bind the published context, reject stale or edited
  submissions, and be idempotent under retries. Plain comments remain discussion.

Persist the original Intent unchanged. Bind each approval to a canonical,
versioned digest of its relevant decision/evidence context as well as the
document hash. Exclude mutable processing cursors and approval receipts from
that digest. Trusted code, not generated text, validates and writes state.

**Exit demonstration:** a draft containing an unanswered owner-roster question
cannot advance; a real authorized response creates a traceable decision;
revised Spec approval is still required; a conflicting answer invalidates the
affected approval. Automated and scripted tests remain labeled as such.

### Increment 2 (P1): concise review packets and quality challenges

**Addresses:** pain points 4, 5, 6, 7, and 10.

Publish a compact packet before the full document:

1. Decisions needed now, including who must act.
2. What changed and why, compared with the previous revision.
3. Added, changed, and removed ACs/tasks and affected decisions.
4. Readiness blockers, deferred risks, and advisory findings.
5. Links to evidence and complete immutable artifacts.

Compute ID/reference/hash changes deterministically. Label an AI-written
semantic summary as assistance, not authoritative evidence. Removing or
renumbering an AC must be visible even if the summary omits it. A packet must
name its exact document and context versions; stale packets cannot authorize
newer content. Preserve explicit size limits and link to details rather than
silently dropping blockers.

Add a proportionate quality assessment for migration/data integrity, error
handling, access/privacy, concurrency, performance, accessibility, recovery,
and observability. Each area is applicable, not applicable with a reason, or
unknown. Do not force every small change to implement every quality attribute.
An applicable requirement should describe observable behavior or a measurable
condition and validation approach.

Optional AI analysis can flag ambiguity, contradiction, unsupported assumptions,
and weak acceptance criteria. Findings have IDs and an explicit Human
disposition; a model's "pass" is never approval. A required analysis that fails
must report failure, not fabricate a clean result. An advisory analysis that
was not run must be shown as not run.

**Exit demonstration:** a revision changes filter semantics and removes an AC;
the packet exposes both and their task impact without requiring a reviewer to
compare two full documents manually. A vague quality requirement remains a
visible concern until the reviewer makes its outcome explicit or records a
justified disposition.

### Increment 3 (P1): grounded and feasible plans

**Addresses:** pain points 2, 6, 8, and 9.

Require important Plan claims to distinguish:

- **Existing:** repository-relative path and immutable baseline reference,
  optionally a symbol/range and a claim explaining its relevance.
- **New:** proposed path/component and why existing code cannot satisfy it.
- **External:** source/version, observation date, and unresolved verification.
- **Hypothesis:** a technical assumption and how it will be checked.

Trusted validation can check paths and references at the pinned commit.
It cannot prove that a cited function supports the proposed interpretation.
Evidence existence and semantic relevance must be reported separately.

Tasks retain AC mappings and dependencies, and add a clear verifiable outcome.
Shared surfaces should trigger review of possible execution conflicts, not an
automatic claim that tasks can run in parallel. Reference evidence that must
be revisited if its underlying decision changes. Do not silently rebase a run
to newer source; stale-baseline concerns need an explicit disposition, with a
new Intent when necessary.

High-risk feasibility assumptions need a bounded experiment before Plan
approval or an authorized, visible risk acceptance where policy permits it.
Do not give the document generator shell/write access to achieve this. Initially,
a Human can attach a reviewed evidence reference. Any later automated probe
must use a separate constrained job with approved execution, isolated fixtures,
timeouts, and no production mutation or arbitrary commands from generated prose.

**Exit demonstration:** an existing surface with a nonexistent baseline path
is rejected; an explicitly new path is accepted as a proposal; a claimed
migration behavior without evidence remains unverified; a pinned experiment
records what was actually tested and does not claim broader feasibility.

### Increment 4 (P2): evidence-driven demo scenarios and review measurement

**Addresses:** all ten through observable exercises rather than new headings.

Keep the ownership-free source and use fresh isolated demo repositories.
Retain the current completed run as historical evidence, not a resettable
fixture. Add the following scenarios only after their required mechanisms
exist:

| Scenario | Failure deliberately exposed | Required observable result |
|---|---|---|
| Ambiguous ownership goal | "Make handoffs better" with no agreed outcome | Discovery separates the problem, proposed solution, evidence, and unanswered success questions |
| Conflicting ownership policies | One role requires an owner; another needs an unassigned queue | Conflict remains visible until an authorized decision records the trade-off; AI does not reconcile it silently |
| Unsupported technical assumption | Plan assumes a component or migration guarantee that is not established | Existing/new distinction and evidence checks identify the unsupported claim before implementation |
| Spec change after approval | Clear-filter behavior changes and affects Plan tasks | Old approval is rejected, affected task mappings are shown, and a new review is required |
| Reviewer-overload comparison | A small semantic change is buried in a long revision | Reviewer receives a faithful decision/impact packet, with complete artifacts still accessible |

Use fictional, clearly labeled role cards for scripted demonstrations. To
claim independent multi-stakeholder review, recruit real participants with
the relevant authority; one account playing several roles does not qualify.

Record review effort separately from Issue-open-to-close wall time:

- Seeded contradictions or unsupported assumptions found before approval.
- Missed defects and false-positive findings.
- Revisions caused by late discovery, with reasons.
- Active reviewer time, using consented self-report or explicit timing.
- Unauthorized/stale decisions correctly rejected.
- Post-handoff corrections attributable to missed early-stage decisions.

Use equivalent but different scenarios, counterbalance presentation order,
and report participant/sample limitations. Do not derive a productivity
percentage from one rehearsal or infer active review time from comment gaps.
Business impact requires post-delivery observation beyond this workflow.

## 6. Integration and compatibility requirements

Prompt changes alone cannot implement this design. Readiness must be enforced
at command processing, publication, approval, and engineering handoff, and
verified again by downstream artifact checks.

| Existing surface | Required implementation work |
|---|---|
| [Intent form](../.github/ISSUE_TEMPLATE/brownfield-human-gated-delivery-intent.yml) and [Issue prompts](../.github/brownfield-human-gated-delivery/prompts/) | Discovery questions, proposed decisions, evidence classification, and size-bounded output contracts |
| [Document core](../.github/brownfield-human-gated-delivery/scripts/document-core.mjs) | Versioned typed records, readiness transitions, stage-scoped context bindings, and decision authorization |
| [Document orchestrator](../.github/brownfield-human-gated-delivery/scripts/documents.mjs) | Trusted ingestion, version-bound command receipts, atomic publication, hub/packet rendering, and handoff validation |
| [Core validators](../.github/brownfield-human-gated-delivery/scripts/core.mjs) and [stage validation](../.github/brownfield-human-gated-delivery/scripts/validate-stage.mjs) | Evidence/reference checks, conditional artifact contracts, and preservation of every approved input |
| [GitHub adapter](../.github/brownfield-human-gated-delivery/scripts/github.mjs) and [document workflow](../.github/workflows/brownfield-human-gated-delivery-documents.yml) | Consistent mode/version routing, trust boundaries, failure reporting, and retry behavior |
| [Demo toolkit](../tools/brownfield-demo/) | Preparation/preflight compatibility, replay of bound decision evidence, and truthful readiness reporting |
| [Scenario manifests](../demos/it-service-desk/.github/brownfield-human-gated-delivery/scenarios/) and [walkthrough](./brownfield-human-gated-delivery-walkthrough.md) | New exercises, expected outcomes, operator instructions, and explicit live-versus-scripted evidence |

The current handoff permits exactly Spec, Plan, and the approval-state file.
The initial design should extend the versioned state record rather than add
many independently editable artifacts. If separate evidence files become
necessary, update the handoff allowlist, approved-blob checks, replay, and
readiness readers together; never relax the allowlist to an unrestricted
directory.

Introduce the new readiness semantics only for newly opted-in runs with a
persisted, versioned review profile. Existing `issue-v1` and legacy document-PR
runs must retain their established contract, and completed evidence must stay
readable. A repository setting change must not retroactively change a run's
approval meaning. Unsupported profiles should fail explicitly, not fall back
to a weaker mode. Disabling new enrollment must not disable gates for runs
already enrolled.

Before enabling the profile:

- Add state-machine tests for blocker/defer/resolve transitions, stale
  contexts, unauthorized actors, duplicate commands, changed policy, and
  Spec/Plan-scoped invalidation.
- Add integration tests proving that generation cannot forge decisions and
  that every approval/handoff path enforces the same readiness rules.
- Test failure recovery between state persistence and comment publication;
  retries must neither duplicate decisions nor advance unpublished content.
- Test deterministic added/changed/removed ID reporting and advisory-failure
  display; a summary must not conceal missing evidence.
- Test existing/new paths at the pinned baseline and evidence invalidation.
- Run regression fixtures for current Issue review, legacy PR review,
  approved-file preservation, replay, and readiness.
- Run the root `npm test`. If application code is affected, also run the
  application's tests, lint, and build as required by repository guidance.
- Rehearse on a fresh isolated target, preserving required PR checks and
  Human acceptance. Do not rewrite the historical development-test run.

Roll out one increment at a time. The first end-to-end slice should be:
**ambiguous Intent -> explicit blocking question -> recorded Human decision ->
revised Spec -> valid approval**. It offers a clearer improvement than adding
all ten categories to a template and calling them solved.

## 7. What this proposal does not solve

- GitHub cannot supply missing customer research or legitimate decision
  authority. Humans must provide both.
- Structured decisions can still be wrong. Provenance makes them reviewable,
  not true.
- Path validation and experiments cannot prove a whole architecture feasible.
- An AI critique is not an independent Human review or proof of completeness.
- Cross-repository knowledge, organization-wide prioritization, capacity
  planning, and cross-Intent impact graphs remain outside the initial scope.
- No new effectiveness, business-value, or Demo Ready claim is justified
  until the corresponding observations and live rehearsals exist.

## 8. Sources

Sources were consulted during the September 2026 research pass. Spec Kit
references are pinned to commit `c00dc0551583428a10a94443c58c6a41e5e0138c`
to distinguish reviewed workflow design from future behavior.

- **S1.** [Naming the Pain in Requirements Engineering: Contemporary Problems,
  Causes, and Effects in Practice](https://arxiv.org/html/1611.10288v1),
  2016 preprint, especially the problem results and discussion. Empirical
  requirements-engineering baseline; not an AI-specific study.
- **S2.** [DORA: User-centric focus](https://dora.dev/capabilities/user-centric-focus/).
  Guidance on connecting software work to user needs.
- **S3.** [2025 DORA AI Capabilities Model](https://services.google.com/fh/files/misc/2025_dora_ai_capabilities_model.pdf).
  Survey and qualitative evidence on capabilities that support AI adoption;
  not a randomized early-stage intervention study.
- **S4.** Birgitta Bockeler,
  [Understanding Spec-Driven-Development: Kiro, spec-kit, and Tessl](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html),
  2025-10-15. Practitioner observations, including specification expansion
  and failures to use existing-code context; limited trials, not a benchmark.
- **S5.** [Spec Kit: Clarify](https://github.com/github/spec-kit/blob/c00dc0551583428a10a94443c58c6a41e5e0138c/templates/commands/clarify.md).
  Structured ambiguity, edge-case, and quality-attribute questions.
- **S6.** [Spec Kit: Analyze](https://github.com/github/spec-kit/blob/c00dc0551583428a10a94443c58c6a41e5e0138c/templates/commands/analyze.md).
  Ambiguity, omissions, coverage, and cross-artifact consistency.
- **S7.** [Spec Kit: Plan](https://github.com/github/spec-kit/blob/c00dc0551583428a10a94443c58c6a41e5e0138c/templates/commands/plan.md).
  Research of unknowns and technical planning.
- **S8.** [Spec Kit: Tasks](https://github.com/github/spec-kit/blob/c00dc0551583428a10a94443c58c6a41e5e0138c/templates/commands/tasks.md).
  Task organization, dependencies, and independently verifiable increments.

[intent]: https://github.com/huangyingting/ai-native-sdlc-demo/issues/3
[contract]: https://github.com/huangyingting/ai-native-sdlc-demo/tree/4d9bef47d1ddc91e6cb3d3ebed1aa826c6c97e1e/docs/delivery-runs/brownfield-human-gated-delivery/3
[spec-revision]: https://github.com/huangyingting/ai-native-sdlc-demo/issues/3#issuecomment-5851353633
[stale-rejection]: https://github.com/huangyingting/ai-native-sdlc-demo/issues/3#issuecomment-5851365861
