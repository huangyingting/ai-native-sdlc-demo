import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TicketStore } from '../src/store.mjs';
import { listTickets } from '../src/api.mjs';

const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));

test('API serializes original fields and applies filters', (t) => {
  const store = new TicketStore(':memory:');
  t.after(() => store.close());
  const ticket = store.create({ title: 'Synthetic request', owner: 'avery' });
  store.create({ title: 'Other request', owner: 'jordan' });
  const rows = listTickets(store, { owner: 'avery' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, ticket.id);
  assert.equal(rows[0].title, 'Synthetic request');
  assert.equal(rows[0].owner, 'avery');
  assert.equal(rows[0].status, 'open');
  assert.doesNotThrow(() => JSON.stringify(rows));
});

function runCli(cwd) {
  const result = spawnSync(process.execPath, [cli], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const rows = JSON.parse(result.stdout);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(({ title, owner, status }) => ({ title, owner, status })), [
    { title: 'Synthetic keyboard request', owner: 'avery', status: 'open' },
    { title: 'Synthetic monitor request', owner: 'jordan', status: 'closed' },
  ]);
}

test('CLI reads runtime configuration and prints its two synthetic fixtures', () => {
  runCli(fileURLToPath(new URL('..', import.meta.url)));
});

test('CLI resolves configuration independently of the working directory', () => {
  runCli(fileURLToPath(new URL('.', import.meta.url)));
});
