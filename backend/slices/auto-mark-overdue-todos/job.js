/**
 * OverdueDetectionJob — daily automation that marks active todos overdue.
 *
 * EM slice: Auto-Mark Overdue Todos (automation)
 * Trigger:  Daily at 00:01 UTC (scheduled in server.js)
 *
 * Business rules enforced:
 *   1. Todo must be in Active status (SQL filter on active_todos_projection)
 *   2. Todo due date must be earlier than today (SQL filter: due_date < today)
 *   3. Event-level guard: DCB load confirms current status is still 'active'
 *      before appending, preventing races with concurrent state-change commands.
 *
 * Concurrency:
 *   store.append with { query, expectedVersion } — ConcurrencyError silently
 *   swallowed (another command changed the todo between check and append).
 */

/**
 * @param {object} deps
 * @param {import('pg').Pool} deps.pool
 * @param {object} deps.store  — PostgresEventStore
 * @param {Function} deps.query — DCB query builder
 */
export async function runOverdueDetectionJob({ pool, store, query }) {
  const today = new Date().toISOString().slice(0, 10);

  // --- Step 1: find active todos with a due date earlier than today ---
  const client = await pool.connect();
  let overdueTodos;
  try {
    const { rows } = await client.query(
      `SELECT todo_id
         FROM active_todos_projection
        WHERE due_date < $1
          AND status = 'active'`,
      [today],
    );
    overdueTodos = rows;
  } finally {
    client.release();
  }

  // --- Step 2: for each candidate, verify via events then append TodoMarkedOverdue ---
  for (const row of overdueTodos) {
    const todoId = row.todo_id;

    try {
      const q = query
        .eventsOfType('TodoCreated').where.key('todoId').equals(todoId)
        .eventsOfType('TodoMarkedOverdue').where.key('todoId').equals(todoId)
        .eventsOfType('TodoReopened').where.key('todoId').equals(todoId)
        .eventsOfType('TodoCompleted').where.key('todoId').equals(todoId)
        .eventsOfType('TodoDeleted').where.key('todoId').equals(todoId);

      const { events, version } = await store.load(q);

      // Fold to get current status — TodoReopened resets to 'active'
      let status = null;
      for (const event of events) {
        switch (event.type) {
          case 'TodoCreated':       status = 'active';   break;
          case 'TodoMarkedOverdue': status = 'overdue';  break;
          case 'TodoReopened':      status = 'active';   break;
          case 'TodoCompleted':     status = 'completed'; break;
          case 'TodoDeleted':       status = 'deleted';  break;
        }
      }

      // Guard: only mark overdue if still active (handles race with complete/delete)
      if (status !== 'active') continue;

      await store.append(
        {
          type: 'TodoMarkedOverdue',
          payload: { todoId, markedOverdueAt: new Date().toISOString() },
        },
        { query: q, expectedVersion: version },
      );
    } catch (err) {
      // ConcurrencyError: concurrent command changed the todo — skip silently
      if (err.name !== 'ConcurrencyError') {
        console.error(`OverdueDetectionJob: error for todoId=${todoId}`, err);
      }
    }
  }
}
