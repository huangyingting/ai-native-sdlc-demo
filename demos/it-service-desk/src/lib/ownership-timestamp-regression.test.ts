import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { TicketStore } from "./ticket-store";

const directories: string[] = [];
const stores: TicketStore[] = [];

function databasePath() {
  const directory = mkdtempSync(join(tmpdir(), "ticket-owner-timestamp-"));
  directories.push(directory);
  return join(directory, "tickets.db");
}

function oldSchemaDatabaseWithFutureTimestamp() {
  const path = databasePath();
  const database = new DatabaseSync(path);
  database.exec(`
    CREATE TABLE tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
      status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
      requester_name TEXT NOT NULL,
      requester_email TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  database.prepare(`
    INSERT INTO tickets (
      id, title, description, category, priority, status,
      requester_name, requester_email, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    1,
    "Future timestamp migration",
    "Verify owner assignment does not move updatedAt backward.",
    "Other",
    "high",
    "open",
    "Demo Requester",
    "demo.requester@example.com",
    "2099-01-01T00:00:00.000Z",
    "2099-01-02T00:00:00.000Z",
  );
  const original = database.prepare("SELECT * FROM tickets WHERE id = 1").get();
  database.close();
  return { path, original };
}

afterEach(() => {
  while (stores.length) stores.pop()?.close();
  while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true });
});

describe("Ticket ownership timestamp regression", () => {
  it("does not decrease future updatedAt when assigning an old-schema ticket owner", () => {
    const { path, original } = oldSchemaDatabaseWithFutureTimestamp();
    const store = new TicketStore(path, false);
    stores.push(store);

    expect(store.updateOwner(1, "avery-stone")).toBe(true);
    const changed = store.find(1);
    expect(changed).toMatchObject({
      owner: "avery-stone",
      updatedAt: "2099-01-02T00:00:00.000Z",
    });

    const database = new DatabaseSync(path);
    try {
      const persisted = database.prepare("SELECT * FROM tickets WHERE id = 1").get() as Record<string, unknown>;
      expect(Object.fromEntries(Object.entries(persisted).filter(([column]) => column !== "owner")))
        .toEqual(original);
      expect(persisted.owner).toBe("avery-stone");
    } finally {
      database.close();
    }
  });
});
