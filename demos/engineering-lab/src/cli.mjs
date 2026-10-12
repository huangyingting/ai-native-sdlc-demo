import { readFileSync } from 'node:fs';
import { TicketStore } from './store.mjs';
import { listTickets } from './api.mjs';

const config = JSON.parse(readFileSync(new URL('../runtime.json', import.meta.url), 'utf8'));
const store = new TicketStore(config.databasePath);
try {
  store.create({ title: 'Synthetic keyboard request', owner: 'avery' });
  store.create({ title: 'Synthetic monitor request', owner: 'jordan', status: 'closed' });
  console.log(JSON.stringify(listTickets(store)));
} finally {
  store.close();
}
