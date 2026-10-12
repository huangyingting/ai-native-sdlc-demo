import {
  approveDocument, initialDocumentState, latestDecisions, parseDocumentCommand,
  publishDocumentRevision, recordDiscoveryDecision, requestDocumentRevision,
} from "../../../.github/brownfield-human-gated-delivery/scripts/document-core.mjs";
import { commit, config } from "./helpers.mjs";

export function discoveryFixture({ intent = 42, complete = true, revise = false } = {}) {
  const reviewConfig = { ...structuredClone(config), specReadiness: "decisions-v1" };
  const state = initialDocumentState({ number: intent, title: "Ticket ownership", body: "Clarify ownership." }, commit, reviewConfig);
  const questions = [
    { id: "Q-1", question: "Who can own a ticket?", options: "Local owner list or external directory." },
    { id: "Q-2", question: "Should assignment notify the owner?", options: "Notify now or defer." },
  ];
  const comments = [];
  const texts = {};
  const user = { id: 10, login: "reviewer", type: "User" };
  const comment = (body) => {
    const id = 4001 + comments.length;
    const at = `2026-09-26T00:${String(comments.length + 1).padStart(2, "0")}:00Z`;
    const value = { id, body, user, created_at: at, updated_at: at, author_association: "OWNER" };
    comments.push({ id, body, user, createdAt: at, updatedAt: at, authorAssociation: "OWNER" });
    return value;
  };
  const receipt = (value, action) => {
    state.lastCommentId = value.id;
    state.receipts.push({ id: value.id, message: `Command #${value.id} recorded: ${action}.` });
  };
  const publishSpec = () => {
    const discovery = {
      problem: "Support agents need visible ticket ownership.",
      evidence: "Synthetic fixture observations.", successMeasure: "Ownership persists after reload.",
      alternatives: "A local owner list or a full external directory.", questions,
      decisionMapping: latestDecisions(state.discovery).map((decision) => ({
        questionId: decision.questionId, commentId: decision.commentId,
        acceptanceIds: decision.disposition === "resolved" ? ["AC-1"] : [],
        explanation: decision.disposition === "resolved" ? "AC-1 uses the local list." : "Notifications remain out of scope.",
      })),
    };
    texts.spec = `# Specification
## Intent
Clarify ticket ownership.
## Scope
Local ticket owners.
## Non-goals
No external directory or notifications.
## Actors
Support agents.
## Constraints
Preserve existing tickets.
## Acceptance scenarios
### AC-1: Assign an owner
**Given** an unassigned ticket
**When** an agent selects a local owner
**Then** the selected owner persists after reload
## Revision summary
Published revision ${state.pending.version}.
## Open questions
See the bounded Discovery question list.
## Discovery
\`\`\`json
${JSON.stringify(discovery, null, 2)}
\`\`\`
`;
    publishDocumentRevision(state, texts.spec, null, reviewConfig);
  };
  requestDocumentRevision(state, "spec", "Initial proposal.", reviewConfig);
  publishSpec();
  if (complete) {
    for (const [action, question, fields] of [
      ["decide", "Q-1", "Outcome: Use the local owner list.\nRationale: Keep this change bounded."],
      ["defer", "Q-2", "Rationale: Notifications need separate discovery.\nOwner: reviewer\nFollow-up: Revisit in a separate Intent.\nRisk: Owners must inspect the queue."],
      ["decide", "Q-1", "Outcome: Use exactly two local owners.\nRationale: Preserve the fixed scenario."],
    ]) {
      const value = comment(`/sdlc ${action} spec v${state.counters.spec} ${question}\n${fields}`);
      const command = parseDocumentCommand(value.body);
      recordDiscoveryDecision(state, command, value, reviewConfig);
      receipt(value, `${action} spec v${command.version}`);
      publishSpec();
    }
    if (revise) {
      const value = comment("/sdlc revise spec\nClarify owner persistence after reload.");
      requestDocumentRevision(state, "spec", parseDocumentCommand(value.body).feedback, reviewConfig);
      receipt(value, "revise spec");
      publishSpec();
    }
    const specApproval = comment(`/sdlc approve spec v${state.counters.spec}`);
    approveDocument(state, parseDocumentCommand(specApproval.body), specApproval, reviewConfig);
    receipt(specApproval, `approve spec v${state.counters.spec}`);
    texts.plan = `# Implementation plan
## Acceptance mapping
TASK-1 covers AC-1.
## Tasks
### TASK-1: Persist local ticket ownership
Depends on: none
Acceptance: AC-1
Surfaces: ticket store and UI
Validation: store and UI tests
## Risks and migrations
Add a nullable owner column without changing existing ticket data.
## Validation
Red/Green tests, lint, build and container verification.
## Revision summary
Initial plan.
## Open questions
None.
`;
    requestDocumentRevision(state, "plan", "Implement the approved Spec.", reviewConfig);
    publishDocumentRevision(state, texts.plan, texts.spec, reviewConfig);
    const planApproval = comment("/sdlc approve plan v1");
    approveDocument(state, parseDocumentCommand(planApproval.body), planApproval, reviewConfig);
    receipt(planApproval, "approve plan v1");
  }
  return { state, texts, config: reviewConfig, comments };
}
