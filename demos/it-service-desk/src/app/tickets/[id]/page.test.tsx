import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import TicketPage from "./page";
import { getTicketStore } from "@/lib/ticket-store";

vi.mock("@/lib/ticket-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ticket-store")>();
  const store = new actual.TicketStore(":memory:", false);
  return { ...actual, getTicketStore: () => store };
});

vi.mock("@/app/actions", () => ({ updateTicketStatusAction: vi.fn() }));

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
  });
});
