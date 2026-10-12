import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASE_IDS, getCase, IMPACT_CONTRACT } from '../cases.mjs';

const baseline = fileURLToPath(new URL('../../../demos/engineering-lab', import.meta.url));
const oracle = fileURLToPath(new URL('../oracle.mjs', import.meta.url));
const successful = (checks) => ({ kind: 'engineering-oracle', passed: true, checks });
const failed = { kind: 'engineering-oracle', passed: false, checks: 0 };

function fixture(t) {
  const directory = mkdtempSync(resolve('.engineering-cases-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const root = resolve(directory, 'app');
  cpSync(baseline, root, { recursive: true });
  return { directory, root };
}

function replaceOnce(root, path, before, after) {
  const filename = resolve(root, path);
  const content = readFileSync(filename, 'utf8');
  assert.equal(content.split(before).length - 1, 1, `${path}: overlay must match exactly once`);
  writeFileSync(filename, content.replace(before, after));
}

function runSuite(root) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [
    '--test', '--test-reporter=tap', ...getCase('case-1').visibleTests,
  ], { cwd: root, env, encoding: 'utf8', timeout: 30_000 });
  assert.equal(result.error, undefined);
  assert.equal(Number(result.stdout.match(/^# tests (\d+)$/m)?.[1]), 15, result.stdout + result.stderr);
  return result;
}

function runOracle(mode, { directory, root }) {
  const result = spawnSync(process.execPath, [oracle, mode, root], {
    cwd: directory, encoding: 'utf8', timeout: 30_000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.stdout.trim().split('\n').length, 1);
  return { ...result, summary: JSON.parse(result.stdout) };
}

test('case metadata has neutral requests, exact boundaries, and independent values', () => {
  assert.deepEqual(CASE_IDS, ['case-1', 'case-2', 'case-3']);
  assert.deepEqual(CASE_IDS.map((id) => getCase(id).classification), ['product', 'test-harness', 'environment']);
  for (const id of CASE_IDS) {
    const entry = getCase(id);
    assert.equal(entry.id, id);
    assert.equal(entry.request, 'Diagnose and correct observed CI failure without changing unrelated behavior');
    assert.equal(entry.overlays.length, 1);
    assert.deepEqual(entry.allowedPaths, entry.overlays.map(({ path }) => path));
    assert.equal(entry.expectedTests, 15);
    assert.equal(entry.oracleChecks, 20);
    entry.visibleTests.pop();
    assert.equal(getCase(id).visibleTests.length, 3);
  }
  assert.throws(() => getCase('unknown'), RangeError);
  assert.deepEqual(IMPACT_CONTRACT.allowedPaths, [
    'src/domain.mjs', 'src/store.mjs', 'src/api.mjs', 'contract.md',
  ]);
  assert.deepEqual(IMPACT_CONTRACT.requiredSurfaces, IMPACT_CONTRACT.allowedPaths);
  assert.deepEqual(IMPACT_CONTRACT.visibleTests, getCase('case-1').visibleTests);
  assert.equal(IMPACT_CONTRACT.expectedTests, 15);
  assert.equal(IMPACT_CONTRACT.oracleChecks, 35);
  assert.ok(IMPACT_CONTRACT.acceptanceCriteria.length > 0);
});

test('each overlay matches exactly once in the untouched baseline', () => {
  for (const id of CASE_IDS) {
    for (const { path, before, after } of getCase(id).overlays) {
      const content = readFileSync(resolve(baseline, path), 'utf8');
      assert.equal(content.split(before).length - 1, 1);
      assert.notEqual(before, after);
      assert.equal(content.includes(after), false);
    }
  }
});

test('untouched approved baseline has exactly fifteen green tests', (t) => {
  const { root } = fixture(t);
  const result = runSuite(root);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /^# pass 15$/m);
  assert.match(result.stdout, /^# fail 0$/m);
});

for (const id of CASE_IDS) {
  test(`${id} makes the real approved suite red without changing the test count`, (t) => {
    const candidate = fixture(t);
    for (const overlay of getCase(id).overlays) {
      replaceOnce(candidate.root, overlay.path, overlay.before, overlay.after);
    }
    const result = runSuite(candidate.root);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.ok(Number(result.stdout.match(/^# fail (\d+)$/m)?.[1]) > 0);
    const independent = runOracle(id, candidate);
    // Expectation drift changes the harness, not the product; both gates matter.
    assert.deepEqual(independent.summary, id === 'case-2' ? successful(20) : failed);
    assert.equal(independent.status, id === 'case-2' ? 0 : 1);
  });
}

test('every diagnosis oracle accepts baseline independently of candidate test contents', (t) => {
  const candidate = fixture(t);
  for (const path of getCase('case-1').visibleTests) {
    writeFileSync(resolve(candidate.root, path), "throw new Error('Candidate tests must not be trusted');\n");
  }
  for (const id of CASE_IDS) {
    const result = runOracle(id, candidate);
    assert.equal(result.status, 0);
    assert.deepEqual(result.summary, successful(20));
  }
});

test('oracle rejects changing correct product ownership to satisfy a drifting assertion', (t) => {
  const candidate = fixture(t);
  replaceOnce(candidate.root, 'src/domain.mjs', 'return ticket.owner ?? null;', "return 'jordan';");
  const result = runOracle('case-2', candidate);
  assert.equal(result.status, 1);
  assert.deepEqual(result.summary, failed);
});

test('impact oracle rejects baseline without proxy support', (t) => {
  const result = runOracle('impact', fixture(t));
  assert.equal(result.status, 1);
  assert.deepEqual(result.summary, failed);
});

test('unknown case failures return only the fixed non-secret summary', (t) => {
  const result = runOracle('private-synthetic-value', fixture(t));
  assert.equal(result.status, 1);
  assert.deepEqual(result.summary, failed);
  assert.equal((result.stdout + result.stderr).includes('private-synthetic-value'), false);
});

// This implementation exists only in a disposable candidate, never the baseline.
function addSyntheticImpact(root) {
  replaceOnce(root, 'src/domain.mjs', 'return ticket.owner ?? null;',
    'return ticket.proxyOwner ?? ticket.owner ?? null;');
  replaceOnce(root, 'src/store.mjs', '\n  }\n\n  create(', `
    if (!this.#database.prepare('PRAGMA table_info(tickets)').all().some((column) => column.name === 'proxy_owner')) {
      this.#database.exec('ALTER TABLE tickets ADD COLUMN proxy_owner TEXT');
    }
  }

  create(`);
  const filename = resolve(root, 'src/store.mjs');
  writeFileSync(filename, readFileSync(filename, 'utf8').replaceAll(
    'SELECT id, title, owner, status FROM tickets',
    'SELECT id, title, owner, status, proxy_owner AS proxyOwner FROM tickets',
  ));
  replaceOnce(root, 'src/store.mjs', '  close() {', `  assignProxy(id, proxyOwner) {
    validateOwner(proxyOwner);
    if (!this.get(id)) throw new RangeError('Unknown ticket');
    this.#database.prepare('UPDATE tickets SET proxy_owner = ? WHERE id = ?').run(proxyOwner, id);
    return this.get(id);
  }

  close() {`);
  writeFileSync(resolve(root, 'src/api.mjs'), `import { effectiveOwner } from './domain.mjs';
export function listTickets(store, filters = {}) {
  return store.list(filters).map((ticket) => ({
    id: ticket.id, title: ticket.title, owner: ticket.owner, status: ticket.status,
    proxyOwner: ticket.proxyOwner, effectiveOwner: effectiveOwner(ticket),
  }));
}
`);
  const contract = resolve(root, 'contract.md');
  writeFileSync(contract, `${readFileSync(contract, 'utf8')}\n${IMPACT_CONTRACT.request}\n`);
}

test('impact oracle accepts real additive SQLite migration and the approved tests stay unchanged', (t) => {
  const candidate = fixture(t);
  const before = getCase('case-1').visibleTests.map((path) => readFileSync(resolve(candidate.root, path), 'utf8'));
  addSyntheticImpact(candidate.root);
  const result = runOracle('impact', candidate);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(result.summary, successful(35));
  assert.equal(runSuite(candidate.root).status, 0);
  const after = getCase('case-1').visibleTests.map((path) => readFileSync(resolve(candidate.root, path), 'utf8'));
  assert.deepEqual(after, before);
});

test('impact oracle rejects serialization-only ownership instead of persisted proxy assignment', (t) => {
  const candidate = fixture(t);
  addSyntheticImpact(candidate.root);
  replaceOnce(candidate.root, 'src/store.mjs',
    "this.#database.prepare('UPDATE tickets SET proxy_owner = ? WHERE id = ?').run(proxyOwner, id);",
    "this.#database.prepare('UPDATE tickets SET owner = ? WHERE id = ?').run(proxyOwner, id);");
  const result = runOracle('impact', candidate);
  assert.equal(result.status, 1);
  assert.deepEqual(result.summary, failed);
});
