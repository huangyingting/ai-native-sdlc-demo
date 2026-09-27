# Specification

## Intent

Add explicit ticket ownership to the IT service desk so service-desk agents and team leads can identify responsibility, find unassigned work, and perform handoffs.

Ownership must be visible on the dashboard and ticket detail page. From the detail page, a ticket can be assigned to Avery Stone or Jordan Lee, reassigned between them, or cleared to Unassigned. On the dashboard, an owner filter must work together with the existing search, status, and priority filters without changing existing ticket data or established application behavior.

## Scope

- Extend each ticket with a nullable owner.
- Use the fixed local roster:
  - `avery-stone`: Avery Stone
  - `jordan-lee`: Jordan Lee
- Represent a ticket without an owner as Unassigned.
- Migrate existing databases so every old-schema ticket becomes Unassigned without changing its other persisted fields.
- Show the owner, including Unassigned, for every ticket on:
  - The dashboard ticket queue.
  - The ticket detail page.
- Provide a labeled, keyboard-usable ownership control on the ticket detail page that supports:
  - Assignment to Avery Stone.
  - Assignment to Jordan Lee.
  - Reassignment from one roster member to the other.
  - Clearing the ticket owner to Unassigned.
- Provide a labeled, keyboard-usable dashboard owner filter with these choices:
  - All owners.
  - Unassigned.
  - Avery Stone.
  - Jordan Lee.
- Intersect the owner filter with the existing search, status, and priority filters.
- Allow the owner filter to be cleared by selecting All owners while preserving the exact active search text, status selection, and priority selection.
- Persist ownership changes in the existing SQLite database and retain them across page reloads and application or container restarts using the same database volume.
- Validate ownership mutations on the server.
- Keep newly created tickets Unassigned without adding an owner field to the creation form.
- Preserve existing ticket creation, detail display, status updates, search, filtering, priority ordering, and dashboard summaries except for the specified ownership additions.

## Non-goals

- Authentication or authorization.
- External directory, GitHub identity, or other identity-provider integration.
- Owners outside the fixed local roster.
- Free-text owners.
- Team ownership.
- Multiple simultaneous owners.
- Bulk assignment or bulk clearing.
- Selecting an owner while creating a ticket.
- Notifications or assignment alerts.
- SLA policies.
- Comments or ownership audit history.
- New dashboards beyond adding ownership information and the owner filter to the existing queue.
- Changes to delivery workflows, review gates, credentials, repository settings, or approval rules.

## Actors

- **Service-desk agent:** Views ownership, filters the queue, and assigns, reassigns, or clears a ticket owner from the ticket detail page.
- **Team lead:** Uses the same ownership views and controls to identify responsibility, locate unassigned work, and coordinate handoffs.
- **IT service desk application:** Displays ownership, validates requested ownership changes, persists valid assignments, and rejects invalid mutations.
- **Existing database:** May contain tickets created under the old schema and must be migrated without losing or altering existing ticket data.

## Constraints

- The only valid assigned-owner identifiers are `avery-stone` and `jordan-lee`.
- Unassigned is an explicit supported state and must not be represented by a forged roster identifier or free text.
- Existing tickets and newly created tickets default to Unassigned.
- Migration must operate against an old-schema SQLite database containing persisted records; inserting fresh seed data is not sufficient to establish migration compatibility.
- Migration must preserve each existing ticket's ID, reference, title, description, requester name, requester email, category, priority, status, creation timestamp, and update timestamp.
- An ownership mutation may change only the owner and may advance `updatedAt`; any advanced timestamp must be nondecreasing.
- Invalid owner identifiers and nonexistent ticket identifiers must be rejected server-side without mutating any ticket.
- Ownership must remain durable when the application restarts against the same database volume.
- The owner filter must intersect with, rather than replace or reset, the existing search, status, and priority filters.
- Selecting All owners clears only the owner restriction. It must preserve the exact active search text, status selection, and priority selection and their established behavior.
- Clearing the owner filter by selecting All owners is distinct from clearing a ticket's owner to Unassigned on the ticket detail page.
- Existing priority ordering and dashboard summary semantics must remain unchanged.
- Ownership controls must have accessible labels and be operable by keyboard.
- The fixed roster, nullable single-owner model, Unassigned defaults, AC-1 through AC-5, compatibility requirements, and non-goals are agreed requirements from the Human-authored Intent.
- No alternative ownership model is proposed.
- The previous specification approval and its draft Plan are superseded by the requested revision. This revised specification requires a new explicit Human approval after review; an AI comment, checklist state, validation result, or prior-version approval is not approval of this version.

## Acceptance scenarios

### AC-1: Migrate existing tickets to Unassigned

**Given** an old-schema database contains the four existing tickets INC-0001 through INC-0004, has no ownership field, and retains their original persisted values and timestamps

**When** the ownership-capable application opens and migrates that database

**Then** all four records still exist with the same IDs, references, titles, descriptions, requesters, categories, priorities, statuses, `createdAt` values, and `updatedAt` values

**Then** each migrated ticket is Unassigned and is displayed as Unassigned on both the dashboard and its detail page

**Then** the dashboard summary remains 2 open, 1 in progress, 1 resolved, and 2 active high-or-critical tickets

**Then** migration does not replace the existing records with newly seeded records or otherwise lose persisted data

### AC-2: Assign, reassign, and clear a ticket owner

**Given** INC-0001 is Unassigned

**When** an agent assigns INC-0001 to Avery Stone from its detail page

**Then** Avery Stone is shown as the owner on the detail page and dashboard after each page is reloaded

**When** the agent reassigns INC-0001 to Jordan Lee

**Then** Jordan Lee replaces Avery Stone as the displayed owner on both pages after reload

**When** the agent clears the ticket owner from the detail page

**Then** INC-0001 is shown as Unassigned on both pages after reload

**Then** each ownership change is persisted in SQLite and remains visible after restarting the application or labeled container with the same existing volume

**Then** each change preserves all other ticket fields except that `updatedAt` may advance to a nondecreasing timestamp

### AC-3: Filter the queue by owner and existing criteria

**Given** INC-0001 and INC-0003 are assigned to Avery Stone, INC-0002 is assigned to Jordan Lee, and INC-0004 is Unassigned

**When** the owner filter is set to All owners

**Then** the queue contains exactly INC-0001, INC-0002, INC-0003, and INC-0004

**When** the owner filter is set to Avery Stone

**Then** the queue contains exactly INC-0001 and INC-0003

**When** the owner filter is set to Jordan Lee

**Then** the queue contains exactly INC-0002

**When** the owner filter is set to Unassigned

**Then** the queue contains exactly INC-0004

**When** the owner filter is set to Avery Stone, status is Open, priority is High, and search text is exactly `inc-1`

**Then** the queue contains exactly INC-0001

**When** the owner filter is set to Avery Stone and priority is Critical

**Then** the queue is empty

**Given** search text, status, and priority selections are active together with a restrictive owner selection

**When** the owner filter is cleared by selecting All owners

**Then** the owner restriction is removed while the exact active search text, status selection, and priority selection remain unchanged and continue to intersect using their established behavior

**Then** selecting All owners does not clear any ticket's assigned owner and is distinct from clearing a ticket owner to Unassigned on the detail page

### AC-4: Reject invalid ownership mutations and support accessible controls

**Given** the ownership and owner-filter controls are displayed

**When** an agent navigates to and operates them using a keyboard

**Then** each control has an accessible label and supports selecting every allowed option

**Given** an ownership mutation submits the owner identifier `not-in-roster`

**When** the server processes the request

**Then** the request is rejected and no ticket is mutated

**Given** an ownership mutation submits an otherwise valid owner value for a nonexistent ticket ID

**When** the server processes the request

**Then** the request is rejected and no ticket is mutated

**Given** an ownership mutation submits `avery-stone`, `jordan-lee`, or the explicit Unassigned value for an existing ticket

**When** the server processes the request

**Then** the requested valid ownership state is persisted

### AC-5: Preserve ticket creation and existing workflows

**Given** a separate fresh dataset from the dataset used in AC-3

**When** an agent creates a ticket with title `Ownership demo request`, description `Verify a new unassigned ticket.`, category `Other`, priority `low`, requester `Demo Requester`, and email `demo.requester@example.com`

**Then** the ticket is created with status Open and owner Unassigned

**Then** the creation form does not require or offer an owner field

**When** the agent uses the existing detail view, status update, search, status filter, and priority filter workflows

**Then** those workflows continue to behave as before while displaying the ticket's ownership state

**Then** existing priority ordering and summary calculations remain unchanged

**Then** the newly created ticket is not included in the four-ticket reference sets asserted by AC-3

## Revision summary

This revision preserves AC-1 through AC-5, the fixed roster, nullable single-owner model, Unassigned defaults, migration requirements, server-side validation, compatibility requirements, and all existing non-goals.

AC-3 is clarified without changing scope: clearing the owner filter specifically means selecting All owners. That action removes only the owner restriction and preserves the exact active search text, status selection, and priority selection. It is now explicitly distinguished from clearing a ticket's assigned owner to Unassigned on the detail page.

The discussion records an approval of specification v1 followed by a Human request to revise it. Under that request, the earlier specification approval and its draft Plan do not approve this revision. This revised version requires new explicit Human review and approval before planning or implementation.

## Open questions

None. The Human Intent and revision feedback fix the roster, ownership states, mutation behavior, owner-filter clearing semantics, migration expectations, compatibility requirements, and non-goals.

