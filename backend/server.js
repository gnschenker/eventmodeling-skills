import express from 'express';
import cors from 'cors';
import { query } from 'es-dcb-library';
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
import completedTodosQuery from './slices/view-completed-todos/query.js';
import overdueTodosQuery from './slices/view-overdue-todos/query.js';
import todoDetailQuery from './slices/view-todo-detail/query.js';
import notificationHistoryQuery from './slices/view-notification-history/query.js';

// --- Projections ---
import * as todoListsProjection from './slices/view-my-todo-lists/projection.js';
import * as todoListDetailProjection from './slices/view-todo-list-detail/projection.js';
import * as activeTodosProjection from './slices/view-active-todos/projection.js';
import * as completedTodosProjection from './slices/view-completed-todos/projection.js';
import * as overdueTodosProjection from './slices/view-overdue-todos/projection.js';
import * as todoDetailProjection from './slices/view-todo-detail/projection.js';
import * as notificationHistoryProjection from './slices/view-notification-history/projection.js';

// --- Automation jobs ---
import { runDueDateReminderJob } from './slices/send-due-date-reminder-notification/job.js';

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
app.use(completedTodosQuery);
app.use(overdueTodosQuery);
app.use(todoDetailQuery);
app.use(notificationHistoryQuery);

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

  await initProjection(pool, completedTodosProjection);
  console.log('CompletedTodosProjection started');

  await initProjection(pool, overdueTodosProjection);
  console.log('OverdueTodosProjection started');

  await initProjection(pool, todoDetailProjection);
  console.log('TodoDetailProjection started');

  await initProjection(pool, notificationHistoryProjection);
  console.log('NotificationHistoryProjection started');

  // --- Automation jobs ---
  const jobDeps = { pool, store, query };

  // DueDateReminderJob: run immediately on start, then every hour
  const HOUR_MS = 60 * 60 * 1000;
  const runReminder = () =>
    runDueDateReminderJob(jobDeps).catch((err) =>
      console.error('DueDateReminderJob error:', err),
    );
  runReminder();
  setInterval(runReminder, HOUR_MS);
  console.log('DueDateReminderJob scheduled (hourly)');

  app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
