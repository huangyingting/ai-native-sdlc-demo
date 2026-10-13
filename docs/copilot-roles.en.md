# What Copilot does in these demonstrations

[中文](copilot-roles.md) · [Documentation](README.en.md) · [Presentation route](presenter.en.md)

## Start with two different kinds of evidence

The customer-facing delivery mainline and the controlled engineering experiments
are **not the same workflow**. A results comment under the operator's name is
not a Copilot-authored implementation PR.

| Demonstration | Purpose | Copilot's actual contribution | Best evidence |
|---|---|---|---|
| [Ticket ownership](cases/ownership.en.md) | Deliver responsibility and handoffs without breaking existing work | Coding Agent writes implementation and opens a PR | [PR #9](https://github.com/huangyingting/ai-native-sdlc-demo/pull/9), author `app/copilot-swe-agent`, diff, CI and image acceptance |
| [Database readiness](cases/readiness.en.md) | Turn an observed database gap into a reviewed, accepted change | Coding Agent implements the approved readiness contract | [PR #26](https://github.com/huangyingting/ai-native-sdlc-demo/pull/26), same bot author, frozen tests and exact-image verification |
| [Release reliability](cases/reliability.en.md) | Verify admission, failure detection, fallback and data preservation | Uses the previously delivered image; **no new CLI diagnosis or repair call** in this rehearsal | Deterministic qualification and two runtime observations, not an autonomous AI repair |
| [Proxy-owner impact](cases/change-impact.en.md) | Identify compatibility surfaces, then implement a bounded candidate | CLI generates the impact proposal and candidate source in two calls | Reviewed output excerpts, selected code difference and independent 15+35 checks |
| [Diagnosis and strategy](cases/engineering-judgment.en.md) | Compare fault classification, repair and the cost of an extra diagnosis step | CLI generates diagnoses and repair candidates in nine calls | Actual rationale/classification excerpts, selected patches and all six cell outcomes |

Lead a customer presentation with the first two rows. Use the remaining rows
as engineering appendices, not more examples of a bot opening product PRs.

## Who does what?

| Actor | Responsibility | Do not confuse it with |
|---|---|---|
| GitHub Copilot Coding Agent | Authors implementation PRs under `app/copilot-swe-agent` | A user-authored documentation PR |
| Copilot CLI | Produces structured proposal, rationale, classification and candidate text | An autonomous GitHub contributor in these restricted experiments |
| AI assistant using Copilot SDK in VS Code | Orchestrates the experiment, reviews outputs, records delegated local decisions and publishes reviewed summaries using the authorized account | An independent human reviewer or a separate bot identity |
| GitHub Actions / trusted verification harness | Executes checks, applies allowlisted candidates, runs restricted Docker and records outcomes | Copilot grading its own proposed repair |
| User / configured reviewer | Authorizes decisions and records explicit delivery approvals and acceptance | Every comment displaying the user's login |

The local receipt label `copilot-operator` is a label, **not an authenticated
GitHub Copilot account**. Its recorded `independentHumanReview: false` remains
false; it must not be presented as independent Human acceptance.

## Why do Issues show huangyingting comments?

The comments in ordinary experiment records
[#28](https://github.com/huangyingting/ai-native-sdlc-demo/issues/28),
[#29](https://github.com/huangyingting/ai-native-sdlc-demo/issues/29) and
[#30](https://github.com/huangyingting/ai-native-sdlc-demo/issues/30)
were published by the assistant using the user's authorized GitHub credentials.
The visible login identifies the publishing account, not necessarily the
person or model that produced the content.

These CLI calls deliberately verified zero available tools and zero tool
requests. The CLI could not edit the repository, comment on GitHub, open a PR
or approve itself. The operator's summaries are not Coding Agent comments.
Likewise, [PR #31](https://github.com/huangyingting/ai-native-sdlc-demo/pull/31)
and [PR #32](https://github.com/huangyingting/ai-native-sdlc-demo/pull/32) publish
documentation and evidence under `huangyingting`; they are not the model's
implementation PRs.

## The two actual execution chains

```text
Delivery mainline:
  user decisions and approvals → Coding Agent implementation PR
    → Actions checks → actual published image → explicit user acceptance

Restricted experiment:
  fixed synthetic input → Copilot CLI proposal / diagnosis / candidate text
    → trusted allowlisted adapter → Docker tests + independent checks
    → assistant-reviewed summary published through the operator account
```

The engineering baseline is deliberately unchanged. A verified isolated proxy
candidate does not mean proxy ownership was deployed into the service desk.

## Show the work, not just the usage totals

For a CLI experiment, show these four items in order:

1. **Input:** the fixed request and relevant supplied faulty or baseline code.
2. **Model output:** an actual rationale or classification, not a retelling.
3. **Candidate difference:** a reviewed excerpt of the code it proposed.
4. **Independent outcome:** scope, test preservation, behavioral checks and classification gate.

The [reviewed excerpt record](cases/assets/engineering/copilot-excerpts.json)
contains selected exact final-answer text and one-line differences, tied to the
response hashes already present in the measured summaries. The
[impact case](cases/change-impact.en.md#what-copilot-actually-produced) and
[diagnosis case](cases/engineering-judgment.en.md#what-copilot-actually-said)
explain those excerpts. Original model quotes remain English on both language
pages; the surrounding explanation is translated.

These selections were reviewed by the assistant, not independently authenticated
by a human. They are **not full raw transcripts or complete candidate files**.
Private/system prompts, credentials, raw sessions and full candidate payloads
remain unpublished. Preparing this documentation added no experiment calls
and did not alter or rerun a failed cell.

## What the presenter must not claim

- Reliability scripts following a fixed policy are not Copilot autonomously choosing rollback.
- The model naming a configuration cause does not fix a wrong `classification` field.
- Green behavior is not complete experimental acceptance; two classification failures remain.
- CLI usage totals and hashes alone do not explain the model's reasoning.
- An operator-account comment is not proof of Copilot authorship or personal human review.
- No bot identity, independent approval, deployment or production certification is invented.
