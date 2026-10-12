import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";

export const configPath = ".github/brownfield-human-gated-delivery/config.json";
export const provenancePath = "brownfield-demo-provenance.json";
export const stages = ["spec", "plan", "tests", "implementation"];
export const workflowFiles = [
  "kickoff", "documents", "pr-coordinator", "review-signal", "stage-ci",
  "advance", "publish",
].map((name) => `brownfield-human-gated-delivery-${name}.yml`).concat("it-service-desk-ci.yml");
export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
export const fullSha = (value) => typeof value === "string" && value.length === 40 && /^[a-f0-9]{40}$/.test(value);
export const positive = (value) => Number.isSafeInteger(value) && value > 0;

export function repository(value) {
  if (typeof value !== "string" || /\s/.test(value) || !/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/.test(value) ||
      [".", ".."].includes(value.split("/")[1])) {
    throw new Error("Use an explicit GitHub.com --repo OWNER/REPO, not a URL.");
  }
  return value.toLowerCase();
}

export function intentNumber(value) {
  if (String(Number(value)) !== String(value) || !/^[1-9]\d*$/.test(String(value)) || !positive(Number(value))) {
    throw new Error("--intent must be a positive safe integer.");
  }
  return Number(value);
}

export function reviewerLogin(value) {
  if (typeof value !== "string" || /\s/.test(value) || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(value)) {
    throw new Error("A valid Human GitHub login is required.");
  }
  return value;
}

export function safePath(value) {
  if (typeof value !== "string" || !value || value.length > 4096 ||
      /[\\:\x00-\x1f\x7f]/.test(value) || value.startsWith("/") ||
      value.split("/").some((part) => !part || [".", "..", ".git"].includes(part.toLowerCase()) ||
        /[. ]$/.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
    throw new Error(`Unsafe repository path: ${JSON.stringify(value)}`);
  }
  return value;
}

export function exists(path) {
  try { lstatSync(path); return true; } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

export function newDestination(path, outside) {
  if (typeof path !== "string" || !path) throw new Error("Specify a new --dest directory.");
  const requested = resolve(path);
  if (exists(requested)) throw new Error("Destination already exists; nothing will be overwritten.");
  const parent = realpathSync(dirname(requested));
  const destination = resolve(parent, basename(requested));
  if (outside) {
    const relation = relative(realpathSync(outside), destination);
    if (!relation || (!relation.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) &&
        relation !== ".." && !isAbsolute(relation))) {
      throw new Error("Destination must be outside the source repository, including symlink aliases.");
    }
  }
  return destination;
}

export function execute(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8", timeout: 30_000, maxBuffer: 16 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"], ...options,
  });
}

export function validateHumanConfig(config) {
  if (config?.version !== 1 || config.project?.path !== "demos/it-service-desk" ||
      !["merge", "squash", "rebase"].includes(config.mergeMethod)) {
    throw new Error("Unsupported delivery config/project.");
  }
  if (config.specReadiness !== undefined && !["structural", "decisions-v1"].includes(config.specReadiness)) {
    throw new Error("Unsupported Spec readiness profile.");
  }
  const policies = stages.map((stage) => [stage, config.stages?.[stage]]);
  for (const [name, policy] of policies) {
    if (!positive(policy?.minimumApprovals) || !Array.isArray(policy.reviewers?.users) ||
        !Array.isArray(policy.reviewers?.teams)) throw new Error(`Invalid Human policy: ${name}.`);
    policy.reviewers.users.forEach(reviewerLogin);
    if (policy.reviewers.teams.some((team) => typeof team !== "string" || !/^[A-Za-z0-9_-]+$/.test(team)) ||
        (!policy.reviewers.teams.length && new Set(policy.reviewers.users.map((user) => user.toLowerCase())).size < policy.minimumApprovals)) {
      throw new Error(`Insufficient or invalid Human reviewers: ${name}.`);
    }
  }
  return config;
}

export function substituteReviewer(config, reviewer) {
  reviewerLogin(reviewer);
  validateHumanConfig(config);
  const changed = structuredClone(config);
  const policies = stages.map((stage) => changed.stages[stage]);
  for (const policy of policies) {
    if (policy.minimumApprovals !== 1) throw new Error("Single reviewer substitution requires minimumApprovals=1; review multi-reviewer configuration manually.");
    policy.reviewers.users = [reviewer];
    policy.reviewers.teams = [];
  }
  return validateHumanConfig(changed);
}

export function validateProvenance(value) {
  if (value?.version !== 1 || value.kind !== "brownfield-demo-export" ||
      typeof value.source?.repository !== "string" || !value.source.repository ||
      !fullSha(value.source.commit) || !/^ownership-(standard|spec-revision|failure-recovery)$/.test(value.scenario) ||
      value.baselineVerified !== true || typeof value.singleOwner !== "boolean" ||
      !Number.isFinite(Date.parse(value.exportedAt)) ||
      !Array.isArray(value.omittedPaths) || value.omittedPaths.some((path) => {
        safePath(path);
        return false;
      })) {
    throw new Error("Invalid prepared-tree provenance manifest.");
  }
  reviewerLogin(value.reviewer);
  return value;
}
