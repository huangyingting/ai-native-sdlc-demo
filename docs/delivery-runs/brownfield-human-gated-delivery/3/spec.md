# Specification

## Intent

Add explicit ticket ownership to the IT service desk so agents and team leads can identify who is responsible for each request, find unassigned work, and perform handoffs.

Ownership must be visible on the dashboard and ticket detail page. A ticket can be assigned to Avery Stone or Jordan Lee, reassigned between them, or cleared to Unassigned from the detail page. The dashboard owner filter must work together with the existing search, status, and priority filters without changing existing ticket data or established application behavior.

## Scope

- Extend each ticket with a nullable owner.
- Use the fixed local roster:
  - `avery-stone`: Avery Stone
  - `jordan-lee`: Jordan Lee
- Represent a ticket without an owner as Unassigned.
- Migrate databases using the existing schema so every existing ticket becomes unassigned without changing its other persisted fields.
- Show the owner, including Unassigned, for every ticket on:
  - The dashboard ticket queue.
  - The ticket detail page.
- Provide a labeled, keyboard-usable ownership control on the ticket detail page that supports:
  - Assignment to Avery Stone.
  - Assignment to Jordan Lee.
  - Reassignment from one roster member to the other.
  - Clearing an assignment to Unassigned.
- Provide a labeled, keyboard-usable dashboard owner filter with these choices:
  - All owners.
  - Unassigned.
  - Avery Stone.
  - Jordan Lee.
- Intersect the owner filter with the existing search, status, and priority filters.
- Persist ownership changes in the existing SQLite database and retain them across page reloads and application or container restarts using the same database volume.
- Validate ownership mutations on the server.
- Keep newly created tickets unassigned without adding an owner field to the creation form.
- Preserve the existing create, detail, status update, search, ordering, filtering, and summary behavior except for the specified addition of ownership.

## Non-goals

- Authentication or authorization.
- External directory, GitHub identity, or other identity-provider integration.
- Owners outside the fixed local roster.
- Free-text owners.
- Team ownership.
- Bulk assignment or bulk clearing.
- Selecting an owner while creating a ticket.
- Notifications or assignment alerts.
- SLA policies.
- Comments or ownership audit history.
- New dashboards beyond the owner information and owner filter added to the existing queue.
- Changes to delivery workflow, review gates, credentials, repository settings, or approval rules.

## Actors

- **Service-desk agent:** Views ownership, filters the queue, and assigns, reassigns, or clears a ticket owner from the ticket detail page.
- **Team lead:** Uses the same ownership views and controls to identify responsibility, locate unassigned work, and coordinate handoffs.
- **IT service desk application:** Displays ownership, validates requested changes, persists valid assignments, and rejects invalid mutations.
- **Existing database:** May contain tickets created under the old schema and must be migrated without losing or altering existing ticket data.

## Constraints

- The only valid assigned-owner identifiers are `avery-stone` and `jordan-lee`.
- Unassigned is an explicit supported state and must not be represented by a forged roster identifier or free text.
- Existing tickets and newly created tickets default to Unassigned.
- Migration must operate against an old-schema SQLite database containing persisted records; inserting fresh seed data is not sufficient evidence of compatibility.
- Migration must preserve each existing ticket's ID, reference, title, description, requester name, requester email, category, priority, status, creation timestamp, and update timestamp.
- An ownership mutation may change only the owner and may advance `updatedAt`; any advanced timestamp must be nondecreasing.
- Invalid owner identifiers and nonexistent ticket identifiers must be rejected server-side without mutating any ticket.
- Ownership must remain durable when the application restarts against the same database volume.
- The owner filter must intersect with, rather than replace or reset, the existing search, status, and priority filters.
- Clearing only the owner filter must retain the other selected filters and their established behavior.
- Existing priority ordering and dashboard summary semantics must remain unchanged.
- Controls introduced for ownership must have accessible labels and be operable by keyboard.
- No alternative ownership models are proposed in this revision; the fixed roster and nullable single-owner model are agreed requirements from the Human-authored Intent.
- This specification is an initial proposal and is not approved until the Human explicitly approves this version after review.

## Acceptance scenarios

### AC-1: Migrate existing tickets to Unassigned

**Given** an old-schema database containing the four existing tickets INC-0001 through INC-0004, with no ownership field and with their original persisted values and timestamps

**When** the ownership-capable application opens and migrates that database

**Then** all four records still exist with the same IDs, references, titles, descriptions, requesters, categories, priorities, statuses, `createdAt` values, and `updatedAt` values

**Then** each migrated ticket is Unassigned and is shown as Unassigned on both the dashboard and its detail page

**Then** the dashboard summary remains 2 open, 1 in progress, 1 resolved, and 2 active high-or-critical tickets

**Then** migration does not replace the existing records with newly seeded records or otherwise lose persisted data

### AC-2: Assign, reassign, and clear a ticket owner

**Given** INC-0001 is Unassigned

**When** an agent assigns INC-0001 to Avery Stone from its detail page

**Then** Avery Stone is shown as the owner on the detail page and dashboard after each page is reloaded

**When** the agent reassigns INC-0001 to Jordan Lee

**Then** Jordan Lee replaces Avery Stone as the displayed owner on both pages after reload

**When** the agent clears the owner

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

**When** Avery Stone is combined with status Open, priority High, and search text `inc-1`

**Then** the queue contains exactly INC-0001

**When** Avery Stone is combined with priority Critical

**Then** the queue is empty

**When** the owner filter is cleared while search, status, or priority filters remain selected

**Then** those existing filters remain in effect and retain their prior behavior

### AC-4: Reject invalid ownership mutations and support accessible controls

**Given** the ownership and owner-filter controls are displayed

**When** an agent navigates and operates them using a keyboard

**Then** each control has an accessible label and supports selecting every allowed option

**Given** a mutation submits the owner identifier `not-in-roster`

**When** the server processes the request

**Then** the request is rejected and no ticket is mutated

**Given** a mutation submits an otherwise valid owner value for a nonexistent ticket ID

**When** the server processes the request

**Then** the request is rejected and no ticket is mutated

**Given** a mutation submits `avery-stone`, `jordan-lee`, or the explicit Unassigned value for an existing ticket

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

This is the initial specification for Human Intent #3; there is no previous specification document to revise.

The proposal grounds the fixed ownership requirements in the current application, which presently stores tickets in SQLite, seeds four tickets, supports creation and status updates, displays a dashboard and detail page, and filters by search, status, and priority. It makes old-schema migration preservation, nullable ownership, fixed-roster server validation, owner-filter intersection, persistence, accessibility, and compatibility behavior explicit.

The `/sdlc retry` discussion adds no application behavior decision and does not constitute approval. No prior specification version or approval exists. The fixed roster, Unassigned default, AC-1 through AC-5 behavior, and listed exclusions are treated as agreed requirements from the Human-authored Intent; no optional ownership alternatives are introduced.

## Open questions

None. The Human Intent explicitly fixes the roster, default ownership state, mutation behavior, filter behavior, migration expectations, compatibility requirements, and non-goals. This version still requires explicit Human review and approval before planning or implementation.

