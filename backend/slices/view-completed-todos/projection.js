/**
 * CompletedTodosProjection — maintains the completed_todos_projection read-side table.
 *
 * EM slice: View Completed Todos (state_view)
 * Source events: TodoCompleted, TodoReopened, TodoDeleted, TodoListArchived, TodoListDeleted
 *
 * Table schema:
 *   completed_todos_projection(todo_id PK, list_id, title, completed_at)
 *
 * Design:
 *   - TodoCompleted inserts the row. But TodoCompleted payload only has
 *     { todoId, completedAt } — no title or listId. Those come from the
 *     ActiveTodosProjection or from TodoCreated. Since this projection only
 *     subscribes to its EM source_events, we store what we have and accept
 *     that title/listId must be enriched from the active-todos projection at
 *     query time, OR we include TodoCreated as an additional source event to
 *     have the data available.
 *
 *   Pragmatic approach: subscribe to TodoCreated as well (an unlisted but
 *   necessary source) to cache todo metadata needed for the completed view.
 *   The table holds a staging row with status='active' that is promoted to
 *   status='completed' when TodoCompleted arrives.
 *
 *   - TodoCreated → INSERT with status='active' (staging, not shown to users)
 *   - TodoCompleted → UPDATE SET status='completed', completed_at=$2 WHERE todo_id=$1
 *   - TodoReopened → UPDATE SET status='active', completed_at=NULL WHERE todo_id=$1
 *   - TodoDeleted → DELETE WHERE todo_id=$1
 *   - TodoListArchived → DELETE WHERE list_id=$1
 *   - TodoListDeleted → DELETE WHERE list_id=$1
 *
 * The query layer filters WHERE status='completed'.
 * Idempotency: INSERT uses ON CONFLICT DO NOTHING; UPDATE/DELETE are naturally idempotent.
 */

export const NAME = 'CompletedTodosProjection';

export const SOURCE_EVENTS = [
  'TodoCreated',
  'TodoCompleted',
  'TodoReopened',
  'TodoDeleted',
  'TodoListArchived',
  'TodoListDeleted',
];

export async function initSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS completed_todos_projection (
      todo_id      TEXT PRIMARY KEY,
      list_id      TEXT NOT NULL,
      title        TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'active',
      completed_at TEXT
    )
  `);
}

export async function handleEvent({ type, payload }, client) {
  switch (type) {
    case 'TodoCreated':
      await client.query(
        `INSERT INTO completed_todos_projection (todo_id, list_id, title, status, completed_at)
         VALUES ($1, $2, $3, 'active', NULL)
         ON CONFLICT (todo_id) DO NOTHING`,
        [payload.todoId, payload.listId, payload.title],
      );
      break;

    case 'TodoCompleted':
      await client.query(
        `UPDATE completed_todos_projection
            SET status = 'completed', completed_at = $2
          WHERE todo_id = $1`,
        [payload.todoId, payload.completedAt],
      );
      break;

    case 'TodoReopened':
      await client.query(
        `UPDATE completed_todos_projection
            SET status = 'active', completed_at = NULL
          WHERE todo_id = $1`,
        [payload.todoId],
      );
      break;

    case 'TodoDeleted':
      await client.query(
        `DELETE FROM completed_todos_projection WHERE todo_id = $1`,
        [payload.todoId],
      );
      break;

    case 'TodoListArchived':
      await client.query(
        `DELETE FROM completed_todos_projection WHERE list_id = $1`,
        [payload.listId],
      );
      break;

    case 'TodoListDeleted':
      await client.query(
        `DELETE FROM completed_todos_projection WHERE list_id = $1`,
        [payload.listId],
      );
      break;

    default:
      break;
  }
}
