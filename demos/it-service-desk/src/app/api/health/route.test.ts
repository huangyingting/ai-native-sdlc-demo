import { expect, it, vi } from "vitest";
import { GET } from "./route";

const { getTicketStore } = vi.hoisted(() => ({
  getTicketStore: vi.fn(),
}));

vi.mock("@/lib/ticket-store", () => ({ getTicketStore }));

it("Liveness route remains available without accessing the database", async () => {
  const response = GET();

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("application/json");
  expect(await response.json()).toEqual({ status: "ok" });
  expect(getTicketStore).not.toHaveBeenCalled();
});
