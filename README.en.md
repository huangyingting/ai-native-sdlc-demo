# AI-native software delivery: from request to working software

[中文](README.md)

Follow a service-desk application from a business request through product
decisions, reviewed specifications, tests, implementation, deployment and
operation. Each case links to the work actually performed in this repository.

## Start here

- **[What Copilot actually does](docs/copilot-roles.en.md)**: distinguish bot-authored delivery PRs, CLI experiments, verification and operator-account comments.
- **[Demo documentation](docs/README.en.md)**: cases, presentation route and evidence.
- **[Presentation route](docs/presenter.en.md)**: a 30-minute tour of the completed ownership delivery.
- **[Ticket ownership, end to end](docs/cases/ownership.en.md)**: the illustrated case study.
- **[Database readiness](docs/cases/readiness.en.md)**: batch decisions, controlled Red, a read probe and exact-image acceptance.
- **[Release reliability](docs/cases/reliability.en.md)**: two isolated admission, fallback and recovery rehearsals.
- **[Diagnosis and strategy](docs/cases/engineering-judgment.en.md)**: six real cells, preserved classification failures and measured cost.
- **[Change impact](docs/cases/change-impact.en.md)**: reviewed proxy-owner proposal, isolated implementation, 15 unchanged tests and 35 independent checks.
- **[Application](demos/it-service-desk/README.en.md)**: local installation and application commands.
- **[Delivery commands](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/brownfield-human-gated-delivery.en.md)**:
  document review, pull-request checks and image acceptance.

Reusable guides live in the [source repository](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/README.en.md);
this repository keeps demonstration narratives, screenshots and delivery records,
not duplicate guide copies.

## Cases

| Case | Business or engineering question | Copilot's role | Status |
|---|---|---|---|
| Ticket ownership | Who is responsible, and how do we hand over a ticket? | Coding Agent implementation [PR #9](https://github.com/huangyingting/ai-native-sdlc-demo/pull/9) | [Accepted](https://github.com/huangyingting/ai-native-sdlc-demo/issues/1#issuecomment-6119642416) |
| Database readiness | Can we distinguish a live process from an unreadable ticket database? | Coding Agent implementation [PR #26](https://github.com/huangyingting/ai-native-sdlc-demo/pull/26) | [Accepted](https://github.com/huangyingting/ai-native-sdlc-demo/issues/18#issuecomment-6133959987) |
| [Release reliability](docs/cases/reliability.en.md) | Can we detect a bad candidate, recover service and prevent recurrence? | Deterministic rehearsal of the delivered image; no new CLI repair call | Two development-test rehearsals passed; maintenance review pending |
| [Change impact](docs/cases/change-impact.en.md) | How can we add a proxy owner without changing the accountable owner? | CLI generates an impact proposal and isolated candidate | Delegated operator review; isolated candidate passes 15 tests + 35 checks |
| [Failure diagnosis](docs/cases/engineering-judgment.en.md) | Is a failure caused by product code, a test or configuration? | CLI generates classification, rationale and repair text | Six repairs verified; two environment classifications rejected |
| [Agent strategy evaluation](docs/cases/engineering-judgment.en.md) | Does a separate diagnosis step improve results enough to justify its cost? | Compare one-call versus two-call CLI strategies | Six cells / nine calls measured; 4/6 full acceptance, no general ranking |

The first two cases form the customer delivery mainline. The remaining cases
are engineering appendices, not additional Coding Agent product PRs. Their
Issue comments were published by the assistant through the authorized
`huangyingting` account; that login is not proof of model authorship or personal human review.

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
tests Green. Two bounded release-reliability rehearsals and the diagnosis/strategy
experiment now have actual evidence. The proxy impact experiment also passed
after delegated local review; its isolated candidate does not change the
repository baseline. Maintenance review remains pending. A ready response does not guarantee full
application availability or production traffic admission. A measured experiment
or reviewed proposal is not an accepted feature delivery.

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
