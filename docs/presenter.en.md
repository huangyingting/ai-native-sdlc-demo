# Presentation route

[中文](presenter.md) · [Documentation](README.en.md) · [Illustrated case](cases/ownership.en.md)

## Prepare

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
| 19–23 min | [Implementation](https://github.com/huangyingting/ai-native-sdlc-demo/pull/9) | All 38 tests pass, with frozen files unchanged. Product code satisfies the reviewed contract. |
| 23–27 min | [Failed publication](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38215333786/attempts/2), [recovery](https://github.com/huangyingting/ai-native-sdlc-demo/actions/runs/38215333786/attempts/3) | Package access required operator intervention; a successful build is not a completed delivery. |
| 27–30 min | [Persistence](cases/assets/ownership/restart-persistence.png), [acceptance](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6119642416) | Verify the actual image before explicit acceptance. Publication, verification and acceptance are separate events. |

## Keep the boundaries clear

- The assistant ran browser checks; the user confirmed product decisions, stage approvals and acceptance.
- This is functional acceptance, not production certification; eight baseline dependency advisories remain.
- Readiness, recovery and engineering experiments retain their actual status in the [case index](cases/README.en.md).
  Historical exercises do not establish completion of this repository's planned cases.
- Screenshots show capture-time state. Check source revision, run, attempt and image digest in the original records;
  a screenshot is not a substitute for version-bound evidence.

For deeper method questions, use the
[AI-native SDLC guide](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/ai-native-sdlc/README.en.md).
Do not edit approved specifications or resubmit acceptance commands during a presentation.

## Optional engineering extension: 15 minutes

Keep the ownership walkthrough unchanged; add these topics only when the audience
wants operational and engineering judgment. All pages are read-only records.

| Time | Show | Explain |
|---|---|---|
| 0–5 min | [Reliability observations](cases/reliability.en.md) | Two fresh-volume runs, six mutation kills, one fallback per incident, and a preserved candidate write. Recovery is not maintenance approval or an SLO. |
| 5–11 min | [Diagnosis and strategy table](cases/engineering-judgment.en.md) | Six repairs, four full passes: both strategies misclassify configuration. Compare nine actual calls and measured usage without a general ranking. |
| 11–15 min | [Exact-hash proxy proposal](cases/change-impact.en.md) | Accountable versus effective owner affects domain, storage, API and contract. Stop at the explicit pending approval; do not imply implementation. |

No new model request, fault injection or approval is needed to present the
recorded scenarios. Maintenance review and proxy implementation remain separate gates.
