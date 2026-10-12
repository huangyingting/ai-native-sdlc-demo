import { afterAll, describe, expect, it, vi } from "vitest";
import * as ticketActions from "./actions";
import { getTicketStore } from "@/lib/ticket-store";

vi.mock("@/lib/ticket-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ticket-store")>();
  const store = new actual.TicketStore(":memory:", false);
  return { ...actual, getTicketStore: () => store };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

afterAll(() => getTicketStore().close());

describe("ticket ownership action", () => {
  it("rejects invalid ownership updates and reports persistence failures", async () => {
    const ticketStore = getTicketStore();
    const ticket = ticketStore.create({
      title: "VPN access request",
      description: "The requester cannot connect to the VPN.",
      category: "Network and connectivity",
      priority: "high",
      requesterName: "Jordan Lee",
      requesterEmail: "jordan.lee@example.com",
    });
    const updateOwnerAction = (ticketActions as unknown as Record<string, unknown>)
      .updateTicketOwnerAction;
    expect(updateOwnerAction).toBeTypeOf("function");
    if (typeof updateOwnerAction !== "function") return;

    const update = async (id: string, owner: string) => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("owner", owner);
      return updateOwnerAction({}, formData);
    };
    const original = ticketStore.find(ticket.id);

    for (const [id, owner] of [
      ["invalid", "alex-chen"],
      ["9999", "alex-chen"],
      [String(ticket.id), "not-on-the-roster"],
      [String(ticket.id), "all"],
    ]) {
      const result = await update(id, owner);
      expect(result).toMatchObject({ message: expect.any(String) });
      expect(ticketStore.find(ticket.id)).toEqual(original);
    }

    const storeWithOwnership = ticketStore as typeof ticketStore & {
      updateOwner?: (id: number, owner: "alex-chen" | "sam-rivera" | null) => boolean;
    };
    expect(storeWithOwnership.updateOwner).toBeTypeOf("function");
    if (!storeWithOwnership.updateOwner) return;

    const persistenceFailure = vi.spyOn(storeWithOwnership, "updateOwner")
      .mockImplementation(() => {
        throw new Error("database is read-only");
      });
    try {
      const result = await update(String(ticket.id), "alex-chen");
      expect(result).toMatchObject({ message: expect.any(String) });
      expect(ticketStore.find(ticket.id)).toEqual(original);
    } finally {
      persistenceFailure.mockRestore();
    }
  });
});
