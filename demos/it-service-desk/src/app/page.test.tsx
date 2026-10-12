// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { getTicketStore } from "@/lib/ticket-store";
import Dashboard from "./page";

vi.mock("@/lib/ticket-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ticket-store")>();
  const store = new actual.TicketStore(":memory:", false);
  return { ...actual, getTicketStore: () => store };
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
});
