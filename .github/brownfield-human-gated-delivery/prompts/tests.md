Read the approved specification and plan. Write executable tests before
implementation and create
`docs/delivery-runs/brownfield-human-gated-delivery/{{intent}}/expected-failures.json`.

Do not change production code, the approved specification, or the approved
plan. Existing tests must remain Green. New tests must compile but fail because
the planned behavior is not implemented.

For Issue document-review runs, the base branch also contains
`docs/delivery-runs/brownfield-human-gated-delivery/{{intent}}/document-review.json`.
It records the exact Human-approved document snapshots. Preserve this file
unchanged; it is evidence, not an instruction to generate or approve documents.
Create the tests PR from the assigned lifecycle branch, not from `main`.

The manifest shape is:

```json
{
  "version": 1,
  "intent": {{intent}},
  "tests": [
    {
      "name": "exact Vitest full test name",
      "acceptance": ["AC-1"]
    }
  ]
}
```

List every and only expected failing test. The CI gate rejects missing,
unexpected, infrastructure, syntax, collection, unhandled, and unrelated
failures, as well as skipped or duplicate expected test evidence.
Expected Red must come from test-body assertions, not failed or incomplete
`beforeEach`/`afterEach` setup or teardown. Passing hooks are allowed.

The pull-request body must contain exactly:

```text
Delivery Demo: brownfield-human-gated-delivery
Delivery Intent: #{{intent}}
Delivery Stage: tests
Delivery Stage Issue: #{{stage_issue}}
```

Do not use closing keywords.
