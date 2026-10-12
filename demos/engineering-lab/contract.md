# Ticket assignment contract

This baseline is a synthetic, local application. It has no temporary proxy
assignment feature, network listener, external service, or third-party runtime
dependency. Node.js 24 and its built-in `node:sqlite` are required.

## Domain

- `OWNERS` is `['avery', 'jordan']`.
- `validateOwner(value)` returns a supported owner or `null`, unchanged.
  Any other value, including `undefined`, throws `TypeError`.
- `effectiveOwner(ticket)` returns `ticket.owner ?? null`.
- `matches(ticket, filters = {})` intersects owner and status predicates using
  **AND**. Omitted/undefined predicates impose no restriction. `owner: null`
  selects unassigned tickets. Unknown filter values match nothing.

## Persistence

`new TicketStore(filename)` opens a real SQLite database (`:memory:` is supported)
and creates `tickets` if absent. The baseline table has `id INTEGER PRIMARY KEY`,
`title TEXT NOT NULL`, nullable `owner TEXT`, and `status TEXT NOT NULL`.

- `create({title, owner = null, status = 'open'})` validates before insertion,
  trims a nonempty string title, and returns the persisted ticket. The only
  statuses are `open` and `closed`; invalid titles, owners, or statuses throw
  `TypeError` without inserting a row.
- `list(filters = {})` returns all matching tickets in ascending ID order.
- `get(id)` returns the ticket or `null`. Nonpositive, noninteger, nonnumeric,
  or unknown IDs return `null`.
- `close()` closes the database. File-backed rows survive reopening.

Tickets expose `{id, title, owner, status}`. Owners remain nullable and statuses
retain their values when read.

## API and runtime

`listTickets(store, filters = {})` returns JSON-serializable tickets containing
`id`, `title`, `owner`, and `status`, using the same filtering contract.

`node src/cli.mjs` loads `runtime.json` relative to the CLI module, not the
working directory. The checked-in configuration is `{"databasePath":":memory:"}`.
Each invocation creates and prints two synthetic fixtures: an open keyboard
request owned by Avery and a closed monitor request owned by Jordan. Invalid
database paths fail; the application must not silently use a different database.
