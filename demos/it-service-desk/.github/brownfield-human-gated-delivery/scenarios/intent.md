# Clarify ticket ownership

## Problem or opportunity

The existing IT service desk lets agents create, search, and update requests,
but has no owner field. Agents and team leads cannot identify responsibility,
unassigned work, or handoffs.

## Proposed outcome

Show ticket ownership on the dashboard and detail page, allow assignment,
reassignment and clearing on detail, and filter the queue by owner without
breaking the existing filters or losing existing data.

## Affected users and systems

Service-desk agents and team leads using `demos/it-service-desk`.

## Constraints and non-goals

Use the fixed local roster: `avery-stone` (Avery Stone) and `jordan-lee`
(Jordan Lee). Tickets may remain unassigned and new tickets start unassigned.
All existing tickets migrate to unassigned without data loss. Support All,
Unassigned, and each roster owner in a filter that intersects with search,
status, and priority. Reject forged owner values server-side.

Keep the acceptance examples AC-1 through AC-5 in the adjacent `ownership.json`
and `acceptance.md`. Attach them to the Human-authored Intent; they are
requirements, not an AI-written Spec, approval, test result, or evidence.
Do not add authentication, external identity, notifications, SLA policies,
free-text owners, team ownership, bulk operations, or new creation-form fields.

## Open questions

None for this fixed rehearsal. Ask the Human if the generated Spec cannot meet
these constraints; never silently expand the scope. AI still writes the Spec
and Plan and the Human approves only versions they have actually reviewed.
