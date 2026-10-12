// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getTicketStore } from "@/lib/ticket-store";
import Dashboard from "./page";
import NewTicketPage from "./tickets/new/page";

vi.mock("@/lib/ticket-store", () => {
  const tickets: Array<Record<string, unknown>> = [];
  const store = {
    close: vi.fn(),
    create(input: Record<string, unknown>) {
      const id = tickets.length + 1;
      const timestamp = String(input.createdAt ?? new Date().toISOString());
      const ticket = {
        ...input,
        id,
        reference: `INC-${String(id).padStart(4, "0")}`,
        status: input.status ?? "open",
        createdAt: timestamp,
        updatedAt: input.updatedAt ?? timestamp,
        owner: input.owner ?? null,
      };
      tickets.push(ticket);
      return ticket;
    },
    list: vi.fn((filters: {
      owner?: string;
      status?: string;
      priority?: string;
      query?: string;
    } = {}) => {
      const query = filters.query?.trim().toLowerCase();
      const referenceId = query ? /^(?:inc-)?0*(\d+)$/.exec(query)?.[1] : undefined;
      const priorities = ["critical", "high", "medium", "low"];
      return tickets
        .filter((ticket) => !filters.owner || filters.owner === "all" ||
          (filters.owner === "unassigned" ? ticket.owner == null : ticket.owner === filters.owner))
        .filter((ticket) => !filters.status || ticket.status === filters.status)
        .filter((ticket) => !filters.priority || ticket.priority === filters.priority)
        .filter((ticket) => !query ||
          [ticket.title, ticket.requesterName, ticket.reference]
            .some((value) => String(value).toLowerCase().includes(query)) ||
          (referenceId !== undefined && String(ticket.id) === referenceId))
        .sort((left, right) =>
          priorities.indexOf(String(left.priority)) - priorities.indexOf(String(right.priority)) ||
          String(right.createdAt).localeCompare(String(left.createdAt)));
    }),
    setOwner(id: number, owner: string | null) {
      const ticket = tickets.find((item) => item.id === id);
      if (ticket) ticket.owner = owner;
    },
    reset() {
      tickets.splice(0);
      store.list.mockClear();
    },
    summary() {
      return {
        open: tickets.filter((ticket) => ticket.status === "open").length,
        inProgress: tickets.filter((ticket) => ticket.status === "in_progress").length,
        resolved: tickets.filter((ticket) => ticket.status === "resolved").length,
        urgent: tickets.filter((ticket) =>
          ["high", "critical"].includes(String(ticket.priority)) &&
          !["resolved", "closed"].includes(String(ticket.status))).length,
      };
    },
  };
  return { getTicketStore: () => store };
});

afterAll(() => getTicketStore().close());

beforeEach(() => {
  (getTicketStore() as unknown as { reset(): void }).reset();
});

describe("Dashboard", () => {
  it("renders the stable smoke identifier without relying on heading copy", async () => {
    const html = renderToStaticMarkup(await Dashboard({ searchParams: Promise.resolve({}) }));
    expect(html).toContain('<main data-testid="service-desk-dashboard">');
  });

  it.each([0, 1])("does not clip filter menus when the queue has %i tickets", async (count) => {
    if (count) {
      getTicketStore().create({
        title: "Laptop display flickers",
        description: "The display flickers when connected to a dock.",
        category: "Device and hardware",
        priority: "high",
        requesterName: "Sam Rivera",
        requesterEmail: "sam.rivera@example.com",
      });
    }
    const html = renderToStaticMarkup(await Dashboard({ searchParams: Promise.resolve({}) }));
    const style = document.createElement("style");
    style.textContent = readFileSync("src/app/globals.css", "utf8");
    document.head.append(style);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    try {
      expect(container.querySelectorAll(".ticket-row")).toHaveLength(count);
      expect(getComputedStyle(container.querySelector(".queue")!).overflow).toBe("visible");
      expect(getComputedStyle(container.querySelector(".ticket-list")!).overflowX).toBe("auto");
    } finally {
      container.remove();
      style.remove();
    }
  });

  it("shows each current owner separately from the requester and keeps global summaries", async () => {
    const store = getTicketStore() as unknown as {
      create(input: Record<string, unknown>): { id: number };
      setOwner(id: number, owner: string | null): void;
    };
    const alex = store.create({
      title: "VPN request for Alex",
      description: "An assigned request.",
      category: "Network and connectivity",
      priority: "high",
      requesterName: "Morgan Bell",
      requesterEmail: "morgan.bell@example.com",
    });
    const sam = store.create({
      title: "VPN request for Sam",
      description: "A second assigned request.",
      category: "Network and connectivity",
      priority: "medium",
      requesterName: "Alex Chen",
      requesterEmail: "alex.chen@example.com",
    });
    store.setOwner(alex.id, "alex-chen");
    store.setOwner(sam.id, "sam-rivera");
    store.create({
      title: "Unassigned VPN request",
      description: "A request without an owner.",
      category: "Network and connectivity",
      priority: "low",
      requesterName: "Jordan Lee",
      requesterEmail: "jordan.lee@example.com",
    });

    const html = renderToStaticMarkup(await Dashboard({ searchParams: Promise.resolve({}) }));
    const container = document.createElement("div");
    container.innerHTML = html;
    try {
      const rows = [...container.querySelectorAll<HTMLElement>(".ticket-row")];
      const alexRow = rows.find((row) => row.textContent?.includes("INC-0001"))!;
      const samRow = rows.find((row) => row.textContent?.includes("INC-0002"))!;
      const unassignedRow = rows.find((row) => row.textContent?.includes("INC-0003"))!;

      expect(alexRow.textContent).toContain("Alex Chen");
      expect(alexRow.querySelector(".ticket-title small")?.textContent).toContain("Morgan Bell");
      expect(alexRow.querySelector(".ticket-title small")?.textContent).not.toContain("Alex Chen");
      expect(samRow.textContent).toContain("Sam Rivera");
      expect(samRow.querySelector(".ticket-title small")?.textContent).toContain("Alex Chen");
      expect(samRow.querySelector(".ticket-title small")?.textContent).not.toContain("Sam Rivera");
      expect(unassignedRow.textContent).toContain("Unassigned");
      expect(container.querySelector(".queue-count")?.textContent).toBe("3 visible");
      expect(container.querySelector('[aria-label="Ticket overview"]')?.textContent)
        .toContain("Open3");
    } finally {
      container.remove();
    }
  });

  it("forwards each owner filter with active filters and preserves them for All owners", async () => {
    const store = getTicketStore() as unknown as {
      create(input: Record<string, unknown>): { id: number };
      setOwner(id: number, owner: string | null): void;
      list: ReturnType<typeof vi.fn>;
    };
    const alex = store.create({
      title: "VPN match one",
      description: "An Alex ticket.",
      category: "Network and connectivity",
      priority: "high",
      status: "open",
      requesterName: "Riley Park",
      requesterEmail: "riley@example.com",
      createdAt: "2026-01-03T00:00:00.000Z",
    });
    const sam = store.create({
      title: "VPN match two",
      description: "A Sam ticket.",
      category: "Network and connectivity",
      priority: "high",
      status: "open",
      requesterName: "Casey Nguyen",
      requesterEmail: "casey@example.com",
      createdAt: "2026-01-02T00:00:00.000Z",
    });
    const unassigned = store.create({
      title: "VPN match three",
      description: "An unassigned ticket.",
      category: "Network and connectivity",
      priority: "high",
      status: "open",
      requesterName: "Jordan Lee",
      requesterEmail: "jordan@example.com",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    store.setOwner(alex.id, "alex-chen");
    store.setOwner(sam.id, "sam-rivera");

    const cases = [
      { owner: "alex-chen", expected: [alex.id] },
      { owner: "sam-rivera", expected: [sam.id] },
      { owner: "unassigned", expected: [unassigned.id] },
      { owner: "", expected: [alex.id, sam.id, unassigned.id] },
    ];
    for (const { owner, expected } of cases) {
      store.list.mockClear();
      const html = renderToStaticMarkup(await Dashboard({
        searchParams: Promise.resolve({
          owner,
          q: "  VPN  ",
          status: "open",
          priority: "high",
        }),
      }));
      const appliedFilters = store.list.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(appliedFilters).toMatchObject({
        query: "VPN",
        status: "open",
        priority: "high",
      });
      expect(appliedFilters.owner || undefined).toBe(owner || undefined);
      const container = document.createElement("div");
      container.innerHTML = html;
      try {
        const ids = [...container.querySelectorAll(".ticket-row")].map((row) =>
          Number(row.getAttribute("href")?.split("/").at(-1)));
        expect(ids).toEqual(expected);
        expect(container.querySelector(".queue-count")?.textContent)
          .toBe(`${expected.length} visible`);
        expect(container.querySelector('[aria-label="Ticket overview"]')?.textContent)
          .toContain("Open3");
      } finally {
        container.remove();
      }
    }

    for (const query of ["INC-0002", "inc-0002", "  Inc-0002  ", "0002", "2", "inc-2"]) {
      store.list.mockClear();
      const trimmedQuery = query.trim();
      const html = renderToStaticMarkup(await Dashboard({
        searchParams: Promise.resolve({
          owner: "",
          q: query,
          status: "open",
          priority: "high",
        }),
      }));
      const filters = store.list.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(filters).toMatchObject({
        query: trimmedQuery,
        status: "open",
        priority: "high",
      });
      const container = document.createElement("div");
      container.innerHTML = html;
      try {
        expect([...container.querySelectorAll(".ticket-row")].map((row) =>
          Number(row.getAttribute("href")?.split("/").at(-1)))).toEqual([sam.id]);
      } finally {
        container.remove();
      }
    }

    store.list.mockClear();
    const firstOwner = renderToStaticMarkup(await Dashboard({
      searchParams: Promise.resolve({
        owner: ["sam-rivera", "alex-chen"],
        q: "inc-0002",
        status: "open",
        priority: "high",
      }),
    }));
    expect(store.list).toHaveBeenCalledWith({
      owner: "sam-rivera",
      query: "inc-0002",
      status: "open",
      priority: "high",
    });
    expect(firstOwner).toContain("VPN match two");

    store.list.mockClear();
    const noResults = renderToStaticMarkup(await Dashboard({
      searchParams: Promise.resolve({
        owner: "unassigned",
        q: "inc-0002",
        status: "open",
        priority: "high",
      }),
    }));
    expect(store.list).toHaveBeenCalledWith({
      owner: "unassigned",
      query: "inc-0002",
      status: "open",
      priority: "high",
    });
    expect(noResults).toContain("No tickets found");
  });

  it("keeps ticket creation free of ownership controls", () => {
    const html = renderToStaticMarkup(NewTicketPage());
    expect(html).not.toContain('name="owner"');
    expect(html).not.toContain("Save ownership");
    expect(html).toContain('name="requesterName"');
    expect(html).toContain('name="requesterEmail"');
  });
});
