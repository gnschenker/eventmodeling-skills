import express from 'express';
import pg from 'pg';
import { PostgresEventStore } from 'es-dcb-library';

const { Pool } = pg;

const PORT = process.env.PORT ?? 3000;
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

// --- Database pool ---
const pool = new Pool({ connectionString: DATABASE_URL });

// --- Event store ---
export const store = new PostgresEventStore({ pool });

// --- Express app ---
const app = express();
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Slice routes are registered here as slices are implemented.
// Example (added per slice):
//   import createTodoListRoute from './slices/create-todo-list/route.js';
//   app.use(createTodoListRoute);

// --- Bootstrap ---
async function start() {
  await store.initializeSchema();
  console.log('Event store schema initialised');

  app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
