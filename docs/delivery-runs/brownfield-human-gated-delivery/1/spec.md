# Specification

## Intent

Human Intent #1, **Make ticket ownership visible and support handoffs**, seeks to help service-desk agents and team leads understand who is responsible for a ticket, identify requests without an owner, and transfer responsibility without losing existing requests.

This revision incorporates the recorded Human decision for Q-1: ownership is optional for every ticket. Existing and newly created tickets may remain unassigned. Agents may assign, reassign, or clear the owner. Tickets without an owner display **Unassigned**, and historical owners must not be inferred or backfilled.

Owner identity, filtering, and assignment surfaces remain subject to Q-2 through Q-4. The Q-1 decision does not constitute approval of this specification version.

## Scope

The improvement introduces at most one current owner per ticket, distinct from the requester.

**Recorded requirement from Q-1:**

- Allow existing and newly created tickets to remain unassigned.
- Allow agents to assign, reassign, or clear ownership.
- Display tickets without an owner as **Unassigned**.
- Do not infer or backfill owners for historical tickets.

**Proposed behavior pending specification approval:**

- Display ownership in both the ticket queue and ticket details.
- Persist ownership changes in the existing local database.
- Validate ownership submissions on the server and explicitly report rejected or failed changes.
- Keep status updates independent of ownership changes.

**Proposed options, not agreed requirements:** use a predefined local roster, provide assignment controls on ticket details, and allow queue filtering by a specific owner or Unassigned. Q-2 determines owner identity and validation, Q-3 determines whether filtering is required, and Q-4 determines whether assignment is also available during creation and whether any status-based restrictions apply.

## Non-goals

External identity integrations, authentication changes, notifications, and SLA policies are outside this change.

The proposal also excludes multiple simultaneous owners, assignment history, comments, automatic routing, workload balancing, reporting, roster administration, and replacement of the service-desk application.

A handoff changes the current owner; it does not imply recipient acknowledgement, a notification, or an auditable assignment history. Ownership does not establish a new authorization role or make the requester responsible for handling the ticket.

## Actors

- **Service-desk agent:** views ownership and assigns, reassigns, or clears an owner.
- **Team lead:** reviews responsibility and unowned work and coordinates handoffs through the existing application. This does not imply additional permissions.
- **Ticket requester:** remains the person whose incident or request is recorded; requester identity is separate from ownership.
- **Human Intent owner and configured reviewers:** decide unresolved requirements and inspect the revised specification before explicitly approving a version. AI comments, checklists, and successful validation are not approval.

## Constraints

The existing application in `demos/it-service-desk` stores tickets in local SQLite through `node:sqlite`. Its ticket model has requester information, status, priority, category, description, reference, and timestamps, but no owner. The queue supports text search, status filtering, and priority filtering. Ticket details currently support status updates.

Ownership support must preserve:

- Existing ticket IDs, `INC-` references, content, requester information, status, priority, category, and creation timestamps.
- Existing routes: `/`, `/tickets/new`, and `/tickets/<id>`.
- Ticket creation without an owner and status updates without unintended ownership changes.
- Status values `open`, `in_progress`, `resolved`, and `closed`. Ownership must not become a prerequisite for creation or status changes.
- Case-insensitive title, requester-name, and reference search, including numeric and shortened references such as `1`, `0001`, and `inc-1`, with surrounding whitespace ignored.
- Combined search, status, and priority filters; priority-first queue ordering followed by newest creation time; and dashboard-wide summary counts independent of queue filters.
- Existing creation-field validation, initial `open` status, and navigation to the created ticket's details.
- Accessible labeled controls and existing dropdown navigation, commit, cancel, and focus conventions.

Introducing ownership must not reset or reseed an existing database, fabricate owners, or rewrite existing timestamps merely because ownership support was introduced. Historical tickets remain unassigned until an agent explicitly assigns an owner.

Ownership writes must be server-validated. Invalid submissions, missing tickets, and persistence failures must not appear successful. Absence of an owner is valid, not an ownership-validation error. Q-2 must define which nonempty owner values are valid.

The proposal is that a successful assignment, reassignment, or clearing updates the last-updated timestamp without changing status, requester information, or other ticket content. Ownership changes across all existing statuses are proposed under Q-4, not yet a recorded decision.

## Discovery

```json
{
  "problem": "Service-desk agents and team leads cannot see ticket responsibility or identify an agent's assigned work because the existing application has no ownership field. This makes handoffs unclear.",
  "evidence": "The supplied Human Intent reports the problem. Read-only inspection of demos/it-service-desk/src/lib/ticket.ts, src/lib/ticket-store.ts, src/app/actions.ts, src/app/page.tsx, src/app/tickets/[id]/page.tsx, src/app/ticket-form.tsx, and src/app/custom-select.tsx confirms the absence of ownership, the existing SQLite persistence and workflows, and dropdown behavior. User interviews, handoff observations, frequency, and impact measurements were not supplied and are Unknown.",
  "successMeasure": "Observable functional success is that users can distinguish owned from unassigned tickets, assign, reassign, or clear responsibility, and see the persisted result without losing existing requests or requiring ownership during intake. Finding a particular agent's work depends on Q-3. No baseline, quantitative improvement target, or usability evidence was supplied.",
  "alternatives": "Do nothing preserves the application but leaves ownership unclear. Visibility without editing is smaller but would not satisfy the recorded assignment, reassignment, and clearing requirement. Detail-page assignment without owner filtering supports handoffs but requires scanning the queue. Optional local-roster ownership gives consistent labels but needs agreed roster contents. Optional free-text ownership avoids roster setup but risks inconsistent names and ambiguous owner matching. Mandatory ownership is not compatible with the recorded Q-1 outcome.",
  "questions": [
    {
      "id": "Q-1",
      "question": "May tickets remain unassigned, including new tickets and tickets that predate ownership support?",
      "options": "Optional ownership permits unassigned tickets and clearing an owner. Mandatory ownership for new tickets with a legacy-ticket exception preserves old records but changes intake and prevents later clearing. Mandatory ownership for every ticket requires a Human-specified transition policy and must not fabricate owners or lose existing requests."
    },
    {
      "id": "Q-2",
      "question": "How should owners be identified and validated?",
      "options": "A predefined local roster provides consistent identities and exact matching; the Human must supply its members and distinguish duplicate display names. Free text avoids roster setup; the Human must specify acceptable names, length limits, and whitespace/case equivalence so validation and any filtering are unambiguous. Roster administration and external identity integration are not proposed."
    },
    {
      "id": "Q-3",
      "question": "Is queue visibility sufficient, or must users filter tickets by ownership?",
      "options": "Visibility only is smaller but requires scanning to find an agent's work. A dedicated owner filter supports All owners, a specific owner, and Unassigned where applicable, combined with existing filters; it adds a control and requires defined owner matching under Q-2."
    },
    {
      "id": "Q-4",
      "question": "Where should users assign or change ownership?",
      "options": "Ticket details only is the smaller change and keeps intake unchanged when ownership is optional. Creation plus ticket details permits assignment during intake and is needed if new tickets require an owner. The proposal allows changes in every existing status and keeps status saves independent of ownership; any restriction needs an explicit Human decision."
    }
  ],
  "decisionMapping": [
    {
      "questionId": "Q-1",
      "commentId": 6117772868,
      "acceptanceIds": ["AC-1", "AC-2", "AC-3", "AC-4", "AC-5", "AC-7", "AC-8", "AC-9"],
      "explanation": "AC-1 requires the Unassigned label. AC-2 and AC-3 retain assignment and reassignment as required capabilities. AC-4 now unconditionally permits clearing rather than retaining a mandatory-ownership branch. AC-5 explicitly treats absence of an owner as valid. AC-7 requires an Unassigned selection if filtering is chosen, while filtering itself remains undecided. AC-8 requires historical tickets to remain unassigned without inferred or backfilled owners. AC-9 preserves creation without an owner and removes the mandatory-owner rejection branch; intake assignment remains subject to Q-4."
    }
  ]
}
```

## Acceptance scenarios

Q-1 establishes optional ownership and assignment, reassignment, and clearing. The scenarios below incorporate that decision while retaining explicit dependencies on unanswered Q-2 through Q-4. Other proposed details require review and approval of this specification.

### AC-1: See current ownership

**Given** a ticket has a saved owner or has no owner.  
**When** an agent views its queue entry or ticket details.  
**Then** both surfaces display the current owner's label or **Unassigned**, clearly distinguished from the requester; the ticket reference and existing ticket information remain available.

### AC-2: Assign an unowned ticket

**Given** an existing unassigned ticket and an owner value valid under the policy selected in Q-2.  
**When** an agent saves that owner using the assignment surface selected in Q-4.  
**Then** the ticket has that owner, its last-updated timestamp reflects the change, and details and queue show the saved ownership after reloading; its ID, reference, status, requester, and other content remain unchanged.

### AC-3: Hand off an owned ticket

**Given** a ticket is owned by one agent and another owner is valid under Q-2.  
**When** an agent saves the replacement owner using the surface selected in Q-4.  
**Then** the ticket has exactly one current owner, the replacement remains visible after reopening the application, and the last-updated timestamp reflects the change; no duplicate ticket or automatic status change is created, and other ticket content remains unchanged.

### AC-4: Clear ownership

**Given** a ticket currently has an owner.  
**When** an agent clears ownership and saves the change using the surface selected in Q-4.  
**Then** the change succeeds, the saved ticket displays **Unassigned** in details and queue after reloading, and its last-updated timestamp reflects the change; no replacement owner is inferred, and status and other ticket information remain unchanged.

### AC-5: Reject invalid ownership updates

**Given** an ownership update contains an invalid ticket identifier, refers to a missing ticket, or contains a nonempty owner value invalid under Q-2, including an unknown roster member if a roster is chosen.  
**When** the update is submitted, including by bypassing client-side controls.  
**Then** server-side validation or ticket lookup rejects it, an explicit error is surfaced, and no ticket or ownership value is created or changed.

**Given** an existing ticket and an update requesting no owner.  
**When** the agent submits the clearing operation.  
**Then** absence of an owner is accepted under Q-1 and is not treated as invalid input; AC-4 applies.

### AC-6: Do not report a failed handoff as successful

**Given** a valid assignment, reassignment, or clearing operation cannot be persisted.  
**When** an agent submits the change.  
**Then** the application surfaces the failure rather than confirming success, and the previously saved ownership, timestamps, and ticket content remain intact.

### AC-7: Find tickets by owner if filtering is selected

**Given** Q-3 selects owner filtering and the queue contains tickets owned by different agents and unassigned tickets.  
**When** a user selects a specific owner, **Unassigned**, or **All owners** and applies the filters.  
**Then** the queue shows only tickets matching that ownership selection together with the active search, status, and priority filters; All owners removes only the ownership restriction, ordering remains unchanged, the visible count matches the results, and dashboard summary counts remain global. Owner matching follows Q-2.

**Given** that combined selection matches no tickets.  
**When** the queue is displayed.  
**Then** the existing no-results state remains available, with controls that let the user change the filters.

If Q-3 selects visibility only, this scenario does not require an owner filter; finding assigned work remains limited to inspecting the queue.

### AC-8: Preserve existing tickets and workflows

**Given** a database created before ownership support, containing tickets in any existing status.  
**When** ownership support is introduced and users reopen existing tickets, search the queue, or save a status change.  
**Then** all existing records and references remain available; historical tickets display **Unassigned** until explicitly assigned; owners are neither inferred nor backfilled; migration does not rewrite ticket timestamps; existing search and filter semantics remain unchanged; and a status save does not change ownership or require an owner.

### AC-9: Create tickets with optional ownership

**Given** a user supplies otherwise valid new-ticket information and no owner.  
**When** the user submits the creation form.  
**Then** creation succeeds without an ownership requirement, the ticket displays **Unassigned**, its initial status remains `open`, and successful creation opens the new ticket's details.

**Given** Q-4 selects assignment during creation and the user supplies an owner valid under Q-2 with otherwise valid ticket information.  
**When** the user submits the creation form.  
**Then** the new ticket persists that owner and displays it in details and queue.

**Given** existing required ticket information is invalid, or intake assignment is selected and a supplied nonempty owner is invalid under Q-2.  
**When** the user submits the creation form.  
**Then** validation reports the relevant error and creates no ticket. Omitting an owner alone is never a creation error.

### AC-10: Operate ownership controls accessibly

**Given** a user operates any proposed ownership control using a keyboard or assistive technology.  
**When** the user reads, selects, clears, or saves ownership.  
**Then** the control has a meaningful label, its current value and errors are perceivable, and operation does not require a pointer. If a dropdown is used, it follows the existing combobox navigation, commit, cancel, and focus behavior; selecting a value does not by itself persist an ownership change.

## Revision summary

Revision 2 applies the recorded Q-1 decision from comment `6117772868` to the proposed behavior and acceptance scenarios.

Optional ownership is no longer merely a proposed option. Clearing is explicitly permitted, new tickets may be created without an owner, and historical tickets remain unassigned without inference or backfill. Mandatory-ownership branches and the unresolved legacy-transition caveat have been removed. Invalid-input behavior now explicitly distinguishes an invalid nonempty owner from a valid request for no owner.

All four discovery questions and their options are preserved exactly, including Q-1. AC-1 through AC-10 retain their identifiers. The decision mapping identifies affected scenarios without asserting that behavior has been implemented.

Read-only application inspection confirms the current model, persistence, queue, creation, status-update, and dropdown behavior. No implementation or approval is claimed. Q-2 through Q-4 remain unanswered.

## Open questions

The following unanswered questions block approval until a configured Human records a decision or deferment:

- **Q-2 — Owner identity:** choose a local roster or free text and supply the roster contents and identity distinctions, or the naming, validation, and matching rules.
- **Q-3 — Finding assigned work:** decide whether queue visibility is sufficient or a dedicated owner filter is required. Visibility only leaves users scanning the queue to find an agent's work.
- **Q-4 — Assignment surfaces:** choose detail-only assignment or creation plus details, and confirm whether ownership changes remain available across all existing statuses. Regardless of the selected surface, ownership must remain optional under Q-1.

Q-1 has a recorded outcome and remains in the discovery register for traceability; it is not an unanswered question. Its preserved mandatory-ownership options are historical alternatives, not current proposed requirements.

No deferments were supplied. Handoff frequency, impact, and quantitative success targets remain unknown; this specification makes no measured-benefit claim. The Human must inspect this revised specification after decisions are recorded and explicitly approve a version.

