Read the approved specification, plan, tests, and expected-failure manifest.
Implement the planned tasks without weakening or rewriting those artifacts.
CI compares approved artifact and test-file blobs against the lifecycle branch.
Do not edit, delete, or rename approved test files. Add any additional tests in
new files instead.

If present, preserve
`docs/delivery-runs/brownfield-human-gated-delivery/{{intent}}/document-review.json`
byte-for-byte as well. It records Issue-based Spec/Plan approvals and must be
included unchanged in the final PR, together with the approved documents.

Make every expected Red test Green, preserve all existing tests, and run the
configured test, lint, build, and container validation. Keep the solution
within the scope and non-goals of the approved specification.

The pull-request body must contain exactly:

```text
Delivery Demo: brownfield-human-gated-delivery
Delivery Intent: #{{intent}}
Delivery Stage: implementation
Delivery Stage Issue: #{{stage_issue}}
```

Do not use closing keywords. This final pull request will be retargeted to
`main` and must contain the complete reviewed product increment.
