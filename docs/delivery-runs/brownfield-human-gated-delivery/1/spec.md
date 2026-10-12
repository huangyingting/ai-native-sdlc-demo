# Specification

## Intent

Human Intent #1, **Make ticket ownership visible and support handoffs**, seeks to help service-desk agents and team leads understand who is responsible for a ticket, identify requests without an owner, and transfer responsibility without losing existing requests.

This is an initial behavioral proposal for the existing application in `demos/it-service-desk`. The Intent establishes the outcome and preservation constraints, but does not decide whether ownership is optional, how owners are identified, or whether owner filtering is required. No recorded Human decisions were supplied.

## Scope

The proposed improvement introduces one current owner per ticket, distinct from the requester.

The candidate behavior is to:

- Display the current owner, or an explicit **Unassigned** label, in the ticket queue and ticket details.
- Allow assignment and reassignment from ticket details, with changes persisted in the existing local database.
- Preserve tickets that predate ownership support without inventing an owner.
- Validate ownership changes on the server and report rejected changes without altering the ticket.
- Support clearing ownership, owner filtering, and assignment during creation only as determined through the questions below.

**Proposed option, not an agreed requirement:** optional ownership selected from a predefined local roster, assignment from ticket details, and queue filtering by a specific owner or Unassigned. This offers consistent owner labels and visible handoffs without introducing external identity integration. The Human must decide the policy, roster contents, filtering scope, and creation behavior before approval.

## Non-goals

This change does not introduce external identity integrations, authentication changes, notifications, or SLA policies.

It also does not propose multiple simultaneous owners, assignment history, comments, automatic routing, workload balancing, reporting, or a replacement service-desk application. A handoff means changing the current owner; it does not imply recipient acknowledgement or an auditable history.

## Actors

- **Service-desk agent:** views ownership and assigns or hands off tickets using the existing application.
- **Team lead:** reviews ownership and unowned work, and coordinates reassignment. This actor does not imply a new authorization role.
- **Ticket requester:** remains the person whose incident or request is recorded. Requester details do not establish ownership.
- **Human Intent owner and configured reviewers:** clarify requirements and explicitly review and approve a specification version. Discussion, AI comments, checklists, and successful validation are not approval.

## Constraints

The existing application stores tickets in local SQLite. Tickets currently have a requester, status, priority, category, description, reference, and timestamps, but no assignee. The queue supports text search, status filtering, and priority filtering; ticket details support status updates.

The proposal must preserve:

- Existing ticket IDs, `INC-` references, content, requester information, status, priority, category, and creation timestamps.
- Existing routes: `/`, `/tickets/new`, and `/tickets/<id>`.
- The ability to create tickets and update their status without unintended ownership changes.
- Status values `open`, `in_progress`, `resolved`, and `closed`, without introducing ownership-dependent transition restrictions unless explicitly decided.
- Case-insensitive title, requester-name, and reference search, including numeric and shortened references such as `1`, `0001`, and `inc-1`, with surrounding whitespace ignored.
- Combined search, status, and priority filters, priority-first queue ordering followed by newest creation time, and dashboard-wide summary counts independent of queue filters.
- Existing accessible control behavior. Any new dropdown must retain labeled keyboard operation and the application's commit/cancel focus conventions.

Adding ownership must not reset or reseed an existing database. Migration must not fabricate owners or change existing timestamps merely because ownership support was introduced.

Ownership writes must be server-validated. Invalid submissions, missing tickets, and persistence failures must not be presented as successful handoffs. A successful owner change should update the existing last-updated timestamp, without changing status or other ticket content.

## Discovery

```json
{
  "problem": "Service-desk agents and team leads cannot see ticket responsibility or identify an agent's assigned work because the existing application has no ownership field. This makes handoffs unclear.",
  "evidence": "The supplied Human Intent reports the problem. Inspection of src/lib/ticket.ts, src/lib/ticket-store.ts, src/app/actions.ts, src/app/page.tsx, src/app/tickets/[id]/page.tsx, and src/app/ticket-form.tsx confirms there is no assignee field or ownership control. User interviews, handoff observations, frequency, and impact measurements were not supplied and are Unknown.",
  "successMeasure": "Observable functional success is that users can distinguish owned from unowned tickets, change responsibility, and see the persisted result without losing existing requests. Finding a particular agent's work depends on the filtering decision. No baseline, quantitative improvement target, or usability evidence was supplied.",
  "alternatives": "Do nothing preserves the application but leaves ownership unclear. Visibility without editing is smaller but does not support in-app handoffs. Detail-page assignment without owner filtering supports handoffs but requires scanning the queue. Optional local-roster ownership gives consistent labels and preserves unassigned work, but needs agreed roster contents. Free text avoids roster setup but risks inconsistent names and ambiguous owner matching. Mandatory ownership increases completeness but may disrupt intake and needs a legacy-ticket exception.",
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
  "decisionMapping": []
}
```

## Acceptance scenarios

These scenarios describe proposed behavior, not recorded Human agreement. Scenarios dependent on Q-1 through Q-4 explicitly identify that dependency.

### AC-1: See current ownership

**Given** an existing ticket has a saved owner or has no owner.  
**When** an agent views its queue entry or ticket details.  
**Then** both surfaces display the current owner's label or **Unassigned**, clearly distinguished from the requester; the ticket reference and existing ticket information remain available.

### AC-2: Assign an unowned ticket

**Given** an existing unassigned ticket and an owner value valid under the policy selected in Q-2.  
**When** an agent saves that owner from ticket details.  
**Then** the ticket has that owner, the last-updated timestamp reflects the change, and both details and queue show the saved ownership after reloading; its ID, reference, status, requester, and other content remain unchanged.

### AC-3: Hand off an owned ticket

**Given** a ticket is owned by one agent and another owner is valid under Q-2.  
**When** an agent saves the replacement owner.  
**Then** the ticket has exactly one current owner, the replacement is visible after reopening the application, and no duplicate ticket or automatic status change is created.

### AC-4: Clear ownership according to policy

**Given** a ticket currently has an owner.  
**When** an agent attempts to clear ownership.  
**Then** if Q-1 permits unassigned tickets, the saved ticket becomes **Unassigned** without losing other information; if Q-1 prohibits clearing, the operation is rejected with an explicit explanation and the saved owner remains unchanged.

### AC-5: Reject invalid ownership updates

**Given** an ownership update contains an invalid ticket identifier, refers to a missing ticket, or contains an owner value invalid under Q-2, including an unknown roster member if a roster is chosen.  
**When** the update is submitted, including by bypassing client-side controls.  
**Then** server-side validation or ticket lookup rejects it, an explicit error is surfaced, and no ticket or ownership value is created or changed.

### AC-6: Do not report a failed handoff as successful

**Given** a valid ownership change cannot be persisted.  
**When** an agent submits the change.  
**Then** the application surfaces the failure rather than confirming a handoff, and the previously saved ownership and ticket content remain intact.

### AC-7: Find tickets by owner if filtering is selected

**Given** Q-3 selects owner filtering and the queue contains tickets owned by different agents and unassigned tickets.  
**When** a user selects a specific owner, Unassigned where applicable, or All owners and applies the filters.  
**Then** the queue shows only tickets matching that selection together with the active search, status, and priority filters; All owners removes only the ownership restriction, ordering remains unchanged, the visible count matches the results, and dashboard summary counts remain global.

**Given** that combined selection matches no tickets.  
**When** the queue is displayed.  
**Then** the existing no-results state remains available, with controls that let the user change the filters.

### AC-8: Preserve existing tickets and workflows

**Given** a database created before ownership support, containing tickets in any existing status.  
**When** ownership support is introduced and users reopen existing tickets, search the queue, or save a status change.  
**Then** all existing records and references remain available, owners are not invented, migration does not rewrite existing ticket timestamps, existing search and filter semantics remain unchanged, and a status save does not change ownership.

Any mandatory-ownership policy must explicitly settle the legacy transition in Q-1 before this scenario can be finalized; resetting data or silently assigning owners is not an acceptable transition.

### AC-9: Create tickets under the selected ownership policy

**Given** a user supplies otherwise valid new-ticket information.  
**When** the user submits the creation form.  
**Then** if Q-1 permits unassigned tickets, creation without an owner remains valid and the ticket displays **Unassigned**; if Q-4 includes intake assignment, a valid supplied owner is saved; if Q-1 requires an owner for new tickets, omission is rejected with an ownership error and no ticket is created.

Existing field validation remains enforced, newly created tickets remain `open`, and successful creation still opens the new ticket's details. The intake change required by mandatory ownership must be explicitly accepted, not treated as backward-compatible behavior.

### AC-10: Operate ownership controls accessibly

**Given** a user operates any proposed ownership control using a keyboard or assistive technology.  
**When** the user reads, selects, or saves ownership.  
**Then** the control has a meaningful label, the current value and errors are perceivable, and keyboard use does not require a pointer. If a dropdown is used, it follows the existing combobox navigation, commit, cancel, and focus behavior.

## Revision summary

This is the initial proposal; no previous revision or recorded Human decisions were supplied.

The proposal is grounded in the current ticket model, SQLite persistence, creation and status-update actions, queue, and detail page. It separates ownership from requester identity, describes assignment and handoff behavior, and makes data preservation, invalid-input handling, persistence failures, and existing workflow compatibility explicit.

Optional roster-based ownership, owner filtering, and detail-page assignment are proposed options only. Q-1 through Q-4 expose the decisions needed to finalize the behavior. No implementation, validation result, or approval is claimed.

## Open questions

All four questions are unanswered and block approval:

- **Q-1 — Ownership requirement:** decide whether tickets may remain unassigned, whether owners may be cleared, and how a mandatory policy would preserve legacy tickets.
- **Q-2 — Owner identity:** choose roster or free text and supply the roster contents or naming, validation, and matching rules.
- **Q-3 — Finding assigned work:** decide whether queue visibility is sufficient or a dedicated owner filter is required.
- **Q-4 — Assignment surfaces:** choose detail-only assignment or creation plus details, and confirm whether ownership changes remain available across all existing statuses.

No deferments were supplied. Evidence about handoff frequency and measurable impact remains unknown; no quantitative benefit is asserted. The Human must inspect the revised specification after decisions are recorded and explicitly approve a version.

