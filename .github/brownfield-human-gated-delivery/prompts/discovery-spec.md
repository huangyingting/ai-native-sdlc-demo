This run uses the decisions-v1 Spec readiness profile. Discovery is part of
Spec review, not a separate Intent approval. The Human still owns the Intent.

In addition to the normal Spec sections, include exactly one `## Discovery`
section with one JSON code block and this shape:

```json
{
  "problem": "Who experiences what problem and why it matters.",
  "evidence": "Source of the observation; explicitly identify missing evidence.",
  "successMeasure": "Observable success, or the missing baseline/target to clarify.",
  "alternatives": "Smaller alternatives and doing nothing, with trade-offs.",
  "questions": [
    {
      "id": "Q-1",
      "question": "Which ownership policy should apply?",
      "options": "Optional fixed roster / mandatory fixed roster / free text; describe trade-offs."
    }
  ],
  "decisionMapping": []
}
```

Treat this as a discovery brief, not permission to invent user research, ROI,
measurements, or stakeholder agreement. "Unknown" is valid evidence status.
Expose consequential unknowns, conflicting requests, and assumptions as
questions rather than silently choosing defaults. Every listed question
blocks approval until a configured Human records a decision or deferment.
Use no more than 20 questions; group related uncertainties and keep text brief.
If the Intent genuinely answers all consequential questions, an empty list is
valid; do not manufacture uncertainty just to demonstrate the mechanism.

Use stable Q-n IDs. Copy all questions and options from the supplied discovery
state exactly, including resolved/deferred ones. Do not remove, rename, or
downgrade them. Add a new question for a new uncertainty. Corrections to an
existing question require Human disposition of the old one, not its deletion.
Do not output statuses, Human identities, approvals, or decision receipts in
this JSON: only trusted automation can record them.

Only supplied latestDecisions are recorded Human decisions. Discussion,
feedback, and previous prose are not substitutes. Integrate the latest outcome
into the proposed behavior, not just the revision summary. For each latest
decision, include exactly one decisionMapping entry:

```json
{
  "questionId": "Q-1",
  "commentId": 12345,
  "acceptanceIds": ["AC-1"],
  "explanation": "How the outcome changes the named scenarios."
}
```

Use the actual supplied comment ID, not the example. Reference only existing
AC IDs. If no acceptance scenario changes, use an empty acceptanceIds array
and explain why, including any accepted limitation. Map deferments too, but
never describe them as resolved or as evidence of implemented behavior.
Surface a newly discovered conflict with a recorded decision as a new question.

Keep the normal Open questions section readable and consistent with this
register. List unanswered Q-n items, distinguish deferred risks, and say
"None" only when neither remains. A candidate with unanswered questions may
be published for discussion, but automation will reject its approval.
The Human must inspect the revised Spec after a decision; mapping references
alone cannot prove that the behavior correctly implements that decision.
