// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { getTicketStore } from "@/lib/ticket-store";
import * as actions from "./actions";
import Dashboard from "./page";
import TicketPage from "./tickets/[id]/page";
import NewTicketPage from "./tickets/new/page";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  notFound: () => { throw new Error("Ticket not found"); },
}));
vi.mock("@/lib/ticket-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ticket-store")>();
  const store = new actual.TicketStore(":memory:", false);
  return { ...actual, getTicketStore: () => store };
});

const store = getTicketStore();
const input = {
  title: "Ownership demo request",
  description: "Verify a new unassigned ticket.",
  category: "Other" as const,
  priority: "low" as const,
  requesterName: "Demo Requester",
  requesterEmail: "demo.requester@example.com",
};
const ticket = store.create(input);

afterAll(() => store.close());

function ownerForm(id: number, owner: string) {
  const data = new FormData();
  data.set("id", String(id));
  data.set("owner", owner);
  return data;
}

function documentFor(markup: string) {
  const container = document.createElement("div");
  container.innerHTML = markup;
  return container;
}

describe("Ticket ownership screens", () => {
  it("shows Unassigned and a labeled detail control with all roster choices (AC-1, AC-4)", async () => {
    const markup = renderToStaticMarkup(await TicketPage({ params: Promise.resolve({ id: String(ticket.id) }) }));
    const page = documentFor(markup);
    expect(page.querySelector("dl")?.textContent).toContain("Unassigned");
    const label = [...page.querySelectorAll("label")].find((item) => /owner/i.test(item.textContent ?? ""));
    expect(label).toBeDefined();
    const control = page.querySelector(`#${label!.htmlFor}`);
    expect(control?.matches('select, [role="combobox"]')).toBe(true);
    for (const option of ["Unassigned", "Avery Stone", "Jordan Lee"]) {
      expect(markup).toContain(option);
    }
    expect(page.querySelector('input[name="owner"][value=""]') ??
      page.querySelector('select[name="owner"] option[value=""]')).not.toBeNull();
  });

  it("shows ownership on queue rows and offers a labeled All/Unassigned/roster filter (AC-3, AC-4)", async () => {
    const markup = renderToStaticMarkup(await Dashboard({ searchParams: Promise.resolve({}) }));
    const page = documentFor(markup);
    expect(page.querySelector(".ticket-row")?.textContent).toContain("Unassigned");
    const label = [...page.querySelectorAll("label")].find((item) => /owner/i.test(item.textContent ?? ""));
    expect(label).toBeDefined();
    expect(page.querySelector(`#${label!.htmlFor}`)?.matches('select, [role="combobox"]')).toBe(true);
    for (const option of ["All owners", "Unassigned", "Avery Stone", "Jordan Lee"]) {
      expect(markup).toContain(option);
    }
  });

  it("keeps exact search text, status and priority when All owners clears the owner filter (AC-3)", async () => {
    const spy = vi.spyOn(store, "list");
    try {
      const page = documentFor(renderToStaticMarkup(await Dashboard({
        searchParams: Promise.resolve({ q: "  inc-1  ", status: "open", priority: "high", owner: "avery-stone" }),
      })));
      expect(page.querySelector<HTMLInputElement>('[name="q"]')?.defaultValue).toBe("  inc-1  ");
      expect(page.querySelector<HTMLInputElement>('[name="status"]')?.value).toBe("open");
      expect(page.querySelector<HTMLInputElement>('[name="priority"]')?.value).toBe("high");
      expect(page.querySelector<HTMLInputElement>('[name="owner"]')?.value).toBe("avery-stone");
      expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ owner: "avery-stone" }));

      const all = documentFor(renderToStaticMarkup(await Dashboard({
        searchParams: Promise.resolve({ q: "  inc-1  ", status: "open", priority: "high", owner: "" }),
      })));
      expect(all.querySelector<HTMLInputElement>('[name="q"]')?.defaultValue).toBe("  inc-1  ");
      expect(all.querySelector<HTMLInputElement>('[name="status"]')?.value).toBe("open");
      expect(all.querySelector<HTMLInputElement>('[name="priority"]')?.value).toBe("high");
      expect(all.querySelector<HTMLInputElement>('[name="owner"]')?.value).toBe("");
      expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({
        status: "open", priority: "high", query: "  inc-1  ",
      }));
    } finally {
      spy.mockRestore();
    }
  });

  it("assigns, reassigns and clears through the detail action and reloads both pages (AC-2)", async () => {
    const update = (actions as typeof actions & { updateTicketOwnerAction?: (data: FormData) => Promise<void> })
      .updateTicketOwnerAction;
    expect(update).toBeTypeOf("function");
    for (const [owner, label] of [
      ["avery-stone", "Avery Stone"],
      ["jordan-lee", "Jordan Lee"],
      ["", "Unassigned"],
    ]) {
      await update!(ownerForm(ticket.id, owner));
      const detail = documentFor(renderToStaticMarkup(
        await TicketPage({ params: Promise.resolve({ id: String(ticket.id) }) }),
      ));
      const ownerTerm = [...detail.querySelectorAll("dt")].find((term) => term.textContent?.trim() === "Owner");
      expect(ownerTerm?.nextElementSibling?.textContent?.trim()).toBe(label);
      const dashboard = documentFor(renderToStaticMarkup(
        await Dashboard({ searchParams: Promise.resolve({}) }),
      ));
      const row = dashboard.querySelector(`.ticket-row[href="/tickets/${ticket.id}"]`);
      expect(row?.textContent).toContain(label);
      for (const other of ["Avery Stone", "Jordan Lee", "Unassigned"].filter((name) => name !== label)) {
        expect(row?.textContent).not.toContain(other);
      }
    }
  });

  it("rejects forged owners and missing tickets without changing any ticket (AC-4)", async () => {
    const update = (actions as typeof actions & { updateTicketOwnerAction?: (data: FormData) => Promise<void> })
      .updateTicketOwnerAction;
    expect(update).toBeTypeOf("function");
    const before = store.list();
    await expect(update!(ownerForm(ticket.id, "not-in-roster")))
      .rejects.toThrow("Invalid ticket owner update");
    expect(store.list()).toEqual(before);
    await expect(update!(ownerForm(999999, "avery-stone"))).rejects.toThrow("Ticket not found");
    expect(store.list()).toEqual(before);
  });

  it("does not offer ownership on the new-ticket form (AC-5)", () => {
    const page = documentFor(renderToStaticMarkup(<NewTicketPage />));
    expect(page.querySelector('[name="owner"]')).toBeNull();
    expect(page.querySelector('[name="title"]')).not.toBeNull();
  });
});
