import {
  configPath, execute, fullSha, provenancePath, repository, validateHumanConfig,
  validateProvenance, workflowFiles,
} from "./common.mjs";
import { contentFile, github, readOnlyApi } from "./github.mjs";
import { baselineProblems } from "./prepare.mjs";
import { loadManifest } from "./scenarios.mjs";
import { exactImage } from "./docker.mjs";

export const manualChecks = [
  "Verify COPILOT_ASSIGN_TOKEN scopes, expiry, repository access and Copilot entitlement without sharing its value.",
  "Verify Copilot CLI billing/usage and copilot-requests permission, sub-issues, Actions policy, GHCR publication/private-image pull access, and Docker daemon availability.",
  "Review inherited rulesets, classic branch protection and Environment approval gates; trusted document and runtime record branches must be writable without granting bypass.",
  "Confirm intended Human identities, independent review (unless explicitly using single-owner mode), and acceptance authority. Teams require manual verification.",
  "No automated preflight proves a live run, old-data migration, UI acceptance, or the three scenario variants. Record real evidence separately.",
];

export async function preflight(options, {
  api = readOnlyApi, run = execute, manifest = loadManifest(), setupPreview,
} = {}) {
  const repo = repository(options.repo);
  const client = github(repo, api);
  const blockers = [];
  const local = {};
  for (const [name, command, args] of [
    ["node", "node", ["--version"]], ["git", "git", ["--version"]],
    ["gh", "gh", ["--version"]], ["docker", "docker", ["--version"]],
  ]) {
    try { local[name] = run(command, args).trim().split("\n")[0]; }
    catch { local[name] = "unavailable"; blockers.push(`Local ${name} CLI is unavailable.`); }
  }
  if (!/^v(?:2[4-9]|[3-9]\d|\d{3,})\./.test(local.node)) blockers.push("Node.js 24+ is required.");
  const metadata = client.get("");
  if (metadata.full_name?.toLowerCase() !== repo || metadata.archived || metadata.default_branch !== "main") {
    blockers.push("Expected the explicit, unarchived GitHub repository with main as default branch.");
  }
  const main = client.get("branches/main").commit?.sha;
  if (!fullSha(main)) throw new Error("Cannot pin current main for preflight.");
  const tree = client.get(`git/trees/${main}?recursive=1`);
  if (tree.truncated || !Array.isArray(tree.tree)) throw new Error("Cannot inspect a truncated repository tree.");
  const files = new Map(tree.tree.filter((entry) => entry.type === "blob").map((entry) => [entry.path, { data: Buffer.alloc(0) }]));
  const needed = [
    provenancePath, configPath, `${manifest.project}/Dockerfile`,
    ...Object.keys(manifest.baseline.files).map((path) => `${manifest.project}/${path}`),
  ];
  for (const path of needed) {
    if (files.has(path)) files.set(path, { data: contentFile(client.get(`contents/${path}?ref=${main}`)) });
  }
  blockers.push(...baselineProblems(files, manifest));
  let provenance = null;
  try {
    provenance = validateProvenance(JSON.parse(files.get(provenancePath)?.data.toString() ?? "null"));
    if (provenance.singleOwner !== (options.singleOwner === true)) {
      blockers.push("Prepared single-owner mode differs; pass --single-owner only if the export explicitly selected it.");
    }
    const config = validateHumanConfig(JSON.parse(files.get(configPath).data.toString()));
    const policies = Object.values(config.stages);
    if (policies.some((policy) => policy.reviewers.users.length !== 1 ||
        policy.reviewers.users[0].toLowerCase() !== provenance.reviewer.toLowerCase() ||
        policy.reviewers.teams.length)) blockers.push("Human configuration differs from the prepared reviewer.");
  } catch (error) { blockers.push(error.message); }
  const registered = client.list("actions/workflows", "workflows");
  for (const file of workflowFiles) {
    if (!registered.some((entry) => entry.path === `.github/workflows/${file}` && entry.state === "active")) {
      blockers.push(`Required workflow is not active: ${file}`);
    }
  }
  const previewLogs = [];
  let preview = null;
  try {
    if (!setupPreview) {
      const module = await import(new URL("../../.github/brownfield-human-gated-delivery/scripts/setup.mjs", import.meta.url));
      setupPreview = module.setup;
    }
    preview = await setupPreview({
      repo, apply: false, "set-token": false, "single-owner": options.singleOwner === true,
    }, {
      api, setToken: () => { throw new Error("Preflight never writes secrets."); },
      log: (line) => previewLogs.push(String(line)),
    });
    if (preview?.ready !== true || preview.changes?.length || preview.blockers?.length) {
      blockers.push("Repository setup preview is incomplete; review suggested changes and blockers separately.");
    }
  } catch (error) { blockers.push(`Setup preview failed: ${error.message}`); }
  if (client.get("branches/main").commit?.sha !== main) blockers.push("Main changed during preflight; repeat the checks against a stable baseline.");
  if (options.image !== undefined) exactImage(options.image);
  return {
    version: 1, mode: "read-only-preflight", repository: repo, inspectedCommit: main,
    automatedReady: blockers.length === 0, readyForLiveRun: false,
    provenance, singleOwner: options.singleOwner === true, local,
    image: options.image ?? null,
    imageNote: options.image ? "Digest syntax checked only; pull/health/acceptance are not verified by preflight." : "No deployment digest supplied; needed only once an image has actually been published.",
    blockers: [...new Set(blockers)], setupPreview: preview, previewLogs, manualChecks,
  };
}
