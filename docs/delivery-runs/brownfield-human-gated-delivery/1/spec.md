# Specification

## Intent

Human Intent #1, **Make ticket ownership visible and support handoffs**, seeks to help service-desk agents and team leads understand who is responsible for a ticket, identify unowned requests, and transfer responsibility without losing existing requests.

The recorded Human decisions establish:

- Ownership is optional for every ticket. Agents may assign, reassign, or clear an owner. Missing ownership displays **Unassigned**; historical owners are neither inferred nor backfilled.
- The predefined local roster contains exactly **Alex Chen** and **Sam Rivera**. Only these roster members are valid nonempty owners; free-text ownership is not accepted.
- The queue provides **All owners**, **Alex Chen**, **Sam Rivera**, and **Unassigned** filtering options. Ownership restrictions combine with every active search, status, and priority condition. All owners imposes no ownership restriction.
- Assignment, reassignment, and clearing occur **only on the ticket details page**, in every existing ticket status. Creation remains unchanged, without an owner control, and newly created tickets start unassigned. Ownership changes preserve status; status saves preserve ownership.

These decisions establish requirements, not approval of this specification version.

## Scope

Add at most one current owner per ticket, separate from its requester, within `demos/it-service-desk`.

**Recorded requirements from Q-1 through Q-4:**

- Permit existing and newly created tickets to remain unassigned.
- Support assignment, reassignment, and clearing only on ticket details.
- Allow these operations in `open`, `in_progress`, `resolved`, and `closed` statuses.
- Preserve status when changing ownership and preserve the current owner when saving status.
- Select owners from exactly Alex Chen and Sam Rivera, with Unassigned available for clearing.
- Keep creation without an ownership control; all newly created tickets start unassigned.
- Display missing ownership as Unassigned without inferring or backfilling historical owners.
- Provide the four-option owner filter and combine it with existing search and filters.
- Preserve existing search and filtering behavior when All owners is selected.
- Exclude free-text ownership, roster administration, and external identity integration.

**Proposed supporting behavior for specification review, not separately recorded Human decisions:**

- Display ownership in both queue entries and ticket details.
- Persist ownership changes in the existing local SQLite database.
- Validate ownership mutations on the server and explicitly surface rejected or failed changes.
- Update the last-updated timestamp when ownership changes, without changing other ticket content.
- Preserve queue ordering, visible-result counts, and global dashboard summary counts.
- Treat existing queue URLs without an ownership selection as unrestricted by ownership.
- Follow the existing accessible dropdown and explicit-save/apply interaction conventions.

These supporting details remain part of the candidate specification for Human review; they are not claims of implemented behavior.

## Non-goals

External identity integrations, authentication changes, notifications, and SLA policies are out of scope.

This change also excludes multiple simultaneous owners, assignment history, comments, automatic routing, workload balancing, reporting, roster administration, and replacement of the application.

A handoff changes the current owner. It does not require recipient acknowledgement, deliver a notification, or create an auditable assignment history. Ownership introduces no authorization roles and does not make the requester responsible for handling the ticket.

Assignment during creation and inline queue assignment are excluded by Q-4. Mandatory ownership, free-text owners, and visibility without filtering are preserved as historical discovery options, not current requirements.

## Actors

- **Service-desk agent:** views ownership, finds assigned or unassigned work, and assigns, reassigns, or clears responsibility on ticket details.
- **Team lead:** reviews responsibility and unowned work and coordinates handoffs through the same application behavior; no additional permissions are introduced.
- **Roster member:** Alex Chen or Sam Rivera, either of whom may be the current owner. Roster membership does not create a login account.
- **Ticket requester:** the person whose incident or request is recorded; requester identity remains distinct from ownership.
- **Human Intent owner and configured reviewers:** record consequential decisions and inspect the revised specification before explicitly approving a version. AI comments, checklists, and successful validation are not approval.

## Constraints

Read-only inspection confirms that the existing application stores tickets in local SQLite through `node:sqlite`. Its ticket model contains requester information, status, priority, category, description, reference, and timestamps, but no owner. The queue supports text search, status filtering, and priority filtering. Ticket details currently support status updates; creation has no ownership control.

Ownership support must preserve:

- Existing ticket IDs, `INC-` references, content, requester information, status, priority, category, and creation timestamps.
- Existing routes: `/`, `/tickets/new`, and `/tickets/<id>`.
- Existing creation validation, initial `open` status, and navigation to the created ticket’s details.
- Creation without an owner control or ownership requirement.
- All four existing statuses, with ownership changes available in each.
- Case-insensitive title, requester-name, and reference search, including numeric and shortened references such as `1`, `0001`, and `inc-1`, with surrounding whitespace ignored.
- Existing combined search, status, and priority filtering.
- Priority-first queue ordering followed by newest creation time.
- Visible-result counts reflecting the filtered queue and dashboard summary counts remaining independent of queue filters.
- Accessible labels and existing dropdown navigation, commit, cancel, and focus conventions.

Introducing ownership must not reset or reseed an existing database, fabricate owners, or rewrite existing timestamps merely because ownership support was introduced. Historical tickets remain unassigned until explicitly assigned.

The ticket-details assignment control must offer exactly **Alex Chen**, **Sam Rivera**, and **Unassigned**. The ticket-list owner filter must offer exactly **All owners**, **Alex Chen**, **Sam Rivera**, and **Unassigned**. All owners is a filtering option, not an assignable owner.

Server-side validation must enforce roster membership independently of client controls. Submitted nonempty ownership values must identify a roster member rather than create identities through spelling, case, or whitespace variations. Internal identity representation is an implementation detail; visible names and roster membership are fixed.

Selecting a roster member filters by that identity. Unassigned matches tickets without an owner. Each ownership restriction applies together with all active search, status, and priority conditions. All owners removes only the ownership restriction.

Ownership and status saves must be independent: each operation preserves the other field’s currently persisted value. Ownership must never become a prerequisite for a status update.

Invalid ownership mutations, missing tickets, and persistence failures must not appear successful. Absence of an owner is valid, not an ownership-validation error. A successful ownership change is proposed to update the last-updated timestamp while preserving status, requester information, creation time, and other ticket content.

## Discovery

```json
{
  "problem": "Service-desk agents and team leads cannot see ticket responsibility or identify an agent's assigned work because the existing application has no ownership field. This makes handoffs unclear.",
  "evidence": "The supplied Human Intent reports the problem. Read-only inspection of demos/it-service-desk/src/lib/ticket.ts, src/lib/ticket-store.ts, src/app/actions.ts, src/app/page.tsx, src/app/tickets/[id]/page.tsx, src/app/ticket-form.tsx, and src/app/custom-select.tsx confirms the absence of ownership, SQLite persistence, existing search and filters, status updates, creation validation, and dropdown behavior. User interviews, handoff observations, frequency, and impact measurements were not supplied and are Unknown.",
  "successMeasure": "Observable functional success is that users can distinguish Alex Chen, Sam Rivera, and Unassigned ownership; assign, reassign, or clear responsibility only on ticket details in every existing status; see persisted results without losing existing requests; and filter the queue by either roster member or Unassigned together with existing search, status, and priority conditions. Creation remains unchanged and produces unassigned tickets. Ownership saves preserve status, and status saves preserve ownership. All owners preserves existing search and filtering behavior. No baseline, quantitative improvement target, or usability evidence was supplied.",
  "alternatives": "Do nothing preserves the application but leaves ownership unclear. Visibility without editing is smaller but does not satisfy Q-1's assignment, reassignment, and clearing requirement. Visibility without filtering requires scanning the queue and does not satisfy Q-3. Detail-page-only assignment keeps intake unchanged and is the recorded Q-4 choice; creation plus details would support earlier selection but expand intake and is excluded by Q-4. A fixed local roster provides consistent identities without account integration and is the recorded Q-2 choice. Free-text ownership is incompatible with Q-2; mandatory ownership is incompatible with Q-1.",
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
      "explanation": "AC-1 displays Unassigned for missing ownership. AC-2 and AC-3 support assignment and reassignment. AC-4 permits clearing without a replacement owner. AC-5 accepts absence of an owner. AC-7 includes unassigned tickets in ownership filtering. AC-8 prohibits inferred or backfilled historical owners and preserves owner-independent status updates. AC-9 preserves creation without an ownership requirement and produces unassigned tickets."
    },
    {
      "questionId": "Q-2",
      "commentId": 6117828551,
      "acceptanceIds": ["AC-1", "AC-2", "AC-3", "AC-5", "AC-7", "AC-10"],
      "explanation": "AC-1 displays the fixed roster member's name. AC-2 and AC-3 use Alex Chen and Sam Rivera for assignment and handoff. AC-5 rejects nonempty values outside the roster even when client controls are bypassed. AC-7 filters by these roster identities alongside All owners and Unassigned. AC-10 excludes free-text ownership and limits assignment selections to the roster plus Unassigned. AC-9 no longer contains conditional intake assignment because Q-4 excludes that surface. Roster administration and external identity integration remain out of scope."
    },
    {
      "questionId": "Q-3",
      "commentId": 6117947008,
      "acceptanceIds": ["AC-7", "AC-8", "AC-10"],
      "explanation": "AC-7 requires the owner filter with All owners, Alex Chen, Sam Rivera, and Unassigned, requires every result to satisfy all active ownership, search, status, and priority conditions, and verifies that All owners removes only the ownership restriction. AC-8 preserves existing search and filtering with All owners and existing URLs without an owner selection. AC-10 requires accessible operation of the four-option owner filter."
    },
    {
      "questionId": "Q-4",
      "commentId": 6117980837,
      "acceptanceIds": ["AC-2", "AC-3", "AC-4", "AC-8", "AC-9", "AC-10"],
      "explanation": "AC-2, AC-3, and AC-4 now require assignment, reassignment, and clearing only on ticket details in open, in_progress, resolved, and closed statuses, with status preserved. AC-8 explicitly verifies that status saves preserve the currently persisted owner, including when an ownership selection is unsaved. AC-9 removes conditional intake assignment, keeps creation without an owner control, and requires every newly created ticket to start unassigned. AC-10 confines the assignment control to ticket details and preserves explicit-save behavior. No ownership editing is provided on creation or queue entries."
    }
  ]
}
```

## Acceptance scenarios

AC-1 through AC-10 retain their identifiers. The recorded Q-1 through Q-4 outcomes apply throughout. Supporting display, persistence, timestamp, error, and accessibility details are proposed requirements for review.

### AC-1: See current ownership

**Given** a ticket is owned by Alex Chen or Sam Rivera, or has no owner.  
**When** an agent views its queue entry or ticket details.  
**Then** both surfaces display **Alex Chen**, **Sam Rivera**, or **Unassigned**, respectively, clearly distinguished from the requester; the ticket reference and existing ticket information remain available.

### AC-2: Assign an unowned ticket

**Given** an unassigned ticket in any of `open`, `in_progress`, `resolved`, or `closed`, and a ticket-details ownership control offering exactly Alex Chen, Sam Rivera, and Unassigned.  
**When** an agent selects Alex Chen or Sam Rivera and explicitly saves ownership on ticket details.  
**Then** the selected roster member becomes its sole owner, its last-updated timestamp reflects the change, and details and queue show the saved ownership after reloading; its status, ID, reference, requester, creation timestamp, and other content remain unchanged.

### AC-3: Hand off an owned ticket

**Given** a ticket owned by Alex Chen or Sam Rivera in any of `open`, `in_progress`, `resolved`, or `closed`.  
**When** an agent selects the other roster member and explicitly saves ownership on ticket details.  
**Then** the ticket has exactly one current owner, the replacement remains visible after reopening the application, and its last-updated timestamp reflects the change; no duplicate ticket or status change occurs, and other ticket content remains unchanged.

### AC-4: Clear ownership

**Given** a ticket currently has an owner and is in any of `open`, `in_progress`, `resolved`, or `closed`.  
**When** an agent selects Unassigned and explicitly saves ownership on ticket details.  
**Then** the change succeeds, details and queue display **Unassigned** after reloading, and the last-updated timestamp reflects the change; no replacement owner is inferred, and status and other ticket information remain unchanged.

### AC-5: Reject invalid ownership updates

**Given** an ownership update contains an invalid ticket identifier, refers to a missing ticket, or contains a nonempty owner value that does not identify Alex Chen or Sam Rivera, including All owners or an arbitrary free-text name.  
**When** the update is submitted, including by bypassing client-side controls.  
**Then** server-side validation or ticket lookup rejects it, an explicit error is surfaced, and no ticket, owner identity, ownership value, or timestamp is created or changed.

**Given** an existing ticket and an update requesting no owner.  
**When** the agent submits the clearing operation on ticket details.  
**Then** absence of an owner is accepted rather than treated as invalid input; AC-4 applies.

### AC-6: Do not report a failed handoff as successful

**Given** a valid assignment, reassignment, or clearing operation cannot be persisted.  
**When** an agent submits the change.  
**Then** the application surfaces the failure rather than confirming success, and the previously saved ownership, timestamps, and ticket content remain intact.

### AC-7: Find tickets by owner

**Given** the queue contains tickets owned by Alex Chen, tickets owned by Sam Rivera, and unassigned tickets.  
**When** a user selects **Alex Chen**, **Sam Rivera**, or **Unassigned** in the owner filter and applies the filters.  
**Then** the queue shows only tickets matching that roster identity or absence of ownership, respectively, and satisfying every active search, status, and priority condition; ordering remains unchanged, the visible count matches the results, and dashboard summary counts remain global.

**Given** an ownership restriction is active alongside search, status, or priority conditions.  
**When** the user selects **All owners** and applies the filters.  
**Then** only the ownership restriction is removed; other selected conditions remain active, and the results match existing search and filtering behavior without an ownership restriction.

**Given** the combined ownership, search, status, and priority selection matches no tickets.  
**When** the queue is displayed.  
**Then** the existing no-results state remains available, with controls that let the user change the filters.

### AC-8: Preserve existing tickets and workflows

**Given** a database created before ownership support, containing tickets in any existing status.  
**When** ownership support is introduced and users reopen existing tickets.  
**Then** all records and references remain available; historical tickets display **Unassigned** until explicitly assigned; owners are neither inferred nor backfilled; and introduction of ownership does not rewrite timestamps or reset or reseed existing records.

**Given** a ticket whose currently persisted owner is Alex Chen, Sam Rivera, or no owner, regardless of any unsaved ownership selection on its details page.  
**When** an agent saves a valid status change through the existing status control.  
**Then** the status changes under the existing workflow, the currently persisted owner remains unchanged, and an unassigned ticket does not require an owner; the normal status-update timestamp behavior remains intact.

**Given** a ticket has an unsaved status selection on its details page.  
**When** an agent saves an ownership change.  
**Then** the currently persisted status remains unchanged; the ownership save does not apply the unsaved status selection.

**Given** existing tickets and a queue URL with no ownership selection, or with All owners selected.  
**When** a user searches by title, requester name, full reference, or numeric or shortened reference and optionally combines status and priority filters.  
**Then** case-insensitive matching, surrounding-whitespace handling, combined filtering, priority-first ordering followed by newest creation time, visible counts, and global summary counts retain their existing behavior; assigned and unassigned tickets are equally eligible when they satisfy those conditions.

### AC-9: Create tickets with optional ownership

**Given** a user opens `/tickets/new`.  
**When** the creation form is displayed.  
**Then** it retains the existing ticket fields and validation and contains no owner control or ownership requirement.

**Given** a user supplies otherwise valid new-ticket information.  
**When** the user submits the creation form.  
**Then** creation succeeds, the new ticket starts **Unassigned** with initial status `open`, and successful creation opens its details; ownership may subsequently be changed only on that details page.

**Given** existing required ticket information is invalid.  
**When** the user submits the creation form, including by bypassing client-side controls.  
**Then** existing server-side validation reports the relevant errors and creates no ticket; absence of an owner is never a creation error.

### AC-10: Operate ownership controls accessibly

**Given** a user operates the ticket-details ownership control using a keyboard or assistive technology.  
**When** the user reads, selects, clears, or saves ownership.  
**Then** the control offers exactly **Alex Chen**, **Sam Rivera**, and **Unassigned**, without free-text entry; it has a meaningful label, its current value and errors are perceivable, and operation does not require a pointer.

**Given** a user views the creation form or ticket queue.  
**When** the available controls are displayed.  
**Then** neither surface offers assignment, reassignment, or clearing controls; the queue owner filter restricts displayed results without changing ticket ownership.

**Given** a user operates the ticket-list owner filter using a keyboard or assistive technology.  
**When** the user reads or selects its value and applies the filters.  
**Then** it offers exactly **All owners**, **Alex Chen**, **Sam Rivera**, and **Unassigned**, has a meaningful label and perceivable current value, and works without a pointer.

**Given** an ownership assignment or filter control uses a dropdown.  
**When** a user navigates, commits, or cancels a selection.  
**Then** it follows existing combobox navigation, commit, cancel, and focus conventions; choosing an assignment value alone does not persist an ownership change, and choosing a filter value alone follows the existing Apply filters workflow.

## Revision summary

Revision 5 applies the recorded Q-4 decision from comment `6117980837` while preserving the recorded Q-1, Q-2, and Q-3 outcomes.

AC-2, AC-3, and AC-4 now specify ticket-details-only ownership changes in every existing status, rather than referring to an undecided surface. AC-8 explicitly covers both directions of status/ownership independence, including unsaved selections. AC-9 removes conditional creation-time assignment and requires unchanged intake with newly created tickets unassigned. AC-10 confines ownership editing to details while retaining queue filtering.

All four discovery questions and their options are preserved exactly. AC-1 through AC-10 retain stable IDs, and each supplied latest decision has exactly one mapping entry referencing existing scenarios. Obsolete statements that Q-4 is unanswered have been removed; historical options do not override recorded outcomes.

Read-only application inspection grounds the compatibility requirements. This document claims neither implementation nor specification approval.

## Open questions

**None.** All four registered questions have supplied recorded outcomes, and no deferments or newly identified consequential conflicts remain.

Q-1 through Q-4 remain in the discovery register for traceability. Their preserved alternatives are not current requirements: ownership is optional, owners come from the fixed roster, filtering is required, and ownership editing is limited to ticket details in every existing status.

Handoff frequency, impact, quantitative improvement targets, and usability evidence remain unknown. This specification defines observable functional outcomes without claiming measured benefits.

The Human must inspect this revised specification and explicitly approve a version. Recorded decisions and their mappings, AI comments, checklists, and successful validation cannot substitute for that approval.

