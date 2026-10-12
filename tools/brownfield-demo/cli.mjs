#!/usr/bin/env node
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadManifest, scenario } from "./scenarios.mjs";
import { prepare } from "./prepare.mjs";
import { preflight } from "./preflight.mjs";
import { runImage, stopImage } from "./docker.mjs";
import { replay } from "./replay.mjs";
import { readiness } from "./readiness.mjs";
import { qualifyReadiness } from "./qualify.mjs";
import { verifyImage, rehearseReliability } from "./reliability.mjs";

const usage = `Brownfield demo toolkit (Node.js 24+, dependency-free)
  scenario list
  scenario show ownership-standard|ownership-spec-revision|ownership-failure-recovery
  prepare --source PATH --source-ref FULL_COMMIT --dest NEW_OUTSIDE_PATH --reviewer LOGIN --scenario ID [--single-owner]
  preflight --repo OWNER/REPO [--single-owner] [--image ghcr.io/owner/image@sha256:DIGEST]
  run --repo OWNER/REPO --intent NUMBER --image ghcr.io/owner/image@sha256:DIGEST --port 3000
  stop --repo OWNER/REPO --intent NUMBER [--cleanup]
  replay --repo OWNER/REPO --intent NUMBER --dest NEW_PATH
  readiness --repo OWNER/REPO --intents N,N,N
  readiness --repos OWNER/NORMAL,OWNER/REVISION,OWNER/RECOVERY --intents N,N,N
  qualify --source PATH --source-ref FULL_COMMIT --dest NEW_OUTSIDE_PATH
  verify-image --image IMMUTABLE_IMAGE --profile baseline|readiness --dest NEW_OUTSIDE_PATH
  rehearse --image ghcr.io/owner/image@sha256:DIGEST --qualification REPORT_JSON --repo OWNER/REPO --owner LOGIN --dest NEW_OUTSIDE_PATH

GitHub operations are read-only. Prepare does not initialize Git, commit, or publish.
run starts Docker locally; stop retains data unless --cleanup is explicit.
qualify runs isolated readiness test mutants; it never changes the source checkout.
verify-image/rehearse create and clean new Docker resources, never accepted demo volumes.
rehearse uses a read-only loopback gateway and emits a maintenance draft; no GitHub writes.
Exit: 0=command/check succeeded (manual checks remain), 2=preflight/readiness incomplete, 1=error.
`;

export function parseOptions(args) {
  if (args.length === 0 || ["--help", "-h", "help"].includes(args[0])) return { command: "help" };
  const [command, ...rest] = args;
  const definitions = {
    prepare: { required: ["source", "source-ref", "dest", "reviewer", "scenario"], optional: [], flags: ["single-owner"] },
    preflight: { required: ["repo"], optional: ["image"], flags: ["single-owner"] },
    run: { required: ["repo", "intent", "image", "port"], optional: [], flags: [] },
    stop: { required: ["repo", "intent"], optional: [], flags: ["cleanup"] },
    replay: { required: ["repo", "intent", "dest"], optional: [], flags: [] },
    readiness: { required: ["intents"], optional: ["repo", "repos"], flags: [] },
    qualify: { required: ["source", "source-ref", "dest"], optional: [], flags: [] },
    "verify-image": { required: ["image", "profile", "dest"], optional: [], flags: [] },
    rehearse: { required: ["image", "qualification", "repo", "owner", "dest"], optional: [], flags: [] },
  };
  if (command === "scenario") {
    if (rest.length === 1 && rest[0] === "list") return { command, action: "list" };
    if (rest.length === 2 && rest[0] === "show") return { command, action: "show", id: rest[1] };
    throw new Error("Use scenario list or scenario show ID.");
  }
  const definition = definitions[command];
  if (!definition) throw new Error(`Unknown command: ${command}. Use --help.`);
  const { values } = parseArgs({
    args: rest, options: {
      ...Object.fromEntries([...definition.required, ...definition.optional].map((key) => [key, { type: "string" }])),
      ...Object.fromEntries(definition.flags.map((key) => [key, { type: "boolean", default: false }])),
    },
  });
  for (const key of definition.required) if (!values[key]?.trim()) throw new Error(`--${key} is required.`);
  return { command, ...values, sourceRef: values["source-ref"], singleOwner: values["single-owner"] === true };
}

export async function main(args) {
  if (Number(process.versions.node.split(".")[0]) < 24) throw new Error("Node.js 24 or newer is required.");
  const options = parseOptions(args);
  if (options.command === "help") { console.log(usage); return 0; }
  let result;
  switch (options.command) {
    case "scenario":
      result = options.action === "show" ? scenario(options.id) :
        loadManifest().variants.map(({ id, title }) => ({ id, title, status: "planned-not-evidence" }));
      break;
    case "prepare": result = prepare(options); break;
    case "preflight": result = await preflight(options); break;
    case "run": result = await runImage(options); break;
    case "stop": result = stopImage(options); break;
    case "replay": result = await replay(options); break;
    case "readiness": result = await readiness(options); break;
    case "qualify": result = await qualifyReadiness(options); break;
    case "verify-image": result = await verifyImage(options); break;
    case "rehearse": result = await rehearseReliability(options); break;
  }
  console.log(JSON.stringify(result, null, 2));
  if (options.command === "qualify") return result.exitCode;
  return (options.command === "preflight" && !result.automatedReady) ||
    (options.command === "readiness" && !result.ready) ? 2 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) { console.error(`Brownfield demo: ${error.message}`); process.exitCode = 1; }
}
