import express from 'express';
import cors from 'cors';
import { store } from './store.js';

// --- Slice routes ---
import createTodoListRoute from './slices/create-todo-list/route.js';

const PORT = process.env.PORT ?? 3000;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

// --- Express app ---
const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:8080' }));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use(createTodoListRoute);

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
