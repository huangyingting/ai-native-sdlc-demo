import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

  it("supports assigning, handing off, and clearing ownership without changing ticket status", () => {
    const ticketStore = createTestStore();
    vi.useFakeTimers();
    const created = ticketStore.create({
      title: "Laptop display flickers",
      description: "The display flickers whenever the laptop is connected to a dock.",
      category: "Device and hardware",
      priority: "high",
      requesterName: "Jordan Lee",
      requesterEmail: "jordan.lee@example.com",
    });
    try {
      expect((created as typeof created & { owner?: string | null }).owner).toBeNull();
      const storeWithOwnership = ticketStore as TicketStore & {
        updateOwner?: (id: number, owner: "alex-chen" | "sam-rivera" | null) => boolean;
      };
      const updateOwner = storeWithOwnership.updateOwner;

      expect(updateOwner).toBeTypeOf("function");
      if (!updateOwner) return;

      for (const status of ["open", "in_progress", "resolved", "closed"] as const) {
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

        const nextStatus = status === "closed" ? "open" : "closed";
        ticketStore.updateStatus(created.id, nextStatus);
        expect(ticketStore.find(created.id)).toMatchObject({
          owner: "alex-chen",
          status: nextStatus,
        });

        vi.setSystemTime(new Date(Date.now() + 1_000));
        expect(setOwner("sam-rivera")).toBe(true);
        expect(ticketStore.find(created.id)).toMatchObject({
          owner: "sam-rivera",
          status: nextStatus,
        });
        vi.setSystemTime(new Date(Date.now() + 1_000));
        expect(setOwner(null)).toBe(true);
        expect(ticketStore.find(created.id)).toMatchObject({
          owner: null,
          status: nextStatus,
        });
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("filters by owner together with the existing ticket filters", () => {
    const ticketStore = createTestStore();
    const alex = ticketStore.create({
      title: "VPN access for Alex",
      description: "Alex needs VPN access for a customer meeting.",
      category: "Network and connectivity",
      priority: "high",
      requesterName: "Taylor Kim",
      requesterEmail: "taylor.kim@example.com",
    });
    const sam = ticketStore.create({
      title: "VPN access for Sam",
      description: "Sam needs VPN access for a customer meeting.",
      category: "Network and connectivity",
      priority: "high",
      requesterName: "Morgan Bell",
      requesterEmail: "morgan.bell@example.com",
    });
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

    expect(storeWithOwnership.list({
      owner: "alex-chen",
      status: "open",
      priority: "high",
      query: "VPN",
    }).map((ticket) => ticket.id)).toEqual([alex.id]);
    expect(storeWithOwnership.list({ owner: "unassigned" })).toEqual([]);
    expect(storeWithOwnership.list({ status: "open", priority: "high", query: "VPN" }))
      .toHaveLength(2);
  });

  it("preserves existing tickets as unassigned when opening a legacy database", () => {
    const directory = mkdtempSync(join(tmpdir(), "service-desk-legacy-"));
    const filename = join(directory, "tickets.sqlite");
    try {
      const legacyStore = new TicketStore(filename, false);
      const existing = legacyStore.create({
        title: "Historical access request",
        description: "A request created before ownership support was introduced.",
        category: "Access and identity",
        priority: "medium",
        requesterName: "Jordan Lee",
        requesterEmail: "jordan.lee@example.com",
      });
      legacyStore.updateStatus(existing.id, "resolved");
      legacyStore.close();

      const reopenedStore = new TicketStore(filename);
      try {
        const reopened = reopenedStore.find(existing.id);
        expect(reopened).toMatchObject({
          id: existing.id,
          reference: existing.reference,
          title: existing.title,
          status: "resolved",
          createdAt: existing.createdAt,
          owner: null,
        });
        expect(reopenedStore.list()).toHaveLength(1);
      } finally {
        reopenedStore.close();
      }

      const emptyFilename = join(directory, "empty.sqlite");
      new TicketStore(emptyFilename, false).close();
      const reopenedEmptyStore = new TicketStore(emptyFilename);
      try {
        expect(reopenedEmptyStore.list()).toEqual([]);
      } finally {
        reopenedEmptyStore.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
