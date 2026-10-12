import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readdirSync, readFileSync } from "node:fs";
import { parseIssueRequest, supportedPatterns } from "./prepare-demo-request.mjs";

const modelFields = `### Orchestrator model

gpt-6-luna

### Subagent model

gpt-6-luna`;

test("preserves Markdown headings and constraints inside task and guidance fields", () => {
  const prompt = "Review this request:\n\n### Requirements\n\nOnly inspect tools; do not examine demos.\n\n### Validation\n\nReport evidence.";
  const guidance = "Keep the review focused.\n\n### Boundaries\n\nDo not make changes.";
  const request = parseIssueRequest(`${modelFields}

### Task or question

${prompt}

### Agent instructions

${guidance}

### Trace detail

Metadata only`);
  assert.equal(request.prompt, prompt);
  assert.ok(request.instruction.includes(guidance));
  assert.equal(request.includeMessages, false);
});

test("preserves form-like headings in fenced task examples", () => {
  for (const fence of ["```", "~~~~"]) {
    const prompt = `Review this example:\n\n${fence}markdown\n### Trace detail\n\nMetadata only\n${fence}\n\nKeep these instructions.`;
    const request = parseIssueRequest(`${modelFields}

### Task or question

${prompt}

### Trace detail

Include redacted request and response payloads`);
    assert.equal(request.prompt, prompt);
    assert.equal(request.includeMessages, true);
  }
});

test("does not treat inline code or invalid backtick info strings as fence openers", () => {
  for (const prompt of [
    "```npm test```",
    "   ```npm test```",
    "````run `npm test` safely````",
    "```javascript `not a valid fence info string`",
  ]) {
    const guidance = "Do not change files.";
    const request = parseIssueRequest(`${modelFields}

### Task or question

${prompt}

### Agent instructions

${guidance}

### Trace detail

Include redacted request and response payloads`);
    assert.equal(request.prompt, prompt.trim());
    assert.ok(request.instruction.includes(guidance));
    assert.equal(request.includeMessages, true);
  }
});

test("allows backticks in tilde-fence info and preserves fields after longer closing fences", () => {
  for (const [opening, closing] of [
    ["~~~markdown `example`", "~~~~"],
    ["```javascript", "````"],
  ]) {
    const prompt = `${opening}\n### Agent instructions\n\nThis is example content.\n${closing}`;
    const request = parseIssueRequest(`${modelFields}

### Task or question

${prompt}

### Agent instructions

Actual guidance.

### Trace detail

Include redacted request and response payloads`);
    assert.equal(request.prompt, prompt);
    assert.match(request.instruction, /Actual guidance\./);
    assert.doesNotMatch(request.instruction, /This is example content/);
    assert.equal(request.includeMessages, true);
  }
});

test("preserves legacy task headings with CRLF line endings", () => {
  const request = parseIssueRequest(`${modelFields}

### Comparison task

Compare services.

### Constraints

Read-only.

### Trace content

_No response_`.replaceAll("\n", "\r\n"));
  assert.equal(request.prompt, "Compare services.\n\n### Constraints\n\nRead-only.");
  assert.equal(request.includeMessages, false);
});

test("rejects ambiguous repeated form fields", () => {
  assert.throws(() => parseIssueRequest(`${modelFields}

### Task or question

First task.

### Task or question

Second task.`), /Duplicate issue form field: Task or question/);
});

test("parses a Copilot CLI agent demo issue form", () => {
  const request = parseIssueRequest(`### Orchestration pattern

Parallel delegation

### Orchestrator model

gpt-6-sol

### Subagent model

claude-sonnet-4.6

### Task or question

Compare two services safely.

### Agent instructions

Focus one reviewer on API compatibility.

### Trace content

- [x] Include redacted request and response payloads in the HTML trace artifact`);
  assert.deepEqual(request, {
    pattern: "parallel-delegation",
    patternLabel: "Parallel delegation",
    execution: "fleet",
    instruction: "Dynamically create at least two read-only subagents and run them concurrently. Give each an independent subtask or perspective, wait for all branches, then synthesize their results and reconcile conflicts. Use only the available read-only tools; do not attempt shell commands or file writes. Focus one reviewer on API compatibility. Every dynamically created subagent must use the claude-sonnet-4.6 model.",
    orchestratorModel: "gpt-6-sol",
    subagentModel: "claude-sonnet-4.6",
    prompt: "Compare two services safely.",
    allowedUrl: "",
    includeMessages: true,
    requiredModels: "gpt-6-sol,claude-sonnet-4.6",
  });
});

test("validates the optional Parallel delegation URL exception", () => {
  const base = `### Orchestration pattern

Parallel delegation

### Orchestrator model

gpt-6-luna

### Subagent model

gpt-6-luna

### Internet access

`;
  assert.equal(parseIssueRequest(`${base}Block all external URLs`).allowedUrl, "");
  assert.equal(
    parseIssueRequest(`${base}Allow https://docs.aws.amazon.com`).allowedUrl,
    "https://docs.aws.amazon.com",
  );
  assert.throws(
    () => parseIssueRequest(`${base}Allow https://example.com`),
    /Unsupported Internet access option/,
  );
});

test("rejects edited issue forms with unsupported models", () => {
  assert.throws(() => parseIssueRequest(`### Orchestrator model

untrusted-model

### Subagent model

gpt-6-luna

### Comparison task

Compare services.`), /Unsupported orchestrator model/);
});

test("defaults older issue forms to parallel delegation", () => {
  const request = parseIssueRequest(`### Orchestrator model

gpt-6-luna

### Subagent model

gpt-6-luna

### Comparison task

Compare services.`);
  assert.equal(request.pattern, "parallel-delegation");
  assert.equal(request.patternLabel, "Parallel delegation");
  assert.equal(request.prompt, "Compare services.");
});

test("rejects unsupported orchestration patterns", () => {
  assert.throws(() => parseIssueRequest(`### Orchestration pattern

Untrusted workflow

### Orchestrator model

gpt-6-luna

### Subagent model

gpt-6-luna`), /Unsupported orchestration pattern/);
});

test("prepares direct and critique demos", () => {
  const single = parseIssueRequest(`### Orchestration pattern

Direct execution

### Orchestrator model

gpt-6-luna

### Subagent model

gpt-6-luna`);
  assert.equal(single.pattern, "direct-execution");
  assert.match(single.instruction, /without invoking any subagents/);
  assert.equal(single.requiredModels, "gpt-6-luna");

  const rubberDuck = parseIssueRequest(`### Orchestration pattern

Critic-reviser loop

### Orchestrator model

gpt-6-luna

### Subagent model

gpt-6-luna`);
  assert.equal(rubberDuck.pattern, "critic-reviser-loop");
  assert.match(rubberDuck.instruction, /dynamically create one read-only subagent/);
  assert.match(rubberDuck.instruction, /gpt-6-luna model/);
});

test("does not inject example-specific guidance into a custom issue task", () => {
  const request = parseIssueRequest(`### Orchestration pattern

Parallel delegation

### Orchestrator model

gpt-6-luna

### Subagent model

gpt-6-luna

### Task or question

Review the authentication boundary from two independent perspectives.`);
  assert.match(request.instruction, /run them concurrently/);
  assert.doesNotMatch(request.instruction, /Amazon S3|Azure Blob Storage|Microsoft Learn/);
});

test("provides a runnable default for every orchestration pattern", () => {
  for (const { id, label, defaultPrompt } of supportedPatterns) {
    const request = parseIssueRequest(`### Orchestration pattern

${label}

### Orchestrator model

gpt-6-luna

### Subagent model

gpt-6-luna`);
    assert.equal(request.pattern, id);
    assert.equal(request.prompt, defaultPrompt);
    assert.ok(request.instruction.length > 20);
  }
});

test("keeps orchestration pattern labels synchronized", () => {
  const workflow = readFileSync(".github/workflows/copilot-cli-agent-demos.yml", "utf8");
  const formSources = readdirSync(".github/ISSUE_TEMPLATE")
    .filter((name) => name.startsWith("copilot-") && name.endsWith(".yml"))
    .map((name) => readFileSync(`.github/ISSUE_TEMPLATE/${name}`, "utf8"));
  assert.equal(formSources.length, supportedPatterns.length);
  for (const { id, label } of supportedPatterns) {
    const pattern = new RegExp(`- ${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
    assert.match(workflow, pattern);
    const matchingForms = formSources.filter((source) => source.includes(`"copilot-pattern:${id}"`));
    assert.equal(matchingForms.length, 1);
    assert.doesNotMatch(matchingForms[0], /id: orchestration_pattern|label: Orchestration pattern/);
    assert.match(matchingForms[0], /id: task_prompt[\s\S]*?value:\s*\|[\s\S]*?\S/);
    assert.doesNotMatch(matchingForms[0], /id: agent_instructions|label: Agent instructions/);
    assert.equal(matchingForms[0].match(/type: textarea/g)?.length, 1);
  }
});

test("routes dedicated issue forms by their pattern label", () => {
  const request = parseIssueRequest(`### Orchestrator model

gpt-6-luna

### Subagent model

gpt-6-luna

### Task or question

Review two independent concerns.`, [
    { name: "copilot-agent-demo" },
    { name: "copilot-pattern:parallel-delegation" },
  ]);
  assert.equal(request.pattern, "parallel-delegation");
  assert.throws(
    () => parseIssueRequest("", [
      { name: "copilot-pattern:parallel-delegation" },
      { name: "copilot-pattern:direct-execution" },
    ]),
    /Multiple orchestration pattern labels/,
  );
});

test("defaults every issue form to detailed request and response tracing", () => {
  const formSources = readdirSync(".github/ISSUE_TEMPLATE")
    .filter((name) => name.startsWith("copilot-") && name.endsWith(".yml"))
    .map((name) => readFileSync(`.github/ISSUE_TEMPLATE/${name}`, "utf8"));
  for (const source of formSources) {
    assert.match(source, /id: trace_detail[\s\S]*Include redacted request and response payloads[\s\S]*Metadata only[\s\S]*default: 0/);
  }
  const request = parseIssueRequest(`### Orchestrator model

gpt-6-luna

### Subagent model

gpt-6-luna

### Trace detail

Include redacted request and response payloads`);
  assert.equal(request.includeMessages, true);
});

test("keeps provider comparison content out of reusable pattern defaults", () => {
  const defaults = supportedPatterns.map(({ defaultPrompt, instruction }) => `${defaultPrompt} ${instruction}`).join("\n");
  assert.doesNotMatch(defaults, /Amazon|AWS|Azure|Microsoft Learn|docs\.aws/);
  const parallelForm = readFileSync(".github/ISSUE_TEMPLATE/copilot-cli-parallel-delegation.yml", "utf8");
  assert.match(parallelForm, /Amazon S3/);
  assert.match(parallelForm, /Azure Blob Storage/);
  assert.match(parallelForm, /Use only docs\.aws\.amazon\.com for AWS and Microsoft Learn MCP for Azure/);
  assert.match(parallelForm, /Block all external URLs[\s\S]*Allow https:\/\/docs\.aws\.amazon\.com/);
  assert.match(parallelForm, /id: allow_url[\s\S]*default: 1/);
});

test("pairs the validated URL exception with web fetch permission", () => {
  const workflow = readFileSync(".github/workflows/copilot-cli-agent-demos.yml", "utf8");
  assert.match(workflow, /EXTRA_ARGS\+=\(--allow-url="\$ALLOWED_URL"\)/);
  assert.match(workflow, /else\s+EXTRA_ARGS\+=\(--available-tools='[^']*'\)/);
  assert.doesNotMatch(workflow, /--available-tools='[^']*web_fetch[^']*'/);
  assert.match(workflow, /--available-tools='[^']*microsoft-learn[^']*'/);
  assert.match(workflow, /--allow-tool='web_fetch,microsoft-learn'/);
  assert.doesNotMatch(workflow, /microsoft-learn\(microsoft_docs_(?:search|fetch)\)/);
  assert.doesNotMatch(workflow, /--(?:available-tools|allow-tool)='[^']*(?:^|,)read(?:,|$)/m);
  assert.doesNotMatch(workflow, /--(?:available-tools|allow-tool)='[^']*(?:^|,)search(?:,|$)/m);
  assert.match(workflow, /--allow-tool='[^']*web_fetch[^']*'/);
  assert.doesNotMatch(workflow, /--allow-url='https:\/\/docs\.aws\.amazon\.com'/);
});

test("captures only the dependency graph for issue images", () => {
  const workflow = readFileSync(".github/workflows/copilot-cli-agent-demos.yml", "utf8");
  assert.match(workflow, /node tools\/trace-viewer\/capture-dependency-graph\.mjs/);
});

test("updates the existing demo result comment instead of duplicating it", () => {
  const workflow = readFileSync(".github/workflows/copilot-cli-agent-demos.yml", "utf8");
  assert.match(workflow, /copilot-agent-demo-result/);
  assert.match(workflow, /issues\/comments\/\$COMMENT_ID/);
  assert.match(workflow, /--method PATCH/);
  assert.match(workflow, /ARTIFACT_URL: \$\{\{ steps\.trace_artifact\.outputs\.artifact-url \}\}/);
  assert.match(workflow, /PAGES_URL: https:\/\/\$\{\{ github\.repository_owner \}\}\.github\.io\/\$\{\{ github\.event\.repository\.name \}\}\/viewer\/\?run=\$\{\{ github\.run_id \}\}/);
});

test("publishes successful trace artifacts through the shared trace site", () => {
  const workflow = readFileSync(".github/workflows/publish-trace-site.yml", "utf8");
  assert.match(workflow, /workflow_run:[\s\S]*Copilot CLI Agent Demos/);
  assert.match(workflow, /conclusion == 'success'/);
  assert.match(workflow, /group: copilot-trace-pages[\s\S]*cancel-in-progress: false/);
  assert.match(workflow, /actions\/download-artifact@v8[\s\S]*run-id: \$\{\{ github\.event\.workflow_run\.id \}\}/);
  assert.match(workflow, /ref: gh-pages/);
  assert.match(workflow, /publish-trace-site\.mjs report pages source/);
  assert.match(workflow, /pages\/builds/);
});
