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
import editTodoRoute from './slices/edit-todo/route.js';
import setTodoDueDateRoute from './slices/set-due-date-on-todo/route.js';
import completeTodoRoute from './slices/complete-todo/route.js';
import reopenTodoRoute from './slices/reopen-todo/route.js';
import deleteTodoRoute from './slices/delete-todo/route.js';

// --- Slice routes (state_view) ---
import myTodoListsQuery from './slices/view-my-todo-lists/query.js';
import todoListDetailQuery from './slices/view-todo-list-detail/query.js';
import activeTodosQuery from './slices/view-active-todos/query.js';

// --- Projections ---
import * as todoListsProjection from './slices/view-my-todo-lists/projection.js';
import * as todoListDetailProjection from './slices/view-todo-list-detail/projection.js';
import * as activeTodosProjection from './slices/view-active-todos/projection.js';

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
app.use(editTodoRoute);
app.use(setTodoDueDateRoute);
app.use(completeTodoRoute);
app.use(reopenTodoRoute);
app.use(deleteTodoRoute);

// State-view routes
app.use(myTodoListsQuery);
app.use(todoListDetailQuery);
app.use(activeTodosQuery);

// --- Bootstrap ---
async function start() {
  await store.initializeSchema();
  console.log('Event store schema initialised');

  await initProjection(pool, todoListsProjection);
  console.log('TodoListsProjection started');

  await initProjection(pool, todoListDetailProjection);
  console.log('TodoListDetailProjection started');

  await initProjection(pool, activeTodosProjection);
  console.log('ActiveTodosProjection started');

  app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
