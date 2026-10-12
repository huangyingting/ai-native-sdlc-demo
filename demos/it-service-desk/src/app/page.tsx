import Link from "next/link";
import {
  ArrowUpRightIcon,
  FilterIcon,
  PlusIcon,
  SearchIcon,
} from "@/app/icons";
import { CustomSelect } from "@/app/custom-select";
import { getTicketStore } from "@/lib/ticket-store";
import {
  formatTicketStatus,
  ticketPriorities,
  ticketStatuses,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/ticket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requestedStatus = firstQueryValue(params.status);
  const requestedPriority = firstQueryValue(params.priority);
  const status = ticketStatuses.includes(requestedStatus as TicketStatus)
    ? requestedStatus as TicketStatus
    : undefined;
  const priority = ticketPriorities.includes(requestedPriority as TicketPriority)
    ? requestedPriority as TicketPriority
    : undefined;
  const query = firstQueryValue(params.q)?.trim() || undefined;
  const store = getTicketStore();
  const tickets = store.list({ status, priority, query });
  const summary = store.summary();

  return (
    <main data-testid="service-desk-dashboard">
      <div className="shell">
        <div className="page-heading dashboard-heading">
          <div>
            <p className="eyebrow"><span className="live-indicator" /> Service operations</p>
            <h1>Service desk</h1>
            <p className="lead">
              A focused view of employee incidents and requests, from intake
              through resolution.
            </p>
          </div>
          <Link className="button button-primary" href="/tickets/new">
            <PlusIcon />
            Create ticket
          </Link>
        </div>

        <section className="metrics" aria-label="Ticket overview">
          <article className="metric metric-open">
            <span>Open</span><strong>{summary.open}</strong><small>Awaiting action</small>
          </article>
          <article className="metric metric-progress">
            <span>In progress</span><strong>{summary.inProgress}</strong><small>Work underway</small>
          </article>
          <article className="metric metric-resolved">
            <span>Resolved</span><strong>{summary.resolved}</strong><small>Completed requests</small>
          </article>
          <article className="metric metric-urgent">
            <span>High priority</span><strong>{summary.urgent}</strong><small>Active escalations</small>
          </article>
        </section>

        <section className="panel queue" aria-label="Ticket queue">
          <div className="queue-heading">
            <div>
              <p className="section-label">Work queue</p>
              <h2>Requests</h2>
            </div>
            <span className="queue-count">{tickets.length} visible</span>
          </div>
          <form className="filters">
            <div className="field field-grow">
              <label htmlFor="q">Search requests</label>
              <div className="input-with-icon">
                <SearchIcon />
                <input id="q" name="q" placeholder="Title, reference, or requester" defaultValue={query} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="status">Status</label>
              <CustomSelect
                defaultValue={status ?? ""}
                id="status"
                key={`status-${status ?? "all"}`}
                name="status"
                options={[
                  { value: "", label: "All statuses" },
                  ...ticketStatuses.map((item) => ({
                    value: item,
                    label: formatTicketStatus(item),
                  })),
                ]}
              />
            </div>
            <div className="field">
              <label htmlFor="priority">Priority</label>
              <CustomSelect
                defaultValue={priority ?? ""}
                id="priority"
                key={`priority-${priority ?? "all"}`}
                name="priority"
                options={[
                  { value: "", label: "All priorities" },
                  ...ticketPriorities.map((item) => ({
                    value: item,
                    label: item,
                  })),
                ]}
              />
            </div>
            <button className="button button-filter" type="submit">
              <FilterIcon />
              Apply filters
            </button>
          </form>

          <div className="ticket-list">
            <div className="ticket-list-header">
              <span>Request</span><span>Status</span><span>Priority</span><span>Updated</span><span />
            </div>
            {tickets.length ? tickets.map((ticket) => (
              <Link className="ticket-row" href={`/tickets/${ticket.id}`} key={ticket.id}>
                <span className="ticket-title">
                  <strong>{ticket.title}</strong>
                  <small>{ticket.reference} · {ticket.requesterName} · {ticket.category}</small>
                </span>
                <span className={`badge badge-status-${ticket.status}`}>{formatTicketStatus(ticket.status)}</span>
                <span className={`badge badge-priority-${ticket.priority}`}>{ticket.priority}</span>
                <span className="muted">{formatDate(ticket.updatedAt)}</span>
                <span className="row-arrow" aria-hidden="true">
                  <ArrowUpRightIcon />
                </span>
              </Link>
            )) : (
              <div className="empty-state">
                <span className="empty-mark" aria-hidden="true">0</span>
                <h2>No tickets found</h2>
                <p>Try changing the filters or create a new ticket.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
