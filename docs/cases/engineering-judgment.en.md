# Failure diagnosis and Agent strategy: repair is not the whole result

[中文](engineering-judgment.md) · [Case index](README.en.md) · [Proxy proposal](change-impact.en.md)

**Controlled CLI experiment, not a Coding Agent delivery.** The CLI generated
diagnoses and candidate text; the trusted harness applied and verified it.
See [demo goals and Copilot's role](../copilot-roles.en.md).

## Result and boundary

A real six-cell experiment completed with **six verified behavioral repairs
but only four fully accepted cells**. Both strategies misclassified a runtime
configuration fault as a product defect. The benchmark therefore returned
`completed-with-failures`, exit **2**, not an infrastructure failure or a
fully successful comparison.

These are two demonstrations sharing one controlled fixture: identifying the
failure class, and comparing direct repair with diagnosis-first repair.
[Original results](https://github.com/huangyingting/ai-native-sdlc-demo/issues/29)
and the [sanitized measured report](assets/engineering/summary.json) retain every cell.
No failed cell was retried or patched by a human.

![Original diagnosis and strategy results](assets/engineering/strategy-results.png)

[Screenshot provenance](assets/engineering/manifest.json) records its source,
capture time and unchanged image hash.

## Inputs and execution controls

The small [engineering fixture](../../demos/engineering-lab/README.en.md) is
independent of the service desk. Its synthetic owners are `avery` and `jordan`,
not Alex Chen / Sam Rivera.

| Input | Pinned observation |
|---|---|
| Fixture source | `0eb9973b3fb09d648ebeea21b64786a763fc3021` |
| Fixture hash | `4d25f387db0329a1add68680ebd2f52974ae58e5996ce0adb3e61b12c40f351d` |
| Sandbox image | `node@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6` |
| Observed sandbox runtime | Node 24.21.0, linux/amd64 |
| Observed CLI / model | Copilot 1.0.89 / `gpt-5.6-sol`, no model override |
| Visible control | 15/15 passing |
| Per-cell budget | At most two calls, 120 seconds per call, 300 seconds per cell |
| Real benchmark requests | Nine: three direct, six diagnosis-first |

Each call verified **zero available tools and zero tool requests**. The model
returns candidate text; an allowlisted adapter applies it. Generated code runs
only inside restricted Docker: non-root, no network, read-only workspace and
oracle, disposable temporary storage, resource and time limits. Candidate
source is never executed on the host. Every test/oracle sandbox was cleaned.

## Three fault classes

| Case | Deliberate fault | Correct class | Permitted repair surface |
|---|---|---|---|
| 1 | Owner/status filter uses OR instead of AND | Product | `src/domain.mjs` |
| 2 | A test expects the wrong synthetic owner | Test harness | `tests/domain.test.mjs` |
| 3 | Database path is beneath `/dev/null` | Environment | `runtime.json` |

The [fixed case definitions](../../tools/engineering-demo/cases.mjs) specify the
faults and scope before execution. Each strategy receives the same case input
hash; order alternates between cases. Direct repair uses one call.
Diagnosis-first uses one diagnosis call followed by one repair call.

```text
Same frozen case → direct diagnosis + patch → visible tests + independent oracle
Same frozen case → diagnosis → bounded patch → visible tests + independent oracle
                     classification + evidence + scope are separate gates
```

## What Copilot actually said

The fixed request was “Diagnose and correct observed CI failure without changing
unrelated behavior”, with the contract, faulty source and measured failing
tests supplied. These are actual direct-strategy excerpts, not a rerun or
rewritten successful explanation. Original model wording is preserved.

### Product filter

The input used OR where the contract required AND. Copilot returned
`classification: "product"` and this rationale:

> The product implementation combines independent owner and status predicates with OR, so a ticket is incorrectly accepted whenever either predicate passes—including when one filter is omitted. Replacing OR with AND implements the documented intersection semantics while preserving individual-filter and no-filter behavior.

```diff
-  return ownerMatches || statusMatches;
+  return ownerMatches && statusMatches;
```

The independent behavioral checks and classification gate both passed.

### Test-harness drift

Copilot returned `classification: "test-harness"`:

> The implementation returns the ticket's existing owner exactly as required by the documented contract. The failing test incorrectly expects 'jordan' for a ticket owned by 'avery', so the assertion must be restored to the contractually correct value without changing product behavior.

```diff
-  assert.equal(effectiveOwner(ticket), 'jordan');
+  assert.equal(effectiveOwner(ticket), 'avery');
```

This case deliberately allows repairing the faulty harness assertion, not
changing product behavior to satisfy a wrong test. Both gates passed.

### Runtime configuration: repair passes, label fails

Copilot returned `classification: "product"` even though the expected class
was `environment`. Its actual rationale correctly described the configuration:

> The checked-in runtime configuration violates the documented contract by pointing SQLite beneath /dev/null, which cannot contain a database file. Both CLI tests therefore fail while domain, API, and store behavior pass. Restoring the required in-memory database path fixes the root cause without changing code, tests, fallback behavior, or unrelated semantics.

```diff
-  "databasePath": "/dev/null/engineering-lab.db"
+  "databasePath": ":memory:"
```

This is not evidence that the model failed to locate the configuration cause.
The repair and explanation identify it, but the **classification field is
wrong**, so full acceptance fails. Diagnosis-first also returned the wrong
class; its result is retained in the six-cell report.

[Reviewed exact excerpts](assets/engineering/copilot-excerpts.json) contain
the source evidence and response hashes, matching the public measured
summary. These are selected final-answer fields and one-line differences,
not full raw sessions or complete candidate files.

## All six outcomes

| Case | Strategy | Initial passing / failing tests | Final visible / oracle | Reported class | Full acceptance |
|---|---|---:|---|---|---|
| Product filter | Direct | 10 / 5 | 15/15 + 20/20 | Product | Pass |
| Product filter | Diagnose-first | 10 / 5 | 15/15 + 20/20 | Product | Pass |
| Harness drift | Diagnose-first | 14 / 1 | 15/15 + 20/20 | Test harness | Pass |
| Harness drift | Direct | 14 / 1 | 15/15 + 20/20 | Test harness | Pass |
| Runtime path | Direct | 13 / 2 | 15/15 + 20/20 | Product, incorrectly | Fail |
| Runtime path | Diagnose-first | 13 / 2 | 15/15 + 20/20 | Product, incorrectly | Fail |

All six stayed within scope, preserved required tests and passed independent
behavioral checks. Evidence validation passed, but it does not override the
classification gate. There were **zero infrastructure failures**, **zero
behaviorally false completion claims**, and **two unaccepted completion claims**
because the runtime-path classification was wrong.

The last two are useful demonstrations: Green tests prove the bounded repair,
not a sound explanation. Do not rewrite them as successful diagnosis or hide
them because the application works afterward.

## Actual strategy cost

| Metric, summed over three cells | Direct | Diagnose-first |
|---|---:|---:|
| Fully accepted cells | 2/3 | 2/3 |
| Verified repairs | 3/3 | 3/3 |
| Calls | 3 | 6 |
| Cell wall time | 61,728 ms | 106,063 ms |
| Input tokens | 24,820 | 50,569 |
| Output tokens | 1,421 | 2,499 |
| Cache-read tokens | 0 | 0 |
| Cache-write tokens, input subset | 24,811 | 50,551 |
| Premium-request units | 3 | 6 |
| Nano-AIU | 15,251,100,000 | 30,280,700,000 |
| Inferred dollar cost | None | None |

Wall time is the sum of measured cell durations, not just API time.
Cache-write tokens are already part of input tokens; do not add them again.
CLI request units and nano-AIU are recorded usage, not a dollar invoice.

This pilot shows extra measured cost without an acceptance improvement **in
these three cases**. One trial per cell, a small synthetic task set and a single
observed model cannot establish general strategy superiority or statistical significance.

## Isolation failure retained separately

Before this benchmark, an initial proxy-proposal call was safely rejected:
the CLI exposed two workflow-tool aliases, although it made no tool requests.
The tooling added those observed aliases to explicit exclusions, kept the
fail-closed telemetry checks and verified zero tools on fresh calls.

That rejected request is not one of the nine benchmark calls. Together with
the later proxy proposal and implementation, there have been **twelve actual
calls**: one rejected compatibility attempt, one proposal, nine benchmark
requests and one bounded implementation. The [proxy experiment](change-impact.en.md)
passed 15 unchanged tests and 35 independent checks after proposal review;
it does not change any of these six benchmark outcomes.

## Present or repeat it

Start with the runtime-path row: behavior passes, classification fails.
Then compare the two strategies' actual usage, not an assumed price.
Finish with the distinction between evidence validation, explanation and behavior.

Use the [reusable engineering-experiment guide](https://github.com/huangyingting/ai-native-sdlc/blob/main/docs/guides/engineering-judgment-demos.en.md)
for bounded execution. Do not rerun failed cells to replace these results;
a new experiment must preserve its own inputs, budget and complete outcomes.
