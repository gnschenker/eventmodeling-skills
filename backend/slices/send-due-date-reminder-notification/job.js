/**
 * DueDateReminderJob — hourly automation that sends due-date reminder notifications.
 *
 * EM slice: Send Due Date Reminder Notification (automation)
 * Trigger:  Hourly
 *
 * Business rules enforced:
 *   1. Todo must be in Active or Overdue status (enforced by querying active_todos_projection)
 *   2. Due date must be within the reminder window (≤ REMINDER_WINDOW_HOURS from now)
 *   3. Reminder must not have already been sent for this todo/due date combination
 *      (enforced by folding TodoDueReminderSent events via DCB store.load + expectedVersion)
 *
 * Concurrency:
 *   store.append is called with { query, expectedVersion } so a ConcurrencyError is thrown
 *   if another job instance already sent the reminder. The error is silently swallowed.
 *
 * userId:
 *   The current app has no user model. A constant placeholder UUID is used until
 *   user authentication is introduced.
 */

const REMINDER_WINDOW_HOURS = 24;
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000';

/**
 * @param {object} deps
 * @param {import('pg').Pool} deps.pool
 * @param {object} deps.store  — PostgresEventStore
 * @param {Function} deps.query — DCB query builder
 */
export async function runDueDateReminderJob({ pool, store, query }) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // --- Step 1: find todos due within the reminder window ---
  const client = await pool.connect();
  let todosDue;
  try {
    const { rows } = await client.query(
      `SELECT todo_id, due_date
         FROM active_todos_projection
        WHERE due_date >= $1
          AND due_date <= $2
          AND status = ANY($3::text[])`,
      [todayStr, windowEnd, ['active', 'overdue']],
    );
    todosDue = rows;
  } finally {
    client.release();
  }

  // --- Step 2: for each eligible todo, send reminder if not already sent ---
  for (const row of todosDue) {
    const todoId = row.todo_id;
    const dueDate = row.due_date;

    try {
      const q = query
        .eventsOfType('TodoDueReminderSent')
        .where.key('todoId')
        .equals(todoId);

      const { events, version } = await store.load(q);

      // Rule 3: skip if a reminder was already sent for this due date
      const alreadySent = events.some((e) => e.payload.dueDate === dueDate);
      if (alreadySent) continue;

      await store.append(
        {
          type: 'TodoDueReminderSent',
          payload: {
            todoId,
            userId: DEMO_USER_ID,
            dueDate,
            sentAt: new Date().toISOString(),
          },
        },
        { query: q, expectedVersion: version },
      );
    } catch (err) {
      // ConcurrencyError means another job instance won the race — skip silently
      if (err.name !== 'ConcurrencyError') {
        console.error(`DueDateReminderJob: error for todoId=${todoId}`, err);
      }
    }
  }
}
