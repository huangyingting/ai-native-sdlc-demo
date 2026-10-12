import { afterEach, describe, expect, it } from "vitest";
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
});
