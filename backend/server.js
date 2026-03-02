import express from 'express';
import cors from 'cors';
import { store, pool } from './store.js';
import { initProjection } from './projection-runner.js';

// --- Slice routes (state_change) ---
import createTodoListRoute from './slices/create-todo-list/route.js';
import renameTodoListRoute from './slices/rename-todo-list/route.js';
import archiveTodoListRoute from './slices/archive-todo-list/route.js';
import deleteTodoListRoute from './slices/delete-todo-list/route.js';
import createTodoRoute from './slices/create-todo/route.js';

// --- Slice routes (state_view) ---
import myTodoListsQuery from './slices/view-my-todo-lists/query.js';

// --- Projections ---
import * as todoListsProjection from './slices/view-my-todo-lists/projection.js';

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

// State-change routes
app.use(createTodoListRoute);
app.use(renameTodoListRoute);
app.use(archiveTodoListRoute);
app.use(deleteTodoListRoute);
app.use(createTodoRoute);

// State-view routes
app.use(myTodoListsQuery);

// --- Bootstrap ---
async function start() {
  await store.initializeSchema();
  console.log('Event store schema initialised');

  await initProjection(pool, todoListsProjection);
  console.log('TodoListsProjection started');

  app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
