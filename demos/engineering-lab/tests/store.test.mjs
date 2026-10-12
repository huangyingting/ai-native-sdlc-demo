import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { TicketStore } from '../src/store.mjs';

function memoryStore(t) {
  const store = new TicketStore(':memory:');
  t.after(() => store.close());
  return store;
}

test('create stores trimmed titles, nullable owners, and default open status', (t) => {
  const store = memoryStore(t);
  const unassigned = store.create({ title: '  Synthetic request  ' });
  assert.equal(unassigned.title, 'Synthetic request');
  assert.equal(unassigned.owner, null);
  assert.equal(unassigned.status, 'open');
  assert.equal(unassigned.id, 1);
  const assigned = store.create({ title: 'Assigned', owner: 'avery' });
  assert.equal(assigned.owner, 'avery');
  assert.equal(assigned.id, 2);
});

test('list intersects owner/status filters and orders by id', (t) => {
  const store = memoryStore(t);
  const first = store.create({ title: 'One', owner: 'avery' });
  const second = store.create({ title: 'Two', owner: 'avery', status: 'closed' });
  const third = store.create({ title: 'Three', owner: 'jordan' });
  assert.deepEqual(store.list().map(({ id }) => id), [first.id, second.id, third.id]);
  assert.deepEqual(store.list({ owner: 'avery', status: 'open' }).map(({ id }) => id), [first.id]);
});

test('get retrieves a ticket and returns null for missing or malformed ids', (t) => {
  const store = memoryStore(t);
  const ticket = store.create({ title: 'One', owner: 'jordan' });
  assert.deepEqual(store.get(ticket.id), ticket);
  for (const id of [999, 0, -1, 1.5, '1', null]) assert.equal(store.get(id), null);
});

test('invalid create inputs are rejected without inserting rows', (t) => {
  const store = memoryStore(t);
  for (const values of [
    { title: '' }, { title: '   ' }, { title: 1 },
    { title: 'One', owner: 'unknown' }, { title: 'One', status: 'pending' },
  ]) assert.throws(() => store.create(values), TypeError);
  assert.deepEqual(store.list(), []);
});

test('SQLite persists ticket fields across close and reopen', (t) => {
  const directory = mkdtempSync(resolve('.engineering-lab-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const filename = resolve(directory, 'tickets.db');
  const first = new TicketStore(filename);
  let ticket;
  try {
    ticket = first.create({ title: 'Persistent synthetic request', owner: 'avery', status: 'closed' });
  } finally {
    first.close();
  }
  const reopened = new TicketStore(filename);
  try {
    assert.deepEqual(reopened.get(ticket.id), ticket);
  } finally {
    reopened.close();
  }
});

test('closed and unassigned tickets remain queryable', (t) => {
  const store = memoryStore(t);
  const ticket = store.create({ title: 'Unassigned closed', status: 'closed' });
  store.create({ title: 'Assigned open', owner: 'avery' });
  assert.deepEqual(store.list({ owner: null, status: 'closed' }).map(({ id }) => id), [ticket.id]);
});
