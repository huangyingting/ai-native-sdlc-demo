# AI-native software delivery: from request to working software

[中文](README.md)

Follow a service-desk application from a business request through product
decisions, reviewed specifications, tests, implementation, deployment and
operation. Each case links to the work actually performed in this repository.

## Start here

- **[Demo documentation](docs/README.en.md)**: cases, presentation route and evidence.
- **[Presentation route](docs/presenter.en.md)**: a 30-minute tour of the completed ownership delivery.
- **[Ticket ownership, end to end](docs/cases/ownership.en.md)**: the illustrated case study.
- **[Database readiness](docs/cases/readiness.en.md)**: batch decisions, controlled Red, a read probe and exact-image acceptance.
- **[Application](demos/it-service-desk/README.en.md)**: local installation and application commands.
- **[Delivery commands](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/brownfield-human-gated-delivery.en.md)**:
  document review, pull-request checks and image acceptance.

Reusable guides live in the [source repository](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/README.en.md);
this repository keeps demonstration narratives, screenshots and delivery records,
not duplicate guide copies.

## Cases

| Case | Business or engineering question | Status |
|---|---|---|
| Ticket ownership | Who is responsible, and how do we hand over a ticket? | [Accepted](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6119642416) |
| Database readiness | Can we distinguish a live process from an unreadable ticket database? | [Accepted](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6133959987) |
| Release reliability | Can we detect a bad candidate, recover service and prevent recurrence? | Not started |
| Change impact | How can we add a proxy owner without changing the accountable owner? | Not started |
| Failure diagnosis | Is a failure caused by product code, a test or configuration? | Not started |
| Agent strategy evaluation | Does a separate diagnosis step improve results enough to justify its cost? | Not started |

## How work moves forward

```text
Intent → product decisions → approved Spec → approved Plan
       → reviewed tests → reviewed implementation → verified image
       → user acceptance → operational follow-up
```

AI proposes documents and code. GitHub Actions executes checks and preserves
versioned records. Product decisions and version-specific approvals require
authorization from the configured reviewer, `huangyingting`. A successful
generation job is not an approval.

The initial service-desk baseline had no ticket ownership; the first delivery
now includes it and has been accepted. The engineering application still has
no proxy ownership. Database readiness is also accepted, with all 47 current
tests Green; release reliability is still pending, and a ready response does
not guarantee full application availability or production traffic admission.
Screenshots and measured results are added as work
completes; a planned case is not a completed delivery.

## Validation

Use Node.js 24. Run repository automation and the independent engineering
fixture from the root:

```sh
npm test
npm --prefix demos/engineering-lab test
```

For the service desk:

```sh
cd demos/it-service-desk
npm ci
npm test
npm run lint
npm run build
```

Each application owns its dependencies and lockfile. Do not install demo
dependencies at the repository root.

## Source and reference material

The implementation and workflow baseline comes from
[`huangyingting/ai-native-sdlc` at `b30e6bc3a693f674d48f1a9f76952176214eae9e`](https://github.com/huangyingting/ai-native-sdlc/tree/b30e6bc3a693f674d48f1a9f76952176214eae9e).
The [export record](brownfield-demo-provenance.json) identifies that baseline.
Toolkit guides and source case reports are supporting references, not results
of this repository's delivery. Use the [case index](docs/cases/README.en.md) for
this repository's evidence.
