import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { getCase, IMPACT_CONTRACT } from './cases.mjs';

let checks = 0;
function check(assertions) {
  assertions();
  checks += 1;
}

function originalFields({ id, title, owner, status }) {
  return { id, title, owner, status };
}

function ids(tickets) {
  return tickets.map(({ id }) => id);
}

async function verify(mode, root, directory) {
  const expectedChecks = mode === 'impact' ? IMPACT_CONTRACT.oracleChecks : getCase(mode).oracleChecks;
  const domain = await import(pathToFileURL(resolve(root, 'src/domain.mjs')).href);
  const { TicketStore } = await import(pathToFileURL(resolve(root, 'src/store.mjs')).href);
  const { listTickets } = await import(pathToFileURL(resolve(root, 'src/api.mjs')).href);
  const { OWNERS, validateOwner, effectiveOwner, matches } = domain;

  function usingStore(filename, action) {
    const store = new TicketStore(filename);
    try {
      return action(store);
    } finally {
      store.close();
    }
  }

  check(() => assert.deepEqual(OWNERS, ['avery', 'jordan']));
  check(() => {
    for (const owner of ['avery', 'jordan', null]) assert.equal(validateOwner(owner), owner);
  });
  check(() => {
    for (const owner of [undefined, '', 'Avery', 'other', 0, false, {}, []]) {
      assert.throws(() => validateOwner(owner), TypeError);
    }
  });
  check(() => {
    for (const owner of ['avery', 'jordan', null]) assert.equal(effectiveOwner({ owner }), owner);
    assert.equal(effectiveOwner({}), null);
  });
  check(() => {
    for (const owner of ['avery', 'jordan', null]) {
      for (const status of ['open', 'closed']) {
        const ticket = { owner, status };
        assert.equal(matches(ticket), true);
        for (const filterOwner of ['avery', 'jordan', null, 'other', undefined]) {
          for (const filterStatus of ['open', 'closed', 'other', undefined]) {
            assert.equal(matches(ticket, { owner: filterOwner, status: filterStatus }),
              (filterOwner === undefined || owner === filterOwner)
              && (filterStatus === undefined || status === filterStatus));
          }
        }
      }
    }
  });

  usingStore(':memory:', (store) => {
    const defaults = store.create({ title: 'Synthetic default' });
    check(() => assert.deepEqual(originalFields(defaults), {
      id: 1, title: 'Synthetic default', owner: null, status: 'open',
    }));
    const trimmed = store.create({ title: '  Synthetic trimmed  ', owner: 'avery', status: 'closed' });
    check(() => assert.deepEqual(originalFields(trimmed), {
      id: 2, title: 'Synthetic trimmed', owner: 'avery', status: 'closed',
    }));
    const records = [
      defaults, trimmed,
      store.create({ title: 'Synthetic Avery open', owner: 'avery' }),
      store.create({ title: 'Synthetic Jordan open', owner: 'jordan' }),
      store.create({ title: 'Synthetic Jordan closed', owner: 'jordan', status: 'closed' }),
      store.create({ title: 'Synthetic unassigned closed', status: 'closed' }),
    ];
    check(() => {
      for (const values of [
        { title: '' }, { title: '   ' }, { title: null }, { title: 7 }, {},
        { title: 'Invalid owner', owner: 'other' },
        { title: 'Invalid owner type', owner: {} },
        { title: 'Invalid status', status: 'pending' },
        { title: 'Null status', status: null },
      ]) assert.throws(() => store.create(values), TypeError);
      assert.equal(store.list().length, records.length);
    });
    check(() => assert.deepEqual(store.list().map(originalFields), records.map(originalFields)));
    check(() => {
      for (const owner of ['avery', 'jordan', null, 'other']) {
        assert.deepEqual(ids(store.list({ owner })), ids(records.filter((row) => row.owner === owner)));
      }
    });
    check(() => {
      for (const status of ['open', 'closed', 'other']) {
        assert.deepEqual(ids(store.list({ status })), ids(records.filter((row) => row.status === status)));
      }
    });
    check(() => {
      for (const owner of ['avery', 'jordan', null]) {
        for (const status of ['open', 'closed']) {
          assert.deepEqual(ids(store.list({ owner, status })),
            ids(records.filter((row) => row.owner === owner && row.status === status)));
        }
      }
    });
    check(() => {
      for (const row of records) assert.deepEqual(originalFields(store.get(row.id)), originalFields(row));
      for (const id of [999, 0, -1, 1.5, '1', null, undefined]) assert.equal(store.get(id), null);
    });
    check(() => {
      const copy = store.get(trimmed.id);
      copy.owner = 'jordan';
      copy.title = 'Changed only in memory';
      assert.deepEqual(originalFields(store.get(trimmed.id)), originalFields(trimmed));
    });
    check(() => {
      assert.deepEqual(JSON.parse(JSON.stringify(listTickets(store))).map(originalFields),
        records.map(originalFields));
    });
    check(() => {
      assert.deepEqual(ids(listTickets(store, { owner: 'avery', status: 'open' })), [records[2].id]);
      assert.deepEqual(ids(listTickets(store, { owner: null, status: 'closed' })), [records[5].id]);
    });
  });

  check(() => {
    const filename = resolve(directory, 'persistent.db');
    const ticket = usingStore(filename, (store) => store.create({
      title: 'Synthetic durable ticket', owner: 'jordan', status: 'closed',
    }));
    usingStore(filename, (store) => assert.deepEqual(originalFields(store.get(ticket.id)), originalFields(ticket)));
    const database = new DatabaseSync(filename, { readOnly: true });
    try {
      assert.deepEqual(originalFields(database.prepare('SELECT * FROM tickets').get()), originalFields(ticket));
    } finally {
      database.close();
    }
  });
  check(() => assert.throws(() => {
    const store = new TicketStore('/dev/null/engineering-lab.db');
    store.close();
  }));
  check(() => {
    assert.deepEqual(JSON.parse(readFileSync(resolve(root, 'runtime.json'), 'utf8')), { databasePath: ':memory:' });
  });
  check(() => {
    const result = spawnSync(process.execPath, [resolve(root, 'src/cli.mjs')], {
      cwd: directory, encoding: 'utf8', timeout: 15_000,
    });
    assert.equal(result.status, 0);
    assert.deepEqual(JSON.parse(result.stdout).map(originalFields), [
      { id: 1, title: 'Synthetic keyboard request', owner: 'avery', status: 'open' },
      { id: 2, title: 'Synthetic monitor request', owner: 'jordan', status: 'closed' },
    ]);
  });

  if (mode === 'impact') {
    check(() => {
      for (const owner of ['avery', 'jordan', null]) {
        for (const proxyOwner of ['avery', 'jordan', null, undefined]) {
          const ticket = { owner, proxyOwner };
          assert.equal(effectiveOwner(ticket), proxyOwner ?? owner);
          assert.equal(ticket.owner, owner);
          assert.equal(ticket.proxyOwner, proxyOwner);
        }
      }
    });
    check(() => {
      for (const owner of ['avery', 'jordan', null]) {
        for (const proxyOwner of ['avery', 'jordan', null]) {
          for (const status of ['open', 'closed']) {
            for (const filterOwner of ['avery', 'jordan', null, undefined]) {
              for (const filterStatus of ['open', 'closed', undefined]) {
                assert.equal(matches({ owner, proxyOwner, status }, { owner: filterOwner, status: filterStatus }),
                  (filterOwner === undefined || filterOwner === (proxyOwner ?? owner))
                  && (filterStatus === undefined || filterStatus === status));
              }
            }
          }
        }
      }
    });

    const filename = resolve(directory, 'legacy.db');
    const legacy = [
      { id: 7, title: 'Synthetic legacy accountable', owner: 'avery', status: 'closed' },
      { id: 19, title: 'Synthetic legacy unassigned', owner: null, status: 'open' },
    ];
    const database = new DatabaseSync(filename);
    let originalRootpage;
    try {
      database.exec(`CREATE TABLE tickets (
        id INTEGER PRIMARY KEY, title TEXT NOT NULL, owner TEXT, status TEXT NOT NULL
      );
      CREATE INDEX legacy_status_idx ON tickets(status);
      CREATE TABLE retained_metadata (value TEXT NOT NULL);
      INSERT INTO retained_metadata VALUES ('synthetic-preserved');`);
      originalRootpage = database.prepare("SELECT rootpage FROM sqlite_schema WHERE name = 'tickets'").get().rootpage;
      const insert = database.prepare('INSERT INTO tickets (id, title, owner, status) VALUES (?, ?, ?, ?)');
      for (const row of legacy) insert.run(row.id, row.title, row.owner, row.status);
    } finally {
      database.close();
    }

    let created;
    usingStore(filename, (store) => {
      check(() => {
        const inspect = new DatabaseSync(filename, { readOnly: true });
        try {
          const columns = inspect.prepare('PRAGMA table_info(tickets)').all();
          const proxy = columns.find((column) => column.name === 'proxy_owner');
          assert.ok(proxy);
          assert.equal(proxy.type.toUpperCase(), 'TEXT');
          assert.equal(proxy.notnull, 0);
          assert.equal(inspect.prepare("SELECT rootpage FROM sqlite_schema WHERE name = 'tickets'").get().rootpage,
            originalRootpage);
          assert.ok(inspect.prepare("SELECT name FROM sqlite_schema WHERE name = 'legacy_status_idx'").get());
          assert.equal(inspect.prepare('SELECT value FROM retained_metadata').get().value, 'synthetic-preserved');
        } finally {
          inspect.close();
        }
      });
      check(() => {
        assert.deepEqual(store.list().map(originalFields), legacy);
        for (const row of legacy) {
          assert.equal(store.get(row.id).proxyOwner, null);
          assert.deepEqual(originalFields(store.get(row.id)), row);
        }
      });
    });
    check(() => {
      usingStore(filename, (store) => assert.deepEqual(store.list().map(originalFields), legacy));
    });
    usingStore(filename, (store) => {
      check(() => {
        created = store.create({ title: 'Synthetic newly created', owner: 'jordan' });
        assert.equal(created.proxyOwner, null);
        assert.ok(created.id > 19);
      });
      check(() => {
        for (const row of legacy) {
          const updated = store.assignProxy(row.id, 'jordan');
          assert.deepEqual(originalFields(updated), row);
          assert.equal(updated.proxyOwner, 'jordan');
          assert.deepEqual(store.get(row.id), updated);
        }
      });
      check(() => {
        assert.deepEqual(ids(store.list({ owner: 'jordan' })), [7, 19, created.id]);
        assert.deepEqual(ids(store.list({ owner: 'avery' })), []);
        assert.deepEqual(ids(store.list({ owner: null })), []);
        assert.deepEqual(ids(store.list({ owner: 'jordan', status: 'closed' })), [7]);
        assert.deepEqual(ids(store.list({ owner: 'jordan', status: 'open' })), [19, created.id]);
        assert.deepEqual(ids(store.list({ owner: 'avery', status: 'open' })), []);
      });
      check(() => {
        assert.deepEqual(JSON.parse(JSON.stringify(listTickets(store))), [
          { ...legacy[0], proxyOwner: 'jordan', effectiveOwner: 'jordan' },
          { ...legacy[1], proxyOwner: 'jordan', effectiveOwner: 'jordan' },
          { ...originalFields(created), proxyOwner: null, effectiveOwner: 'jordan' },
        ]);
        assert.deepEqual(ids(listTickets(store, { owner: 'jordan', status: 'closed' })), [7]);
        assert.deepEqual(ids(listTickets(store, { owner: 'avery' })), []);
      });
      check(() => {
        for (const row of legacy) {
          const updated = store.assignProxy(row.id, null);
          assert.deepEqual(originalFields(updated), row);
          assert.equal(updated.proxyOwner, null);
          assert.equal(effectiveOwner(updated), row.owner);
        }
        assert.deepEqual(ids(store.list({ owner: 'avery', status: 'closed' })), [7]);
        assert.deepEqual(ids(store.list({ owner: null, status: 'open' })), [19]);
        const unassigned = listTickets(store, { owner: null })[0];
        assert.equal(unassigned.proxyOwner, null);
        assert.equal(unassigned.effectiveOwner, null);
      });
      check(() => {
        const before = store.list();
        for (const value of ['unknown', '', 'Avery', undefined, false, 1, {}, []]) {
          assert.throws(() => store.assignProxy(7, value), TypeError);
        }
        assert.deepEqual(store.list(), before);
      });
      check(() => {
        const before = store.list();
        for (const id of [999, 0, -1, 1.5, '7', null, undefined, Number.MAX_SAFE_INTEGER + 1]) {
          assert.throws(() => store.assignProxy(id, 'avery'), RangeError);
        }
        assert.deepEqual(store.list(), before);
      });
      store.assignProxy(7, 'jordan');
    });
    check(() => {
      usingStore(filename, (store) => {
        assert.equal(store.get(7).proxyOwner, 'jordan');
        assert.deepEqual(store.list().map(originalFields), [...legacy, originalFields(created)]);
      });
    });
    check(() => {
      usingStore(filename, (store) => {
        const others = store.list().filter(({ id }) => id !== 7);
        for (const proxyOwner of ['avery', 'jordan', null, 'avery']) {
          assert.equal(store.assignProxy(7, proxyOwner).proxyOwner, proxyOwner);
        }
        assert.deepEqual(store.list().filter(({ id }) => id !== 7), others);
      });
    });
    check(() => {
      const inspect = new DatabaseSync(filename, { readOnly: true });
      try {
        const rows = inspect.prepare('SELECT * FROM tickets ORDER BY id').all();
        assert.deepEqual(rows.map(originalFields), [...legacy, originalFields(created)]);
        assert.deepEqual(rows.map(({ proxy_owner }) => proxy_owner), ['avery', null, null]);
      } finally {
        inspect.close();
      }
      const contract = readFileSync(resolve(root, 'contract.md'), 'utf8');
      for (const surface of ['proxyOwner', 'effectiveOwner', 'assignProxy', 'proxy_owner']) {
        assert.ok(contract.includes(surface));
      }
    });
  }
  assert.equal(checks, expectedChecks);
}

let directory;
try {
  const [mode, candidateRoot, ...extra] = process.argv.slice(2);
  assert.ok(mode && candidateRoot && extra.length === 0);
  if (mode !== 'impact') getCase(mode);
  directory = mkdtempSync(resolve('.engineering-oracle-'));
  await verify(mode, resolve(candidateRoot), directory);
  rmSync(directory, { recursive: true, force: true });
  directory = undefined;
  console.log(JSON.stringify({ kind: 'engineering-oracle', passed: true, checks }));
} catch {
  if (directory) {
    try { rmSync(directory, { recursive: true, force: true }); } catch { /* Fixed failure output below. */ }
  }
  console.log(JSON.stringify({ kind: 'engineering-oracle', passed: false, checks: 0 }));
  process.exitCode = 1;
}
