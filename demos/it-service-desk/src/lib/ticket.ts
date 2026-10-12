import { z } from "zod";

export const ticketStatuses = ["open", "in_progress", "resolved", "closed"] as const;
export const ticketPriorities = ["low", "medium", "high", "critical"] as const;
export const ticketOwners = ["alex-chen", "sam-rivera"] as const;
const ticketOwnerLabels = {
  "alex-chen": "Alex Chen",
  "sam-rivera": "Sam Rivera",
} satisfies Record<(typeof ticketOwners)[number], string>;
export const ticketOwnerOptions = ticketOwners.map((owner) => ({
  value: owner,
  label: ticketOwnerLabels[owner],
}));
export const ticketOwnerFilterOptions = [
  { value: "", label: "All owners" },
  ...ticketOwnerOptions,
  { value: "unassigned", label: "Unassigned" },
];
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
export type TicketOwner = (typeof ticketOwners)[number];
export type TicketCategory = (typeof ticketCategories)[number];

export type Ticket = {
  id: number;
  reference: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  owner: TicketOwner | null;
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

export const updateTicketOwnerSchema = z.object({
  id: z.coerce.number().int().positive(),
  owner: z.union([z.enum(ticketOwners), z.literal("")]),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export function formatTicketReference(id: number) {
  return `INC-${String(id).padStart(4, "0")}`;
}

export function formatTicketStatus(status: TicketStatus) {
  return status.replace("_", " ");
}
