import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import { TicketStore } from "./ticket-store";

type OwnershipStore = TicketStore & {
  updateOwner: (id: number, owner: string | null) => boolean;
};

const directories: string[] = [];
const stores: TicketStore[] = [];

function databasePath() {
  const directory = mkdtempSync(join(tmpdir(), "ticket-ownership-"));
  directories.push(directory);
  return join(directory, "tickets.db");
}

function openStore(path: string): OwnershipStore {
  const store = new TicketStore(path, false);
  stores.push(store);
  return store as OwnershipStore;
}

function oldSchemaDatabase() {
  const path = databasePath();
  const database = new DatabaseSync(path);
  database.exec(`
    CREATE TABLE tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL,
      priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
      status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
      requester_name TEXT NOT NULL, requester_email TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
  `);
  const insert = database.prepare(`
    INSERT INTO tickets (id, title, description, category, priority, status,
      requester_name, requester_email, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insert.run(1, "Cannot connect to corporate VPN",
    "The VPN client stops at 80% and reports that the gateway is unavailable.",
    "Network and connectivity", "high", "open", "Maya Chen", "maya.chen@example.com",
    "2026-09-25T01:20:00.000Z", "2026-09-25T01:20:00.000Z");
  insert.run(2, "Request access to finance reporting",
    "Please add read-only access to the monthly finance reporting workspace.",
    "Access and identity", "medium", "in_progress", "Daniel Foster", "daniel.foster@example.com",
    "2026-09-24T07:45:00.000Z", "2026-09-25T00:10:00.000Z");
  insert.run(3, "Teams microphone is not detected",
    "The built-in microphone works in Windows settings but is unavailable in Teams calls.",
    "Email and collaboration", "low", "resolved", "Priya Shah", "priya.shah@example.com",
    "2026-09-23T03:30:00.000Z", "2026-09-24T09:15:00.000Z");
  insert.run(4, "Executive laptop will not start",
    "The laptop shows a blank screen after the latest firmware update.",
    "Device and hardware", "critical", "open", "Alex Morgan", "alex.morgan@example.com",
    "2026-09-25T02:05:00.000Z", "2026-09-25T02:05:00.000Z");
  const original = database.prepare("SELECT * FROM tickets ORDER BY id").all();
  database.close();
  return { path, original };
}

afterEach(() => {
  while (stores.length) stores.pop()?.close();
  while (directories.length) rmSync(directories.pop()!, { recursive: true, force: true });
});

describe("Ticket ownership persistence", () => {
  it("migrates four old-schema records in place without changing legacy fields or timestamps (AC-1)", () => {
    const { path, original } = oldSchemaDatabase();
    const store = openStore(path);
    const tickets = store.list();
    expect(tickets.map((ticket) => ticket.reference)).toEqual(
      ["INC-0004", "INC-0001", "INC-0002", "INC-0003"],
    );
    expect(tickets.every((ticket) => Object.hasOwn(ticket, "owner"))).toBe(true);
    expect(tickets.map((ticket) => (ticket as typeof ticket & { owner: string | null }).owner))
      .toEqual([null, null, null, null]);
    expect(store.summary()).toEqual({ open: 2, inProgress: 1, resolved: 1, urgent: 2 });
    const database = new DatabaseSync(path);
    try {
      const migrated = database.prepare("SELECT * FROM tickets ORDER BY id").all();
      expect(migrated.map((row) =>
        Object.fromEntries(Object.entries(row).filter(([column]) => column !== "owner"))))
        .toEqual(original);
      expect(migrated.map((row) => row.owner)).toEqual([null, null, null, null]);
    } finally {
      database.close();
    }
  });

  it("assigns, reassigns, clears and persists ownership across reopening the same database (AC-2)", () => {
    const { path } = oldSchemaDatabase();
    let store = openStore(path);
    const original = store.find(1)!;
    expect(typeof store.updateOwner).toBe("function");
    for (const [owner, expected] of [
      ["avery-stone", "avery-stone"],
      ["jordan-lee", "jordan-lee"],
      [null, null],
    ] as const) {
      expect(store.updateOwner(1, owner)).toBe(true);
      const changed = store.find(1)! as typeof original & { owner: string | null };
      expect(changed.owner).toBe(expected);
      expect(new Date(changed.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(original.updatedAt).getTime());
      expect({ ...changed, owner: undefined, updatedAt: original.updatedAt })
        .toEqual({ ...original, owner: undefined });
      store.close();
      stores.pop();
      store = openStore(path);
      expect((store.find(1) as typeof changed).owner).toBe(expected);
    }
  });

  it("does not write or change updatedAt when setting the already-current owner (AC-2)", () => {
    const { path } = oldSchemaDatabase();
    const store = openStore(path);
    const before = store.find(1);
    expect(typeof store.updateOwner).toBe("function");
    expect(store.updateOwner(1, null)).toBe(true);
    expect(store.find(1)).toEqual(before);
    expect(store.updateOwner(1, "avery-stone")).toBe(true);
    const assigned = store.find(1);
    expect(store.updateOwner(1, "avery-stone")).toBe(true);
    expect(store.find(1)).toEqual(assigned);
  });

  it("intersects exact owner sets with search, status and priority without changing summaries (AC-3)", () => {
    const { path } = oldSchemaDatabase();
    const store = openStore(path);
    expect(typeof store.updateOwner).toBe("function");
    store.updateOwner(1, "avery-stone");
    store.updateOwner(3, "avery-stone");
    store.updateOwner(2, "jordan-lee");
    const list = store.list.bind(store) as (filters?: {
      owner?: string | null; status?: "open"; priority?: "high" | "critical"; query?: string;
    }) => ReturnType<TicketStore["list"]>;
    const references = (filters?: Parameters<typeof list>[0]) =>
      list(filters).map((ticket) => ticket.reference).sort();
    expect(references()).toEqual(["INC-0001", "INC-0002", "INC-0003", "INC-0004"]);
    expect(references({ owner: "avery-stone" })).toEqual(["INC-0001", "INC-0003"]);
    expect(references({ owner: "jordan-lee" })).toEqual(["INC-0002"]);
    expect(references({ owner: null })).toEqual(["INC-0004"]);
    expect(references({ owner: "avery-stone", status: "open", priority: "high", query: "inc-1" }))
      .toEqual(["INC-0001"]);
    expect(references({ owner: "avery-stone", priority: "critical" })).toEqual([]);
    expect(store.summary()).toEqual({ open: 2, inProgress: 1, resolved: 1, urgent: 2 });
    expect(references({ status: "open", priority: "high", query: "inc-1" })).toEqual(["INC-0001"]);
    expect(store.find(1)).toHaveProperty("owner", "avery-stone");
  });

  it("creates the exact new request as open and unassigned without changing existing workflows (AC-5)", () => {
    const store = openStore(databasePath());
    const created = store.create({
      title: "Ownership demo request",
      description: "Verify a new unassigned ticket.",
      category: "Other",
      priority: "low",
      requesterName: "Demo Requester",
      requesterEmail: "demo.requester@example.com",
    });
    expect(created.status).toBe("open");
    expect(created).toHaveProperty("owner", null);
    expect(store.list({ query: "Ownership demo" }).map((ticket) => ticket.id)).toEqual([created.id]);
    expect(store.list({ status: "open", priority: "low" }).map((ticket) => ticket.id)).toEqual([created.id]);
    expect(store.updateStatus(created.id, "in_progress")).toBe(true);
    expect(store.summary()).toEqual({ open: 0, inProgress: 1, resolved: 0, urgent: 0 });
  });
});
