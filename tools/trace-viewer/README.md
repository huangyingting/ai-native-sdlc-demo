# Copilot CLI Trace Viewer

This directory owns the dependency-free trace parsing and rendering used by
the Copilot CLI demonstration workflow. Its local package manifest makes the
component independently testable without turning the separate demos into npm
workspaces.

## Structure

- `action.yml` exposes the renderer as a local composite GitHub Action.
- `trace-model.mjs` normalizes JSONL and OTLP spans into the canonical model.
- `html-renderer.mjs` renders the trace and dependency views.
- `render-trace-report.mjs` generates summaries, HTML, and canonical trace data.
- `capture-dependency-graph.mjs` captures a dependency graph from generated HTML.
- `web/` contains the shared GitHub Pages application.
- `model-pricing.json` contains fallback model pricing.
- `render-trace-report.test.mjs` covers normalization, validation, rendering, and
  capture behavior.

Workflow-specific request preparation, issue comments, and Pages publishing
remain in `.github/scripts/`; they consume this directory but are not part of
the reusable action.

## Publication and validation

- Payload capture accepts standard GenAI message `parts` and legacy `content`,
  including tool-call payloads. Empty messages and role labels alone do not
  satisfy requested message evidence.
- Authorization headers, known token/secret fields, and local home, workspace,
  and temporary-directory prefixes are sanitized before publication to JSON,
  HTML, summaries, and renderer diagnostics. Structured payloads are redacted
  recursively before serialization, including JSON-encoded argument strings
  in legacy function calls and standard tool-call parts. Nested JSON strings
  keep their string type; malformed JSON and ordinary text use text redaction
  instead. This also applies to failure
  reasons in metadata-only mode. Configured `GITHUB_WORKSPACE`,
  `RUNNER_WORKSPACE`, and `RUNNER_TEMP` roots are recognized alongside the
  current working directory, home directory, and common runner path prefixes.
  Public URLs and repository-relative paths are retained. Redaction is not a
  guarantee against arbitrary sensitive prose; review payloads before publishing.
- Cached input is part of total input tokens, not additional input. Pricing
  accepts `gen_ai.usage.cache_read.input_tokens` as well as the legacy
  `cached_input_tokens` and `cache_read_input_tokens` usage attributes.
- Parallel evidence requires overlapping independent agent branches: neither
  branch may be an ancestor of the other. The displayed peak concurrency still
  counts all active subagent spans, including nested agents.
- `require-model` is enforced even when `require-pattern-evidence` is disabled.
  Reports are still generated on validation failure for diagnosis.

## Validate

From the repository root:

```sh
npm run test:trace-viewer
```
