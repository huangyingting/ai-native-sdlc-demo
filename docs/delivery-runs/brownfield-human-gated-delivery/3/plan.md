# Implementation plan

## Acceptance mapping

| Acceptance scenario | Planned coverage |
| --- | --- |
| AC-1 | TASK-1 establishes controlled-Red coverage using an old-schema SQLite fixture. TASK-2 adds an in-place nullable-owner migration that preserves all four records, fields, timestamps, and summary values. TASK-4 and TASK-5 display Unassigned on detail and dashboard surfaces. TASK-7 performs Green and migration verification. |
| AC-2 | TASK-1 adds failing ownership lifecycle, no-op, reload, and persistence tests. TASK-3 implements validated assignment, reassignment, clearing, and already-current-owner behavior. TASK-4 adds the detail-page control. TASK-7 verifies durability across reloads and same-volume restart. |
| AC-3 | TASK-1 adds exact-reference-set and filter-intersection tests. TASK-5 adds owner display and All owners, Unassigned, Avery Stone, and Jordan Lee filtering while preserving active search, status, and priority selections. TASK-7 verifies all required combinations. |
| AC-4 | TASK-1 adds negative mutation and accessibility coverage. TASK-3 normalizes empty Unassigned values, rejects unknown nonempty owners with `Invalid ticket owner update`, and surfaces missing tickets as `Ticket not found`, with no mutation. TASK-4 and TASK-5 provide labeled keyboard-operable controls. TASK-7 verifies server, storage, and manual keyboard behavior. |
| AC-5 | TASK-1 adds fresh-dataset compatibility coverage. TASK-2 and TASK-3 ensure newly created tickets default to database null and display as Unassigned. TASK-4 through TASK-6 preserve creation, detail, status, search, filtering, priority ordering, and summary behavior. TASK-7 verifies the exact creation example separately from AC-3. |

## Tasks

### TASK-1: Establish controlled TDD Red evidence

Depends on: none  
Acceptance: AC-1, AC-2, AC-3, AC-4, AC-5  
Surfaces: `demos/it-service-desk` existing test suites and test fixtures covering `src/app/actions.ts`, SQLite persistence, `src/app/page.tsx`, `src/app/tickets/[id]/page.tsx`, and the dashboard and ticket-detail components they render  
Validation: run the existing targeted baseline first, then retain assertion-level Red failures from newly added ownership tests that fail specifically because migration, ownership mutation, display, filtering, no-op, or accessibility behavior is absent

Add deterministic tests before production changes. Construct an old-schema SQLite fixture containing INC-0001 through INC-0004 with their original fields and exact timestamps; do not create those records through an ownership-aware schema. Assert migration preservation, Unassigned display, summary values, assignment lifecycle, exact owner-filter reference sets, filter intersection, All owners state preservation, invalid mutations, keyboard-accessible labels, fresh-ticket defaults, and existing workflow compatibility.

Add explicit controlled-Red cases for the scripted development-review decisions:

- Setting a ticket to its already-current owner succeeds without writing and preserves `updatedAt`.
- The detail form submits an empty value for Unassigned, which the server normalizes to database null.
- Any unknown nonempty owner value is rejected as `Invalid ticket owner update`.
- A valid ownership value submitted for a missing ticket is surfaced as `Ticket not found`.
- Neither invalid-owner nor missing-ticket handling mutates any row.

The baseline must be Green before ownership assertions are introduced. Infrastructure, dependency, fixture-construction, syntax, or unrelated failures do not qualify as controlled-Red evidence, and existing assertions must not be weakened.

### TASK-2: Add the compatible ownership schema migration

Depends on: TASK-1  
Acceptance: AC-1, AC-2, AC-5  
Surfaces: `demos/it-service-desk` SQLite schema initialization and migration code, ticket persistence types, database bootstrap and seed handling, and old-schema database fixtures  
Validation: open the old-schema four-ticket fixture through the ownership-capable application and compare every persisted field and timestamp before and after migration; verify all owners are database null, display as Unassigned, and preserve the summary of 2 open, 1 in progress, 1 resolved, and 2 active high-or-critical

Extend the existing ticket table with a nullable owner column. Database null represents Unassigned; assigned values are limited to `avery-stone` and `jordan-lee`. Use the repository’s existing SQLite initialization and migration conventions rather than replacing the database or introducing a parallel persistence layer.

Make migration additive, transactional, and idempotent. It must alter an existing database in place without replacing records, rerunning seed insertion over persisted data, or modifying IDs, references, titles, descriptions, requester data, categories, priorities, statuses, `createdAt`, or `updatedAt`. Fresh databases and newly inserted tickets must use the same null default without extending the ticket-creation input.

### TASK-3: Implement validated ownership persistence and server mutation

Depends on: TASK-2  
Acceptance: AC-2, AC-4, AC-5  
Surfaces: `demos/it-service-desk/src/app/actions.ts`, the existing SQLite ticket read/update helpers used by those actions, shared ticket types, and the fixed data used to render form options  
Validation: server and storage tests assign both roster owners, clear with an empty form value, preserve `updatedAt` for an already-current owner, reject `not-in-roster` as `Invalid ticket owner update`, surface a nonexistent ticket as `Ticket not found`, and prove both failure paths leave every row unchanged

Define the fixed roster once in an existing shared application module consumed by server validation and UI option construction. Extend ticket reads with the nullable owner while preserving existing ticket fields and call patterns.

Add a focused owner update operation that can change only the owner and, for a real change, may advance `updatedAt` to a nondecreasing value. Follow the validation, revalidation, redirect, and error conventions already used by `src/app/actions.ts`:

- Accept `avery-stone` and `jordan-lee`.
- Accept an empty form value as Unassigned and normalize it to database null before persistence.
- Reject every unknown nonempty value by throwing `Invalid ticket owner update`.
- Surface a missing ticket as `Ticket not found`.
- Treat an already-current owner, including already-Unassigned, as a successful no-op; do not issue an update and preserve `updatedAt`.
- Complete validation and ticket existence checks before writing so either error path leaves all rows unchanged.
- Revalidate and redirect after a successful change or successful no-op using the existing action conventions.

Avoid broad ticket replacement logic that could overwrite unrelated fields. Server-side validation remains authoritative even though the UI exposes only valid options.

### TASK-4: Add ownership to the ticket detail experience

Depends on: TASK-3  
Acceptance: AC-1, AC-2, AC-4, AC-5  
Surfaces: `demos/it-service-desk/src/app/tickets/[id]/page.tsx`, `demos/it-service-desk/src/app/actions.ts`, and the existing ticket metadata, status form, and reusable form controls rendered by the detail page  
Validation: detail integration tests display Unassigned and both roster names; keyboard checks operate every option; reload tests assign Avery, reassign Jordan, clear through the empty Unassigned option, and verify an already-current selection preserves `updatedAt` and all unrelated fields

Display the resolved owner label in the existing detail metadata. Add a labeled native or repository-standard keyboard-operable control with options for Unassigned, Avery Stone, and Jordan Lee. The Unassigned option must have an empty submitted value; no roster-like sentinel may be persisted.

Submit through the focused action in TASK-3 and retain existing form validation, revalidation, redirect, and error behavior. After success, both the detail page and dashboard must read persisted SQLite state rather than relying on optimistic-only state. Invalid requests must not present a success state.

### TASK-5: Add dashboard ownership display and intersecting filter

Depends on: TASK-3  
Acceptance: AC-1, AC-2, AC-3, AC-4, AC-5  
Surfaces: `demos/it-service-desk/src/app/page.tsx` and its existing dashboard queue, ticket row or card, search control, status filter, priority filter, URL or component filter state, ordering, and summary components  
Validation: dashboard tests assert All={INC-0001, INC-0002, INC-0003, INC-0004}, Avery={INC-0001, INC-0003}, Jordan={INC-0002}, Unassigned={INC-0004}, Avery+Open+High+`inc-1`={INC-0001}, and Avery+Critical={}; selecting All owners preserves the exact active search, status, and priority values

Show Avery Stone, Jordan Lee, or Unassigned on each existing ticket row or card. Add a labeled keyboard-operable owner filter with All owners, Unassigned, Avery Stone, and Jordan Lee choices.

Extend the existing filter pipeline with an additional owner intersection. Do not replace or reset search, status, priority, ordering, or summary logic. Selecting All owners must update only owner-filter state while preserving the exact active search text, status selection, and priority selection. It must not mutate any ticket and must remain distinct from clearing a ticket owner on the detail page.

### TASK-6: Preserve creation and established workflows

Depends on: TASK-2, TASK-4, TASK-5  
Acceptance: AC-5  
Surfaces: `demos/it-service-desk/src/app/actions.ts`, the existing ticket creation form and page, `src/app/tickets/[id]/page.tsx`, `src/app/page.tsx`, SQLite insertion logic, status updates, search and filter controls, priority ordering, and dashboard summaries  
Validation: on a separate fresh dataset, create the exact `Ownership demo request` ticket and verify Open/Unassigned state, no owner creation field, and unchanged detail, status, search, status-filter, priority-filter, ordering, and summary behavior

Keep ownership out of the creation form, its submitted data, and its public validation contract. The persistence default must create the ticket with a null owner, rendered as Unassigned, without changing the existing Open status default.

Run this scenario independently from AC-3 so the additional ticket cannot affect the four-ticket reference sets. Add regression assertions for established workflows, ordering, and summaries rather than relying only on a visual smoke test.

### TASK-7: Complete Green verification and delivery evidence

Depends on: TASK-4, TASK-5, TASK-6  
Acceptance: AC-1, AC-2, AC-3, AC-4, AC-5  
Surfaces: complete `demos/it-service-desk` test suite, lint and production build, old-schema migration fixture, browser acceptance flow, and same-volume application or container runtime  
Validation: rerun the unchanged controlled-Red assertions to Green; run `npm test`, `npm run lint`, and `npm run build` from `demos/it-service-desk`; execute AC-1 through AC-5 with isolated datasets and verify persistence after restarting against the same existing database volume

For AC-1, compare complete old-schema records before and after migration and distinguish this from fresh seed verification. For AC-2, reload detail and dashboard pages after each assignment operation, verify the successful no-op preserves `updatedAt`, and restart the same labeled runtime without cleanup. For AC-3, assert exact references rather than counts. For AC-4, combine automated server and storage tests with manual keyboard observations. For AC-5, use a separate fresh dataset.

Treat image smoke tests as supplementary; they cannot replace old-schema migration or same-volume persistence verification. Record actual controlled-Red and Green runs only after they occur. Standard, specification-revision, and failure-recovery variants remain planned scenarios unless each is executed with genuine corresponding evidence. Scripted development-review decisions and rehearsal approvals must not be represented as independent Human acceptance or Demo Ready evidence.

## Risks and migrations

- **Existing-data loss:** Bootstrap logic could mistake an old database for a fresh dataset or overwrite it with seeds. Mitigate with an additive in-place transaction and complete before/after comparisons for all four old-schema records.
- **Timestamp drift:** Migration, generic update helpers, or no-op submissions could advance `updatedAt` incorrectly. Migration and already-current-owner no-ops must preserve it exactly; only a real owner change may advance it nondecreasingly.
- **Invalid owner persistence:** Restricting UI options does not stop forged requests. Central validation in the server action and persistence boundary must permit only the two roster IDs or normalized null.
- **Ambiguous Unassigned transport:** Empty form values can be confused with missing or invalid data. Handle the ownership field explicitly: empty means null, while every unknown nonempty value throws `Invalid ticket owner update`.
- **Partial writes on errors:** Looking up or validating after an update could mutate data before throwing. Validate the owner and establish ticket existence before issuing the focused update; test full database snapshots around both error paths.
- **Error-contract regression:** New errors could bypass established action behavior. Preserve `src/app/actions.ts` conventions while maintaining the exact explicit errors `Invalid ticket owner update` and `Ticket not found`.
- **Filter regression:** Adding owner state could reset, bypass, or reinterpret existing search, status, or priority state. Extend the existing intersection and assert exact state preservation when All owners is selected.
- **Semantic confusion:** Selecting All owners and clearing a ticket owner are different operations. Keep their controls, handlers, state transitions, and test terminology separate.
- **Fresh-data false confidence:** A fresh initialized database cannot demonstrate migration compatibility. Required migration evidence starts with persisted records under the old schema.
- **Rollback compatibility:** The additive nullable column preserves legacy ticket fields, but an older application may ignore ownership written by the newer version. Do not remove or transform legacy fields; record any runtime rollback limitation discovered during implementation.
- **Delivery-evidence overclaim:** Scripted rehearsal activity, successful checks, merged code, or replay output is not Human delivery acceptance. Existing approval, review, publish, verification, and readiness gates remain unchanged.

No destructive rewrite or separate backfill is proposed. Existing rows acquire a nullable owner column and therefore become Unassigned without changing legacy values.

## Validation

1. Run the existing targeted test baseline before adding ownership assertions and confirm it is Green.
2. Capture controlled-Red results only for new assertions that fail because the approved ownership behavior is absent.
3. Migrate an old-schema database containing all four persisted tickets and exact timestamps. Compare every legacy field before and after migration and verify the required unchanged summaries.
4. Test server and storage behavior for `avery-stone`, `jordan-lee`, empty-string-to-null Unassigned, already-current-owner no-op, `not-in-roster`, and a nonexistent ticket.
5. Assert that a real ownership change affects only owner and optionally advances `updatedAt`; assert that a no-op preserves every field including `updatedAt`.
6. Assert that invalid owner input throws `Invalid ticket owner update`, a missing ticket is surfaced as `Ticket not found`, and neither path changes any row.
7. Verify detail-page assignment, reassignment, clearing, and no-op behavior after reloading both detail and dashboard pages, then restart using the same database volume.
8. Verify dashboard owner display and all AC-3 exact reference sets and intersections. Confirm selecting All owners preserves exact active search, status, and priority state and does not clear assigned owners.
9. Keyboard-test the labeled detail ownership control and dashboard owner filter, including every allowed option.
10. On a separate fresh dataset, create the exact AC-5 ticket and verify existing detail, status update, search, status filter, priority filter, ordering, and summary behavior.
11. Run `npm test`, `npm run lint`, and `npm run build` from `demos/it-service-desk`.
12. Accept Green evidence only if the original controlled-Red assertions pass unchanged and existing regression checks remain successful. Do not report delivery variants or Human acceptance without actual qualifying evidence.

## Revision summary

This revises the previous Plan while preserving TASK-1 through TASK-7 because their responsibilities and acceptance mappings remain unchanged. The task surfaces are now grounded in the existing application, including `demos/it-service-desk/src/app/actions.ts`, `src/app/page.tsx`, `src/app/tickets/[id]/page.tsx`, existing SQLite persistence and migration code, and the components and tests used by those pages.

**Approved Specification decisions preserved:** AC-1 through AC-5, the fixed Avery Stone and Jordan Lee roster, nullable single-owner model, Unassigned defaults, old-schema compatibility, server-side rejection, owner-filter intersection and clearing semantics, existing-workflow compatibility, and all non-goals remain unchanged.

**Scripted development-review decisions incorporated:** setting an already-current owner is a successful no-op that preserves `updatedAt`; Unassigned is submitted as an empty form value and normalized to database null; unknown nonempty owner values throw `Invalid ticket owner update`; missing tickets are surfaced as `Ticket not found`; neither error path mutates a row; and the implementation follows existing validation, revalidation, and redirect conventions. These resolve the prior Plan’s three implementation questions. They are development-rehearsal decisions supplied in the review data, not independent Human acceptance and not changes to Specification v2.

**Plan proposals for review:** centralize the fixed roster in an existing shared application module, use a focused owner-only persistence update, add the nullable column through the existing migration path, and extend the current dashboard filtering pipeline rather than creating parallel filtering infrastructure. These are implementation choices consistent with the approved Specification, not new requirements.

Approval of Specification v2 does not approve this Plan. Only explicit Human approval of this exact revised Plan permits engineering handoff.

## Open questions

None. The scripted development-review decisions resolve the previous implementation trade-offs without conflicting with approved Specification v2. Any requested change to those decisions or to specified behavior requires explicit review and, where it changes the approved requirements, a Specification revision that invalidates this draft Plan.

