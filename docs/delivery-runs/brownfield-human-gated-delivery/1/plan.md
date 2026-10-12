# Implementation plan

Human Intent #1: **Make ticket ownership visible and support handoffs**  
Plan version: **1 — draft for Human review**  
Basis: supplied approved Specification v5, hash `685c515461c7e77c4ac13e129f3cc3313d7a8d6ea29d18cda48d290cdce67038`.

This plan implements the supplied approved specification without revising it. Q-1 through Q-4 are recorded Human decisions. Storage representation, migration mechanics, component structure, and test organization below are implementation proposals, not additional Human decisions.

Read-only inspection grounds this plan in the existing Next.js application, SQLite store, server actions, dashboard, ticket details, creation form, dropdown component, and Vitest tests. No files were changed, commands run, tests started, or implementation undertaken. Only explicit Human approval of this Plan version permits engineering handoff.

## Acceptance mapping

| Acceptance | Planned coverage | Tasks |
|---|---|---|
| AC-1 | Show Alex Chen, Sam Rivera, or Unassigned in queue entries and details, separately from requester information; retain references and existing content. | TASK-1, TASK-2, TASK-4, TASK-5, TASK-6 |
| AC-2 | Explicitly assign either roster member on details in all four statuses; persist ownership and update its timestamp without changing other fields. | TASK-1, TASK-2, TASK-3, TASK-4, TASK-6 |
| AC-3 | Replace the sole current owner on details in all four statuses; verify persistence after reopening, timestamp changes, and no duplicate records. | TASK-1, TASK-2, TASK-3, TASK-4, TASK-6 |
| AC-4 | Explicitly clear ownership on details in all four statuses; persist Unassigned, update the timestamp, and preserve status and content. | TASK-1, TASK-2, TASK-3, TASK-4, TASK-6 |
| AC-5 | Reject invalid identifiers, missing tickets, and non-roster values server-side without mutation; accept clearing. | TASK-1, TASK-2, TASK-3, TASK-4, TASK-6 |
| AC-6 | Surface persistence failures without success-shaped responses or changes to previously saved ownership, timestamps, or content. | TASK-1, TASK-2, TASK-3, TASK-4, TASK-6 |
| AC-7 | Apply the four-option owner filter conjunctively with search, status, and priority; preserve ordering, visible counts, global summaries, and no-results behavior. | TASK-1, TASK-2, TASK-5, TASK-6 |
| AC-8 | Preserve legacy data and timestamps; keep status and ownership saves independent, including unsaved selections; retain existing search and URL behavior. | TASK-1, TASK-2, TASK-3, TASK-4, TASK-5, TASK-6 |
| AC-9 | Keep creation fields and validation unchanged, with no owner control; create unassigned, open tickets and navigate to details. | TASK-1, TASK-2, TASK-3, TASK-4, TASK-6 |
| AC-10 | Reuse accessible dropdown conventions, exact option sets, and explicit Save/Apply interactions; exclude ownership editing from creation and queue entries. | TASK-1, TASK-4, TASK-5, TASK-6 |

## Tasks

All application paths below are relative to `demos/it-service-desk/` unless identified as repository-root paths. Dependencies are acyclic.

### TASK-1: Establish acceptance tests and controlled Red evidence

Depends on: none  
Acceptance: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10  
Surfaces: `src/lib/ticket-store.test.ts`, `src/app/page.test.tsx`, `src/app/custom-select.test.tsx`; focused new tests alongside `src/lib/ticket.ts`, `src/app/actions.ts`, ticket details, and the creation form; repository-root `docs/delivery-runs/brownfield-human-gated-delivery/1/expected-failures.json` in the later authorized Tests stage  
Validation: Existing tests remain Green; new feature tests collect and compile successfully, with every expected Red failure attributable to an acceptance assertion and recorded by exact full Vitest test name.

Prepare executable acceptance coverage before production changes, following the existing Vitest, React DOM, and jsdom patterns rather than introducing another test framework.

Use isolated stores and disposable legacy database fixtures. Include:

- Both roster members and unassigned tickets, with requester names deliberately distinct from ownership.
- Assignment, reassignment, and clearing across `open`, `in_progress`, `resolved`, and `closed`.
- Invalid mutations, persistence failures, both directions of status/ownership independence, and unsaved selections.
- Combined filters, reference-search variants, ordering, counts, empty results, and URLs without owner selections.
- Creation validation and the absence of ownership editing outside details.
- Keyboard operation, exact option sets, perceivable current values and errors, and explicit-save behavior.

Tests for behavior already present may pass immediately; do not force them to fail. Tests involving missing ownership APIs must reach explicit test-body assertions rather than fail through missing imports, setup exceptions, or compilation errors. Keep fixtures and cleanup independently valid.

In the later Tests stage, record every and only expected failing test in the existing version-1 manifest format, mapping each to its AC identifiers. Preserve approved documents and approval evidence unchanged.

### TASK-2: Add the ownership model and non-destructive SQLite support

Depends on: TASK-1  
Acceptance: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9  
Surfaces: `src/lib/ticket.ts`, `src/lib/ticket-store.ts`, `src/lib/ticket-store.test.ts`  
Validation: Model-validation tests; populated and empty legacy database migration tests; repeated initialization; assignment/reassignment/clearing matrices; database reopen checks; real SQLite write-failure tests; combined-filter tests.

Propose a shared, fixed roster with stable internal identifiers for exactly Alex Chen and Sam Rivera. Add a nullable current-owner field to `Ticket`, distinct from requester fields. Use `NULL` for persisted unassigned ownership; keep All owners and Unassigned filter selections distinct from assignable roster identities.

Add a dedicated ownership mutation schema validating the ticket identifier and exact roster identifiers. Accept the defined clearing representation without trimming or case-folding arbitrary nonempty values into valid identities.

Extend SQLite initialization with an idempotent schema inspection and additive nullable owner column. Apply a roster constraint for non-null values. Do not recreate the table, infer owners, rewrite ticket timestamps, or reset records. Map stored ownership through the existing row mapper.

The current constructor calls `seed()` whenever seeding is enabled, and `seed()` inserts fixtures whenever the table is empty. Separate genuinely new database initialization from reopening an existing database so ownership introduction cannot populate a pre-existing empty database. Retain automatic demo fixtures for a genuinely new database, all unassigned.

Add an ownership-only update that changes the owner and `updated_at` atomically. It must not write status or other ticket fields. Retain the existing status-only update, which already writes only status and `updated_at`, so it preserves the currently persisted owner.

Extend `list()` with an optional typed ownership restriction:

- A roster member adds an equality predicate.
- Unassigned adds an `IS NULL` predicate.
- All owners, or no owner selection, adds no ownership predicate.

Join this restriction with existing predicates using `AND`. Preserve parameter binding, reference normalization, priority-first/newest-created ordering, and the independent `summary()` query.

### TASK-3: Wire validated ownership saves and explicit failures

Depends on: TASK-2  
Acceptance: AC-2, AC-3, AC-4, AC-5, AC-6, AC-8, AC-9  
Surfaces: `src/app/actions.ts`, `src/lib/ticket.ts`, `src/lib/ticket-store.ts`; focused server-action tests  
Validation: Submit valid and forged FormData; verify validation and missing-ticket errors, unchanged database snapshots after rejection/failure, successful route revalidation, and status/owner independence.

Add a dedicated ownership server action that validates independently of client controls and invokes only the ownership store operation. Do not accept a submitted status as part of an ownership save.

Propose returning ownership field errors and an explicit failure message through the existing `TicketFormState`/`useActionState` pattern. Distinguish invalid input, a missing ticket, and persistence failure. Handle known persistence failures narrowly; do not silently suppress unexpected errors or place framework redirects inside an error handler that would swallow them.

Revalidate `/` and `/tickets/<id>` only after persistence succeeds. Follow existing successful navigation conventions, with no success response or redirect when validation or persistence fails.

Keep `updateTicketStatusAction` owner-independent: it must not read an unsaved owner selection or require ownership. Keep `createTicketAction` and its required-field validation unchanged; submitted extra ownership data must not result in an assigned new ticket.

### TASK-4: Show ownership and enable detail-only handoffs

Depends on: TASK-3  
Acceptance: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-8, AC-9, AC-10  
Surfaces: `src/app/tickets/[id]/page.tsx`, `src/app/custom-select.tsx`, `src/app/ticket-form.tsx`, `src/app/globals.css`; a focused detail ownership form component and related tests  
Validation: Rendered-detail checks, client interaction tests, independent-form submission tests, keyboard checks, error/pending-state checks, and reload verification across all four statuses.

Display a labeled Owner value in ticket details, separate from Requester.

Add a small ownership form using `CustomSelect`, containing exactly Alex Chen, Sam Rivera, and Unassigned, plus an explicit Save ownership button. Keep it separate from the existing status form; neither form submits the other form’s draft selection. Do not disable ownership editing based on status.

Reuse existing combobox behavior without rewriting it: arrow navigation, Home/End, typeahead, Enter/Space commit, Escape cancel, Tab/Shift+Tab commit and focus movement, and outside-pointer/blur commit. Committing a dropdown value changes only the form draft, not persisted ownership.

Associate the label and any ownership errors with the control, expose failure messages through an alert, and provide a pending state consistent with the creation form. Ensure refreshed saved values do not leave the control showing a stale default.

Leave `/tickets/new` and `TicketForm` without an ownership control or requirement. Do not add inline queue assignment.

### TASK-5: Add queue ownership visibility and filtering

Depends on: TASK-2  
Acceptance: AC-1, AC-7, AC-8, AC-10  
Surfaces: `src/app/page.tsx`, `src/app/globals.css`, `src/app/page.test.tsx`, `src/app/custom-select.test.tsx`  
Validation: Queue-rendering and URL-parameter tests; all ownership options with combined conditions; exact visible counts and global summaries; ordering and search regressions; keyboard, short-queue, empty-queue, and responsive-layout checks.

Show the current owner in every queue entry with clear ownership labeling while retaining reference, requester, category, status, priority, and updated-time information.

Add a labeled Owner filter to the existing GET filter form using exactly All owners, Alex Chen, Sam Rivera, and Unassigned. Selection alone must not apply the filter; retain Apply filters.

Parse the ownership query parameter using the dashboard’s existing first-value convention and a typed allowlist. Existing URLs without ownership remain unrestricted. All owners removes only ownership restriction, leaving search, status, and priority active.

Preserve queue links, no-results controls, the stable dashboard smoke marker, visible-result counting, and global summaries. Adjust styling only as necessary for the added information/control. Retain visible dropdown overflow above short and empty queues and usable narrow-screen layouts.

### TASK-6: Verify Green behavior and document the delivered workflow

Depends on: TASK-4, TASK-5  
Acceptance: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10  
Surfaces: Application tests, `README.md`, existing application validation and delivery checks; disposable SQLite fixtures  
Validation: All expected Red tests and existing tests pass; lint, TypeScript checking, and build succeed; AC-1 through AC-10 are exercised against the delivered application, including database reopen and accessibility checks.

In the later authorized Implementation stage, verify that the unchanged acceptance tests become Green through production behavior, not weakened assertions, skipped cases, or altered failure expectations.

Update the application README to describe the fixed roster, optional ownership, detail-only handoffs, combined filtering, unchanged creation, and legacy-data handling. Remove assignment from its list of wholly unimplemented follow-up features while retaining excluded capabilities such as assignment history, notifications, and access control. Do not alter workflow rules or approval instructions.

Use existing delivery checks unchanged. A successful build or dashboard smoke marker alone is not evidence that ownership, migration, filtering, and handoffs satisfy the acceptance scenarios.

## Risks and migrations

**Legacy preservation.** `CREATE TABLE IF NOT EXISTS` does not upgrade existing tables. Use explicit column detection and an additive migration before owner-aware queries run. Verify all original rows and fields, generated references, timestamps, and subsequent ID allocation. Test repeated reopening and a pre-existing empty database, not just a populated database.

**Seeding interaction.** Existing empty-table seeding is tightly coupled to the no-reseed requirement. Detect fresh initialization separately from an existing database; migration must never invoke a data reset or insert historical “replacement” fixtures.

**Deployment and recovery.** Validate migration on disposable copies of representative databases. Before deployment, arrange an operator-managed, consistent SQLite backup that accounts for WAL state. A migration failure must stop initialization explicitly rather than expose a partially working application. Prefer retaining the additive column during an application rollback; never drop ownership data as an automatic recovery step. Verify rollback compatibility on a copy before relying on it.

**Independent saves and stale pages.** Updating complete ticket snapshots could overwrite a newer owner or status. Use field-specific SQL updates against current persisted records. The plan does not add revision tokens, handoff acknowledgement, assignment history, or new conflict-resolution UI; those would expand the approved scope.

**Failure integrity.** Keep owner and timestamp writes in the same SQLite statement. Verify a genuine rejected database write leaves all saved fields intact, and separately verify that the action and form expose the failure. Test validation before mutation and avoid reporting success on zero-row updates.

**Roster consistency.** Share roster definitions across model validation, display, assignment options, and filter options. Reject unknown nonempty mutation values rather than normalizing spelling variations. Roster membership does not create accounts or authorization rights.

**UI delivery.** The added filter and ownership display may crowd the queue. Check narrow screens, dropdown stacking, empty queues, focus movement, and errors without removing existing ticket information.

**Scope and evidence.** No external identity integration, authentication changes, notifications, SLA policies, or audit history are included. Handoff frequency, impact, quantitative improvement targets, and usability evidence remain unknown; functional acceptance must not be represented as measured operational improvement. The supplied decision records contain no explicit deferred decisions or risks to reinterpret as resolved.

## Validation

Validation below is planned for authorized engineering stages, not performed during this document review.

**Controlled Red**

- Keep production code and approved lifecycle documents unchanged during test authoring.
- Confirm existing tests remain Green and new tests compile and collect.
- Record exact full test names and AC mappings in the expected-failures manifest.
- Require failures from feature assertions inside test bodies, not imports, syntax, hooks, infrastructure, unhandled exceptions, or cleanup.
- List every and only expected failing test; exclude passing regressions and reject skipped or duplicate evidence.

**Green verification**

- Run focused model/store, action, dashboard, details, creation, and dropdown tests while implementing.
- Re-run the complete application suite after the change; all previously expected failures must pass without weakening their acceptance assertions.
- Use Node.js 24 or newer. From `demos/it-service-desk/`, run `npm test`, `npm run lint`, `npx tsc --noEmit --incremental false`, and `npm run build`.
- Use in-memory databases for ordinary tests and disposable file-backed databases for legacy migration, reopen, and failure tests. Never target the checkout’s `data/service-desk.db`.

**Acceptance evidence**

- Exercise assignment, reassignment, and clearing in each existing status, capturing before/after snapshots of all unaffected fields and using controlled time for timestamp assertions.
- Reopen the file-backed database and application to verify persistence.
- Submit invalid IDs, missing-ticket IDs, All owners, arbitrary names, and case/whitespace variants directly to the ownership action; verify explicit errors and no mutations.
- Exercise both unsaved-selection directions: Save status preserves persisted ownership; Save ownership preserves persisted status.
- Test title, requester, full reference, `1`, `0001`, and `inc-1` searches with case and surrounding-whitespace variations across assigned and unassigned tickets.
- Verify every ownership filter with combined search/status/priority, All owners removal, ordering, visible counts, global summaries, and no-results controls.
- Confirm creation has no ownership input, remains server-validated, creates an unassigned open ticket, and navigates to details.
- Inspect accessible labels, values, errors, exact options, keyboard operation, commit/cancel behavior, and explicit Save/Apply boundaries. Supplement jsdom checks with real-browser keyboard and assistive-technology review against the delivered application.

## Revision summary

This is the initial Plan draft; no previous Plan document was supplied. TASK-1 through TASK-6 establish stable identifiers for subsequent revisions.

The draft translates approved AC-1 through AC-10 into test, persistence, server-action, details, queue, and verification work. It preserves the Human decisions on optional ownership, the exact two-person roster, conjunctive owner filtering, and detail-only editing in every status.

Implementation proposals include nullable stable roster identifiers, an additive SQLite migration, field-specific updates, action-state error presentation, and reuse of existing dropdowns. None substitutes for a Human decision or rewrites the approved specification.

Application inspection additionally identifies existing empty-table seeding as a compatibility risk requiring targeted handling. No implementation, test results, or Plan approval is claimed.

## Open questions

**No unresolved consequential Spec decisions or identified Spec conflicts.** Q-1 through Q-4 are resolved by the supplied trusted Human decisions; their historical alternatives are not current requirements.

The specification does not define repeated saves of an unchanged owner or malformed owner-filter URLs. Proposed implementation defaults are to leave the timestamp unchanged for a no-op ownership save and treat an unknown filter selection as unrestricted, consistent with existing invalid status/priority URL handling. These are reviewable implementation proposals, not recorded Human decisions.

The remaining trade-off is retaining the application’s existing update concurrency model rather than adding same-field conflict detection. Field-specific updates satisfy the approved status/ownership independence requirement; stronger concurrent-handoff guarantees would require explicit scope review.

If the Human requires different acceptance behavior for these cases, or identifies a conflict with the approved specification, request an explicit Spec revision and invalidate this draft Plan rather than silently changing the Spec. Unknown impact and usability measurements remain unknown and do not block the defined functional acceptance.

Only explicit Human approval of this Plan version permits engineering handoff.

