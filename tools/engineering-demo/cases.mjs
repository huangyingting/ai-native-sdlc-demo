export const CASE_IDS = Object.freeze(['case-1', 'case-2', 'case-3']);

const visibleTests = [
  'tests/domain.test.mjs',
  'tests/store.test.mjs',
  'tests/runtime.test.mjs',
];
const request = 'Diagnose and correct observed CI failure without changing unrelated behavior';

const cases = [
  {
    id: 'case-1',
    classification: 'product',
    overlays: [{
      path: 'src/domain.mjs',
      before: '  return ownerMatches && statusMatches;',
      after: '  return ownerMatches || statusMatches;',
    }],
    allowedPaths: ['src/domain.mjs'],
  },
  {
    id: 'case-2',
    classification: 'test-harness',
    overlays: [{
      path: 'tests/domain.test.mjs',
      before: "  assert.equal(effectiveOwner(ticket), 'avery');",
      after: "  assert.equal(effectiveOwner(ticket), 'jordan');",
    }],
    allowedPaths: ['tests/domain.test.mjs'],
  },
  {
    id: 'case-3',
    classification: 'environment',
    overlays: [{
      path: 'runtime.json',
      before: '"databasePath": ":memory:"',
      after: '"databasePath": "/dev/null/engineering-lab.db"',
    }],
    allowedPaths: ['runtime.json'],
  },
];

export function getCase(id) {
  const definition = cases.find((entry) => entry.id === id);
  if (!definition) throw new RangeError('Unknown engineering case');
  return structuredClone({
    ...definition,
    request,
    visibleTests,
    expectedTests: 15,
    oracleChecks: 20,
  });
}

export const IMPACT_CONTRACT = Object.freeze({
  request: `Add temporary proxy assignment to the ticket application, preserving all existing behavior and approved tests.

The nullable proxyOwner is either 'avery', 'jordan', or null. Keep owner as the accountable owner. effectiveOwner(ticket) must return ticket.proxyOwner ?? ticket.owner ?? null. Owner filters use effectiveOwner and still intersect status using AND, including owner:null. Validate proxies with validateOwner.

TicketStore must add a nullable TEXT proxy_owner column to the SQLite tickets table using an additive, idempotent migration when opening an existing database. Do not rebuild or discard the existing table or rows. Preserve every existing id, title, owner, and status. Existing and newly created tickets have proxyOwner:null until assigned; get/list/create results expose proxyOwner mapped from proxy_owner.

Add TicketStore.assignProxy(id, proxyOwner). It validates the proxy with validateOwner (invalid or undefined values throw TypeError), accepts both supported owners and null to clear, and returns the updated persisted ticket. Missing, nonpositive, noninteger, or nonnumeric IDs throw RangeError without inserting or changing any ticket. Assignment must preserve accountable owner, title, status, and id, including when owner is null. Changes survive close/reopen; repeated initialization must be harmless.

listTickets(store, filters) must preserve id, title, owner, status and additionally serialize proxyOwner and effectiveOwner for every ticket, including null values. All approved tests must remain unchanged and pass. Update contract.md to document effective versus accountable ownership, APIs, validation/clearing, filtering, serialization, and the additive legacy-data migration. Only src/domain.mjs, src/store.mjs, src/api.mjs, and contract.md may change.`,
  allowedPaths: ['src/domain.mjs', 'src/store.mjs', 'src/api.mjs', 'contract.md'],
  requiredSurfaces: ['src/domain.mjs', 'src/store.mjs', 'src/api.mjs', 'contract.md'],
  visibleTests: [...visibleTests],
  expectedTests: 15,
  oracleChecks: 35,
  acceptanceCriteria: [
    'Temporary proxyOwner is nullable avery/jordan; accountable owner is never replaced.',
    'effectiveOwner uses proxyOwner ?? owner ?? null; owner/status predicates intersect.',
    'Add nullable SQLite proxy_owner without rebuilding or losing legacy ticket fields.',
    'get/list/create expose proxyOwner; old and new tickets default to null.',
    'assignProxy returns the persisted updated ticket, accepts supported owners/null, and clears safely.',
    'Invalid proxy values throw TypeError; missing or malformed IDs throw RangeError with no mutations.',
    'Proxy assignments persist and survive idempotent database reopening.',
    'API preserves original fields and adds proxyOwner and effectiveOwner, including nulls.',
    'All 15 approved visible tests remain unchanged and pass.',
    'contract.md documents the complete new behavior and migration.',
  ],
});
