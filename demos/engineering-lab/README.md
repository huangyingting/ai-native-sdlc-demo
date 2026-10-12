# Engineering lab

A deliberately small, independent ticket assignment app for bounded engineering
exercises. All identities and requests are synthetic. It uses only Node.js 24
built-ins, including real SQLite; there are no npm runtime or test dependencies.
It is not an npm workspace and does not share the IT service desk's data or code.

```sh
cd demos/engineering-lab
npm test
npm start
```

No installation step is necessary. The lockfile documents the independent,
dependency-free package. The CLI prints one JSON array and defaults to an
in-memory database; Node may print its SQLite experimental warning on stderr.

See [contract.md](contract.md) for exact validation, filtering, storage, and API
behavior. There is intentionally **no proxy-owner feature** in this baseline.

## Fixture validation

The approved suite contains exactly **15 tests**, with no timed assertions.
Persistence tests create a unique directory relative to the working directory
and remove it afterwards, so run tests from a writable working directory.

From the repository root:

```sh
node --test tools/engineering-demo/tests/cases.test.mjs
node tools/engineering-demo/oracle.mjs case-1 demos/engineering-lab
node tools/engineering-demo/oracle.mjs case-2 demos/engineering-lab
node tools/engineering-demo/oracle.mjs case-3 demos/engineering-lab
```

Each diagnosis oracle command passes on the unchanged baseline. The three case
overlays independently introduce a product defect, a test-expectation drift, or
a runtime-configuration fault. Their public repair request does not disclose
the diagnosis. Applying any one overlay makes the actual approved suite fail.
The tooling suite has **12 tests**. Every diagnosis success reports **20 oracle
checks**; expectation drift still requires the visible suite to be repaired,
because the independent product oracle correctly accepts unchanged behavior.

The separate `impact` oracle must fail on this baseline: it verifies a future
temporary proxy-owner feature specified in `IMPACT_CONTRACT`, rather than
pretending that feature already exists. The oracle requires a writable working
directory for scratch databases, cleans them up, and never edits app files.
In a container its command is
`node /oracle/oracle.mjs CASE_ID /work` (or `impact` instead of `CASE_ID`),
with `/work` and `/oracle` read-only and the working directory writable.
Only the final one-line JSON success/failure summary is emitted on stdout.
Impact success reports **35 checks**, covering the legacy contract plus
migration, proxy assignment, clearing, persistence, filtering, serialization,
and documented API names. Failure always reports
`{"kind":"engineering-oracle","passed":false,"checks":0}` and exits nonzero,
without disclosing assertion details.
