import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { TicketStore } from "./ticket-store";

const openStores: TicketStore[] = [];

function createTestStore() {
  const ticketStore = new TicketStore(":memory:", false);
  openStores.push(ticketStore);
  return ticketStore;
}

afterEach(() => {
  while (openStores.length) openStores.pop()?.close();
});

describe("TicketStore", () => {
  it("creates and retrieves a ticket", () => {
    const ticketStore = createTestStore();
    const created = ticketStore.create({
      title: "Cannot reset my password",
      description: "The password reset link reports that it has expired.",
      category: "Access and identity",
      priority: "high",
      requesterName: "Jordan Lee",
      requesterEmail: "jordan.lee@example.com",
    });

    expect(created.reference).toBe("INC-0001");
    expect(created.status).toBe("open");
    expect(ticketStore.find(created.id)).toEqual(created);
  });

  it("filters tickets by status, priority, and query", () => {
    const ticketStore = createTestStore();
    const vpn = ticketStore.create({
      title: "VPN is unavailable",
      description: "The VPN connection fails before authentication completes.",
      category: "Network and connectivity",
      priority: "critical",
      requesterName: "Taylor Kim",
      requesterEmail: "taylor.kim@example.com",
    });
    ticketStore.create({
      title: "Install design software",
      description: "Please install the approved design package on my laptop.",
      category: "Business applications",
      priority: "low",
      requesterName: "Morgan Bell",
      requesterEmail: "morgan.bell@example.com",
    });
    ticketStore.updateStatus(vpn.id, "in_progress");

    expect(ticketStore.list({ status: "in_progress" })).toHaveLength(1);
    expect(ticketStore.list({ priority: "critical" })[0].id).toBe(vpn.id);
    expect(ticketStore.list({ query: "VPN" }).map((ticket) => ticket.id)).toEqual([vpn.id]);
    expect(ticketStore.list({ query: "taylor" })[0].id).toBe(vpn.id);
    expect(ticketStore.list({ query: "  TaYLoR  " }).map((ticket) => ticket.id)).toEqual([vpn.id]);
  });

  it.each(["INC-0001", "inc-0001", "  Inc-0001  ", "0001", "1", "inc-1"])(
    "finds a ticket by normalized reference or ID: %j",
    (query) => {
      const ticketStore = createTestStore();
      const created = ticketStore.create({
        title: "Cannot reset my password",
        description: "The password reset link reports that it has expired.",
        category: "Access and identity",
        priority: "high",
        requesterName: "Jordan Lee",
        requesterEmail: "jordan.lee@example.com",
      });
      ticketStore.create({
        title: "Install design software",
        description: "Please install the approved design package on my laptop.",
        category: "Business applications",
        priority: "low",
        requesterName: "Morgan Bell",
        requesterEmail: "morgan.bell@example.com",
      });

      expect(ticketStore.list({ query }).map((ticket) => ticket.id)).toEqual([created.id]);
      expect(ticketStore.list({ query, status: "open", priority: "high" })).toHaveLength(1);
      expect(ticketStore.list({ query, status: "closed" })).toEqual([]);
      expect(ticketStore.list({ query, priority: "low" })).toEqual([]);
      expect(ticketStore.list({ query: "INC-9999" })).toEqual([]);
    },
  );

  it("matches displayed references beyond four digits", () => {
    const ticketStore = createTestStore();
    let created;
    for (let index = 0; index < 10000; index += 1) {
      created = ticketStore.create({
        title: "Cannot reset my password",
        description: "The password reset link reports that it has expired.",
        category: "Access and identity",
        priority: "high",
        requesterName: "Jordan Lee",
        requesterEmail: "jordan.lee@example.com",
      });
    }
    expect(created?.reference).toBe("INC-10000");
    expect(ticketStore.list({ query: "INC-10000" }).map((ticket) => ticket.id)).toEqual([10000]);
  });

  it("updates summary counts when ticket status changes", () => {
    const ticketStore = createTestStore();
    const created = ticketStore.create({
      title: "Laptop display flickers",
      description: "The display flickers whenever the laptop is connected to a dock.",
      category: "Device and hardware",
      priority: "high",
      requesterName: "Sam Rivera",
      requesterEmail: "sam.rivera@example.com",
    });

    expect(ticketStore.summary()).toEqual({ open: 1, inProgress: 0, resolved: 0, urgent: 1 });
    ticketStore.updateStatus(created.id, "resolved");
    expect(ticketStore.summary()).toEqual({ open: 0, inProgress: 0, resolved: 1, urgent: 0 });
  });

  it("supports assigning, handing off, and clearing ownership in every status", () => {
    const ticketStore = createTestStore();
    vi.useFakeTimers();
    try {
      const storeWithOwnership = ticketStore as TicketStore & {
        updateOwner?: (id: number, owner: "alex-chen" | "sam-rivera" | null) => boolean;
      };
      const updateOwner = storeWithOwnership.updateOwner;

      expect(updateOwner).toBeTypeOf("function");
      if (!updateOwner) return;

      for (const status of ["open", "in_progress", "resolved", "closed"] as const) {
        const created = ticketStore.create({
          title: `Ownership status ${status}`,
          description: "Ownership must be independent from status.",
          category: "Device and hardware",
          priority: "high",
          requesterName: "Jordan Lee",
          requesterEmail: "jordan.lee@example.com",
        });
        expect((created as typeof created & { owner?: string | null }).owner).toBeNull();
        if (status !== "open") ticketStore.updateStatus(created.id, status);
        const before = ticketStore.find(created.id)!;
        const setOwner = (owner: "alex-chen" | "sam-rivera" | null) =>
          updateOwner.call(storeWithOwnership, created.id, owner);

        vi.setSystemTime(new Date(Date.now() + 1_000));
        expect(setOwner("alex-chen")).toBe(true);
        const assigned = ticketStore.find(created.id)!;
        expect((assigned as typeof assigned & { owner?: string | null }).owner).toBe("alex-chen");
        expect(assigned.status).toBe(status);
        expect(assigned.updatedAt).not.toBe(before.updatedAt);
        expect(assigned).toMatchObject({
          id: before.id,
          reference: before.reference,
          title: before.title,
          description: before.description,
          category: before.category,
          priority: before.priority,
          requesterName: before.requesterName,
          requesterEmail: before.requesterEmail,
          createdAt: before.createdAt,
        });

        const assignedUpdatedAt = assigned.updatedAt;
        const assignedSnapshot = ticketStore.find(created.id);
        vi.setSystemTime(new Date(Date.now() + 1_000));
        expect(setOwner("alex-chen")).toBe(true);
        expect(ticketStore.find(created.id)).toEqual(assignedSnapshot);

        vi.setSystemTime(new Date(Date.now() + 1_000));
        expect(setOwner("sam-rivera")).toBe(true);
        const reassigned = ticketStore.find(created.id)!;
        expect(reassigned).toMatchObject({ owner: "sam-rivera", status });
        expect(reassigned.updatedAt).not.toBe(assignedUpdatedAt);

        vi.setSystemTime(new Date(Date.now() + 1_000));
        expect(setOwner(null)).toBe(true);
        const cleared = ticketStore.find(created.id)!;
        expect(cleared).toMatchObject({ owner: null, status });
        expect(cleared.updatedAt).not.toBe(reassigned.updatedAt);

        const changedStatus = status === "closed" ? "open" : "closed";
        ticketStore.updateStatus(created.id, changedStatus);
        expect(ticketStore.find(created.id)).toMatchObject({
          owner: null,
          status: changedStatus,
        });
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("filters assigned and unassigned tickets together with existing filters and ordering", () => {
    const ticketStore = createTestStore();
    const alex = ticketStore.create({
      title: "VPN access first",
      description: "First matching VPN request.",
      category: "Network and connectivity",
      priority: "high",
      requesterName: "Taylor Kim",
      requesterEmail: "taylor.kim@example.com",
    });
    const sam = ticketStore.create({
      title: "VPN access second",
      description: "Second matching VPN request.",
      category: "Network and connectivity",
      priority: "low",
      requesterName: "Morgan Bell",
      requesterEmail: "morgan.bell@example.com",
    });
    const unassigned = ticketStore.create({
      title: "VPN access unassigned",
      description: "An unassigned VPN request.",
      category: "Network and connectivity",
      priority: "critical",
      requesterName: "Riley Park",
      requesterEmail: "riley.park@example.com",
    });
    const other = ticketStore.create({
      title: "Finance reporting",
      description: "Finance reporting access is unavailable.",
      category: "Business applications",
      priority: "critical",
      requesterName: "Casey Nguyen",
      requesterEmail: "casey.nguyen@example.com",
    });
    ticketStore.updateStatus(sam.id, "in_progress");
    ticketStore.updateStatus(other.id, "closed");
    const storeWithOwnership = ticketStore as TicketStore & {
      updateOwner?: (id: number, owner: "alex-chen" | "sam-rivera" | null) => boolean;
      list: (filters?: {
        owner?: "alex-chen" | "sam-rivera" | "unassigned";
        status?: "open" | "in_progress" | "resolved" | "closed";
        priority?: "low" | "medium" | "high" | "critical";
        query?: string;
      }) => ReturnType<TicketStore["list"]>;
    };

    expect(storeWithOwnership.updateOwner).toBeTypeOf("function");
    if (!storeWithOwnership.updateOwner) return;
    storeWithOwnership.updateOwner(alex.id, "alex-chen");
    storeWithOwnership.updateOwner(sam.id, "sam-rivera");
    storeWithOwnership.updateOwner(other.id, "alex-chen");

    expect(storeWithOwnership.list({
      owner: "alex-chen",
      status: "open",
      priority: "high",
      query: "VPN",
    }).map((ticket) => ticket.id)).toEqual([alex.id]);
    expect(storeWithOwnership.list({
      owner: "sam-rivera",
      status: "in_progress",
      priority: "low",
      query: "VPN",
    }).map((ticket) => ticket.id)).toEqual([sam.id]);
    expect(storeWithOwnership.list({
      owner: "unassigned",
      status: "open",
      priority: "critical",
      query: "VPN",
    }).map((ticket) => ticket.id)).toEqual([unassigned.id]);
    expect(storeWithOwnership.list({
      status: "open",
      query: "VPN",
    }).map((ticket) => ticket.id)).toEqual([unassigned.id, alex.id]);
    expect(storeWithOwnership.list({
      owner: "alex-chen",
      status: "closed",
      priority: "critical",
      query: "finance",
    }).map((ticket) => ticket.id)).toEqual([other.id]);
    expect(storeWithOwnership.list({
      owner: "unassigned",
      status: "closed",
      priority: "critical",
      query: "finance",
    })).toEqual([]);
  });

  it("migrates populated and empty legacy databases without reseeding and preserves owner updates across reopen", () => {
    const directory = mkdtempSync(join(tmpdir(), "service-desk-legacy-"));
    const filename = join(directory, "populated-legacy.sqlite");
    const emptyFilename = join(directory, "empty-legacy.sqlite");
    vi.useFakeTimers();
    const statuses = ["open", "in_progress", "resolved", "closed"] as const;
    const expected = statuses.map((status, index) => ({
      id: index + 1,
      reference: `INC-${String(index + 1).padStart(4, "0")}`,
      title: `Historical ticket ${index + 1}`,
      description: `Legacy record ${index + 1} must remain intact.`,
      category: "Access and identity",
      priority: index % 2 ? "low" : "high",
      status,
      requesterName: `Requester ${index + 1}`,
      requesterEmail: `requester${index + 1}@example.com`,
      createdAt: `2026-01-0${index + 1}T01:02:03.000Z`,
      updatedAt: `2026-02-0${index + 1}T04:05:06.000Z`,
      owner: null,
    }));
    const createLegacyDatabase = (target: string, records: typeof expected) => {
      const database = new DatabaseSync(target);
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
        )
      `);
      const insert = database.prepare(`
        INSERT INTO tickets (
          id, title, description, category, priority, status,
          requester_name, requester_email, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const record of records) {
        insert.run(
          record.id,
          record.title,
          record.description,
          record.category,
          record.priority,
          record.status,
          record.requesterName,
          record.requesterEmail,
          record.createdAt,
          record.updatedAt,
        );
      }
      database.close();
    };

    try {
      createLegacyDatabase(filename, expected);
      createLegacyDatabase(emptyFilename, []);

      const storeWithOwnership = new TicketStore(filename) as unknown as {
        list(): ReturnType<TicketStore["list"]>;
        updateOwner?: (id: number, owner: "alex-chen" | "sam-rivera" | null) => boolean;
        close(): void;
      };
      try {
        expect(storeWithOwnership.list().sort((left, right) => left.id - right.id)).toEqual(expected);
      } finally {
        storeWithOwnership.close();
      }

      for (let initialization = 0; initialization < 2; initialization += 1) {
        const emptyStore = new TicketStore(emptyFilename);
        try {
          expect(emptyStore.list()).toEqual([]);
        } finally {
          emptyStore.close();
        }
      }

      let expectedSnapshot: ReturnType<TicketStore["list"]> = [];
      let savedUpdatedAt = expected[0].updatedAt;
      vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));
      for (const owner of ["alex-chen", "sam-rivera", null] as const) {
        vi.setSystemTime(new Date(Date.now() + 1_000));
        const nextUpdatedAt = new Date().toISOString();
        const updateStore = new TicketStore(filename, false) as unknown as {
          updateOwner?: (id: number, owner: "alex-chen" | "sam-rivera" | null) => boolean;
          list(): ReturnType<TicketStore["list"]>;
          close(): void;
        };
        let actualSnapshot: ReturnType<TicketStore["list"]> = [];
        try {
          expect(updateStore.updateOwner).toBeTypeOf("function");
          if (!updateStore.updateOwner) return;
          expect(updateStore.updateOwner(1, owner)).toBe(true);
          actualSnapshot = updateStore.list().sort((left, right) => left.id - right.id);
        } finally {
          updateStore.close();
        }

        expect(actualSnapshot[0]).toEqual({
          ...expected[0],
          owner,
          updatedAt: nextUpdatedAt,
        });
        expect(actualSnapshot[0].updatedAt).not.toBe(savedUpdatedAt);
        expect(actualSnapshot.slice(1)).toEqual(expected.slice(1));
        expectedSnapshot = actualSnapshot;
        savedUpdatedAt = actualSnapshot[0].updatedAt;

        const reopened = new TicketStore(filename);
        try {
          expect(reopened.list().sort((left, right) => left.id - right.id))
            .toEqual(expectedSnapshot);
        } finally {
          reopened.close();
        }
      }
    } finally {
      vi.useRealTimers();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("surfaces a real SQLite owner-write failure without changing the ticket", () => {
    const directory = mkdtempSync(join(tmpdir(), "service-desk-readonly-"));
    const filename = join(directory, "tickets.sqlite");
    const ticketStore = new TicketStore(filename, false);
    try {
      const ticket = ticketStore.create({
        title: "SQLite write failure",
        description: "Ownership must remain unchanged when SQLite rejects writes.",
        category: "Other",
        priority: "medium",
        requesterName: "Jordan Lee",
        requesterEmail: "jordan.lee@example.com",
      });
      const storeWithOwnership = ticketStore as unknown as {
        updateOwner?: (id: number, owner: "alex-chen" | "sam-rivera" | null) => boolean;
        database?: { exec(sql: string): void };
      };
      expect(storeWithOwnership.updateOwner).toBeTypeOf("function");
      expect(storeWithOwnership.database).toBeDefined();
      if (!storeWithOwnership.updateOwner || !storeWithOwnership.database) return;

      const original = ticketStore.find(ticket.id);
      storeWithOwnership.database.exec("PRAGMA query_only = ON");
      try {
        expect(() => storeWithOwnership.updateOwner!(ticket.id, "alex-chen")).toThrow();
      } finally {
        storeWithOwnership.database.exec("PRAGMA query_only = OFF");
      }
      expect(ticketStore.find(ticket.id)).toEqual(original);
    } finally {
      ticketStore.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
