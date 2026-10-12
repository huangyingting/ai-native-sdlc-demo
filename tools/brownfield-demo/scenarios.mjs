import { readFileSync } from "node:fs";
import { safePath } from "./common.mjs";

export const scenarioDirectory = new URL("../../demos/it-service-desk/.github/brownfield-human-gated-delivery/scenarios/", import.meta.url);
const baselinePaths = [
  "src/lib/ticket.ts", "src/lib/ticket-store.ts", "src/app/actions.ts",
  "src/app/page.tsx", "src/app/tickets/[id]/page.tsx", "src/app/ticket-form.tsx",
];
const variantIds = ["ownership-standard", "ownership-spec-revision", "ownership-failure-recovery"];

export function validateManifest(value) {
  if (value?.version !== 1 || value.feature !== "ticket-ownership" ||
      value.project !== "demos/it-service-desk" || value.template !== "intent.md" ||
      value.checklist !== "acceptance.md" || typeof value.title !== "string") {
    throw new Error("Invalid ownership scenario manifest.");
  }
  const files = value.baseline?.files;
  if (!files || Object.keys(files).length !== baselinePaths.length ||
      !baselinePaths.every((path) => /^[a-f0-9]{64}$/.test(files[path]))) {
    throw new Error("Every approved absent-ownership baseline fingerprint is required.");
  }
  Object.keys(files).forEach(safePath);
  if (JSON.stringify(value.owners) !== JSON.stringify([
    { id: "avery-stone", name: "Avery Stone" }, { id: "jordan-lee", name: "Jordan Lee" },
  ])) throw new Error("The ownership roster must remain deterministic.");
  if (!Array.isArray(value.fixtures) || value.fixtures.length !== 4 ||
      value.fixtures.some((fixture, index) => fixture.reference !== `INC-000${index + 1}` ||
        fixture.owner !== null || typeof fixture.title !== "string" || !fixture.title ||
        ["description", "category", "requesterName", "requesterEmail"].some((key) =>
          typeof fixture[key] !== "string" || !fixture[key].trim()) ||
        ["createdAt", "updatedAt"].some((key) => typeof fixture[key] !== "string" ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(fixture[key]) ||
          !Number.isFinite(Date.parse(fixture[key]))) ||
        !["open", "in_progress", "resolved", "closed"].includes(fixture.status) ||
        !["low", "medium", "high", "critical"].includes(fixture.priority))) {
    throw new Error("Four deterministic unassigned baseline fixtures are required.");
  }
  if (!Array.isArray(value.acceptance) || value.acceptance.length !== 5 ||
      value.acceptance.some((item, index) => item.id !== `AC-${index + 1}` ||
        typeof item.criterion !== "string" || !item.criterion.trim()) ||
      !Array.isArray(value.nonGoals) || !value.nonGoals.length) throw new Error("Fixed acceptance criteria and non-goals are required.");
  if (!Array.isArray(value.variants) || value.variants.length !== 3 ||
      value.variants.some((variant, index) => variant.id !== variantIds[index] ||
        typeof variant.title !== "string" ||
        !Array.isArray(variant.steps) || !variant.steps.length ||
        !Array.isArray(variant.requiredEvidence) || !variant.requiredEvidence.length ||
        [...variant.steps, ...variant.requiredEvidence].some((item) => typeof item !== "string" || !item.trim()))) {
    throw new Error("Standard, Spec revision, and failure-recovery variants are required.");
  }
  return value;
}

export function loadManifest() {
  return validateManifest(JSON.parse(readFileSync(new URL("ownership.json", scenarioDirectory), "utf8")));
}

export function scenario(id, manifest = loadManifest()) {
  const selected = manifest.variants.find((item) => item.id === id);
  if (!selected) throw new Error(`Unknown scenario: ${id}. Use scenario list.`);
  const { variants, ...feature } = manifest;
  return { ...feature, variant: selected };
}
