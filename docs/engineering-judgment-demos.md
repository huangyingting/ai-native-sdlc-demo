# Three Engineering Judgment Demos

These extend the [reliability loops](brownfield-reliability-loops.md) with
change reasoning, CI diagnosis and measured strategy comparison. They use a
small independent synthetic application, not the already accepted service desk.
For the broader delivery method and a bilingual explanation of these experiments,
see the [illustrated handbook](ai-native-sdlc/README.md) and its
[engineering judgment chapter](ai-native-sdlc/en/05-engineering-judgment.md).
For what actually happened, see the
[rehearsal evidence](engineering-judgment-rehearsal.md).

**Status:** executable development-test experiments. The commands actually use
Copilot; offline unit tests do not. A successful experiment demonstrates only
the stated fixtures and checks, not general Agent superiority.

## 1. What each demo proves

| Demo | Plausible wrong choice | Measurable closure |
|---|---|---|
| Change impact | Add a proxy field without updating filters, old storage or API consumers | Every known affected surface is cited, an operator approves a version-bound proposal, and an isolated candidate passes unchanged legacy tests plus independent migration/behavior checks |
| CI diagnosis | Treat every failed check as a product bug or accept a successful retry as a fix | Real controlled failures, source-grounded citations, correct fault class, minimal scoped correction and independent regression checks |
| Strategy evaluation | Assume more planning or more agents always improves results | Identical three-case inputs, recorded calls/time/usage, independent verification, preserved failures and no statistical claim from one sample per cell |

The **diagnosis-first strategy is two fresh CLI requests with an explicit
diagnostic handoff**, not a claim that two independent humans or different
models reviewed the code. Direct execution combines diagnosis and patch in one
response. Both have the same maximum call/time allowance; actual usage differs
and is part of the comparison.

## 2. Prerequisites

- Node.js 24+, Git, Docker and an authenticated installed Copilot CLI.
- A reviewed source commit containing the fixture and toolkit.
- A new output directory outside the repository, with an existing parent.
- A reviewed immutable Node 24 runtime image available locally. Tags are not
  accepted by the verification adapter.

For the initial rehearsal, the runtime was resolved to:

```text
node@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6
```

Pull the exact digest, inspect its source and architecture for your environment,
and use the same image for every cell. The commands do not provision a cloud
environment. Existing accepted containers and volumes are not used.

The default CLI model is not overridden. A model switch in the environment
must be disclosed before interpreting comparisons. Missing telemetry is
reported as unavailable rather than filled with estimates.

The tested CLI is `1.0.89-3`. The adapter uses structured JSONL events rather
than terminal-rendered text, explicitly excludes its verified builtin tool
set, and requires observed zero-tool telemetry before accepting a response.
An empty `--available-tools=` does not disable the tested CLI's tools. A future
CLI that changes its tools or event schema must be requalified; missing evidence
is not silently accepted as compatibility.

## 3. Change-impact and consistency loop

The change request adds a temporary proxy while preserving the accountable
owner. It affects domain filtering, persisted state, API serialization and the
documented contract. The request names objective APIs and migration behavior;
it does not contain a reference implementation.

From the source root:

```sh
mkdir -p "$HOME/engineering-demo-evidence"

node tools/engineering-demo/cli.mjs impact-propose \
  --source /absolute/path/to/ai-native-sdlc \
  --source-ref FULL_40_HEX_SOURCE_COMMIT \
  --image node@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 \
  --dest "$HOME/engineering-demo-evidence/impact-1"
```

Read the complete proposal, not just the status:

1. Confirm every affected domain/storage/API/documentation surface and its
   exact source quotation.
2. Review proposed decisions, including accountability, nullable proxy,
   effective-owner filtering, invalid input and legacy migration.
3. Check the Spec and Plan against objective acceptance criteria.
4. Only then approve the exact `proposalHash` printed in the report:

```sh
node tools/engineering-demo/cli.mjs impact-approve \
  --run "$HOME/engineering-demo-evidence/impact-1" \
  --proposal-hash FULL_PROPOSAL_SHA256 \
  --reviewer YOUR_GITHUB_LOGIN

node tools/engineering-demo/cli.mjs impact-implement \
  --run "$HOME/engineering-demo-evidence/impact-1"
```

An approval cannot be reused after the proposal or source fixture changes.
The receipt records a local development-test operator decision, not verified
GitHub identity or independent Human approval. If a proposal is unacceptable,
keep that attempt and start a new bounded experiment; do not rewrite evidence
to make old approval appear current.

The second real Copilot response supplies complete contents for allowed
implementation/documentation files. The adapter preserves all tests and runs
legacy and independent acceptance checks inside Docker. Only those observed
checks establish a passing candidate, not the model's `claimedFixed` value.

## 4. CI diagnosis and strategy comparison

```sh
node tools/engineering-demo/cli.mjs benchmark \
  --source /absolute/path/to/ai-native-sdlc \
  --source-ref FULL_40_HEX_SOURCE_COMMIT \
  --image node@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6 \
  --dest "$HOME/engineering-demo-evidence/benchmark-1"
```

Three fixed cases are injected into fresh copies:

- A product filtering regression.
- A test expectation that contradicts the unchanged product contract.
- An invalid database configuration.

The model receives neutral case requests, actual failing test output and the
same relevant files, not the expected fault label or oracle implementation.
Every case is exercised by both strategies. Their order is alternated across
cases to reduce, not eliminate, order effects.

For each cell the runner:

1. Produces a real controlled Red with the expected executed test count.
2. Calls Copilot once directly or twice through diagnosis then implementation.
3. Checks cited evidence against supplied source/output.
4. Applies only existing allowlisted files; grades the actual change scope.
5. Requires unchanged legacy assertions, except restoring the deliberately
   corrupted harness assertion to its original contract.
6. Executes the whole visible suite and independent oracle in restricted Docker.
7. Records classification, correctness, false completion, elapsed time and
   actual CLI usage; retains failed cells without automatic retries.

Report dimensions are deliberately separate: a repair can pass all behavioral
checks while its evidence is rejected. `unacceptedCompletionClaims` records
claims that fail the overall gate; `falseCompletionClaims` is reserved for
claimed repairs that actually fail independent behavioral verification.

Budget: nine CLI calls for the six cells, two calls for the separate impact
loop, maximum 120 seconds per call and 300 seconds per benchmark cell. These
are execution bounds, **not a dollar-spend guarantee or equal token allocation**.
The CLI's own startup/usage observations are separate from this experiment.
Sandbox setup shares the execution deadline. Bounded ownership-checked cleanup
has a separate allowance and is included in observed wall time; a result is
never successful while cleanup is unresolved.

The raw reports are private. A `completed-with-failures` report and exit 2 mean
the benchmark completed but one or more candidates failed. Exit 1 is an
infrastructure/contract error; neither should be described as all repairs
succeeding. Generated source never runs on the host.

## 5. Interpreting results

Report task correctness first, then regressions, unsupported completion claims,
wall time, actual calls and available token/usage units. Do not sum cached
tokens again when they are already included in total input. Do not call
premium-request units or nano-AIU values dollars.

One trial per three fixtures cannot establish a statistically significant
ranking or predict real-team productivity. There is no automatic winner,
no claim of model-independent reviewers, and no human-gated strategy in the
benchmark. The separate impact loop demonstrates the review mechanism.

These are bounded text-proposal agents rather than unrestricted autonomous
coding agents. The constraints make evidence and execution reproducible but
limit generalization to agents with broad tool access.

## 6. Validation

```sh
npm test
npm --prefix demos/engineering-lab test
```

Root tests validate tooling contracts, guards and deterministic fixture faults.
The independent app owns its manifest and lockfile; no app dependencies are
added to the root. Offline CI must not spend Copilot usage. Real experiments
remain explicit operator commands with preserved output directories.
