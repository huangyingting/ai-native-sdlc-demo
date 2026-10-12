# 2. Intent, Spec and Plan: resolve uncertainty before coding

[Guide index](../README.md) · [中文](../zh/02-intent-spec-plan.md) ·
[Previous](01-operating-model.md) · [Next: Build and Verify](03-build-verify.md)

## 2.1 Start on the Intent page, not in an implementation prompt

[![Actual discovery Intent, showing the problem, proposed outcome and rehearsal disclaimer](../../assets/ai-native-sdlc-handbook/intent-discovery.png)](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/1)

**Figure B.** Historical [huangyingting/ai-native-sdlc-discovery-demo#1](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/1),
viewed October 12, 2026. Read the problem and outcome; the Closed badge describes
the completed historical run, not a new request you should submit there.

The existing service desk could create, find and update tickets but did not
show who was responsible. A weak request would be “add an owner dropdown.”
That chooses a UI before deciding what responsibility means.

A better Intent records:

| Field | Ownership example |
|---|---|
| Problem / evidence | In the synthetic handoff, agents cannot identify responsibility or unassigned work; the baseline has no owner model |
| Desired outcome | Make responsibility visible, support handoff, preserve existing workflows |
| Users | Support agents and team leads |
| Constraints | Preserve records/timestamps; keyboard-usable labelled controls; persisted behavior |
| Non-goals | Authentication, external directories, SLA, notifications, bulk assignment |
| Unknowns | Optional ownership? Fixed roster? Visibility only or filtering too? |
| Success evidence | Observable UI behavior, exact result sets and data preservation |

“No customer interviews or measured productivity baseline” was explicitly
recorded. A demo should not invent a business metric to make an Intent look
complete. In a real team, attach the actual research and baseline; if unknown,
assign discovery work rather than assert a benefit.

## 2.2 Use AI to expose choices, not silently make them

On a new configured run, the requester submits the Intent. Kickoff routes to
the Documents workflow. Read-only Copilot CLI proposes the Spec; trusted
automation validates and publishes its full revision on the parent Issue.
**No production code, Tests PR or application build is needed at this stage.**

The discovery example generated four blocking questions:

| Decision | Why it matters | Recorded outcome |
|---|---|---|
| Q-1: optional or mandatory ownership | Determines create behavior and treatment of existing tickets | Optional; old/new tickets begin unassigned |
| Q-2: identity source | Determines validation, persistence and scope | Fixed Avery/Jordan roster; empty selection maps to null |
| Q-3: display only or filtering | Determines user journey and query semantics | Filtering intersects existing predicates; navigation must not show stale selection |
| Q-4: migration if mandatory | A conditional assumption may become invalid | Mandatory premise does not apply; do not invent historical attribution |

Each decision generated a new Spec version. The actual sequence reached
**Spec v5**, then **Plan v1**. This is the historical result, not a required
version sequence for another run.

The [premature approval rejection](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/1#issuecomment-5862230300)
stated:

> Unresolved discovery blockers: Q-1, Q-2, Q-3, Q-4.

No approval, Plan or engineering assignment was created by that command.
The value is the blocked transition, not merely the presence of a question list.

## 2.3 What the reviewer actually does

Use the current Issue hub in a **new isolated run**, not these completed Issues.
The commands below are examples of this repository's custom command interface,
not built-in GitHub or Copilot commands.

1. Read the complete latest Spec and its discovery brief.
2. Check each question against the original problem and repository facts.
3. As an eligible configured reviewer, answer one current question:

   ```text
   /sdlc decide spec v1 Q-1
   Outcome: Tickets may remain unassigned until triage.
   Rationale: Requests arrive before a responsible agent is known.
   ```

4. Wait for publication of the new version. Read how the answer changed the
   acceptance criteria before answering the next question.
5. If a question must be deferred, record a rationale, owner, follow-up and risk
   using the [documented defer command](../../../tools/brownfield-demo/README.md#spec-readiness-profiles).
   “Deferred” means owned uncertainty, not a resolved fact.
6. If the Spec is incomplete, request a revision with concrete feedback.
7. Approve only the actual current version after its blockers are handled:

   ```text
   /sdlc approve spec v5
   ```

The `v1`, `Q-1` and `v5` above are illustrative. Copy the current identifiers
from your own hub. Submit a new top-level comment with the command on the first
line, not a code fence or an edit to an old comment. Ordinary discussion and
`@copilot` mentions do not satisfy a document approval.

## 2.4 Make the Spec testable without designing every implementation detail

[![Immutable approved specification with ownership semantics and discovery questions](../../assets/ai-native-sdlc-handbook/approved-spec.png)](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/blob/073c6fb0831e38d5513e22ac193a7bdaac2918cf/docs/delivery-runs/brownfield-human-gated-delivery/1/spec.md)

**Figure B1.** The sealed Spec viewed at an immutable commit. Read Intent,
Discovery and acceptance scenarios together. A screenshot shows only the top
of the document; follow the link for the complete approved content.

The following is a **teaching reconstruction** of the approved behavior, not
a replacement for the frozen Spec:

```text
Given INC-0001 is unassigned,
when a permitted local owner is selected on its detail page and saved,
then detail and queue display that owner,
and reloading/restarting with the same data preserves the assignment,
while the ticket's unrelated fields remain unchanged.
```

Add negative, boundary and compatibility scenarios:

- Clear ownership; stored owner is null and the UI says Unassigned.
- Select the same owner; prove no database write, not just equal timestamps.
- Submit an invalid owner or nonexistent ticket; fail explicitly and preserve data.
- Combine owner, search, status and priority with **AND**, not OR.
- Clear only the owner filter; preserve other filters and synchronize navigation.
- Open an old schema; preserve all previous values while adding nullable owner.

Concrete result sets are better than “filter works.” The discovery fixture
used Avery = `{0001, 0003}`, Jordan = `{0002}`, Unassigned = `{0004}`.
Combined Avery + open + high + `inc-1` yielded `{0001}`; Avery + critical
yielded the empty set. These depend on that deliberately prepared fixture,
not every fresh database.

## 2.5 Plan from repository facts

[![Approved plan mapping acceptance scenarios to task IDs and planned evidence](../../assets/ai-native-sdlc-handbook/approved-plan.png)](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/blob/073c6fb0831e38d5513e22ac193a7bdaac2918cf/docs/delivery-runs/brownfield-human-gated-delivery/1/plan.md)

**Figure B2.** The actual approved acceptance mapping. Read across each row:
criterion → task IDs → planned evidence. Planned evidence is an obligation,
not proof that those checks have already run.

The Plan is an implementation proposal linked to the approved Spec.
Review dependencies, scope and validation, not just a plausible task list.

| Illustrative task | Depends on | Verification |
|---|---|---|
| Add nullable storage and compatible migration | Approved owner semantics | Old-schema rows and original field values |
| Implement validated handoff and no-op behavior | Storage API | Invalid input, repeated owner, close/reopen |
| Expose owner on queue and detail | Store results | Actual row/detail metadata, not only options |
| Add intersecting filter/navigation behavior | Domain query contract | Exact sets, clear-one-filter, Back/Forward |
| Verify existing create/status/search paths | Complete increment | Approved regression tests and image smoke |

This table teaches task structure; it is not the actual task-ID ledger.
In the real Plan, every acceptance criterion must map to named tasks and checks.

A maintenance Plan later claimed an existing public HTTP test harness.
Inspection found direct-module/component Vitest tests instead. The reviewer
[requested a correction](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/issues/8#issuecomment-5863070163).
This is why “AI sounds familiar with the repository” is not sufficient evidence.

Use `/sdlc revise plan` with specific missing mappings or unsupported assumptions.
When ready, approve the latest actual version, for example:

```text
/sdlc approve plan v1
```

## 2.6 Treat approval as a change boundary

Before full Plan approval, an explicit Spec revision invalidates earlier Spec
approval and the dependent Plan. After full Plan approval, the system freezes
Spec, Plan and review state and assigns **Tests only**. Scope changes thereafter
need a new Intent, not a hidden adjustment in implementation.

The discovery run proves unresolved-decision blocking and decision-driven
revisions. It does **not** prove revocation of an already-approved Spec: v1–v4
were not approved. The separate Spec-revision scenario remains a distinct
rehearsal requirement.

### Exit checklist

- [ ] The problem and unknowns are honest, with no invented customer evidence.
- [ ] Each blocking choice has a recorded answer or owned deferment.
- [ ] Acceptance includes negative and compatibility behavior, not only happy paths.
- [ ] Plan assumptions name real repository surfaces.
- [ ] Tasks map to criteria and validation; dependencies are acyclic.
- [ ] Reviewers understand what will freeze after Plan approval.

Further detail: [discovery evidence](../../brownfield-discovery-maintenance-rehearsal.md#2-intent-became-explicit-version-bound-decisions)
and the [operator walkthrough](../../brownfield-human-gated-delivery-walkthrough.md#5-review-and-iterate-on-the-spec).

[Next: review executable contracts and implementation](03-build-verify.md).
