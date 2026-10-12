import Link from "next/link";
import { TicketForm } from "@/app/ticket-form";
import { ArrowLeftIcon } from "@/app/icons";

export default function NewTicketPage() {
  return (
    <main>
      <div className="shell">
        <Link className="back-link" href="/">
          <ArrowLeftIcon />
          Back to tickets
        </Link>
        <div className="page-heading form-heading">
          <div>
            <p className="eyebrow">Request intake / New</p>
            <h1>Create a ticket</h1>
            <p className="lead">
              Give the operations team enough context to assess impact and
              respond with the right priority.
            </p>
          </div>
        </div>
        <section className="panel form-card">
          <TicketForm />
        </section>
      </div>
    </main>
  );
}
