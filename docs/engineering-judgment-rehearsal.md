# Engineering Judgment: Actual Rehearsal Evidence

This report records the development-test rehearsal of the
[three engineering judgment demos](engineering-judgment-demos.md). It keeps
tooling failures separate from evaluated Agent outcomes.

## Fixed input

- Source fixture commit:
  `540cacd2a10be5ed326479fd959d21eec5d4997c`.
- Executed orchestration revision:
  `f6f26f9b4bfdb79f4fadd93617f1049a2b41d709`.
- Exported fixture SHA-256:
  `57dc5e092135fe4e55c34fc094302c24cbb254050d9729c844939dc8dcd11f5f`.
- Runtime:
  `node@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6`.
- Copilot CLI: `1.0.89-3`; observed default model: `gpt-5.6-sol`.
- Baseline: 15 visible tests; diagnosis oracle: 20 checks; impact oracle:
  35 checks including actual additive legacy SQLite migration.

The first real restricted-Docker control passed all 15 visible tests and all
20 diagnosis-oracle checks. Every created control container was removed.
No accepted service-desk image, data volume or application source was reused
as the synthetic experiment workspace.

## Failures found before accepted trials

### Plain CLI rendering is not a JSON transport

The first real impact proposal call consumed one observed premium-request
unit but was rejected as `invalid-response`. Plain terminal rendering inserted
literal line breaks inside JSON strings. Exit zero from the CLI did not make
the response valid.

Its private call evidence recorded:

| Input tokens | Output tokens | Cache-read tokens | Cache-write tokens | Nano-AIU | Wall time |
|---:|---:|---:|---:|---:|---:|
| 16,514 | 2,014 | 0 | 16,511 | 12,284,700,000 | 37,762 ms |

That attempt was not repaired in place, approved, executed, or counted as a
successful proposal. The adapter was changed to extract exact assistant
content from structured JSONL events, without heuristic newline correction.
The proposal prompt was also clarified: source quotations must be exact
contiguous excerpts, with reasoning kept in a separate field.

### An empty tool allowlist did not mean zero tools

Structured preflight telemetry exposed a second problem:

| CLI configuration tested | Observed tools |
|---|---:|
| Empty `--available-tools=` | 19 |
| Include `bash` and exclude `bash` simultaneously | 1 |
| Explicitly exclude all 19 observed tools, without an allowlist | 0 |

The successful empty-tool-set probe also showed an empty assistant
`toolRequests` array. The adapter now rejects responses without observed
zero-tool telemetry, or with tool requests/execution events. This is an
explicitly qualified CLI configuration, not an assumption that any future
CLI version interprets empty flags the same way.

The earlier plain-output attempt cannot establish this zero-tool guarantee
and is excluded from accepted evaluation. Raw CLI events contain private
session metadata and are not published.

Four real qualification calls were made in total: the initial simple CLI
preflight, lossless JSONL transport, include/exclude precedence and explicit
tool exclusion. Together they used 32,579 input tokens, 41 output tokens,
four reported premium-request units and 16,370,300,000 nano-AIU. Together
with the rejected impact attempt, setup overhead was five calls/units,
49,093 input tokens, 2,055 output tokens and 28,655,000,000 nano-AIU.
These costs are disclosed separately rather than omitted from the rehearsal.

### Review corrections

A code review identified three further correctness defects, addressed with
targeted regression tests:

1. Docker setup operations had fresh timeouts and could start a candidate
   after the cell execution deadline. Setup and execution now share a deadline;
   bounded cleanup is accounted separately.
2. Failed paid calls dropped available usage telemetry from aggregate reports.
   Failure metrics are now retained rather than replaced by unknown values.
3. Docker infrastructure failures were counted as completed failed trials.
   They now abort with exit 1, preserve the attempted cell and distinguish
   unexecuted trials from evaluated candidates.

The fixed synthetic source was not changed to hide any of these failures.

### Impact coverage is not the same as allowed edit paths

One subsequent attempt was blocked before any CLI process was spawned while
tool-isolation qualification was being integrated; it incurred no model request.

The first zero-tool, lossless proposal then supplied **17 exact source
quotations**. It correctly cited multiple responsibilities in individual files
and unchanged CLI/test consumers. The original validator incorrectly demanded
exactly one entry per required edit surface and rejected this useful analysis.

This was a harness defect, not fabricated model evidence. The validator now
allows distinct quotations from any supplied source file, still requires every
mandatory domain/storage/API/documentation surface, and rejects duplicated
quotations, unknown files and inexact excerpts. Implementation edit paths remain
unchanged and restricted to four files. The rejected report and original
response remain intact; the corrected validator also accepts that original
response without modifying it.

That model call recorded 7,173 input tokens, 3,316 output tokens,
10,218,200,000 nano-AIU, one premium-request unit and 47,499 ms wall time.
Including it, pre-acceptance overhead is six actual calls/units, 56,266 input
tokens, 5,371 output tokens and 38,873,200,000 nano-AIU. The pre-spawn blocked
attempt is not counted as a model call.

## Completed change-impact loop

The fresh fourth impact attempt completed the full loop:

1. Copilot produced 20 verified source quotations, decisions, Spec, objective
   acceptance criteria and a seven-step implementation plan.
2. The authorized development-test operator reviewed accountability, proxy
   precedence, filtering, migration, invalid input, API compatibility and
   unchanged consumers, then approved the exact proposal hash.
3. A second real, tool-free Copilot call proposed the four allowed files.
4. Restricted Docker execution passed **15 unchanged visible tests and all
   35 independent checks**, including real old-schema migration, data
   preservation, assignment/clearing, validation and reopen persistence.
5. Contract documentation was updated, only the four allowed files changed,
   and every new verification container was removed.

| Measurement | Proposal | Implementation |
|---|---:|---:|
| Actual requests / premium-request units | 1 | 1 |
| Input tokens | 7,196 | 9,579 |
| Output tokens | 2,758 | 2,323 |
| Cache-read tokens | 0 | 0 |
| Cache-write tokens | 7,193 | 9,576 |
| Nano-AIU | 9,113,700,000 | 9,435,200,000 |
| Call wall time | 36,670 ms | 33,609 ms |
| Verified zero-tool telemetry | yes | yes |

The two accepted calls total 16,775 input tokens, 5,081 output tokens and
18,548,900,000 nano-AIU. Dollar cost is unavailable, not zero.

Evidence identities:

- Approved proposal digest, canonical JSON:
  `42403b22398e17d836a58bb26d51f0da34f59e64c2f1a471421928930b9fd5e0`.
- Proposal file SHA-256:
  `08278deb9cd0aae3640a522e2ebb532b6e8d45648f3bb4fd3ed1505060f49e2d`.
- Approval file SHA-256:
  `7bdbda6cc36f9cc5abfaab33dfe70387040a8f0c020f52912d3b94387f8f4d45`.
- Final impact report SHA-256:
  `afd24d752a138118264bdfff07bf95a24eaf2e2f9168d3943eaed39087e74b6c`.
- Verified candidate tree SHA-256:
  `4c19563a4270ae815027cc8ed966b5f83afbdc446a9d0deaaf2819f5cdc4b9af`.

The proposal digest deliberately differs from the pretty-printed file hash.
The operator receipt explicitly records `independentHumanReview:false`.
This is not independent Human acceptance. The proxy implementation remains
in isolated evidence output; the committed baseline intentionally remains
proxy-free for repeatable demonstrations.

## Completed diagnosis and strategy pilot

All six cells and all nine planned calls ran once, in alternating strategy
order, without model retries or human patches. Every call reported
`gpt-5.6-sol` and verified zero available tools. The benchmark finished with
`completed-with-failures`, exit **2**, not a successful acceptance result.

| Case | Strategy | Real Red failures / 15 | Green / independent oracle | Classification / scope | Exact evidence gate | Cell wall time |
|---|---|---:|---|---|---|---:|
| Product filter | Direct | 5 | 15/15 and 20/20 | correct / preserved | rejected | 30,280 ms |
| Product filter | Diagnose-first | 5 | 15/15 and 20/20 | correct / preserved | rejected | 60,757 ms |
| Test expectation | Diagnose-first | 1 | 15/15 and 20/20 | correct / preserved | rejected | 51,627 ms |
| Test expectation | Direct | 1 | 15/15 and 20/20 | correct / preserved | rejected | 38,517 ms |
| Invalid environment | Direct | 2 | 15/15 and 20/20 | correct / preserved | rejected | 23,068 ms |
| Invalid environment | Diagnose-first | 2 | 15/15 and 20/20 | correct / preserved | rejected | 42,756 ms |

**Functional repairs: 6/6 verified. Full evidence-based acceptance: 0/6.**
Every candidate restored the exact baseline tree hash
`57dc5e092135fe4e55c34fc094302c24cbb254050d9729c844939dc8dcd11f5f`.
Product/environment repairs preserved all tests; the harness repair restored
the deliberately corrupted assertion to its exact original version.

The failures were in evidence representation, not failed repairs:

- Contract quotations omitted or normalized Markdown punctuation/newlines, so
  they were not exact contiguous source excerpts.
- Diagnostic outputs used names such as `Actual failing test output` rather
  than the validator's `test-output` identifier. The original prompt did not
  state that reserved identifier clearly enough.

The prompt now explicitly states the allowed citation paths, reserved output
identifier, 1-to-8-entry limit, 5-to-500-character bounds and exact formatting
requirements. Those changes have offline regression coverage. **This pilot was
not rerun after the clarification**, so it does not establish a new evidence
acceptance rate or support blaming the model for an underspecified protocol.
The original failed reports remain unchanged.

The executed report also used `falseCompletionClaims` too broadly: its
three claims per strategy meant failed overall acceptance, even though all
claimed code repairs passed independent verification. Those are **not six
false repair claims**. Current tooling separates `repairsVerified`,
`evidenceAccepted`, `unacceptedCompletionClaims` and actual failed-repair
`falseCompletionClaims`; an end-to-end injected matrix regression verifies
that evidence rejection cannot relabel a valid repair as a false one.

| Measured strategy totals | Direct | Diagnose-first |
|---|---:|---:|
| Cells / independently verified repairs | 3 / 3 | 3 / 3 |
| Full acceptance | 0 / 3 | 0 / 3 |
| Actual calls / premium-request units | 3 | 6 |
| Input tokens | 24,591 | 50,262 |
| Output tokens | 1,136 | 2,449 |
| Cache-read tokens | 0 | 0 |
| Cache-write tokens | 24,582 | 50,244 |
| Nano-AIU | 14,566,600,000 | 30,027,200,000 |
| Summed cell wall time | 91,865 ms | 155,140 ms |
| Human repair interventions | 0 | 0 |

Diagnose-first consumed more calls, tokens and time in this pilot without
changing the measured repair or acceptance outcomes. This does not establish
a general strategy ranking. In particular, the evidence protocol ambiguity
limits interpretation of the acceptance metric.

- Benchmark report SHA-256:
  `624abc4e025cf66729c39f2dd07e2b2f7db8e5285f540b120e6ed66777cf1930`.
- Actual interval: `2026-09-28T09:16:14.259Z` through
  `2026-09-28T09:20:52.179Z`.
- No infrastructure failures, skipped cells, automatic retries or unresolved
  sandbox containers occurred.

Across qualification, rejected attempts, accepted impact work and the complete
pilot, there were **17 actual model requests**, 147,894 input tokens, 14,037
output tokens, 17 reported premium-request units and 102,015,900,000 nano-AIU.
Dollar cost remains unknown. The pre-spawn blocked attempt consumed no request.

## Interpretation and preservation

Private evidence remains in new external experiment directories: original
prompts, raw CLI events, usage files, candidate files, test executions,
approval receipts and reports. Failed attempts are not overwritten. Published
summaries contain only reviewed measurements and hashes.

The benchmark uses one sample per case and strategy. Results are illustrative,
not statistically significant. Measured premium-request units and nano-AIU
are not dollars, and cache tokens must not be added to total input twice.
Preflight, transport qualification and failed setup attempts are overhead,
not hidden inside a successful benchmark cell.

## Validation and application preservation

Complete source and synchronized discovery-demo validation passed:

- 186 automation tests, 26 trace-viewer tests, 174 existing toolkit tests and
  70 engineering-toolkit tests: **456 repository tests**.
- **15 independent engineering application tests**.
- No editor diagnostics in the changed orchestration or regression tests.

After all real trials, there were no remaining engineering sandbox containers.
The three previously accepted local applications still returned HTTP 200 on
their health endpoints. Their containers and volumes were not used for these
experiments.

Unchanged application Git trees:

- Source service desk: `ac82ccf290c576248a5d26d79a9b71a8aaa1830e`.
- Accepted discovery service desk: `8aed50dfacb527f3550b4a779514701383fa5bea`.

## Published source and protected demo update

- Source implementation and evidence publication:
  [`0074eea`](https://github.com/huangyingting/ai-native-sdlc/commit/0074eea32dcdb6bc80dc910db6c6a835db779c0a).
- Successful [source Repository CI](https://github.com/huangyingting/ai-native-sdlc/actions/runs/36403499096).
- Ordinary protected
  [discovery-demo PR #27](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/27),
  reviewed at exact head `1c5952f628e11717612b810d8978b7fb19642373`.
- [Authorized operator COMMENT review](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/pull/27#pullrequestreview-5336553560),
  explicitly not independent Human approval.
- Successful [demo Repository CI](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36403693809)
  and [application validation/container smoke](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36403693825).
- Normal protected merge:
  [`b225590`](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/commit/b225590fd0c6933c1f6b98b365db8781d11f4939),
  followed by successful
  [post-merge Repository CI](https://github.com/huangyingting/ai-native-sdlc-discovery-demo/actions/runs/36403957310).

The synchronized toolkit and fixture Git trees are identical in both
repositories: `16198dcc789d93c2510b4cf9b701e5d1828f7358` and
`89923e017d3a976dc7f4c703f7642a2af8c3c95a`, respectively. The discovery README
and walkthrough link this canonical report instead of duplicating it.
