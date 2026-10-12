// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { getTicketStore } from "@/lib/ticket-store";
import Dashboard from "./page";
import NewTicketPage from "./tickets/new/page";

vi.mock("@/lib/ticket-store", () => {
  const tickets: Array<Record<string, unknown>> = [];
  const store = {
    close: vi.fn(),
    create(input: Record<string, unknown>) {
      const id = tickets.length + 1;
      const timestamp = new Date().toISOString();
      const ticket = {
        ...input,
        id,
        reference: `INC-${String(id).padStart(4, "0")}`,
        status: "open",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      tickets.push(ticket);
      return ticket;
    },
    list() {
      return [...tickets];
    },
    summary() {
      return { open: tickets.length, inProgress: 0, resolved: 0, urgent: 0 };
    },
  };
  return { getTicketStore: () => store };
});

afterAll(() => getTicketStore().close());

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

  it("shows ticket ownership and the complete owner filter", async () => {
    getTicketStore().create({
      title: "Ownership is separate from requester",
      description: "The queue should make the ticket owner visible.",
      category: "Other",
      priority: "medium",
      requesterName: "Jordan Lee",
      requesterEmail: "jordan.lee@example.com",
    });
    const html = renderToStaticMarkup(await Dashboard({ searchParams: Promise.resolve({}) }));

    expect(html).toContain('<label for="owner">Owner</label>');
    expect(html).toContain('name="owner"');
    expect(html).toContain("All owners");
    expect(html).toContain("Alex Chen");
    expect(html).toContain("Sam Rivera");
    expect(html).toContain("Unassigned");
    expect(html).toContain("Jordan Lee");
  });

  it("keeps ticket creation free of ownership controls", () => {
    const html = renderToStaticMarkup(NewTicketPage());

    expect(html).not.toContain('name="owner"');
    expect(html).not.toContain("Save ownership");
    expect(html).toContain('name="requesterName"');
    expect(html).toContain('name="requesterEmail"');
  });
});
