/**
 * TodoDetailProjection — maintains the todo_detail_projection read-side table.
 *
 * EM slice: View Todo Detail (state_view)
 * Source events: TodoCreated, TodoEdited, TodoDueDateSet, TodoCompleted,
 *                TodoReopened, TodoMarkedOverdue, TodoDeleted,
 *                TodoListArchived, TodoListDeleted
 *
 * Table schema:
 *   todo_detail_projection(todo_id PK, list_id, title, description, due_date,
 *                          priority, status, created_at)
 *   status: 'active' | 'overdue' | 'completed' | 'deleted'
 *
 * Design:
 *   - Rows are never hard-deleted so that detail views for deleted todos can
 *     show meaningful data (status='deleted') rather than a 404-like gap.
 *     Only TodoListArchived and TodoListDeleted remove rows (the list is gone).
 *   - TodoDeleted marks the row status='deleted'; the row is kept for audit.
 *
 * Idempotency: INSERT uses ON CONFLICT DO NOTHING; UPDATE/DELETE are naturally
 * idempotent.
 */

export const NAME = 'TodoDetailProjection';

export const SOURCE_EVENTS = [
  'TodoCreated',
  'TodoEdited',
  'TodoDueDateSet',
  'TodoCompleted',
  'TodoReopened',
  'TodoMarkedOverdue',
  'TodoDeleted',
  'TodoListArchived',
  'TodoListDeleted',
];

export async function initSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS todo_detail_projection (
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
        `INSERT INTO todo_detail_projection
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

    case 'TodoEdited':
      await client.query(
        `UPDATE todo_detail_projection
            SET title = $2, description = $3, priority = $4
          WHERE todo_id = $1`,
        [payload.todoId, payload.title, payload.description ?? '', payload.priority],
      );
      break;

    case 'TodoDueDateSet':
      await client.query(
        `UPDATE todo_detail_projection SET due_date = $2 WHERE todo_id = $1`,
        [payload.todoId, payload.dueDate],
      );
      break;

    case 'TodoCompleted':
      await client.query(
        `UPDATE todo_detail_projection SET status = 'completed' WHERE todo_id = $1`,
        [payload.todoId],
      );
      break;

    case 'TodoReopened':
      await client.query(
        `UPDATE todo_detail_projection SET status = 'active' WHERE todo_id = $1`,
        [payload.todoId],
      );
      break;

    case 'TodoMarkedOverdue':
      await client.query(
        `UPDATE todo_detail_projection SET status = 'overdue' WHERE todo_id = $1`,
        [payload.todoId],
      );
      break;

    case 'TodoDeleted':
      await client.query(
        `UPDATE todo_detail_projection SET status = 'deleted' WHERE todo_id = $1`,
        [payload.todoId],
      );
      break;

    case 'TodoListArchived':
      await client.query(
        `DELETE FROM todo_detail_projection WHERE list_id = $1`,
        [payload.listId],
      );
      break;

    case 'TodoListDeleted':
      await client.query(
        `DELETE FROM todo_detail_projection WHERE list_id = $1`,
        [payload.listId],
      );
      break;

    default:
      break;
  }
}
