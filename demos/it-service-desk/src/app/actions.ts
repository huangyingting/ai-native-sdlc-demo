"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTicketStore } from "@/lib/ticket-store";
import {
  createTicketSchema,
  updateTicketOwnerSchema,
  updateTicketStatusSchema,
} from "@/lib/ticket";

export type TicketFormState = {
  errors?: Record<string, string[] | undefined>;
  message?: string;
};

export async function createTicketAction(
  _previousState: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  const result = createTicketSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
    priority: formData.get("priority"),
    requesterName: formData.get("requesterName"),
    requesterEmail: formData.get("requesterEmail"),
  });

  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
      message: "Review the highlighted fields and try again.",
    };
  }

  const ticket = getTicketStore().create(result.data);
  revalidatePath("/");
  redirect(`/tickets/${ticket.id}`);
}

export async function updateTicketStatusAction(formData: FormData) {
  const result = updateTicketStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!result.success) throw new Error("Invalid ticket status update.");

  const updated = getTicketStore().updateStatus(result.data.id, result.data.status);
  if (!updated) throw new Error("Ticket not found.");

  revalidatePath("/");
  revalidatePath(`/tickets/${result.data.id}`);
  redirect(`/tickets/${result.data.id}`);
}

export async function updateTicketOwnerAction(
  _previousState: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  const result = updateTicketOwnerSchema.safeParse({
    id: formData.get("id"),
    owner: formData.get("owner"),
  });
  if (!result.success) {
    return {
      errors: result.error.flatten().fieldErrors,
      message: "Choose an owner from the list or leave the ticket unassigned.",
    };
  }

  let updated: boolean;
  try {
    updated = getTicketStore().updateOwner(
      result.data.id,
      result.data.owner || null,
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string" &&
      error.code.startsWith("ERR_SQLITE_")
    ) {
      return { message: "Unable to save ownership. Please try again." };
    }
    throw error;
  }
  if (!updated) return { message: "Ticket not found." };

  revalidatePath("/");
  revalidatePath(`/tickets/${result.data.id}`);
  redirect(`/tickets/${result.data.id}`);
}
