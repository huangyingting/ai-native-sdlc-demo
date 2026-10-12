import { getTicketStore } from "@/lib/ticket-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const readinessFailureEvent = "Service desk readiness check failed";

function checkReadiness() {
  try {
    getTicketStore().checkReadiness();
    return true;
  } catch {
    console.error(readinessFailureEvent);
    return false;
  }
}

function methodNotAllowed() {
  return new Response(null, {
    status: 405,
    headers: { Allow: "GET, HEAD" },
  });
}

export function GET() {
  const ready = checkReadiness();
  return Response.json(
    { status: ready ? "ready" : "unavailable" },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export function HEAD() {
  const ready = checkReadiness();
  return new Response(null, {
    status: ready ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  });
}

export function POST() {
  return methodNotAllowed();
}

export function PUT() {
  return methodNotAllowed();
}

export function PATCH() {
  return methodNotAllowed();
}

export function DELETE() {
  return methodNotAllowed();
}

export function OPTIONS() {
  return methodNotAllowed();
}
