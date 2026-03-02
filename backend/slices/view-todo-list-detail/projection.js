/**
 * TodoListDetailProjection — maintains the todo_list_detail_projection read-side table.
 *
 * EM slice: View Todo List Detail (state_view)
 * Source events: TodoListCreated, TodoListRenamed, TodoListArchived, TodoListDeleted
 *
 * Table schema:
 *   todo_list_detail_projection(list_id PK, name, status, created_at)
 *   status: 'active' | 'archived' | 'deleted'
 *
 * Unlike TodoListsProjection, deleted lists are kept as rows (status='deleted')
 * so that the detail endpoint can return a meaningful 410 Gone rather than 404,
 * and so the record remains available for any future audit queries.
 *
 * Idempotency: INSERT uses ON CONFLICT DO NOTHING; UPDATE/DELETE are naturally idempotent.
 */

export const NAME = 'TodoListDetailProjection';

export const SOURCE_EVENTS = [
  'TodoListCreated',
  'TodoListRenamed',
  'TodoListArchived',
  'TodoListDeleted',
];

export async function initSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS todo_list_detail_projection (
      list_id    TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    )
  `);
}

export async function handleEvent({ type, payload }, client) {
  switch (type) {
    case 'TodoListCreated':
      await client.query(
        `INSERT INTO todo_list_detail_projection (list_id, name, status, created_at)
         VALUES ($1, $2, 'active', $3)
         ON CONFLICT (list_id) DO NOTHING`,
        [payload.listId, payload.name, payload.createdAt],
      );
      break;

    case 'TodoListRenamed':
      await client.query(
        `UPDATE todo_list_detail_projection SET name = $1 WHERE list_id = $2`,
        [payload.name, payload.listId],
      );
      break;

    case 'TodoListArchived':
      await client.query(
        `UPDATE todo_list_detail_projection SET status = 'archived' WHERE list_id = $1`,
        [payload.listId],
      );
      break;

    case 'TodoListDeleted':
      await client.query(
        `UPDATE todo_list_detail_projection SET status = 'deleted' WHERE list_id = $1`,
        [payload.listId],
      );
      break;

    default:
      break;
  }
}
