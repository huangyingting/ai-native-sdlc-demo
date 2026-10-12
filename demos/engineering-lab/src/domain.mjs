export const OWNERS = Object.freeze(['avery', 'jordan']);

export function validateOwner(value) {
  if (value !== null && !OWNERS.includes(value)) {
    throw new TypeError('Owner must be avery, jordan, or null');
  }
  return value;
}

export function effectiveOwner(ticket) {
  return ticket.owner ?? null;
}

export function matches(ticket, filters = {}) {
  const ownerMatches = filters.owner === undefined || effectiveOwner(ticket) === filters.owner;
  const statusMatches = filters.status === undefined || ticket.status === filters.status;
  return ownerMatches && statusMatches;
}
