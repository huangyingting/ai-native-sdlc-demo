# Copilot CLI agent orchestration patterns

For repository setup, workflow operations, trace publishing, and security
guidance, see the [repository guide](./repository-guide.md).

This guide describes reusable orchestration patterns for GitHub Copilot CLI. Each pattern shows how Copilot can dynamically decompose a task into subagents, coordinate their execution, and synthesize their results. The repository defines the orchestration objective and constraints, but it does not define fixed demo-specific agent profiles.

The Copilot CLI Trace Viewer is the observability layer used by this repository to demonstrate and validate these patterns. It records the resulting OpenTelemetry call hierarchy, timing, model usage, tool calls, and cost; it is not the name of the patterns themselves.

## Pattern comparison

| Pattern | Subagents | Scheduling | Information flow | Best used for |
|---|---:|---|---|---|
| Direct execution | 0 | Direct | User → orchestrator → result | Establishing latency, token, and cost baselines |
| Parallel delegation | 2+ | Parallel | Independent branches → synthesis | Research, comparison, review, or separable subtasks |
| Critic-reviser loop | 1+ | Sequential | Initial position → critic → revision | Challenging assumptions and simplifying a proposal |
| Sequential pipeline | 2+ | Sequential | Stage result → dependent stage → synthesis | Work where later stages consume earlier results |

## Runtime model selection

Every workflow run has two model inputs:

- **Orchestrator model** plans delegation, supplies context, and synthesizes the final response.
- **Subagent model** is requested for every dynamically created subagent.

The defaults are `gpt-6-luna` for both inputs. The trace reports the models actually observed rather than assuming that the requested models were used. For delegated patterns, validation rejects models outside the selected set and requires the selected subagent model to appear. Cost is then calculated independently for every observed model call and aggregated by model and agent branch.

Each pattern has a dedicated issue form with one runnable, editable demonstration task. A template-specific `copilot-pattern:*` label routes the issue internally, so users do not need to repeat the pattern in a dropdown. Those scenarios are template content, not part of the reusable pattern definition. The form does not expose a separate agent-instructions field: the selected pattern's generic orchestration contract is injected automatically. Manual workflow dispatch retains an optional advanced guidance input and uses a generic repository-analysis task when no task is supplied.

Task text preserves Markdown headings such as `### Requirements` and fenced
examples. Inline code spans are not treated as fence openers, so later form
settings remain separate. Only known form labels, such as `### Trace detail`, delimit fields
outside code fences. Keep those labels reserved for the form itself; duplicate
fields are rejected rather than silently choosing one value.

All forms default to detailed tracing with redacted request and response payloads. Select **Metadata only** when payload content should not be included in the public GitHub Pages report or HTML artifact.

The Parallel delegation form also has an **Internet access** choice. The generic workflow has no preapproved URL, but the form's AWS/Azure comparison scenario preselects `https://docs.aws.amazon.com` and passes it to the CLI through `--allow-url`; Azure research uses the default-enabled Microsoft Learn MCP. Select **Block all external URLs** when replacing the task with one that does not need AWS documentation. Arbitrary values in edited issue bodies are rejected.

## 1. Direct execution

The orchestrator handles the task directly and is instructed not to delegate.

```text
User request
    └── Orchestrator
            └── Final answer
```

Use this pattern to measure the overhead introduced by delegation. It is the reference point for comparing elapsed time, token use, and cost with the other patterns.

**Trace evidence**

- No subagent spans.
- At least one model call.
- Only the orchestrator model is required.
- Peak concurrent subagents is `0`.

## 2. Parallel delegation

Copilot CLI runs in fleet mode and dynamically creates at least two independent subagents. The task determines whether branches research different subjects, review the same artifact from different perspectives, or solve separate parts of a larger task.

```text
                         ┌── Dynamic subagent A ── independent result ──┐
User request ── Orchestrator                                          ├── Synthesis
                         └── Dynamic subagent B ── independent result ──┘
```

The branches must be independent and overlap in time. Research and review are demos of the same underlying pattern, so they do not need separate pattern names.

**Trace evidence**

- At least two subagent branches.
- Peak concurrent subagents is at least `2`.
- The selected subagent model is observed.

## 3. Critic-reviser loop

The orchestrator first develops an initial position. It then dynamically creates one independent critic with the original request and initial position as context. The final answer must explain how the critique changed the conclusion.

```text
User request
    └── Orchestrator initial position
            └── Dynamic critic
                    └── Orchestrator revised conclusion
```

Unlike parallel delegation, this pattern is intentionally asymmetric: the critic reacts to an existing position rather than independently solving the original task. It is useful for exposing hidden assumptions, counterexamples, and unnecessary complexity.

**Trace evidence**

- At least one dynamically created subagent branch.
- The critic executes after the initial reasoning begins.
- The selected subagent model is observed.

## 4. Sequential pipeline

This pattern demonstrates dependent, sequential collaboration. The orchestrator dynamically creates a solution-design specialist and waits for its proposal. It then creates a fresh critical-review specialist whose input includes both the original request and the first result.

```text
User request
    └── Orchestrator
            └── Dynamic design specialist
                    └── result returned
                            └── Dynamic critical reviewer
                                    └── revised plan
```

This differs from parallel delegation because the second task cannot start correctly until the first task finishes. Use it for plan-review-revision workflows, staged analysis, and other tasks with explicit data dependencies.

**Trace evidence**

- At least two dynamically created subagent branches.
- Peak concurrent subagents is exactly `1`.
- The second branch begins after the first branch completes.
- The selected subagent model is observed.

## Reading failures in the viewer

A red tool span means OpenTelemetry recorded an actual tool failure. It does not necessarily mean the overall orchestration failed. Common examples include:

- A URL rejected by the workflow allowlist.
- A subagent attempting a denied shell or write operation.
- An MCP or HTTP request returning an error.

Select the span to view its **Failure reason**. This diagnostic is shown independently of request/response payload capture. Payload capture remains off by default because tool arguments and results can contain sensitive information.

## Choosing a pattern

- Choose **Direct execution** when measuring whether delegation is worthwhile.
- Choose **Parallel delegation** when subtasks or perspectives are independent.
- Choose **Critic-reviser loop** when an initial position needs adversarial reflection.
- Choose **Sequential pipeline** when later work must consume an earlier result.

Select a pattern through **Actions → Copilot CLI Agent Demos → Run workflow** or choose one of the four pattern-specific issue forms. GitHub Issue Forms do not support changing textarea values from a dropdown, so separate forms provide the clearest one-click experience while keeping the execution workflow shared.
