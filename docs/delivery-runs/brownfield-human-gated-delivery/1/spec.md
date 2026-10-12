# Specification

## Intent

Human Intent #1, **Make ticket ownership visible and support handoffs**, seeks to help service-desk agents and team leads understand who is responsible for a ticket, identify unowned requests, and transfer responsibility without losing existing requests.

This revision incorporates the recorded Human decisions for Q-1, Q-2, and Q-3:

- Ownership is optional. Existing and newly created tickets may remain unassigned. Agents may assign, reassign, or clear ownership. Tickets without an owner display **Unassigned**, and historical owners must not be inferred or backfilled.
- Owners come from a predefined local roster containing exactly **Alex Chen** and **Sam Rivera**. Only these roster members are valid nonempty owners; free-text ownership is not accepted.
- The ticket list includes an owner filter with **All owners**, **Alex Chen**, **Sam Rivera**, and **Unassigned** options. Ownership restrictions combine with existing search and filters: tickets must satisfy every active condition. All owners imposes no ownership restriction and preserves existing search and filtering behavior.

Assignment surfaces and status-related restrictions remain subject to Q-4. Recorded decisions establish these requirements but do not constitute approval of this specification version.

## Scope

Introduce at most one current owner per ticket, distinct from its requester, within the existing application at `demos/it-service-desk`.

**Recorded requirements from Q-1 through Q-3:**

- Permit unassigned tickets during intake and afterward.
- Support assignment, reassignment, and clearing of ownership.
- Display missing ownership as **Unassigned**, without inferring or backfilling historical owners.
- Select owners from exactly Alex Chen and Sam Rivera; reject nonempty values outside this roster.
- Provide a ticket-list owner filter offering All owners, Alex Chen, Sam Rivera, and Unassigned.
- Combine the selected ownership restriction with existing text search, status, and priority conditions.
- Preserve existing search and filtering behavior when All owners is selected.
- Exclude free-text ownership, roster administration, and external identity integration.

**Proposed behavior for specification review, not separately recorded Human decisions:**

- Display ownership in both queue entries and ticket details.
- Persist ownership changes in the existing local database.
- Validate ownership submissions on the server and explicitly surface rejected or failed changes.
- Keep status saves independent of ownership changes.
- Update the last-updated timestamp when ownership changes, without changing other ticket content.
- Preserve queue ordering, visible-result counts, and global dashboard summary counts.
- Keep existing queue URLs without an ownership selection unrestricted by ownership.

**Options pending Q-4:**

- Provide assignment on ticket details only, or during creation as well as on ticket details.
- Allow ownership changes in every existing status, as proposed, or apply explicitly Human-specified restrictions.

Neither option may make ownership mandatory or expand the recorded roster.

## Non-goals

External identity integrations, authentication changes, notifications, and SLA policies are outside this change.

The proposal also excludes multiple simultaneous owners, assignment history, comments, automatic routing, workload balancing, reporting, roster administration, and replacement of the service-desk application.

A handoff changes the current owner. It does not imply recipient acknowledgement, notification, or an auditable assignment history. Ownership does not introduce authorization roles or make the requester responsible for handling the ticket.

Visibility-only filtering alternatives, mandatory ownership, and free-text owners remain in the preserved discovery register for traceability; they are not current proposed behavior because they conflict with recorded Q-1, Q-2, or Q-3 outcomes.

## Actors

- **Service-desk agent:** views ownership, finds owned or unassigned work, and assigns, reassigns, or clears responsibility.
- **Team lead:** reviews responsibility and unowned work and coordinates handoffs through the existing application. This does not imply additional permissions.
- **Roster member:** Alex Chen or Sam Rivera, either of whom may be the current owner. Roster membership does not create a login account or identity integration.
- **Ticket requester:** the person whose incident or request is recorded; requester identity remains separate from ownership.
- **Human Intent owner and configured reviewers:** decide unresolved requirements and inspect the revised specification before explicitly approving a version. AI comments, checklists, and successful validation are not approval.

## Constraints

Read-only inspection of the existing application confirms that tickets are stored in local SQLite through `node:sqlite`. The ticket model contains requester information, status, priority, category, description, reference, and timestamps, but no owner. The queue supports text search, status filtering, and priority filtering. Ticket details currently support status updates.

Ownership support must preserve:

- Existing ticket IDs, `INC-` references, content, requester information, status, priority, category, and creation timestamps.
- Existing routes: `/`, `/tickets/new`, and `/tickets/<id>`.
- Creation without an owner and status updates without unintended ownership changes.
- Existing statuses: `open`, `in_progress`, `resolved`, and `closed`. Ownership must not become a prerequisite for creation or status changes.
- Case-insensitive title, requester-name, and reference search, including numeric and shortened references such as `1`, `0001`, and `inc-1`, with surrounding whitespace ignored.
- Existing combined search, status, and priority filtering.
- Priority-first queue ordering followed by newest creation time.
- Dashboard-wide summary counts independent of queue filters, including the new owner filter.
- Existing creation-field validation, initial `open` status, and navigation to the created ticket’s details.
- Accessible labeled controls and existing dropdown navigation, commit, cancel, and focus conventions.

Introducing ownership must not reset or reseed an existing database, fabricate owners, or rewrite existing timestamps merely because ownership support was introduced. Historical tickets remain unassigned until explicitly assigned.

All assignment controls must offer exactly Alex Chen, Sam Rivera, and Unassigned. The ticket-list owner filter must offer exactly All owners, Alex Chen, Sam Rivera, and Unassigned. **All owners is a filtering option, not an assignable owner.**

Server validation must enforce roster membership independently of client controls. Submitted values must identify a roster member rather than create new identities through spelling, case, or whitespace variations. Internal identity representation is an implementation detail; visible names and roster membership are fixed.

Selecting Alex Chen or Sam Rivera filters by that roster identity. Selecting Unassigned matches tickets without an owner. Each restriction applies together with existing search, status, and priority conditions. Selecting All owners removes only the ownership restriction.

Invalid ownership mutations, missing tickets, and persistence failures must not appear successful. Absence of an owner is valid, not an ownership-validation error.

A successful ownership change is proposed to update the last-updated timestamp while preserving status, requester information, and other ticket content. Availability of ownership changes across all statuses remains pending Q-4.

## Discovery

```json
{
  "problem": "Service-desk agents and team leads cannot see ticket responsibility or identify an agent's assigned work because the existing application has no ownership field. This makes handoffs unclear.",
  "evidence": "The supplied Human Intent reports the problem. Read-only inspection of demos/it-service-desk/src/lib/ticket.ts, src/lib/ticket-store.ts, src/app/actions.ts, src/app/page.tsx, src/app/tickets/[id]/page.tsx, src/app/ticket-form.tsx, and src/app/custom-select.tsx confirms the absence of ownership, SQLite persistence, existing search and filters, status updates, creation validation, and dropdown behavior. User interviews, handoff observations, frequency, and impact measurements were not supplied and are Unknown.",
  "successMeasure": "Observable functional success is that users can distinguish Alex Chen, Sam Rivera, and Unassigned ownership; assign, reassign, or clear responsibility; see persisted results without losing existing requests or requiring ownership during intake; and filter the queue by either roster member or Unassigned together with existing search, status, and priority conditions. All owners preserves existing search and filtering behavior. No baseline, quantitative improvement target, or usability evidence was supplied.",
  "alternatives": "Do nothing preserves the application but leaves ownership unclear. Visibility without editing is smaller but does not satisfy Q-1's assignment, reassignment, and clearing requirement. Ownership visibility without filtering requires scanning the queue and does not satisfy the recorded Q-3 outcome. Detail-page assignment keeps intake unchanged; creation plus details supports earlier ownership selection but expands intake, and this choice remains pending Q-4. A fixed local roster provides consistent identities without account integration and is the recorded Q-2 choice. Free-text ownership is incompatible with Q-2; mandatory ownership is incompatible with Q-1.",
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
      "explanation": "AC-1 displays Unassigned for missing ownership. AC-2 and AC-3 support assignment and reassignment. AC-4 permits clearing without a replacement owner. AC-5 accepts absence of an owner. AC-7 includes unassigned tickets in ownership filtering. AC-8 prohibits inferred or backfilled historical owners and preserves owner-independent status updates. AC-9 permits creation without an owner; the optional intake assignment surface remains pending Q-4."
    },
    {
      "questionId": "Q-2",
      "commentId": 6117828551,
      "acceptanceIds": ["AC-1", "AC-2", "AC-3", "AC-5", "AC-7", "AC-9", "AC-10"],
      "explanation": "AC-1 displays the fixed roster member's name. AC-2 and AC-3 use Alex Chen and Sam Rivera for assignment and handoff. AC-5 rejects nonempty values outside the roster even when client controls are bypassed. AC-7 filters by these two roster identities alongside All owners and Unassigned. AC-9 uses the same roster and validation if intake assignment is selected under Q-4. AC-10 excludes free-text ownership and limits assignment selections to the roster plus Unassigned. Roster administration and external identity integration remain out of scope."
    },
    {
      "questionId": "Q-3",
      "commentId": 6117947008,
      "acceptanceIds": ["AC-7", "AC-8", "AC-10"],
      "explanation": "AC-7 now requires, rather than conditionally proposes, the owner filter with All owners, Alex Chen, Sam Rivera, and Unassigned. It requires every result to satisfy all active ownership, search, status, and priority conditions and verifies that All owners removes only the ownership restriction. AC-8 preserves existing search and filtering behavior with All owners and existing URLs without an owner selection. AC-10 now requires accessible owner-filter operation with exactly the four recorded options. Q-4 remains unanswered; the filter decision does not select assignment surfaces."
    }
  ]
}
```

## Acceptance scenarios

Q-1 establishes optional ownership and assignment, reassignment, and clearing. Q-2 establishes the fixed roster. Q-3 requires ownership filtering combined with existing conditions. Q-4 still governs assignment surfaces and any status-related restrictions. Other proposed details remain subject to specification review and explicit approval.

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
**Then** the ticket has exactly one current owner, the replacement remains visible after reopening the application, and its last-updated timestamp reflects the change; no duplicate ticket or automatic status change is created, and other ticket content remains unchanged.

### AC-4: Clear ownership

**Given** a ticket currently has an owner.  
**When** an agent selects Unassigned and saves using the surface selected in Q-4.  
**Then** the change succeeds, details and queue display **Unassigned** after reloading, and the last-updated timestamp reflects the change; no replacement owner is inferred, and status and other ticket information remain unchanged.

### AC-5: Reject invalid ownership updates

**Given** an ownership update contains an invalid ticket identifier, refers to a missing ticket, or contains a nonempty owner value that does not identify Alex Chen or Sam Rivera.  
**When** the update is submitted, including by bypassing client-side controls.  
**Then** server-side validation or ticket lookup rejects it, an explicit error is surfaced, and no ticket, owner identity, ownership value, or timestamp is created or changed.

**Given** an existing ticket and an update requesting no owner.  
**When** the agent submits the clearing operation.  
**Then** absence of an owner is accepted under Q-1 rather than treated as invalid input; AC-4 applies.

### AC-6: Do not report a failed handoff as successful

**Given** a valid assignment, reassignment, or clearing operation cannot be persisted.  
**When** an agent submits the change.  
**Then** the application surfaces the failure rather than confirming success, and the previously saved ownership, timestamps, and ticket content remain intact.

### AC-7: Find tickets by owner

**Given** the queue contains tickets owned by Alex Chen, tickets owned by Sam Rivera, and unassigned tickets.  
**When** a user selects **Alex Chen**, **Sam Rivera**, or **Unassigned** in the owner filter and applies the filters.  
**Then** the queue shows only tickets matching that roster identity or absence of ownership, respectively, and also satisfying every active search, status, and priority condition; ordering remains unchanged, the visible count matches the results, and dashboard summary counts remain global.

**Given** an ownership restriction is active alongside search, status, or priority conditions.  
**When** the user selects **All owners** and applies the filters.  
**Then** only the ownership restriction is removed; the other selected conditions remain active, and the results match existing search and filtering behavior without an ownership restriction.

**Given** the combined ownership, search, status, and priority selection matches no tickets.  
**When** the queue is displayed.  
**Then** the existing no-results state remains available, with controls that let the user change the filters.

### AC-8: Preserve existing tickets and workflows

**Given** a database created before ownership support, containing tickets in any existing status.  
**When** ownership support is introduced and users reopen existing tickets or save a status change.  
**Then** all records and references remain available; historical tickets display **Unassigned** until explicitly assigned; owners are neither inferred nor backfilled; introduction of ownership does not rewrite timestamps; and a status save neither changes ownership nor requires an owner.

**Given** existing tickets and a queue URL with no ownership selection, or with All owners selected.  
**When** a user searches by title, requester name, full reference, or numeric or shortened reference and optionally combines status and priority filters.  
**Then** case-insensitive matching, surrounding-whitespace handling, combined filtering, priority-first ordering followed by newest creation time, visible counts, and global summary counts retain their existing behavior; assigned and unassigned tickets are equally eligible when they satisfy those conditions.

### AC-9: Create tickets with optional ownership

**Given** a user supplies otherwise valid new-ticket information and no owner.  
**When** the user submits the creation form.  
**Then** creation succeeds without an ownership requirement, the ticket displays **Unassigned**, its initial status remains `open`, and successful creation opens the new ticket’s details.

**Given** Q-4 selects assignment during creation and the user selects Alex Chen or Sam Rivera with otherwise valid ticket information.  
**When** the user submits the creation form.  
**Then** the new ticket persists the selected roster member as its sole owner and displays that name in details and queue.

**Given** existing required ticket information is invalid, or intake assignment is selected and a submitted nonempty ownership value does not identify Alex Chen or Sam Rivera.  
**When** the user submits the creation form, including by bypassing client-side controls.  
**Then** validation reports the relevant error and creates no ticket or new owner identity; omitting an owner alone is never a creation error.

If Q-4 selects detail-only assignment, the creation form remains without an ownership control, and newly created tickets are unassigned until explicitly assigned afterward.

### AC-10: Operate ownership controls accessibly

**Given** a user operates an ownership assignment control using a keyboard or assistive technology.  
**When** the user reads, selects, clears, or saves ownership.  
**Then** the control offers exactly **Alex Chen**, **Sam Rivera**, and **Unassigned**, without free-text owner entry; it has a meaningful label, its current value and errors are perceivable, and operation does not require a pointer.

**Given** a user operates the ticket-list owner filter using a keyboard or assistive technology.  
**When** the user reads or selects its value and applies the filters.  
**Then** it offers exactly **All owners**, **Alex Chen**, **Sam Rivera**, and **Unassigned**, has a meaningful label and perceivable current value, and works without a pointer.

**Given** an ownership assignment or filter control uses a dropdown.  
**When** a user navigates, commits, or cancels a selection.  
**Then** it follows existing combobox navigation, commit, cancel, and focus conventions; choosing an assignment value alone does not persist an ownership change, and choosing a filter value alone follows the existing Apply filters workflow.

## Revision summary

Revision 4 applies the recorded Q-3 decision from comment `6117947008` while preserving Q-1 from comment `6117772868` and Q-2 from comment `6117828551`.

Owner filtering is now a requirement rather than a conditional option. AC-7 requires All owners, Alex Chen, Sam Rivera, and Unassigned; selected ownership combines with all active search, status, and priority conditions. It explicitly verifies that All owners removes only the ownership restriction. AC-8 makes the compatibility requirement explicit for All owners and existing queue URLs. AC-10 requires accessible operation of the owner filter rather than conditioning it on a future decision.

All four discovery questions and their options are preserved exactly. AC-1 through AC-10 retain their identifiers. Each supplied latest decision has exactly one mapping entry referencing existing acceptance scenarios.

Read-only application inspection grounds the compatibility requirements. No implementation or specification approval is claimed. Q-4 remains unanswered.

## Open questions

**Q-4 — Assignment surfaces and status availability:** choose ticket-details-only assignment or creation plus ticket details, and confirm whether ownership changes remain available across all existing statuses. Any restriction needs an explicit Human decision. Ownership remains optional, and any assignment control must use the fixed roster.

Q-4 blocks approval until a configured Human records a decision or deferment. A candidate specification may be published for discussion while it remains unanswered.

Q-1, Q-2, and Q-3 have recorded outcomes and remain in the discovery register for traceability; they are not unanswered questions. Preserved mandatory-ownership, free-text, and visibility-only alternatives do not override those outcomes. The mandatory-intake language preserved in Q-4’s options does not override optional ownership under Q-1.

No deferments were supplied. Handoff frequency, impact, and quantitative improvement targets remain unknown; this specification makes no measured-benefit claim.

The Human must inspect the revised specification after decisions and explicitly approve a version. Decision mappings, AI comments, checklists, and successful validation cannot substitute for that approval.

