import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  type CreateTicketInput,
  type Ticket,
  type TicketPriority,
  type TicketStatus,
  type TicketSummary,
  formatTicketReference,
} from "./ticket";

type TicketRow = {
  id: number;
  title: string;
  description: string;
  category: Ticket["category"];
  priority: TicketPriority;
  status: TicketStatus;
  requester_name: string;
  requester_email: string;
  created_at: string;
  updated_at: string;
};

type TicketSummaryRow = {
  open_count: number;
  in_progress_count: number;
  resolved_count: number;
  urgent_count: number;
};

function mapTicketRow(row: TicketRow): Ticket {
  return {
    id: row.id,
    reference: formatTicketReference(row.id),
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    requesterName: row.requester_name,
    requesterEmail: row.requester_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class TicketStore {
  private readonly database: DatabaseSync;

  constructor(filename: string, seed = true) {
    if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
    this.database = new DatabaseSync(filename);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
        status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
        requester_name TEXT NOT NULL,
        requester_email TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    if (seed) this.seed();
  }

  private seed() {
    const count = this.database.prepare("SELECT COUNT(*) AS count FROM tickets").get() as { count: number };
    if (count.count > 0) return;

    const insert = this.database.prepare(`
      INSERT INTO tickets (
        title, description, category, priority, status,
        requester_name, requester_email, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const fixtures = [
      [
        "Cannot connect to corporate VPN",
        "The VPN client stops at 80% and reports that the gateway is unavailable.",
        "Network and connectivity",
        "high",
        "open",
        "Maya Chen",
        "maya.chen@example.com",
        "2026-09-25T01:20:00.000Z",
        "2026-09-25T01:20:00.000Z",
      ],
      [
        "Request access to finance reporting",
        "Please add read-only access to the monthly finance reporting workspace.",
        "Access and identity",
        "medium",
        "in_progress",
        "Daniel Foster",
        "daniel.foster@example.com",
        "2026-09-24T07:45:00.000Z",
        "2026-09-25T00:10:00.000Z",
      ],
      [
        "Teams microphone is not detected",
        "The built-in microphone works in Windows settings but is unavailable in Teams calls.",
        "Email and collaboration",
        "low",
        "resolved",
        "Priya Shah",
        "priya.shah@example.com",
        "2026-09-23T03:30:00.000Z",
        "2026-09-24T09:15:00.000Z",
      ],
      [
        "Executive laptop will not start",
        "The laptop shows a blank screen after the latest firmware update.",
        "Device and hardware",
        "critical",
        "open",
        "Alex Morgan",
        "alex.morgan@example.com",
        "2026-09-25T02:05:00.000Z",
        "2026-09-25T02:05:00.000Z",
      ],
    ];

    this.database.exec("BEGIN");
    try {
      for (const fixture of fixtures) insert.run(...fixture);
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  list(filters: { status?: TicketStatus; priority?: TicketPriority; query?: string } = {}) {
    const clauses: string[] = [];
    const values: string[] = [];
    if (filters.status) {
      clauses.push("status = ?");
      values.push(filters.status);
    }
    if (filters.priority) {
      clauses.push("priority = ?");
      values.push(filters.priority);
    }
    if (filters.query) {
      clauses.push(`(
        LOWER(title) LIKE ? OR LOWER(requester_name) LIKE ?
        OR LOWER(printf('INC-%04d', id)) LIKE ? OR CAST(id AS TEXT) = ?
      )`);
      const normalizedQuery = filters.query.trim().toLowerCase();
      const query = `%${normalizedQuery}%`;
      const referenceId = /^(?:inc-)?0*(\d+)$/.exec(normalizedQuery)?.[1] ?? "";
      values.push(query, query, query, referenceId);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.database.prepare(`
      SELECT * FROM tickets
      ${where}
      ORDER BY
        CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        datetime(created_at) DESC
    `).all(...values) as unknown as TicketRow[];
    return rows.map(mapTicketRow);
  }

  find(id: number) {
    const row = this.database.prepare("SELECT * FROM tickets WHERE id = ?").get(id) as TicketRow | undefined;
    return row ? mapTicketRow(row) : null;
  }

  summary(): TicketSummary {
    const row = this.database.prepare(`
      SELECT
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_count,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_count,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved_count,
        SUM(CASE WHEN priority IN ('high', 'critical') AND status NOT IN ('resolved', 'closed') THEN 1 ELSE 0 END) AS urgent_count
      FROM tickets
    `).get() as TicketSummaryRow;
    return {
      open: row.open_count,
      inProgress: row.in_progress_count,
      resolved: row.resolved_count,
      urgent: row.urgent_count,
    };
  }

  create(input: CreateTicketInput) {
    const timestamp = new Date().toISOString();
    const result = this.database.prepare(`
      INSERT INTO tickets (
        title, description, category, priority, status,
        requester_name, requester_email, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?)
    `).run(
      input.title,
      input.description,
      input.category,
      input.priority,
      input.requesterName,
      input.requesterEmail,
      timestamp,
      timestamp,
    );
    const ticket = this.find(Number(result.lastInsertRowid));
    if (!ticket) throw new Error("Ticket was created but could not be loaded.");
    return ticket;
  }

  updateStatus(id: number, status: TicketStatus) {
    const result = this.database.prepare(`
      UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?
    `).run(status, new Date().toISOString(), id);
    return result.changes > 0;
  }

  close() {
    this.database.close();
  }
}

let sharedStore: TicketStore | undefined;

export function getTicketStore() {
  if (!sharedStore) {
    const databasePath = process.env.SERVICE_DESK_DB_PATH ?? join(process.cwd(), "data", "service-desk.db");
    sharedStore = new TicketStore(databasePath);
  }
  return sharedStore;
}
