# Demo documentation

[中文](README.md)

This repository holds actual cases: the requirement, decisions, checks and
delivered outcome. Reusable methods, configuration and operator references live
in the [guide repository](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/README.en.md);
they are not duplicated here. Chinese and English have separate pages, with a
language switch at the top.
Commands, code, original screenshots and frozen delivery evidence remain
unchanged by translation.

## Start here

1. **Understand the result:** [ticket ownership case study](cases/ownership.en.md).
   Then follow the [database-readiness maintenance delivery](cases/readiness.en.md).
2. **Present it:** [presentation route](presenter.en.md).
3. **Check scope and progress:** [case index](cases/README.en.md).
   For the new topics, use [release reliability](cases/reliability.en.md),
   [diagnosis and strategy](cases/engineering-judgment.en.md), and the
   [pending change-impact proposal](cases/change-impact.en.md).
4. **Inspect original records:**
   [Intent](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1) ·
   [Tests PR](https://github.com/huangyingting/ai-native-sdlc-demo/pull/8) ·
   [Implementation PR](https://github.com/huangyingting/ai-native-sdlc-demo/pull/9) ·
   [Acceptance](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6119642416).

## Current scope

Ticket ownership is accepted, with 38 passing tests and verification of the
published image by its exact digest. Database readiness is also accepted: all
47 current tests pass, and the exact published digest passed isolated fault,
recovery and real business-journey checks. Release reliability now has two
passing isolated rehearsals, with maintenance review pending. Diagnosis and
strategy evaluation completed six real cells: six repairs verified, four
fully accepted, with both wrong environment classifications preserved.
The change-impact proposal is reviewed but awaits explicit operator approval;
no proxy implementation has occurred. These experiments are not production
certification or automatic feature acceptance.

## Files and evidence

- [cases/](cases/README.en.md): case narratives and progress.
- [cases/assets/ownership/](cases/assets/ownership/manifest.json): 14 original screenshots with source, time and hashes.
- [cases/assets/readiness/](cases/assets/readiness/manifest.json): 21 readiness screenshots with distinct baseline and delivered-image identities.
- [cases/assets/reliability/](cases/assets/reliability/manifest.json): original results screenshot, qualification summary and two independently recorded runtime rehearsals.
- [cases/assets/engineering/](cases/assets/engineering/manifest.json): original strategy/proposal records and sanitized six-cell metrics; no raw prompts or generated candidate source.
- [delivery-runs/](delivery-runs/brownfield-human-gated-delivery/1/spec.md):
  workflow-managed specifications, plans and review artifacts, unchanged by reorganization or translation.

Temporary verification resources have been cleaned up. Localhost addresses in
screenshots are not public deployments. To run the application, use the
[application guide](../demos/it-service-desk/README.en.md).
To start another complete delivery, follow the
[operator walkthrough](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/brownfield-human-gated-delivery-walkthrough.en.md).
