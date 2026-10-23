# Meeting room booking: workflow comparison

This directory collects the local OpenSpec, Spec Kit, and BMad experiments
previously located under `~/workspace/sdlc`. They belong in the demonstration
repository because they contain concrete implementations and execution evidence,
not reusable methodology or shared tooling.

## Start here

- [Method comparison](docs/method-comparison-2026-10-20.md): workflow differences,
  outcomes, token usage, and accounting limitations.
- [OpenSpec history](openspec/docs/openspec-session-history.md) and
  [application setup](openspec/README.md).
- [Spec Kit history](speckit/docs/session-interaction-report.md) and
  [application setup](speckit/README.md).
- [BMad history](bmad/docs/session-interaction-report-2026-10-20.md) and
  [application setup](bmad/service/README.md).

The experiments have different scopes and acceptance endpoints. They are not a
controlled benchmark or evidence that all three implementations are production
ready. In particular, BMad's delivered batch has no live recurrence handlers,
and Spec Kit's recorded performance acceptance remains incomplete.

## Layout

```text
meeting-room-booking/
  bmad/       # BMad implementation, artifacts, and independent Git repository
  docs/       # Cross-method comparison
  openspec/   # OpenSpec implementation and independent Git repository
  speckit/    # Spec Kit implementation and independent Git repository
```

## Local relocation and Git boundary

On 2026-10-22, the four directories were moved here without flattening their
contents. The three existing `.git` directories, commit histories, hidden
configuration, dependencies, build output, and local runtime files were retained.
Each application still owns its dependencies and validation commands; there is
no shared npm workspace or root-level dependency installation.

The old `~/workspace/sdlc` directory and compatibility symlinks were removed.
Use this directory for all subsequent work. Historical absolute references,
including generated BMad workflow paths, may still mention the old location;
they are retained as historical evidence, not current runnable paths.

This is a **local filesystem consolidation**, not a Git history import or a
submodule setup. The three application repositories remain independent and
have not been committed or pushed into the parent repository. Do not blindly
stage these nested repositories: adding them as directories can create gitlinks
without a corresponding submodule configuration. Publishing a self-contained
parent checkout requires a separate choice of history import or properly
configured submodules. Local dependencies, build output, databases, and
credentials must not be committed as part of that work.
