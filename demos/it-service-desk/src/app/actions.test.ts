import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as ticketActions from "./actions";
import { getTicketStore } from "@/lib/ticket-store";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

vi.mock("@/lib/ticket-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ticket-store")>();
  const store = new actual.TicketStore(":memory:", false);
  return { ...actual, getTicketStore: () => store };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

afterAll(() => getTicketStore().close());
beforeEach(() => {
  vi.mocked(revalidatePath).mockClear();
  vi.mocked(redirect).mockClear();
});

function ownershipForm(id: number, owner: string, status?: string) {
  const formData = new FormData();
  formData.set("id", String(id));
  formData.set("owner", owner);
  if (status) formData.set("status", status);
  return formData;
}

describe("ticket ownership action", () => {
  it("saves assignment, handoff, and clearing independently from status", async () => {
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

    const updateStatusAction = ticketActions.updateTicketStatusAction;
    const originalStatus = ticket.status;
    await updateOwnerAction({}, ownershipForm(ticket.id, "alex-chen", "closed"));
    expect(ticketStore.find(ticket.id)).toMatchObject({
      owner: "alex-chen",
      status: originalStatus,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith(`/tickets/${ticket.id}`);
    expect(redirect).toHaveBeenCalledWith(`/tickets/${ticket.id}`);

    const statusForm = new FormData();
    statusForm.set("id", String(ticket.id));
    statusForm.set("status", "resolved");
    statusForm.set("owner", "sam-rivera");
    await updateStatusAction(statusForm);
    expect(ticketStore.find(ticket.id)).toMatchObject({
      owner: "alex-chen",
      status: "resolved",
    });

    vi.mocked(revalidatePath).mockClear();
    vi.mocked(redirect).mockClear();
    await updateOwnerAction({}, ownershipForm(ticket.id, "sam-rivera", "closed"));
    expect(ticketStore.find(ticket.id)).toMatchObject({
      owner: "sam-rivera",
      status: "resolved",
    });

    vi.mocked(revalidatePath).mockClear();
    vi.mocked(redirect).mockClear();
    await updateOwnerAction({}, ownershipForm(ticket.id, ""));
    expect(ticketStore.find(ticket.id)).toMatchObject({
      owner: null,
      status: "resolved",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith(`/tickets/${ticket.id}`);
    expect(redirect).toHaveBeenCalledWith(`/tickets/${ticket.id}`);
  });

  it("rejects forged updates and reports SQLite write failures without success effects", async () => {
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

    const original = ticketStore.find(ticket.id);
    for (const [id, owner] of [
      ["invalid", "alex-chen"],
      ["9999", "alex-chen"],
      [String(ticket.id), "not-on-the-roster"],
      [String(ticket.id), "Alex Chen"],
      [String(ticket.id), "all"],
    ]) {
      const result = await updateOwnerAction({}, ownershipForm(Number(id) || -1, owner));
      expect(result).toMatchObject({ message: expect.any(String) });
      expect(ticketStore.find(ticket.id)).toEqual(original);
    }
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();

    const writableStore = ticketStore as unknown as {
      database?: { exec(sql: string): void };
    };
    expect(writableStore.database).toBeDefined();
    if (!writableStore.database) return;

    writableStore.database.exec("PRAGMA query_only = ON");
    try {
      const result = await updateOwnerAction({}, ownershipForm(ticket.id, "alex-chen"));
      expect(result).toMatchObject({ message: expect.any(String) });
      expect(ticketStore.find(ticket.id)).toEqual(original);
      expect(revalidatePath).not.toHaveBeenCalled();
      expect(redirect).not.toHaveBeenCalled();
    } finally {
      writableStore.database.exec("PRAGMA query_only = OFF");
    }
  });
});
