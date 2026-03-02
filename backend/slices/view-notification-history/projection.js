/**
 * NotificationHistoryProjection — maintains the notification_history_projection table.
 *
 * EM slice: View Notification History (state_view)
 * Source events: TodoDueReminderSent
 *
 * Table schema:
 *   notification_history_projection(todo_id TEXT, user_id TEXT,
 *                                    due_date TEXT, sent_at TEXT,
 *                                    PRIMARY KEY (todo_id, due_date))
 *
 * Design:
 *   - One row per (todo_id, due_date) pair — the EM business rule guarantees
 *     a reminder is sent at most once per todo+due-date combination.
 *   - ON CONFLICT DO NOTHING makes projection replay idempotent.
 *   - Rows are never deleted; the history is append-only.
 */

export const NAME = 'NotificationHistoryProjection';

export const SOURCE_EVENTS = ['TodoDueReminderSent'];

export async function initSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS notification_history_projection (
      todo_id   TEXT NOT NULL,
      user_id   TEXT NOT NULL,
      due_date  TEXT NOT NULL,
      sent_at   TEXT NOT NULL,
      PRIMARY KEY (todo_id, due_date)
    )
  `);
}

export async function handleEvent({ type, payload }, client) {
  switch (type) {
    case 'TodoDueReminderSent':
      await client.query(
        `INSERT INTO notification_history_projection (todo_id, user_id, due_date, sent_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (todo_id, due_date) DO NOTHING`,
        [payload.todoId, payload.userId, payload.dueDate, payload.sentAt],
      );
      break;

    default:
      break;
  }
}
