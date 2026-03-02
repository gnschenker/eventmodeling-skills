import { ValidationError } from '../../errors.js';

/**
 * Handle the CompleteTodo command.
 *
 * EM slice: Complete Todo (state_change)
 * Business rules:
 *   - Todo must be in Active or Overdue status
 *
 * @param {{ todoId: string }} command
 * @param {{ store: object, query: Function }} deps
 * @returns {{ todoId: string }}
 */
export async function handleCompleteTodo({ todoId }, { store, query }) {
  const q = query
    .eventsOfType('TodoCreated').where.key('todoId').equals(todoId)
    .eventsOfType('TodoCompleted').where.key('todoId').equals(todoId)
    .eventsOfType('TodoReopened').where.key('todoId').equals(todoId)
    .eventsOfType('TodoDeleted').where.key('todoId').equals(todoId)
    .eventsOfType('TodoMarkedOverdue').where.key('todoId').equals(todoId);

  const { events, version } = await store.load(q);

  // Derive current status by replaying lifecycle events in order
  let status = null; // null = never created
  for (const event of events) {
    switch (event.type) {
      case 'TodoCreated':      status = 'active'; break;
      case 'TodoCompleted':    status = 'completed'; break;
      case 'TodoReopened':     status = 'active'; break;
      case 'TodoDeleted':      status = 'deleted'; break;
      case 'TodoMarkedOverdue': status = 'overdue'; break;
    }
  }

  if (status !== 'active' && status !== 'overdue') {
    throw new ValidationError('Todo must be in Active or Overdue status');
  }

  await store.append(
    {
      type: 'TodoCompleted',
      payload: {
        todoId,
        completedAt: new Date().toISOString(),
      },
    },
    { query: q, expectedVersion: version },
  );

  return { todoId };
}
