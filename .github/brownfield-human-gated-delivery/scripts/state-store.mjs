import { contentHash } from "./document-core.mjs";
import { graphql } from "./github.mjs";

export const isWorkflowComment = (comment) =>
  comment.user?.type === "Bot" && comment.user.login === "github-actions[bot]";

export class ReviewStateStore {
  constructor(io, { branch, path, marker, validate, allowedPaths = [] }) {
    Object.assign(this, { io, branch, path, marker, validate, allowedPaths });
  }

  async ledger(intent) {
    const comment = (await this.io.list(`/issues/${intent}/comments`))
      .find((item) => isWorkflowComment(item) && item.body?.startsWith(this.marker));
    if (!comment) return null;
    const { node } = await graphql(this.io.token, `
      query DocumentLedger($id: ID!) {
        node(id: $id) {
          ... on IssueComment {
            body lastEditedAt
            author { __typename login }
            editor { __typename login }
          }
        }
      }
    `, { id: comment.node_id });
    const trusted = (actor) => actor?.__typename === "Bot" &&
      ["github-actions", "github-actions[bot]"].includes(actor.login);
    if (!trusted(node?.author) || (node.lastEditedAt && !trusted(node.editor))) {
      throw new Error("The review audit ledger was edited outside trusted workflow automation.");
    }
    return node;
  }

  async load(intent) {
    const sha = await this.io.ref(this.branch(intent));
    if (!sha) {
      if (await this.ledger(intent)) throw new Error("Review branch is missing but its audit ledger exists; restore the attested ref rather than resetting history.");
      return null;
    }
    const record = await this.io.file(this.path(intent), sha);
    const ledger = await this.ledger(intent);
    if (!ledger?.body.split("\n").includes(`${sha} ${contentHash(record.text)}`)) {
      throw new Error("Review state lacks its trusted workflow audit entry; direct edits cannot authorize a handoff.");
    }
    return { sha, state: this.validate(JSON.parse(record.text), intent), blob: record.sha };
  }

  async save(snapshot, state, files = {}) {
    const intent = state.intent;
    this.validate(state, intent);
    const branch = this.branch(intent);
    const current = await this.io.ref(branch);
    if (current !== (snapshot?.sha ?? null)) throw new Error("Review branch changed concurrently; retry the operation.");
    const base = snapshot?.sha ?? state.baseline;
    const commit = await this.io.request(`/git/commits/${base}`);
    const record = JSON.stringify(state, null, 2) + "\n";
    const tree = [{ path: this.path(intent), mode: "100644", type: "blob", content: record }];
    for (const [path, text] of Object.entries(files)) {
      if (!this.allowedPaths.includes(path)) throw new Error("Only declared review artifacts may be published.");
      tree.push({ path, mode: "100644", type: "blob", ...(text === null ? { sha: null } : { content: text }) });
    }
    const createdTree = await this.io.request("/git/trees", "POST", { base_tree: commit.tree.sha, tree });
    const created = await this.io.request("/git/commits", "POST", {
      message: `Record delivery review for Intent #${intent}`, tree: createdTree.sha, parents: [base],
    });
    // Attest before moving the ref, so a failed write can never become trusted
    // merely by leaving an unsigned state file on the branch.
    const ledger = await this.ledger(intent);
    const entries = ledger?.body.split("\n").filter((line) => /^[a-f0-9]{40} [a-f0-9]{64}$/.test(line)) ?? [];
    entries.push(`${created.sha} ${contentHash(record)}`);
    const body = `<details>\n<summary>Review audit ledger</summary>\n\nTrusted workflow commit and state SHA-256 receipts.\n\n\`\`\`text\n${entries.join("\n")}\n\`\`\`\n</details>`;
    if (Buffer.byteLength(body) > 55000) throw new Error("Review audit ledger is full; start a new Intent rather than losing history.");
    await this.io.comment(intent, this.marker, body);
    if (current) await this.io.request(`/git/refs/heads/${branch}`, "PATCH", { sha: created.sha, force: false });
    else await this.io.request("/git/refs", "POST", { ref: `refs/heads/${branch}`, sha: created.sha });
    return this.load(intent);
  }
}
