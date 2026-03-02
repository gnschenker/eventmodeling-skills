/**
 * ActiveTodosProjection — maintains the active_todos_projection read-side table.
 *
 * EM slice: View Active Todos (state_view)
 * Source events: TodoCreated, TodoCompleted, TodoReopened, TodoDeleted,
 *                TodoMarkedOverdue, TodoListArchived, TodoListDeleted
 *
 * Table schema:
 *   active_todos_projection(todo_id PK, list_id, title, description,
 *                           due_date, priority, status, created_at)
 *   status: 'active' | 'overdue' | 'completed'
 *
 * The query layer filters to status IN ('active', 'overdue').
 * Keeping completed rows avoids data loss when a todo is completed then
 * reopened (TodoReopened) — the row still exists to be updated back to 'active'.
 * Rows are only hard-deleted on TodoDeleted, TodoListArchived, TodoListDeleted.
 *
 * Idempotency: INSERT uses ON CONFLICT DO NOTHING; UPDATE/DELETE are naturally
 * idempotent.
 */

export const NAME = 'ActiveTodosProjection';

export const SOURCE_EVENTS = [
  'TodoCreated',
  'TodoCompleted',
  'TodoReopened',
  'TodoDeleted',
  'TodoMarkedOverdue',
  'TodoListArchived',
  'TodoListDeleted',
];

export async function initSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS active_todos_projection (
      todo_id     TEXT PRIMARY KEY,
      list_id     TEXT NOT NULL,
      title       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      due_date    TEXT,
      priority    TEXT NOT NULL DEFAULT 'Medium',
      status      TEXT NOT NULL DEFAULT 'active',
      created_at  TEXT NOT NULL
    )
  `);
}

export async function handleEvent({ type, payload }, client) {
  switch (type) {
    case 'TodoCreated':
      await client.query(
        `INSERT INTO active_todos_projection
           (todo_id, list_id, title, description, due_date, priority, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
         ON CONFLICT (todo_id) DO NOTHING`,
        [
          payload.todoId,
          payload.listId,
          payload.title,
          payload.description ?? '',
          payload.dueDate ?? null,
          payload.priority ?? 'Medium',
          payload.createdAt,
        ],
      );
      break;

    case 'TodoCompleted':
      await client.query(
        `UPDATE active_todos_projection SET status = 'completed' WHERE todo_id = $1`,
        [payload.todoId],
      );
      break;

    case 'TodoReopened':
      await client.query(
        `UPDATE active_todos_projection SET status = 'active' WHERE todo_id = $1`,
        [payload.todoId],
      );
      break;

    case 'TodoDeleted':
      await client.query(
        `DELETE FROM active_todos_projection WHERE todo_id = $1`,
        [payload.todoId],
      );
      break;

    case 'TodoMarkedOverdue':
      await client.query(
        `UPDATE active_todos_projection SET status = 'overdue' WHERE todo_id = $1`,
        [payload.todoId],
      );
      break;

    case 'TodoListArchived':
      await client.query(
        `DELETE FROM active_todos_projection WHERE list_id = $1`,
        [payload.listId],
      );
      break;

    case 'TodoListDeleted':
      await client.query(
        `DELETE FROM active_todos_projection WHERE list_id = $1`,
        [payload.listId],
      );
      break;

    default:
      break;
  }
}
