#!/usr/bin/env node
import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { approveImpact, benchmark, implementImpact, proposeImpact } from "./experiments.mjs";

const usage = `Engineering judgment demos (Node 24, Docker, authenticated Copilot CLI)
  impact-propose --source PATH --source-ref FULL_COMMIT --image IMMUTABLE_NODE_IMAGE --dest NEW_EXTERNAL_PATH
  impact-approve --run PATH --proposal-hash SHA256 --reviewer LOGIN
  impact-implement --run PATH
  benchmark --source PATH --source-ref FULL_COMMIT --image IMMUTABLE_NODE_IMAGE --dest NEW_EXTERNAL_PATH

Actual paid Copilot calls: impact 2 total, benchmark 9 total; at most 120s per call.
The benchmark compares one-shot vs diagnosis-first on three fixed synthetic cases.
No model override: observe the user's CLI selection. No dollar costs are inferred.
Generated code runs only in restricted Docker, never on the host.
No GitHub writes or lifecycle approvals. Existing output directories are refused.
Exit codes: 0=passed or explicit review pending, 2=completed with failed candidates, 1=error.
`;

export function parseOptions(args) {
  if (!args.length || ["help", "--help"].includes(args[0])) return { command: "help" };
  const [command, ...rest] = args;
  const definitions = {
    "impact-propose": ["source", "source-ref", "image", "dest"],
    "impact-approve": ["run", "proposal-hash", "reviewer"],
    "impact-implement": ["run"],
    benchmark: ["source", "source-ref", "image", "dest"],
  };
  const fields = definitions[command];
  if (!fields) throw new Error("Unknown engineering demo command; use --help.");
  const { values } = parseArgs({ args: rest, options: Object.fromEntries(fields.map((field) => [field, { type: "string" }])) });
  if (fields.some((field) => !values[field]?.trim())) throw new Error(`Required options: ${fields.join(", ")}`);
  return { command, ...values, sourceRef: values["source-ref"], proposalHash: values["proposal-hash"] };
}

export async function main(args) {
  if (Number(process.versions.node.split(".")[0]) < 24) throw new Error("Node 24+ is required.");
  const options = parseOptions(args);
  if (options.command === "help") { console.log(usage); return 0; }
  const actions = {
    "impact-propose": proposeImpact, "impact-approve": approveImpact,
    "impact-implement": implementImpact, benchmark,
  };
  const result = await actions[options.command](options);
  console.log(JSON.stringify(result, null, 2));
  return result.exitCode ?? 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) { console.error(`Engineering demo: ${error.message}`); process.exitCode = 1; }
}
