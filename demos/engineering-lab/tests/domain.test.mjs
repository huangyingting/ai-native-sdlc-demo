import test from 'node:test';
import assert from 'node:assert/strict';
import { OWNERS, effectiveOwner, matches, validateOwner } from '../src/domain.mjs';

test('owners are the two supported synthetic identities', () => {
  assert.deepEqual(OWNERS, ['avery', 'jordan']);
  for (const owner of [...OWNERS, null]) assert.equal(validateOwner(owner), owner);
});

test('effective owner is the accountable owner', () => {
  const ticket = { owner: 'avery', status: 'open' };
  assert.equal(effectiveOwner(ticket), 'avery');
  assert.equal(effectiveOwner({ owner: null }), null);
});

test('combined owner and status filters intersect', () => {
  const ticket = { owner: 'avery', status: 'open' };
  assert.equal(matches(ticket, { owner: 'avery', status: 'open' }), true);
  assert.equal(matches(ticket, { owner: 'avery', status: 'closed' }), false);
  assert.equal(matches(ticket, { owner: 'jordan', status: 'open' }), false);
  assert.equal(matches(ticket, { owner: 'jordan', status: 'closed' }), false);
});

test('individual and omitted filters preserve legacy matching', () => {
  const ticket = { owner: 'jordan', status: 'closed' };
  assert.equal(matches(ticket), true);
  assert.equal(matches(ticket, { owner: 'jordan' }), true);
  assert.equal(matches(ticket, { owner: 'avery' }), false);
  assert.equal(matches(ticket, { status: 'closed' }), true);
  assert.equal(matches(ticket, { status: 'open' }), false);
});

test('null owner filter selects only unassigned tickets', () => {
  assert.equal(matches({ owner: null, status: 'open' }, { owner: null }), true);
  assert.equal(matches({ owner: 'avery', status: 'open' }, { owner: null }), false);
});

test('owner validation rejects unknown or malformed identities', () => {
  for (const owner of ['unknown', '', 'Avery', undefined, 1, false, {}]) {
    assert.throws(() => validateOwner(owner), TypeError);
  }
});
