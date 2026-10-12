import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

export const supportedModels = [
  "gpt-6-luna",
  "gpt-6-sol",
  "gpt-6-astra",
  "gpt-5.6-luna",
  "gpt-5.6-terra",
  "gpt-5.6-sol",
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.3-codex",
  "gpt-5-mini",
  "claude-sonnet-5",
  "claude-sonnet-4.6",
  "gemini-3.8-flash",
  "grok-4.7",
  "mai-code-1.1-flash",
];

export const supportedPatterns = [
  {
    id: "direct-execution",
    label: "Direct execution",
    legacyLabels: ["Single-agent baseline", "Single agent baseline"],
    execution: "direct",
    defaultPrompt: "Analyze the current repository, identify the highest-impact improvement, and support the recommendation with repository evidence.",
    instruction: "Handle the task directly without invoking any subagents. Produce a concise evidence-backed answer. Use direct file reads or simple literal searches; do not attempt shell commands, file writes, or complex regular expressions.",
  },
  {
    id: "parallel-delegation",
    label: "Parallel delegation",
    legacyLabels: ["Parallel research", "Concurrent research", "Parallel review", "Review panel"],
    execution: "fleet",
    defaultPrompt: "Analyze the current repository from at least two independent perspectives, then synthesize the findings into prioritized recommendations supported by evidence.",
    instruction: "Dynamically create at least two read-only subagents and run them concurrently. Give each an independent subtask or perspective, wait for all branches, then synthesize their results and reconcile conflicts. Use only the available read-only tools; do not attempt shell commands or file writes.",
  },
  {
    id: "critic-reviser-loop",
    label: "Critic-reviser loop",
    legacyLabels: ["Critique and revision", "Rubber duck critique"],
    execution: "sequential",
    defaultPrompt: "Propose a meaningful improvement to the current repository, challenge its hidden assumptions and unnecessary complexity, then produce a simpler and more defensible revised proposal.",
    instruction: "First write a concise initial position. Then dynamically create one read-only subagent as an independent critic, give it the request and initial position, and wait for its response. Finish with a revised conclusion that states what changed. Use only the available read-only tools; do not attempt shell commands or file writes.",
  },
  {
    id: "sequential-pipeline",
    label: "Sequential pipeline",
    legacyLabels: ["Sequential handoff", "Lead + specialists"],
    execution: "sequential",
    defaultPrompt: "Develop an implementation plan for a meaningful repository improvement, then critically review the plan and produce a revised version with clear goals, architecture decisions, risks, and acceptance criteria.",
    instruction: "Dynamically create two read-only subagents in sequence. Wait for the first result, then give that result and the original request to a fresh second subagent. Finally synthesize the two stages. Use only the available read-only tools; do not attempt shell commands or file writes.",
  },
];

const formLabels = [
  "Orchestration pattern", "Orchestration demo", "Orchestration scenario",
  "Orchestrator model", "Subagent model", "Internet access",
  "Task or question", "Comparison task", "Agent instructions",
  "Trace detail", "Trace content",
];

function extractFormSections(body) {
  const sections = new Map();
  let content;
  let fence = "";
  for (const line of String(body ?? "").split(/\r?\n/)) {
    if (fence) {
      if (new RegExp(`^ {0,3}${fence[0]}{${fence.length},}\\s*$`).test(line)) fence = "";
      content?.push(line);
      continue;
    }
    const openingFence = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (openingFence && !(openingFence[1][0] === "`" && openingFence[2].includes("`"))) {
      fence = openingFence[1];
      content?.push(line);
      continue;
    }
    const heading = line.match(/^### (.+?)\s*$/)?.[1];
    const label = formLabels.find((candidate) => candidate.toLowerCase() === heading?.toLowerCase());
    if (label) {
      if (sections.has(label)) throw new Error(`Duplicate issue form field: ${label}`);
      content = [];
      sections.set(label, content);
    } else {
      content?.push(line);
    }
  }
  return new Map([...sections].map(([label, lines]) => {
    const value = lines.join("\n").trim();
    return [label, value === "_No response_" ? "" : value];
  }));
}

function validateModel(model, field) {
  if (!supportedModels.includes(model)) throw new Error(`Unsupported ${field}: ${model || "(missing)"}`);
  return model;
}

function validateAllowedUrl(option) {
  if (!option || option === "Block all external URLs") return "";
  if (option === "Allow https://docs.aws.amazon.com") return "https://docs.aws.amazon.com";
  throw new Error(`Unsupported Internet access option: ${option}`);
}

function findPattern(label) {
  const selectedLabel = label || "Parallel delegation";
  const selected = supportedPatterns.find((candidate) =>
    candidate.label === selectedLabel || candidate.legacyLabels.includes(selectedLabel));
  if (!selected) throw new Error(`Unsupported orchestration pattern: ${label || "(missing)"}`);
  return selected;
}

function resolveIssuePattern(sections, labels = []) {
  const explicitLabel = sections.get("Orchestration pattern")
    || sections.get("Orchestration demo")
    || sections.get("Orchestration scenario");
  const patternIds = labels
    .map((label) => typeof label === "string" ? label : label?.name)
    .filter((label) => label?.startsWith("copilot-pattern:"))
    .map((label) => label.slice("copilot-pattern:".length));
  if (patternIds.length > 1) throw new Error(`Multiple orchestration pattern labels: ${patternIds.join(", ")}`);
  const labeledPattern = patternIds.length
    ? supportedPatterns.find((candidate) => candidate.id === patternIds[0])
    : null;
  if (patternIds.length && !labeledPattern) throw new Error(`Unsupported orchestration pattern label: ${patternIds[0]}`);
  const bodyPattern = explicitLabel ? findPattern(explicitLabel) : null;
  if (labeledPattern && bodyPattern && labeledPattern.id !== bodyPattern.id) {
    throw new Error(`Conflicting orchestration patterns: ${labeledPattern.label} and ${bodyPattern.label}`);
  }
  return labeledPattern || bodyPattern || findPattern("");
}

export function parseIssueRequest(body, labels = []) {
  const sections = extractFormSections(body);
  const selectedPattern = resolveIssuePattern(sections, labels);
  const orchestratorModel = validateModel(sections.get("Orchestrator model"), "orchestrator model");
  const subagentModel = validateModel(sections.get("Subagent model"), "subagent model");
  const customPrompt = sections.get("Task or question") || sections.get("Comparison task");
  const prompt = customPrompt || selectedPattern.defaultPrompt;
  const guidance = sections.get("Agent instructions");
  const capture = sections.get("Trace detail") || sections.get("Trace content");
  return completeRequest({
    pattern: selectedPattern.id,
    patternLabel: selectedPattern.label,
    execution: selectedPattern.execution,
    instruction: [selectedPattern.instruction, guidance].filter(Boolean).join(" "),
    orchestratorModel,
    subagentModel,
    prompt,
    allowedUrl: validateAllowedUrl(sections.get("Internet access")),
    includeMessages: /Include redacted request and response payloads/.test(capture),
  });
}

function completeRequest(request) {
  if (request.execution !== "direct") {
    request.instruction += ` Every dynamically created subagent must use the ${request.subagentModel} model.`;
  }
  request.requiredModels = request.execution === "direct"
    ? request.orchestratorModel
    : [...new Set([request.orchestratorModel, request.subagentModel])].join(",");
  return request;
}

function appendWorkflowOutput(name, value) {
  const delimiter = `TRACE_${randomUUID()}`;
  appendFileSync(process.env.GITHUB_OUTPUT, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const selectedPattern = findPattern(process.env.INPUT_PATTERN);
  const customPrompt = process.env.INPUT_TASK_PROMPT?.trim();
  const guidance = process.env.INPUT_AGENT_INSTRUCTIONS?.trim();
  const request = process.env.GITHUB_EVENT_NAME === "issues"
    ? parseIssueRequest(event.issue?.body, event.issue?.labels)
    : completeRequest({
        pattern: selectedPattern.id,
        patternLabel: selectedPattern.label,
        execution: selectedPattern.execution,
        instruction: [selectedPattern.instruction, guidance].filter(Boolean).join(" "),
        orchestratorModel: validateModel(process.env.INPUT_ORCHESTRATOR_MODEL || "gpt-6-luna", "orchestrator model"),
        subagentModel: validateModel(process.env.INPUT_SUBAGENT_MODEL || "gpt-6-luna", "subagent model"),
        prompt: customPrompt || selectedPattern.defaultPrompt,
        allowedUrl: "",
        includeMessages: process.env.INPUT_INCLUDE_MESSAGES === "true",
      });
  writeFileSync(process.env.TRACE_PROMPT_PATH, request.prompt);
  writeFileSync(process.env.TRACE_INSTRUCTION_PATH, request.instruction);
  appendWorkflowOutput("pattern", request.pattern);
  appendWorkflowOutput("pattern_label", request.patternLabel);
  appendWorkflowOutput("execution", request.execution);
  appendWorkflowOutput("orchestrator_model", request.orchestratorModel);
  appendWorkflowOutput("subagent_model", request.subagentModel);
  appendWorkflowOutput("required_models", request.requiredModels);
  appendWorkflowOutput("allowed_url", request.allowedUrl);
  appendWorkflowOutput("include_messages", String(request.includeMessages));
  appendWorkflowOutput("issue_number", String(event.issue?.number ?? ""));
}
