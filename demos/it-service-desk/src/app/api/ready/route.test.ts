import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { GET as getHealth } from "../health/route";

type RouteHandler = (request: Request) => Promise<Response> | Response;
type ReadinessRoute = Partial<Record<
  "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS",
  RouteHandler
>>;
type ClosableStore = { close(): void };

const temporaryDirectories: string[] = [];
const openStores: ClosableStore[] = [];

afterEach(() => {
  while (openStores.length) openStores.pop()?.close();
  while (temporaryDirectories.length) {
    const directory = temporaryDirectories.pop();
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function configureDatabasePath() {
  const directory = mkdtempSync(join(tmpdir(), "service-desk-readiness-route-"));
  temporaryDirectories.push(directory);
  const databasePath = join(directory, "service-desk.sqlite");
  vi.stubEnv("SERVICE_DESK_DB_PATH", databasePath);
  return { directory, databasePath };
}

async function loadReadinessRoute() {
  await vi.resetModules();
  const routePath = fileURLToPath(new URL("./route.ts", import.meta.url));
  const exists = existsSync(routePath);
  expect(exists).toBe(true);
  if (!exists) return undefined;
  return vi.importActual<ReadinessRoute>("./route");
}

function routeHandler(route: ReadinessRoute, method: keyof ReadinessRoute) {
  const handler = route[method];
  expect(handler).toBeTypeOf("function");
  return handler as RouteHandler;
}

async function captureSharedStore() {
  const ticketStoreModule = await vi.importActual<typeof import("@/lib/ticket-store")>(
    "@/lib/ticket-store",
  );
  const store = ticketStoreModule.getTicketStore();
  if (!openStores.includes(store)) openStores.push(store);
  return store;
}

it("Readiness route GET returns the exact current ready contract", async () => {
  configureDatabasePath();
  const route = await loadReadinessRoute();
  if (!route) return;

  const response = await routeHandler(route, "GET")(
    new Request("http://localhost/api/ready"),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("application/json");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ status: "ready" });
  await captureSharedStore();
});

it("Readiness route initialization failures return unavailable and one sanitized event per request", async () => {
  const directory = mkdtempSync(join(tmpdir(), "service-desk-readiness-failure-"));
  temporaryDirectories.push(directory);
  const blocker = join(directory, "not-a-directory");
  writeFileSync(blocker, "not a directory");
  vi.stubEnv("SERVICE_DESK_DB_PATH", join(blocker, "tickets.sqlite"));
  const route = await loadReadinessRoute();
  if (!route) return;

  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const get = routeHandler(route, "GET");
  for (let request = 0; request < 2; request += 1) {
    const response = await get(new Request("http://localhost/api/ready"));
    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "unavailable" });
  }

  expect(error).toHaveBeenCalledTimes(2);
  expect(error.mock.calls[0]).toEqual(error.mock.calls[1]);
  expect(JSON.stringify(error.mock.calls)).not.toContain(blocker);
});

it("Readiness route warm shared-store queries transition from ready to unavailable to ready", async () => {
  const { databasePath } = configureDatabasePath();
  const route = await loadReadinessRoute();
  if (!route) return;
  const store = await captureSharedStore();
  const database = new DatabaseSync(databasePath);
  let renamed = false;
  const error = vi.spyOn(console, "error").mockImplementation(() => {});

  try {
    expect(store.list()).toHaveLength(4);
    expect(getHealth().status).toBe(200);
    database.exec("ALTER TABLE tickets RENAME TO readiness_tickets");
    renamed = true;

    const get = routeHandler(route, "GET");
    for (let request = 0; request < 2; request += 1) {
      const unavailable = await get(new Request("http://localhost/api/ready"));
      expect(unavailable.status).toBe(503);
      expect(await unavailable.json()).toEqual({ status: "unavailable" });
    }
    expect(getHealth().status).toBe(200);
    expect(await getHealth().json()).toEqual({ status: "ok" });
    expect(error).toHaveBeenCalledTimes(2);
    expect(error.mock.calls[0]).toEqual(error.mock.calls[1]);

    database.exec("ALTER TABLE readiness_tickets RENAME TO tickets");
    renamed = false;
    const ready = await get(new Request("http://localhost/api/ready"));
    expect(ready.status).toBe(200);
    expect(await ready.json()).toEqual({ status: "ready" });
    expect(await captureSharedStore()).toBe(store);
  } finally {
    if (renamed) database.exec("ALTER TABLE readiness_tickets RENAME TO tickets");
    database.close();
  }
});

it("Readiness route HEAD checks the current dependency without a response body", async () => {
  const { databasePath } = configureDatabasePath();
  const route = await loadReadinessRoute();
  if (!route) return;
  await captureSharedStore();
  const database = new DatabaseSync(databasePath);
  let renamed = false;

  try {
    const head = routeHandler(route, "HEAD");
    const ready = await head(new Request("http://localhost/api/ready", { method: "HEAD" }));
    expect(ready.status).toBe(200);
    expect(ready.headers.get("content-type")).toBe("application/json");
    expect(ready.headers.get("cache-control")).toBe("no-store");
    expect(await ready.text()).toBe("");

    database.exec("ALTER TABLE tickets RENAME TO readiness_tickets");
    renamed = true;
    const unavailable = await head(
      new Request("http://localhost/api/ready", { method: "HEAD" }),
    );
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.get("content-type")).toBe("application/json");
    expect(unavailable.headers.get("cache-control")).toBe("no-store");
    expect(await unavailable.text()).toBe("");

    database.exec("ALTER TABLE readiness_tickets RENAME TO tickets");
    renamed = false;
  } finally {
    if (renamed) database.exec("ALTER TABLE readiness_tickets RENAME TO tickets");
    database.close();
  }
});

it("Readiness route GET ignores caller database and SQL inputs", async () => {
  const { databasePath } = configureDatabasePath();
  const route = await loadReadinessRoute();
  if (!route) return;

  const callerPath = `${databasePath}-caller-controlled`;
  const url = new URL("http://localhost/api/ready");
  url.searchParams.set("database", callerPath);
  url.searchParams.set("dbPath", callerPath);
  url.searchParams.set("sql", "DROP TABLE tickets");
  const response = await routeHandler(route, "GET")(new Request(url));

  expect(response.status).toBe(200);
  const body = await response.text();
  expect(JSON.parse(body)).toEqual({ status: "ready" });
  expect(body).not.toContain(callerPath);
  expect(existsSync(callerPath)).toBe(false);
  await captureSharedStore();
});

it("Readiness route unsupported methods reject requests without initializing the store", async () => {
  const directory = mkdtempSync(join(tmpdir(), "service-desk-readiness-methods-"));
  temporaryDirectories.push(directory);
  const databaseDirectory = join(directory, "not-created");
  vi.stubEnv("SERVICE_DESK_DB_PATH", join(databaseDirectory, "tickets.sqlite"));
  const route = await loadReadinessRoute();
  if (!route) return;

  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const) {
    const response = await routeHandler(route, method)(
      new Request("http://localhost/api/ready", { method }),
    );
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
    expect(await response.text()).toBe("");
  }
  expect(existsSync(databaseDirectory)).toBe(false);
});
