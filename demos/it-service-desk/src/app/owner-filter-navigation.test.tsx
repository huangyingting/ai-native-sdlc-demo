// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTicketStore } from "@/lib/ticket-store";
import Dashboard from "./page";

vi.mock("@/lib/ticket-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ticket-store")>();
  const store = new actual.TicketStore(":memory:");
  return { ...actual, getTicketStore: () => store };
});

const store = getTicketStore();
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

afterAll(() => store.close());

async function renderDashboard(searchParams: Record<string, string | undefined>) {
  const page = await Dashboard({ searchParams: Promise.resolve(searchParams) });
  await act(async () => root.render(page));
}

function ownerFilter() {
  return container.querySelector<HTMLSelectElement>('select[name="owner"]')!;
}

describe("Dashboard owner filter navigation", () => {
  it("syncs the native owner select when same-page navigation changes owner query state", async () => {
    await renderDashboard({
      owner: "avery-stone",
      q: "inc-1",
      status: "open",
      priority: "high",
    });
    expect(ownerFilter().value).toBe("avery-stone");

    await renderDashboard({});
    expect(ownerFilter().value).toBe("");

    await renderDashboard({ owner: "unassigned" });
    expect(ownerFilter().value).toBe("unassigned");

    await renderDashboard({ owner: "jordan-lee" });
    expect(ownerFilter().value).toBe("jordan-lee");

    await renderDashboard({});
    expect(ownerFilter().value).toBe("");
  });
});
