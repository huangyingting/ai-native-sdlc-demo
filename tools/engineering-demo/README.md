# Engineering judgment demo toolkit

Dependency-free Node.js 24 tooling for three connected demonstrations:

1. Change-impact analysis, explicit proposal review and compatible implementation.
2. Evidence-based diagnosis of product, test-harness and environment failures.
3. A fixed-case comparison of direct versus diagnosis-first Copilot proposals.

Start with the [step-by-step guide](../../docs/engineering-judgment-demos.md).
The independent synthetic app is under
[`demos/engineering-lab`](../../demos/engineering-lab/). It is not the accepted
IT service desk and does not alter any earlier lifecycle evidence.

```sh
npm run demo:engineering -- --help
npm run test:engineering-demo
```

Offline tests do not call Copilot. The real commands explicitly call the
installed authenticated CLI and consume its usage allowance. They do not
change the configured model; results record the observed CLI model and units.

## Boundaries

- Only committed synthetic fixture files and measured test output go into
  prompts. The trusted acceptance oracle and fault labels are not sent.
- Copilot has no available file, shell, network or GitHub tools. It returns
  structured candidate text; an allowlisted adapter applies file changes.
  The adapter explicitly excludes the verified CLI tool set and requires
  structured telemetry reporting zero available tools and zero tool requests.
  An empty `--available-tools=` argument is **not** sufficient for the tested
  CLI. Missing or changed telemetry is an error, not presumed isolation.
- Responses are extracted losslessly from structured CLI events. Plain terminal
  rendering can wrap JSON strings; the adapter never guesses how to repair it.
- Generated code is run only inside a non-root, read-only, network-disabled,
  resource-limited Docker container with a disposable writable temporary area.
  This is defense in depth for an authorized experiment, not a security
  certification or protection against every container escape.
- Each strategy/case receives fresh identical source and fault input, identical
  verification and at most two 120-second calls. Direct uses one call;
  diagnosis-first uses two. No automatic retry or human patch repairs a cell.
  The execution deadline covers sandbox setup and candidate execution; bounded
  cleanup is separately accounted for and must finish before success is reported.
- Candidate failure and false completion claims remain results. A completed
  benchmark is not necessarily a successful repair.
- Missing usage is null, not zero. Premium-request and nano-AIU fields are
  raw CLI-reported units, not invoiced dollars. No price table is guessed.
- Explicit approval is bound to the proposal and fixture hash. It is a local
  operator receipt, not GitHub authentication or independent Human acceptance.
- No remote repository writes, commits, workflow dispatch, issue creation or
  approval occur inside this toolkit.

Private raw prompts, responses and executions stay under the new external
experiment directory. Review before publishing. The public summary contains
measured results and hashes, not source payloads or raw error output.
