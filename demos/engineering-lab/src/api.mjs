export function listTickets(store, filters = {}) {
  return store.list(filters).map(({ id, title, owner, status }) => ({
    id,
    title,
    owner,
    status,
  }));
}
