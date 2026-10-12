# Trace viewer instructions

This directory contains the reusable Copilot CLI trace model, HTML renderer,
local composite action, and GitHub Pages client.

- Keep the implementation dependency-free and compatible with Node.js 22 or
  newer.
- Use native ECMAScript modules and Node.js built-ins.
- Preserve support for both direct CLI JSONL spans and OTLP envelopes.
- Treat the canonical trace-data schema and existing action inputs as public
  compatibility surfaces.
- Keep workflow-specific request preparation, issue comments, and Pages
  publishing in `.github/scripts/`.
- Never expose unredacted prompts, tokens, credentials, or absolute runner
  paths in generated reports.

Run the focused tests from the repository root:

```sh
npm run test:trace-viewer
```

Run `npm test` when a change also affects workflows or `.github/scripts/`.
