"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateTicketOwnerAction, type TicketFormState } from "./actions";
import { CustomSelect } from "./custom-select";
import { CheckIcon } from "./icons";
import { ticketOwnerOptions, type TicketOwner } from "@/lib/ticket";

const initialState: TicketFormState = {};

function SaveOwnerButton() {
  const { pending } = useFormStatus();
  return (
    <button className="button button-primary" disabled={pending} type="submit">
      <CheckIcon />
      {pending ? "Saving..." : "Save ownership"}
    </button>
  );
}

export function TicketOwnerForm({
  id,
  owner,
}: {
  id: number;
  owner: TicketOwner | null;
}) {
  const [state, formAction] = useActionState(updateTicketOwnerAction, initialState);
  const ownerError = state.errors?.owner?.[0];

  return (
    <form action={formAction} className="status-form owner-form">
      <input name="id" type="hidden" value={id} />
      <label htmlFor="owner">Owner</label>
      <CustomSelect
        defaultValue={owner ?? ""}
        errorId={ownerError ? "owner-error" : undefined}
        id="owner"
        key={`owner-${owner ?? "unassigned"}`}
        name="owner"
        options={[
          ...ticketOwnerOptions,
          { value: "", label: "Unassigned" },
        ]}
      />
      {ownerError ? <p className="field-error" id="owner-error">{ownerError}</p> : null}
      {state.message ? <p className="form-error" role="alert">{state.message}</p> : null}
      <SaveOwnerButton />
    </form>
  );
}
