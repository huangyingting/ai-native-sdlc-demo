# Specification

## Intent

Human Intent #1, **Make ticket ownership visible and support handoffs**, seeks to help service-desk agents and team leads understand who is responsible for a ticket, identify requests without an owner, and transfer responsibility without losing existing requests.

This revision incorporates the recorded Human decisions for Q-1 and Q-2:

- Ownership is optional for every ticket. Existing and newly created tickets may remain unassigned. Agents may assign, reassign, or clear the owner.
- Tickets without an owner display **Unassigned**. Historical owners must not be inferred or backfilled.
- Owners are selected from a predefined local roster containing exactly **Alex Chen** and **Sam Rivera**. Only these roster members are valid nonempty owners; free-text ownership is not accepted.

Filtering and assignment surfaces remain subject to Q-3 and Q-4. The recorded decisions do not constitute approval of this specification version.

## Scope

The improvement introduces at most one current owner per ticket, distinct from the requester.

**Recorded requirements from Q-1 and Q-2:**

- Allow existing and newly created tickets to remain unassigned.
- Allow agents to assign, reassign, or clear ownership.
- Display tickets without an owner as **Unassigned**.
- Do not infer or backfill owners for historical tickets.
- Offer exactly Alex Chen and Sam Rivera as roster members for ownership selection.
- Reject nonempty ownership values that do not identify one of these roster members.
- Do not accept free-text owner names or provide roster administration.

**Proposed behavior pending specification approval:**

- Display ownership in both the ticket queue and ticket details.
- Persist ownership changes in the existing local database.
- Validate ownership submissions on the server and explicitly report rejected or failed changes.
- Keep status updates independent of ownership changes.
- Update the last-updated timestamp when ownership changes, without changing other ticket content.

**Proposed options, not agreed requirements:**

- Provide assignment controls on ticket details; optionally also provide assignment during creation, subject to Q-4.
- Provide a queue filter for a specific roster member or Unassigned, subject to Q-3.
- Allow ownership changes across all existing statuses, subject to Q-4.

No option may make ownership mandatory or expand the recorded roster.

## Non-goals

External identity integrations, authentication changes, notifications, and SLA policies are outside this change.

The proposal also excludes multiple simultaneous owners, assignment history, comments, automatic routing, workload balancing, reporting, roster administration, and replacement of the service-desk application.

A handoff changes the current owner; it does not imply recipient acknowledgement, a notification, or an auditable assignment history. Ownership does not establish a new authorization role or make the requester responsible for handling the ticket.

Free-text ownership and additional roster members are not alternatives in the current proposed behavior because Q-2 specifies exactly Alex Chen and Sam Rivera.

## Actors

- **Service-desk agent:** views ownership and assigns, reassigns, or clears an owner.
- **Team lead:** reviews responsibility and unowned work and coordinates handoffs through the existing application. This does not imply additional permissions.
- **Roster member:** Alex Chen or Sam Rivera, either of whom may be the ticket's current owner. Roster membership does not introduce a login account or identity integration.
- **Ticket requester:** remains the person whose incident or request is recorded; requester identity is separate from ownership.
- **Human Intent owner and configured reviewers:** decide unresolved requirements and inspect the revised specification before explicitly approving a version. AI comments, checklists, and successful validation are not approval.

## Constraints

Read-only inspection of `demos/it-service-desk` confirms that the application stores tickets in local SQLite through `node:sqlite`. Its ticket model includes requester information, status, priority, category, description, reference, and timestamps, but no owner. The queue supports text search, status filtering, and priority filtering. Ticket details currently support status updates.

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

All ownership controls must select from the same fixed roster: Alex Chen and Sam Rivera, with an Unassigned choice where ownership can be set or cleared. No free-text name entry is permitted. Server validation must enforce roster membership independently of client-side controls. Submitted values must identify a roster member, not create a new identity through spelling, case, or whitespace variations. The internal representation of roster identities is an implementation detail; visible names and membership are fixed.

Invalid submissions, missing tickets, and persistence failures must not appear successful. Absence of an owner is valid, not an ownership-validation error.

The proposal is that a successful assignment, reassignment, or clearing updates the last-updated timestamp without changing status, requester information, or other ticket content. Ownership changes across all existing statuses remain proposed under Q-4, not a recorded decision.

## Discovery

```json
{
  "problem": "Service-desk agents and team leads cannot see ticket responsibility or identify an agent's assigned work because the existing application has no ownership field. This makes handoffs unclear.",
  "evidence": "The supplied Human Intent reports the problem. Read-only inspection of demos/it-service-desk/src/lib/ticket.ts, src/lib/ticket-store.ts, src/app/actions.ts, src/app/page.tsx, src/app/tickets/[id]/page.tsx, src/app/ticket-form.tsx, and src/app/custom-select.tsx confirms the absence of ownership, the existing SQLite persistence and workflows, and dropdown behavior. User interviews, handoff observations, frequency, and impact measurements were not supplied and are Unknown.",
  "successMeasure": "Observable functional success is that users can distinguish Alex Chen, Sam Rivera, and Unassigned ownership, assign, reassign, or clear responsibility, and see the persisted result without losing existing requests or requiring ownership during intake. Finding a particular agent's work through filtering depends on Q-3. No baseline, quantitative improvement target, or usability evidence was supplied.",
  "alternatives": "Do nothing preserves the application but leaves ownership unclear. Visibility without editing is smaller but would not satisfy the recorded assignment, reassignment, and clearing requirement. Detail-page assignment without owner filtering supports handoffs but requires scanning the queue. Adding assignment during creation supports earlier ownership selection but expands intake. A fixed local roster provides consistent identities without account integration and is the recorded Q-2 choice. Free-text ownership risks inconsistent names and is not compatible with Q-2. Mandatory ownership is not compatible with Q-1.",
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
      "explanation": "AC-1 requires the Unassigned label. AC-2 and AC-3 require assignment and reassignment capabilities. AC-4 permits clearing without requiring a replacement owner. AC-5 treats absence of an owner as valid. AC-7 includes an Unassigned selection if filtering is chosen, while filtering itself remains undecided. AC-8 preserves historical tickets as unassigned without inference or backfill. AC-9 permits creation without an owner; intake assignment remains subject to Q-4."
    },
    {
      "questionId": "Q-2",
      "commentId": 6117828551,
      "acceptanceIds": ["AC-1", "AC-2", "AC-3", "AC-5", "AC-7", "AC-9", "AC-10"],
      "explanation": "AC-1 displays the fixed roster member's name. AC-2 and AC-3 use Alex Chen and Sam Rivera for assignment and handoff. AC-5 rejects nonempty values outside the fixed roster even when client controls are bypassed. AC-7 limits any selected owner filter to these two roster identities, alongside All owners and Unassigned. AC-9 applies the same roster selection and validation if intake assignment is chosen. AC-10 requires selection controls offering exactly the two roster members and Unassigned rather than free-text ownership. Roster administration and external identity integration remain out of scope; Q-3 and Q-4 are still unanswered."
    }
  ]
}
```

## Acceptance scenarios

Q-1 establishes optional ownership, assignment, reassignment, and clearing. Q-2 establishes the fixed roster and excludes free-text owners. The scenarios below incorporate both decisions while retaining explicit dependencies on unanswered Q-3 and Q-4. Other proposed details require review and approval of this specification.

### AC-1: See current ownership

**Given** a ticket is owned by Alex Chen or Sam Rivera, or has no owner.  
**When** an agent views its queue entry or ticket details.  
**Then** both surfaces display **Alex Chen**, **Sam Rivera**, or **Unassigned**, respectively, clearly distinguished from the requester; the ticket reference and existing ticket information remain available.

### AC-2: Assign an unowned ticket

**Given** an existing unassigned ticket and an ownership selection control offering exactly Alex Chen, Sam Rivera, and Unassigned.  
**When** an agent selects Alex Chen or Sam Rivera and saves using the assignment surface selected in Q-4.  
**Then** the ticket has the selected roster member as its sole owner, its last-updated timestamp reflects the change, and details and queue show the saved ownership after reloading; its ID, reference, status, requester, and other content remain unchanged.

### AC-3: Hand off an owned ticket

**Given** a ticket is owned by Alex Chen or Sam Rivera.  
**When** an agent selects the other roster member and saves using the surface selected in Q-4.  
**Then** the ticket has exactly one current owner, the replacement remains visible after reopening the application, and the last-updated timestamp reflects the change; no duplicate ticket or automatic status change is created, and other ticket content remains unchanged.

### AC-4: Clear ownership

**Given** a ticket currently has an owner.  
**When** an agent selects Unassigned and saves using the surface selected in Q-4.  
**Then** the change succeeds, the saved ticket displays **Unassigned** in details and queue after reloading, and its last-updated timestamp reflects the change; no replacement owner is inferred, and status and other ticket information remain unchanged.

### AC-5: Reject invalid ownership updates

**Given** an ownership update contains an invalid ticket identifier, refers to a missing ticket, or contains a nonempty owner value that does not identify Alex Chen or Sam Rivera.  
**When** the update is submitted, including by bypassing client-side controls.  
**Then** server-side validation or ticket lookup rejects it, an explicit error is surfaced, and no ticket, owner identity, ownership value, or timestamp is created or changed.

**Given** an existing ticket and an update requesting no owner.  
**When** the agent submits the clearing operation.  
**Then** absence of an owner is accepted under Q-1 and is not treated as invalid input; AC-4 applies.

### AC-6: Do not report a failed handoff as successful

**Given** a valid assignment, reassignment, or clearing operation cannot be persisted.  
**When** an agent submits the change.  
**Then** the application surfaces the failure rather than confirming success, and the previously saved ownership, timestamps, and ticket content remain intact.

### AC-7: Find tickets by owner if filtering is selected

**Given** Q-3 selects owner filtering and the queue contains tickets owned by Alex Chen, tickets owned by Sam Rivera, and unassigned tickets.  
**When** a user selects **Alex Chen**, **Sam Rivera**, **Unassigned**, or **All owners** and applies the filters.  
**Then** the queue shows only tickets matching that ownership selection together with the active search, status, and priority filters; ownership matching uses the selected roster identity; All owners removes only the ownership restriction; ordering remains unchanged; the visible count matches the results; and dashboard summary counts remain global.

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

**Given** Q-4 selects assignment during creation and the user selects Alex Chen or Sam Rivera with otherwise valid ticket information.  
**When** the user submits the creation form.  
**Then** the new ticket persists the selected roster member as its sole owner and displays that name in details and queue.

**Given** existing required ticket information is invalid, or intake assignment is selected and a submitted nonempty ownership value does not identify Alex Chen or Sam Rivera.  
**When** the user submits the creation form, including by bypassing client-side controls.  
**Then** validation reports the relevant error and creates no ticket or new owner identity. Omitting an owner alone is never a creation error.

If Q-4 selects detail-only assignment, the creation form remains without an ownership control and newly created tickets are unassigned until explicitly assigned afterward.

### AC-10: Operate ownership controls accessibly

**Given** a user operates an ownership assignment control using a keyboard or assistive technology.  
**When** the user reads, selects, clears, or saves ownership.  
**Then** the control offers exactly **Alex Chen**, **Sam Rivera**, and **Unassigned**, without free-text owner entry; it has a meaningful label; its current value and errors are perceivable; and operation does not require a pointer.

**Given** an ownership control uses a dropdown.  
**When** a user navigates, commits, or cancels a selection.  
**Then** it follows the existing combobox navigation, commit, cancel, and focus behavior; selecting a value does not by itself persist an ownership change. Any owner-filter control approved under Q-3 follows the same accessibility conventions and additionally offers All owners.

## Revision summary

Revision 3 applies the recorded Q-2 decision from comment `6117828551` while preserving the Q-1 decision from comment `6117772868`.

The owner-identity policy is no longer an unresolved choice. The proposed behavior now uses a predefined local roster containing exactly Alex Chen and Sam Rivera, excludes free-text entry, and requires server-side rejection of nonempty values outside that roster. Ownership visibility, assignment, handoff, conditional filtering, conditional intake assignment, and accessible controls now name or enforce the fixed roster. Unassigned remains valid throughout.

All four discovery questions and their options are preserved exactly, including the questions with recorded outcomes. AC-1 through AC-10 retain their identifiers. Each supplied latest decision has exactly one mapping entry describing its effect on existing acceptance scenarios.

Read-only application inspection grounds the compatibility requirements. No implementation or specification approval is claimed. Q-3 and Q-4 remain unanswered.

## Open questions

The following unanswered questions block approval until a configured Human records a decision or deferment:

- **Q-3 — Finding assigned work:** decide whether queue visibility is sufficient or a dedicated owner filter is required. Visibility only leaves users scanning the queue to find an agent's work. If filtering is chosen, the proposed choices are All owners, Alex Chen, Sam Rivera, and Unassigned, combined with existing filters.
- **Q-4 — Assignment surfaces:** choose detail-only assignment or creation plus details, and confirm whether ownership changes remain available across all existing statuses. Any restriction needs an explicit Human decision. Ownership remains optional, and any ownership selection must use the fixed roster.

Q-1 and Q-2 have recorded outcomes and remain in the discovery register for traceability; they are not unanswered questions. Their preserved mandatory-ownership and free-text options are historical alternatives, not current proposed requirements. The conditional mandatory-intake language preserved in Q-4's options does not override Q-1.

No deferments were supplied. Handoff frequency, impact, and quantitative success targets remain unknown; this specification makes no measured-benefit claim. The Human must inspect the revised specification after decisions are recorded and explicitly approve a version.

