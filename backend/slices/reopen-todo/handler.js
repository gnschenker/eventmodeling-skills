import { ValidationError } from '../../errors.js';

/**
 * Handle the ReopenTodo command.
 *
 * EM slice: Reopen Todo (state_change)
 * Business rules:
 *   - Todo must be in Completed status
 *
 * @param {{ todoId: string }} command
 * @param {{ store: object, query: Function }} deps
 * @returns {{ todoId: string }}
 */
export async function handleReopenTodo({ todoId }, { store, query }) {
  const q = query
    .eventsOfType('TodoCreated').where.key('todoId').equals(todoId)
    .eventsOfType('TodoCompleted').where.key('todoId').equals(todoId)
    .eventsOfType('TodoReopened').where.key('todoId').equals(todoId)
    .eventsOfType('TodoDeleted').where.key('todoId').equals(todoId)
    .eventsOfType('TodoMarkedOverdue').where.key('todoId').equals(todoId);

  const { events, version } = await store.load(q);

  let status = null;
  for (const event of events) {
    switch (event.type) {
      case 'TodoCreated':       status = 'active'; break;
      case 'TodoCompleted':     status = 'completed'; break;
      case 'TodoReopened':      status = 'active'; break;
      case 'TodoDeleted':       status = 'deleted'; break;
      case 'TodoMarkedOverdue': status = 'overdue'; break;
    }
  }

  if (status !== 'completed') {
    throw new ValidationError('Todo must be in Completed status');
  }

  await store.append(
    {
      type: 'TodoReopened',
      payload: {
        todoId,
        reopenedAt: new Date().toISOString(),
      },
    },
    { query: q, expectedVersion: version },
  );

  return { todoId };
}
