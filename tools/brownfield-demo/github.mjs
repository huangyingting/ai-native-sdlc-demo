import { execute, repository } from "./common.mjs";

export function readOnlyApi(method, endpoint, body, run = execute) {
  const graphQuery = method === "POST" && endpoint === "graphql" &&
    typeof body?.query === "string" && /^\s*query\b/.test(body.query) &&
    !/\bmutation\b/i.test(body.query);
  if (method !== "GET" && !graphQuery) throw new Error("Read-only GitHub adapter refuses remote writes.");
  if (typeof endpoint !== "string" || !/^(?:repos\/|apps\/|graphql$)/.test(endpoint) ||
      /[\s\\]/.test(endpoint) || endpoint.includes("..") || (method === "GET" && body !== undefined)) {
    throw new Error("Unsafe GitHub API endpoint or request.");
  }
  const args = [
    "api", "--hostname", "github.com", "--method", method, endpoint,
    "--header", "Accept: application/vnd.github+json",
    "--header", "X-GitHub-Api-Version: 2026-03-10",
    "--header", "GraphQL-Features: issues_copilot_assignment_api_support",
  ];
  if (graphQuery) args.push("--input", "-");
  let output;
  try { output = run("gh", args, graphQuery ? { input: JSON.stringify(body) } : {}); }
  catch (cause) {
    const error = new Error(`GitHub read failed for ${endpoint}; check gh authentication, access, and rate limits.`);
    error.notFound = /\bHTTP 404\b/.test(String(cause.stderr ?? ""));
    throw error;
  }
  return output.trim() ? JSON.parse(output) : null;
}

export function github(repo, api = readOnlyApi) {
  const root = `repos/${repository(repo)}`;
  return {
    get: (path) => api("GET", path ? `${root}/${path}` : root),
    optional(path) {
      try { return api("GET", `${root}/${path}`); }
      catch (error) { if (error.notFound) return null; throw error; }
    },
    list(path, key) {
      const all = [];
      for (let page = 1; page <= 100; page++) {
        const result = api("GET", `${root}/${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`);
        const items = key ? result?.[key] : result;
        if (!Array.isArray(items)) throw new Error(`Expected GitHub list: ${path}`);
        all.push(...items);
        if (items.length < 100) return all;
      }
      throw new Error(`Pagination limit reached: ${path}; refusing an incomplete evidence snapshot.`);
    },
  };
}

export function contentFile(file) {
  if (file?.encoding !== "base64" || typeof file.content !== "string" ||
      file.content.length > 2_000_000) throw new Error("GitHub file content is absent, oversized, or unsupported.");
  return Buffer.from(file.content, "base64");
}
