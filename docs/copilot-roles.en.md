# Demo goals, Copilot's role and results

[中文](copilot-roles.md) · [Documentation](README.en.md) · [Presentation route](presenter.en.md)

## What each demonstration establishes

| Demonstration | Purpose | Copilot's contribution | Result |
|---|---|---|---|
| [Ticket ownership](cases/ownership.en.md) | Make responsibility and handoffs visible without breaking existing work | Coding Agent implements [PR #9](https://github.com/huangyingting/ai-native-sdlc-demo/pull/9) | Accepted; 38 tests Green |
| [Database readiness](cases/readiness.en.md) | Distinguish a live process from a readable ticket database | Coding Agent implements [PR #26](https://github.com/huangyingting/ai-native-sdlc-demo/pull/26) | Accepted; 47 tests Green; failed database probes return 503 |
| [Release reliability](cases/reliability.en.md) | Verify admission, failure detection, fallback and data preservation | Rehearse the previously delivered image with deterministic scripts; no new CLI repair call | Two isolated runs passed; one fallback per incident and candidate writes preserved |
| [Proxy-owner impact](cases/change-impact.en.md) | Add temporary assignment while preserving accountable ownership and compatibility | CLI generates an impact proposal and isolated candidate in two calls | 15 unchanged tests and 35 independent checks passed; not deployed into the service desk |
| [Failure diagnosis](cases/engineering-judgment.en.md) | Distinguish product, test-harness and configuration faults | CLI generates classifications, rationales and repair candidates | Six behavioral repairs; four full passes; two incorrect configuration labels |
| [Agent strategy comparison](cases/engineering-judgment.en.md) | Measure whether diagnosis-first improves results enough to justify its cost | Compare direct and diagnosis-first CLI strategies | Both pass 2/3; diagnosis-first uses six calls versus three; no general ranking |

## Three demonstration types

- **Delivery mainline:** ownership and readiness cover requirement decisions,
  approved documents, Coding Agent implementation, CI, image verification and acceptance.
- **Operational rehearsal:** reliability tests fixed admission and recovery policies.
- **Controlled engineering experiments:** proxy impact, diagnosis and strategy
  comparison evaluate generated proposals and candidates against independent checks.

## Copilot and verification responsibilities

- **Coding Agent:** implements the reviewed feature and submits the code PR.
- **Copilot CLI:** generates structured analysis and candidate text. These
  experiments require zero available tools and zero tool requests.
- **Actions and the verification harness:** execute checks, apply allowlisted
  candidates and run restricted Docker; the model does not grade its own repair.
- **Delivery review:** approves specifications, plans, tests and implementation
  separately from final artifact acceptance.

## The two actual execution chains

```text
Delivery mainline:
  user decisions and approvals → Coding Agent implementation PR
    → Actions checks → actual published image → explicit user acceptance

Restricted experiment:
  fixed synthetic input → Copilot CLI proposal / diagnosis / candidate text
    → trusted allowlisted adapter → Docker tests + independent checks
    → measured result and code-difference evidence
```

The engineering baseline is deliberately unchanged. A verified isolated proxy
candidate does not mean proxy ownership was deployed into the service desk.

## Evidence to inspect

For a CLI experiment, show these four items in order:

1. **Input:** the fixed request and relevant supplied faulty or baseline code.
2. **Model output:** the actual rationale and classification.
3. **Candidate difference:** a reviewed excerpt of the code it proposed.
4. **Independent outcome:** scope, test preservation, behavioral checks and classification gate.

The [reviewed excerpt record](cases/assets/engineering/copilot-excerpts.json)
contains selected exact final-answer text and one-line differences, tied to the
response hashes already present in the measured summaries. The
[impact case](cases/change-impact.en.md#what-copilot-actually-produced) and
[diagnosis case](cases/engineering-judgment.en.md#what-copilot-actually-said)
explain those excerpts. Original model quotes remain English on both language
pages; the surrounding explanation is translated.

Only selected final-answer text and code differences are published, not full
raw transcripts or complete candidate files. Private prompts, credentials and
raw sessions remain unpublished.

## Conclusion boundaries

- Reliability scripts following a fixed policy are not Copilot autonomously choosing rollback.
- The model naming a configuration cause does not fix a wrong `classification` field.
- Green behavior is not complete experimental acceptance; two classification failures remain.
- One trial per small synthetic case does not establish statistical strategy superiority.
- Functional acceptance and isolated experiment results are not production certification.
