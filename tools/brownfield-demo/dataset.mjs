import { loadManifest } from "./scenarios.mjs";

export const seedProbe = `
import { DatabaseSync } from "node:sqlite";
const database = new DatabaseSync("/app/data/service-desk.db", { readOnly: true });
try {
  const count = database.prepare("SELECT COUNT(*) AS count FROM tickets").get().count;
  const rows = database.prepare(\`
    SELECT id, title, description, category, status, priority,
      requester_name AS requesterName, requester_email AS requesterEmail,
      created_at AS createdAt, updated_at AS updatedAt
    FROM tickets ORDER BY id LIMIT 5
  \`).all();
  console.log(JSON.stringify({ count, rows }));
} finally {
  database.close();
}
`;

export function verifySeededDataset(snapshot, manifest = loadManifest()) {
  if (snapshot?.count !== 4 || !Array.isArray(snapshot.rows) || snapshot.rows.length !== 4) {
    throw new Error("Fresh application dataset must contain exactly four seeded tickets; no existing data was reset.");
  }
  const fields = [
    "title", "description", "category", "status", "priority", "requesterName",
    "requesterEmail", "createdAt", "updatedAt",
  ];
  for (const [index, expected] of manifest.fixtures.entries()) {
    const row = snapshot.rows[index];
    if (row?.id !== index + 1 || fields.some((key) => row[key] !== expected[key])) {
      throw new Error(`Fresh application seed differs from the deterministic baseline at ${expected.reference}; no data was overwritten.`);
    }
  }
  return {
    provisioner: "Application TicketStore.seed() on first dashboard request to a fresh isolated volume",
    verified: true, ticketCount: snapshot.count, references: manifest.fixtures.map((fixture) => fixture.reference),
    timestamps: "Fixed fixture timestamps verified exactly; later user-created/updated tickets use runtime timestamps.",
    ownershipVerified: false,
    note: "Read-only SQLite verification of original ticket fields. New ownership fields and old-schema migration still require the Human checklist and implementation tests.",
  };
}
