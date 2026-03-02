/**
 * OverdueTodosProjection — maintains the overdue_todos_projection read-side table.
 *
 * EM slice: View Overdue Todos (state_view)
 * Source events: TodoCreated, TodoDueDateSet, TodoMarkedOverdue, TodoCompleted,
 *                TodoDeleted, TodoEdited, TodoListArchived, TodoListDeleted
 *
 * Table schema:
 *   overdue_todos_projection(todo_id PK, list_id, title, priority, due_date, status)
 *   status: 'active' | 'overdue' | 'completed'
 *
 * Design:
 *   - All todos are staged at TodoCreated (status='active').
 *   - TodoMarkedOverdue promotes status to 'overdue'.
 *   - TodoCompleted removes the todo from overdue interest — status='completed'.
 *   - TodoEdited updates title and priority (which affect overdue display).
 *   - TodoDueDateSet updates due_date (relevant for overdue detection context).
 *   - TodoDeleted, TodoListArchived, TodoListDeleted hard-delete rows.
 *   - The query layer filters WHERE status='overdue'.
 *
 * Idempotency: INSERT uses ON CONFLICT DO NOTHING; UPDATE/DELETE are naturally idempotent.
 */

export const NAME = 'OverdueTodosProjection';

export const SOURCE_EVENTS = [
  'TodoCreated',
  'TodoDueDateSet',
  'TodoMarkedOverdue',
  'TodoCompleted',
  'TodoDeleted',
  'TodoEdited',
  'TodoListArchived',
  'TodoListDeleted',
];

export async function initSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS overdue_todos_projection (
      todo_id  TEXT PRIMARY KEY,
      list_id  TEXT NOT NULL,
      title    TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'Medium',
      due_date TEXT,
      status   TEXT NOT NULL DEFAULT 'active'
    )
  `);
}

export async function handleEvent({ type, payload }, client) {
  switch (type) {
    case 'TodoCreated':
      await client.query(
        `INSERT INTO overdue_todos_projection (todo_id, list_id, title, priority, due_date, status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         ON CONFLICT (todo_id) DO NOTHING`,
        [
          payload.todoId,
          payload.listId,
          payload.title,
          payload.priority ?? 'Medium',
          payload.dueDate ?? null,
        ],
      );
      break;

    case 'TodoDueDateSet':
      await client.query(
        `UPDATE overdue_todos_projection SET due_date = $2 WHERE todo_id = $1`,
        [payload.todoId, payload.dueDate],
      );
      break;

    case 'TodoMarkedOverdue':
      await client.query(
        `UPDATE overdue_todos_projection SET status = 'overdue' WHERE todo_id = $1`,
        [payload.todoId],
      );
      break;

    case 'TodoCompleted':
      await client.query(
        `UPDATE overdue_todos_projection SET status = 'completed' WHERE todo_id = $1`,
        [payload.todoId],
      );
      break;

    case 'TodoEdited':
      await client.query(
        `UPDATE overdue_todos_projection SET title = $2, priority = $3 WHERE todo_id = $1`,
        [payload.todoId, payload.title, payload.priority],
      );
      break;

    case 'TodoDeleted':
      await client.query(
        `DELETE FROM overdue_todos_projection WHERE todo_id = $1`,
        [payload.todoId],
      );
      break;

    case 'TodoListArchived':
      await client.query(
        `DELETE FROM overdue_todos_projection WHERE list_id = $1`,
        [payload.listId],
      );
      break;

    case 'TodoListDeleted':
      await client.query(
        `DELETE FROM overdue_todos_projection WHERE list_id = $1`,
        [payload.listId],
      );
      break;

    default:
      break;
  }
}
