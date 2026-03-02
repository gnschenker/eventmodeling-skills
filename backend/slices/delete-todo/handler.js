import { ValidationError } from '../../errors.js';

/**
 * Handle the DeleteTodo command.
 *
 * EM slice: Delete Todo (state_change)
 * Business rules:
 *   - Todo must exist and not already be deleted
 *
 * @param {{ todoId: string }} command
 * @param {{ store: object, query: Function }} deps
 * @returns {{ todoId: string }}
 */
export async function handleDeleteTodo({ todoId }, { store, query }) {
  const q = query
    .eventsOfType('TodoCreated').where.key('todoId').equals(todoId)
    .eventsOfType('TodoDeleted').where.key('todoId').equals(todoId);

  const { events, version } = await store.load(q);

  let exists = false;
  let deleted = false;
  for (const event of events) {
    if (event.type === 'TodoCreated') exists = true;
    if (event.type === 'TodoDeleted') deleted = true;
  }

  if (!exists || deleted) {
    throw new ValidationError('Todo must exist and not already be deleted');
  }

  await store.append(
    {
      type: 'TodoDeleted',
      payload: {
        todoId,
        deletedAt: new Date().toISOString(),
      },
    },
    { query: q, expectedVersion: version },
  );

  return { todoId };
}
