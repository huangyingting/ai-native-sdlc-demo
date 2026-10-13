# Presentation route

[中文](presenter.md) · [Documentation](README.en.md) · [Illustrated case](cases/ownership.en.md)

## Prepare

Read [who did what](copilot-roles.en.md) first. Point to the actual
`app/copilot-swe-agent` author on [PR #9](https://github.com/huangyingting/ai-native-sdlc-demo/pull/9)
or [PR #26](https://github.com/huangyingting/ai-native-sdlc-demo/pull/26), then show
its code diff and Actions checks. The appendix Issues use the operator's account;
they are summaries, not bot-authored implementation PRs.

Open the case study and the GitHub pages below. This is a read-only
presentation: no new model calls, comments, approvals or workflow runs are
required. The repository stores 14 screenshots for Markdown previews.
For a live application session, prepare an isolated instance in advance;
recorded localhost addresses are not public deployments.

## A 30-minute walkthrough

| Time | Show | Explain |
|---|---|---|
| 0–4 min | [Handoff](cases/assets/ownership/owner-handoff.png), [filtering](cases/assets/ownership/owner-filter.png) | Start with the user outcome: who owns a ticket, how responsibility transfers and how to find assigned work. |
| 4–9 min | [Intent and decisions](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6117980837) | AI identifies ambiguity; the user decides. The fixed roster is Alex Chen and Sam Rivera. |
| 9–13 min | [Spec approval](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6118027964), [Plan approval](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6118095114) | Separate agreement on behavior from approval of implementation planning. |
| 13–19 min | [Second test review](https://github.com/huangyingting/ai-native-sdlc-demo/pull/8#pullrequestreview-5486915007), [final Red](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38210170335/attempts/2) | A passing CI gate does not prove sound tests. After correction: 29 pass, nine expected failures. Review assertions, not just a green check. |
| 19–23 min | [Implementation](https://github.com/huangyingting/ai-native-sdlc-demo/pull/9) | Show Copilot's `app/copilot-swe-agent` authorship and code diff, then the independently executed 38 Green tests and unchanged frozen files. |
| 23–27 min | [Failed publication](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38215333786/attempts/2), [recovery](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38215333786/attempts/3) | Package access required operator intervention; a successful build is not a completed delivery. |
| 27–30 min | [Persistence](cases/assets/ownership/restart-persistence.png), [acceptance](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6119642416) | Verify the actual image before explicit acceptance. Publication, verification and acceptance are separate events. |

## Keep the boundaries clear

- The assistant ran browser checks; the user confirmed product decisions, stage approvals and acceptance.
- This is functional acceptance, not production certification; eight baseline dependency advisories remain.
- Readiness, recovery and engineering experiments retain their actual status in the [case index](cases/README.en.md).
  Historical exercises do not establish completion of this repository's planned cases.
- Screenshots show capture-time state. Check source revision, run, attempt and image digest in the original records;
  a screenshot is not a substitute for version-bound evidence.
- Operator-account comments may have been authored/published by the assistant under authorization. They do not establish Copilot bot identity or personal human review; a local delegated receipt is not independent Human acceptance.

For deeper method questions, use the
[AI-native SDLC guide](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/ai-native-sdlc/README.en.md).
Do not edit approved specifications or resubmit acceptance commands during a presentation.

## Optional engineering extension: 15 minutes

Keep the ownership walkthrough unchanged; add these topics only when the audience
wants operational and engineering judgment. All pages are read-only records.

| Time | Show | Explain |
|---|---|---|
| 0–5 min | [Reliability observations](cases/reliability.en.md) | Fixed-policy scripts, not an AI rollback decision: two runs, six mutation kills, preserved writes. No new CLI diagnosis/repair calls; no SLO or maintenance approval. |
| 5–11 min | [Actual diagnosis output](cases/engineering-judgment.en.md#what-copilot-actually-said), then the results table | Show request, exact model rationale/classification, one-line patch and independent result. The runtime cause is identified, but the label is wrong. Then compare nine-call usage. |
| 11–15 min | [Actual proxy output and difference](cases/change-impact.en.md#what-copilot-actually-produced) | Show migration proposal and proxy-first code difference, then independent 15+35 checks. The candidate is isolated, not a Coding Agent PR or deployed feature. |

No new model request, fault injection or approval is needed to present the
recorded scenarios. Maintenance review remains pending; the verified proxy
candidate is not a deployed feature or production authorization.
