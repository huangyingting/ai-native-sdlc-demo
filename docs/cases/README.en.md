# Cases and delivery progress

[中文](README.md) · [Repository home](../../README.en.md)

Start with [Copilot roles and authorship](../copilot-roles.en.md).
The two accepted deliveries below have Coding Agent-authored implementation PRs.
The engineering appendices instead contain CLI output and independent checks,
or deterministic runtime observations.

**Completed ownership walkthrough:**
[Illustrated case](ownership.en.md) · [Screenshot provenance](assets/ownership/manifest.json)

**Completed database-readiness maintenance delivery:**
[Illustrated case](readiness.en.md) · [Screenshot provenance](assets/readiness/manifest.json)

<a id="main-delivery"></a>
## First delivery: ticket ownership

The service desk already supports creating, searching and updating tickets.
The first request is to make ticket responsibility visible and support
handoffs without disrupting those workflows. Product choices are resolved
before implementation rather than inferred from a finished example.

| Step | What to inspect | State |
|---|---|---|
| Preparation | [Baseline and checks](preparation.en.md) | Baseline and automated setup checks passed |
| Intent | [Ticket ownership and handoffs](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1) | Closed after acceptance |
| Spec | Product decisions and observable acceptance criteria | [Spec v5 approved](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6118027964) |
| Plan | [Six implementation tasks](https://github.com/huangyingting/ai-native-sdlc-demo/blob/6b7a4ddf96f43c6f1980c2e1ed4b568ec429d427/docs/delivery-runs/brownfield-human-gated-delivery/1/plan.md) | [Plan v1 approved](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6118095114) |
| Tests | [Tests PR](https://github.com/huangyingting/ai-native-sdlc-demo/pull/8) | [Approved after two revision rounds](https://github.com/huangyingting/ai-native-sdlc-demo/pull/8#pullrequestreview-5486995544); merged into the delivery branch |
| Implementation | [Implementation PR](https://github.com/huangyingting/ai-native-sdlc-demo/pull/9) | Approved and merged; 38 tests Green |
| Delivery | [Exact image acceptance](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6119642416) | Published, run and accepted |
| Operation | [Database-readiness maintenance delivery](readiness.en.md) · [Reliability rehearsal](reliability.en.md) | Readiness accepted; two recovery rehearsals passed, maintenance review pending |

### Product decisions

| Decision | Confirmed behavior | Resulting version |
|---|---|---|
| [Q-1: optional ownership](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6117772868) | Existing and new tickets may remain unassigned; owners may be cleared. Do not infer historical owners. | [Spec v2](https://github.com/huangyingting/ai-native-sdlc-demo/blob/f63ee57010f1c83de3b0ae4d6d270c87c62441cf/docs/delivery-runs/brownfield-human-gated-delivery/1/spec.md) |
| [Q-2: local roster](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6117828551) | Select Alex Chen or Sam Rivera from a fixed list; no free-text owners, roster management or external identity integration. | [Spec v3](https://github.com/huangyingting/ai-native-sdlc-demo/blob/de5fdb100963c65f19a8f5295602ecf381bf1235/docs/delivery-runs/brownfield-human-gated-delivery/1/spec.md) |
| [Q-3: owner filtering](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6117947008) | Filter by either roster member or Unassigned, together with existing search and filters; All owners removes only the ownership restriction. | [Spec v4](https://github.com/huangyingting/ai-native-sdlc-demo/blob/dd32ba04871f10017963917471cdef5ee6164f52/docs/delivery-runs/brownfield-human-gated-delivery/1/spec.md) |
| [Q-4: detail-only handoffs](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6117980837) | Change ownership on details in every existing status; creation stays unchanged, and status and ownership saves remain independent. | [Spec v5](https://github.com/huangyingting/ai-native-sdlc-demo/blob/9e183465d985bfa081f239a68eda400340320195/docs/delivery-runs/brownfield-human-gated-delivery/1/spec.md) |

All four decisions are recorded. Spec v5, Plan v1, Tests and Implementation
were approved separately. The published image was then verified and explicitly
accepted; the Intent closed at `2026-10-12T07:22:08Z` (15:22:08 Beijing time).

### Tests: CI success is not review approval

1. The [first CI attempt](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38207729425/attempts/2)
   failed because expected-failure names did not match Vitest's JSON report.
   The [first review](https://github.com/huangyingting/ai-native-sdlc-demo/pull/8#pullrequestreview-5486811408)
   also requested genuine legacy database fixtures and stronger acceptance coverage.
2. The [revised controlled Red check](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38208788465/attempts/2)
   passed, but [another review](https://github.com/huangyingting/ai-native-sdlc-demo/pull/8#pullrequestreview-5486915007)
   found contradictory filter and timestamp assertions, a detached-DOM lookup,
   and an ineffective no-op timestamp check. Earlier expected failures masked
   these later assertions. They were corrected before approval.
3. [Final Tests CI](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38210170335/attempts/2)
   passed: 26 baseline tests; then 29 passing tests and exactly nine expected
   assertion failures on the Tests head, with no skips or infrastructure errors.
   Lint, TypeScript checking and build also passed.
4. Approved head `104be0889c54652bec8f9bc317ffa5f0cf33166f` was merged as
   `65939138ada498dca30b572d3baec25cddb5178d`.
   The [handoff](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38210668893)
   then assigned implementation. Approved tests and documents are frozen:
   implementation must make them Green without weakening them.

The nine failures reflect missing behavior, not errors to conceal. Test approval
does not mean the feature is delivered or accepted by the user.

### Delivery and acceptance

The [implementation approval](https://github.com/huangyingting/ai-native-sdlc-demo/pull/9#pullrequestreview-5487362172)
covered head `4ee8225`; its protected squash merge is `1a1e14d`.
Publication attempt 2 failed on package-write access. The operator corrected
the package's Actions access, and [attempt 3 passed](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38215333786/attempts/3).
The exact published digest was pulled, run and checked before separate acceptance,
not replaced by a local source preview. See the [illustrated case](ownership.en.md)
for the complete sequence and functional acceptance boundaries.

Accepted digest:
`sha256:90836abf909410db91b0d3c791812683e5424c5cab7d7a84df1af6772a66ce76`.
Functional acceptance does not resolve the [baseline dependency advisories](preparation.en.md)
or authorize production use.

## Maintenance delivery: database readiness

[Intent #18](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18)
is accepted and closed, with all 47 current tests Green.

| Gate | Original record | Result |
| --- | --- | --- |
| Product decisions | [Six-answer batch](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6124226071) | One command produces one Spec revision, not approval |
| Spec and Plan | [Spec v3 approval](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6124496828) · [Plan v2 approval](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6124971454) | Separate exact-version records |
| Tests | [PR #25](https://github.com/huangyingting/ai-native-sdlc-demo/pull/25) | 38 baseline passes; head 47 total, 39 passing and 8 exact assertion Red; approved after one correction round |
| Implementation | [PR #26](https://github.com/huangyingting/ai-native-sdlc-demo/pull/26) | 47 Green, seven approved increment files unchanged, protected merge `06e9fe3` |
| Publication | [Digest verification](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38311999223/attempts/2) | OCI source matches the merge |
| Acceptance | [User acceptance](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6133959987) · [Receipt](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6133963982) | Real fault/recovery, preservation and business journeys passed; Intent closed |

See the [readiness case](readiness.en.md) for the full boundaries and illustrated evidence.
Database readability is not a write guarantee, deadline or production certification;
the separate reliability rehearsal has two passing runs, with maintenance review pending.

<a id="focused-cases"></a>
<a id="remaining-focused-cases"></a>
## Engineering appendices, not additional product deliveries

Reliability adds no new CLI diagnosis/repair call. The impact and diagnosis
experiments generate candidate text with zero tools, not GitHub implementation
PRs. Their user-account comments are assistant-published summaries.
See the reviewed [impact output](change-impact.en.md#what-copilot-actually-produced)
and [diagnosis output](engineering-judgment.en.md#what-copilot-actually-said).

| Topic | Actual result | Remaining boundary |
|---|---|---|
| [Release reliability](reliability.en.md) | 23 exact qualification assertions, six mutants killed; two fresh-volume admission/fallback/recovery rehearsals passed | Operational observation only; [maintenance review #28](https://github.com/huangyingting/ai-native-sdlc-demo/issues/28) pending |
| [Change impact](change-impact.en.md) | Reviewed exact-hash proposal; one isolated implementation passes 15 unchanged tests + 35 independent checks | [Record #30](https://github.com/huangyingting/ai-native-sdlc-demo/issues/30) preserves delegated local review, not independent Human acceptance; repository baseline unchanged |
| [Failure diagnosis](engineering-judgment.en.md) | Six behaviorally verified repairs; both environment classifications wrong | Classification failures retained, not overwritten by Green tests |
| [Agent strategy evaluation](engineering-judgment.en.md) | Six cells / nine actual calls, 4/6 full acceptance; usage and time compared | One trial per cell, no general statistical ranking |

The [engineering results record #29](https://github.com/huangyingting/ai-native-sdlc-demo/issues/29)
preserves every outcome. Each real model call verified zero tools. The earlier
isolation-rejected proposal call remains a separate compatibility failure;
private raw prompts, full responses and complete candidate source are not published;
only selected [reviewed output/difference excerpts](assets/engineering/copilot-excerpts.json) are added.

Each topic records its inputs, allowed scope, observed outcome and unverified areas separately.

## Screenshots and records

Capture each meaningful step: requirement submission, document publication,
review decisions, tests, publication, application operation and experiment results.
Capture every decision and resulting document version, not just the final version.
Include the command receipt when available and visually confirm the intended
content is visible. Never capture credential-entry pages.

Keep the source URL, capture time, commit or workflow run/attempt and checksum
with each image. Preserve original test and approval records as well;
screenshots illustrate them rather than replace them.

Review evidence before publication. Credentials, private prompts, unreviewed
raw events, local databases and sensitive logs stay outside Git.
Failed attempts remain separate; later success does not overwrite them.
