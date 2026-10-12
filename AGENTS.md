# Repository instructions

## Scope

This repository contains independent demonstration applications, reusable
tools, GitHub workflow automation, and documentation.

- Keep complete demo applications under `demos/<name>/`.
- Keep repository utilities under `tools/<name>/`.
- Keep shared workflow adapters under `.github/scripts/` and demo-specific
  automation inside that demo's `.github/<demo-name>/` directory.
- Add shared packages only when multiple projects genuinely consume them.

Demo projects are intentionally not npm workspaces. Each demo owns its
manifest, lockfile, runtime requirements, documentation, and path-scoped CI.
Do not add demo dependencies to the root package.

## Changes

- Follow the nearest nested `AGENTS.md` when a project has additional rules.
- Update workflows, scripts, tests, and documentation when moving files or
  changing a public path.
- Preserve existing behavior and compatibility unless a change explicitly
  requires otherwise.
- Avoid over-engineering. Prefer the simplest design that fully satisfies the
  current requirement, and do not add abstractions, dependencies, or extension
  points without a demonstrated need.
- Do not commit generated build output, local databases, logs, or credentials.
- Keep changes focused and follow the style already used in the target project.
- For Brownfield Human-Gated Delivery stage work, follow the assigned prompt
  under `.github/brownfield-human-gated-delivery/prompts/`. Do not change
  approved lifecycle artifacts or production code outside the current stage's
  allowed boundary.

## Validation

Use Node.js 24 unless a nested project documents another supported runtime.

Run repository automation and trace-viewer tests from the repository root:

```sh
npm test
```

For the IT service desk:

```sh
cd demos/it-service-desk
npm test
npm run lint
npm run build
```

For the independent engineering fixture:

```sh
npm --prefix demos/engineering-lab test
```

Root tests include its deterministic experiment-tooling checks. Real Copilot
experiments require explicit operator execution and are not part of offline CI.

Run the smallest relevant checks while iterating, then run the complete checks
for every project affected by the change.
