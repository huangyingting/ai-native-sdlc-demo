import { z } from "zod";

export const ticketStatuses = ["open", "in_progress", "resolved", "closed"] as const;
export const ticketPriorities = ["low", "medium", "high", "critical"] as const;
export const ticketCategories = [
  "Access and identity",
  "Business applications",
  "Device and hardware",
  "Email and collaboration",
  "Network and connectivity",
  "Other",
] as const;

export type TicketStatus = (typeof ticketStatuses)[number];
export type TicketPriority = (typeof ticketPriorities)[number];
export type TicketCategory = (typeof ticketCategories)[number];

export type Ticket = {
  id: number;
  reference: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  requesterName: string;
  requesterEmail: string;
  createdAt: string;
  updatedAt: string;
};

export type TicketSummary = {
  open: number;
  inProgress: number;
  resolved: number;
  urgent: number;
};

export const createTicketSchema = z.object({
  title: z.string().trim().min(5, "Enter a title with at least 5 characters.").max(120),
  description: z.string().trim().min(10, "Describe the issue in at least 10 characters.").max(4000),
  category: z.enum(ticketCategories),
  priority: z.enum(ticketPriorities),
  requesterName: z.string().trim().min(2, "Enter the requester's name.").max(100),
  requesterEmail: z.string().trim().email("Enter a valid email address.").max(200),
});

export const updateTicketStatusSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: z.enum(ticketStatuses),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export function formatTicketReference(id: number) {
  return `INC-${String(id).padStart(4, "0")}`;
}

export function formatTicketStatus(status: TicketStatus) {
  return status.replace("_", " ");
}
