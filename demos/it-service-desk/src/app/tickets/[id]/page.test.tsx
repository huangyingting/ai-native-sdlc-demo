// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import TicketPage from "./page";
import { getTicketStore } from "@/lib/ticket-store";

vi.mock("@/lib/ticket-store", () => {
  const tickets = new Map<number, Record<string, unknown>>();
  let nextId = 1;
  const store = {
    close: vi.fn(),
    create(input: Record<string, unknown>) {
      const id = nextId++;
      const timestamp = new Date().toISOString();
      const ticket = {
        ...input,
        id,
        reference: `INC-${String(id).padStart(4, "0")}`,
        status: "open",
        createdAt: timestamp,
        updatedAt: timestamp,
        owner: null,
      };
      tickets.set(id, ticket);
      return ticket;
    },
    find(id: number) {
      return tickets.get(id) ?? null;
    },
    setOwner(id: number, owner: string | null) {
      const ticket = tickets.get(id);
      if (ticket) ticket.owner = owner;
    },
  };
  return { getTicketStore: () => store };
});

vi.mock("@/app/actions", () => ({
  updateTicketStatusAction: vi.fn(),
  updateTicketOwnerAction: vi.fn(),
}));

afterAll(() => getTicketStore().close());

describe("Ticket details", () => {
  it("shows ownership separately and offers an explicit handoff control", async () => {
    const ticket = getTicketStore().create({
      title: "Laptop display flickers",
      description: "The display flickers whenever the laptop is connected to a dock.",
      category: "Device and hardware",
      priority: "high",
      requesterName: "Jordan Lee",
      requesterEmail: "jordan.lee@example.com",
    });
    const html = renderToStaticMarkup(await TicketPage({
      params: Promise.resolve({ id: String(ticket.id) }),
    }));

    expect(html).toContain("<dt>Owner</dt>");
    expect(html).toContain("<dd>Unassigned</dd>");
    expect(html).toContain('<label for="owner">Owner</label>');
    expect(html).toContain('name="owner"');
    expect(html).toContain("Save ownership");
    expect(html).toContain("Requester");
    expect(html).toContain("Save status");

    const store = getTicketStore() as unknown as {
      setOwner(id: number, owner: string | null): void;
    };
    for (const [owner, label] of [
      ["alex-chen", "Alex Chen"],
      ["sam-rivera", "Sam Rivera"],
      [null, "Unassigned"],
    ] as const) {
      store.setOwner(ticket.id, owner);
      const updatedHtml = renderToStaticMarkup(await TicketPage({
        params: Promise.resolve({ id: String(ticket.id) }),
      }));
      expect(updatedHtml).toContain(`<dt>Owner</dt><dd>${label}</dd>`);
    }

    const container = document.createElement("div");
    container.innerHTML = html;
    try {
      const forms = [...container.querySelectorAll("form")];
      const ownerForm = forms.find((form) => form.querySelector('[name="owner"]'))!;
      const statusForm = forms.find((form) => form.querySelector('[name="status"]'))!;
      expect(forms).toHaveLength(2);
      expect(new FormData(ownerForm).has("status")).toBe(false);
      expect(new FormData(statusForm).has("owner")).toBe(false);
      const ownerControl = ownerForm.querySelector<HTMLButtonElement>("#owner")!;
      expect(ownerControl.getAttribute("role")).toBe("combobox");
      expect(ownerControl.labels?.[0].textContent).toBe("Owner");
      expect(document.getElementById(ownerControl.getAttribute("aria-describedby")!)?.textContent)
        .toBe("Unassigned");
    } finally {
      container.remove();
    }
  });
});
