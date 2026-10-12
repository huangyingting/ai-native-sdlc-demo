import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { execute } from "../common.mjs";
import { seedProbe, verifySeededDataset } from "../dataset.mjs";
import { loadManifest } from "../scenarios.mjs";
import { artifacts } from "./helpers.mjs";

test("the real SQLite probe reads the known schema and verifies fixture data without changing the database", (t) => {
  const filename = join(artifacts(t), "isolated-seed.db");
  const database = new DatabaseSync(filename);
  database.exec(`
    CREATE TABLE tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL,
      priority TEXT NOT NULL, status TEXT NOT NULL,
      requester_name TEXT NOT NULL, requester_email TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
  `);
  const insert = database.prepare(`
    INSERT INTO tickets (
      title, description, category, priority, status, requester_name,
      requester_email, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const fixture of loadManifest().fixtures) {
    insert.run(fixture.title, fixture.description, fixture.category, fixture.priority, fixture.status,
      fixture.requesterName, fixture.requesterEmail, fixture.createdAt, fixture.updatedAt);
  }
  database.close();
  const before = readFileSync(filename);
  const probe = seedProbe.replace('"/app/data/service-desk.db"', JSON.stringify(filename));
  const snapshot = JSON.parse(execute(process.execPath, ["--input-type=module", "-e", probe]));
  assert.equal(verifySeededDataset(snapshot).verified, true);
  assert.deepEqual(snapshot.rows.map((row) => row.id), [1, 2, 3, 4]);
  assert.deepEqual(readFileSync(filename), before);
});
