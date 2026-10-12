import { DatabaseSync } from 'node:sqlite';
import { matches, validateOwner } from './domain.mjs';

export class TicketStore {
  #database;

  constructor(filename) {
    this.#database = new DatabaseSync(filename);
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        owner TEXT CHECK (owner IS NULL OR owner IN ('avery', 'jordan')),
        status TEXT NOT NULL CHECK (status IN ('open', 'closed'))
      )
    `);
  }

  create({ title, owner = null, status = 'open' }) {
    if (typeof title !== 'string' || title.trim() === '') {
      throw new TypeError('Title must be a nonempty string');
    }
    validateOwner(owner);
    if (!['open', 'closed'].includes(status)) {
      throw new TypeError('Status must be open or closed');
    }
    const { lastInsertRowid } = this.#database.prepare(
      'INSERT INTO tickets (title, owner, status) VALUES (?, ?, ?)',
    ).run(title.trim(), owner, status);
    return this.get(Number(lastInsertRowid));
  }

  list(filters = {}) {
    return this.#database.prepare(
      'SELECT id, title, owner, status FROM tickets ORDER BY id',
    ).all().map((row) => ({ ...row })).filter((ticket) => matches(ticket, filters));
  }

  get(id) {
    if (!Number.isSafeInteger(id) || id < 1) return null;
    const row = this.#database.prepare(
      'SELECT id, title, owner, status FROM tickets WHERE id = ?',
    ).get(id);
    return row ? { ...row } : null;
  }

  close() {
    this.#database.close();
  }
}
