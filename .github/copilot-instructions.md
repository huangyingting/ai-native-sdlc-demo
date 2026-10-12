# Repository guidance

Read the repository-root `AGENTS.md` and the nearest nested `AGENTS.md` before
changing files.

- Keep independent applications under `demos/` and reusable utilities under
  `tools/`.
- Do not add demo dependencies to the root package or combine demo lockfiles.
- Update every workflow, script, test, and documentation reference when paths
  change.
- Preserve compatibility and keep changes focused.
- Run the validation commands documented by the applicable `AGENTS.md`.
