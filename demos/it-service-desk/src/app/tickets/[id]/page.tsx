import Link from "next/link";
import { notFound } from "next/navigation";
import { updateTicketStatusAction } from "@/app/actions";
import { ArrowLeftIcon, CheckIcon } from "@/app/icons";
import { CustomSelect } from "@/app/custom-select";
import { getTicketStore } from "@/lib/ticket-store";
import { formatTicketStatus, ticketStatuses } from "@/lib/ticket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ticketId = Number(id);
  if (!Number.isInteger(ticketId) || ticketId < 1) notFound();
  const ticket = getTicketStore().find(ticketId);
  if (!ticket) notFound();

  return (
    <main>
      <div className="shell">
        <Link className="back-link" href="/">
          <ArrowLeftIcon />
          Back to tickets
        </Link>
        <div className="page-heading detail-heading">
          <div>
            <p className="eyebrow">{ticket.reference}</p>
            <h1>{ticket.title}</h1>
            <p className="lead">Submitted by {ticket.requesterName} · {formatDate(ticket.createdAt)}</p>
          </div>
          <span className={`badge badge-status-${ticket.status}`}>{formatTicketStatus(ticket.status)}</span>
        </div>

        <div className="detail-layout">
          <section className="detail-card detail-primary">
            <p className="section-label">Request context</p>
            <h2>Description</h2>
            <p className="ticket-description">{ticket.description}</p>
          </section>
          <aside className="detail-card">
            <p className="section-label">Record</p>
            <h2>Ticket details</h2>
            <dl className="detail-list">
              <div><dt>Requester</dt><dd>{ticket.requesterName}</dd></div>
              <div><dt>Email</dt><dd>{ticket.requesterEmail}</dd></div>
              <div><dt>Category</dt><dd>{ticket.category}</dd></div>
              <div><dt>Priority</dt><dd>{ticket.priority}</dd></div>
              <div><dt>Last updated</dt><dd>{formatDate(ticket.updatedAt)}</dd></div>
            </dl>
            <form action={updateTicketStatusAction} className="status-form">
              <input name="id" type="hidden" value={ticket.id} />
              <label htmlFor="status">Update status</label>
              <CustomSelect
                defaultValue={ticket.status}
                id="status"
                name="status"
                options={ticketStatuses.map((status) => ({
                  value: status,
                  label: formatTicketStatus(status),
                }))}
              />
              <button className="button button-primary" type="submit">
                <CheckIcon />
                Save status
              </button>
            </form>
          </aside>
        </div>
      </div>
    </main>
  );
}
