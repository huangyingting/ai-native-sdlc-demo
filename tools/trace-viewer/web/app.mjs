import { renderHtml } from "./html-renderer.mjs";

const stateElement = document.querySelector(".state");
const runId = new URLSearchParams(location.search).get("run") ?? "";

function showError(message) {
  stateElement.classList.add("error");
  const title = document.createElement("h1");
  const detail = document.createElement("p");
  title.textContent = "Trace Viewer unavailable";
  detail.textContent = message;
  stateElement.replaceChildren(title, detail);
}

if (!/^\d+$/.test(runId)) {
  showError("The URL must include a numeric workflow run ID.");
} else {
  try {
    const response = await fetch(`../traces/${encodeURIComponent(runId)}.json`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Trace data returned HTTP ${response.status}.`);
    const model = await response.json();
    if (model.schemaVersion !== 1 || !Array.isArray(model.events) || !model.timeRange || !model.counts) {
      throw new Error("Trace data uses an unsupported schema.");
    }
    document.open();
    document.write(renderHtml(model));
    document.close();
  } catch (error) {
    showError(error.message);
  }
}
