import { ValidationError } from '../../errors.js';

/**
 * Handle the SetTodoDueDate command.
 *
 * EM slice: Set Due Date on Todo (state_change)
 * Business rules:
 *   - Todo must exist and not be deleted
 *   - Due date must not be in the past
 *
 * @param {{ todoId: string, dueDate: string }} command  — dueDate as YYYY-MM-DD
 * @param {{ store: object, query: Function }} deps
 * @returns {{ todoId: string }}
 */
export async function handleSetTodoDueDate({ todoId, dueDate }, { store, query }) {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    throw new ValidationError('Due date must be a valid date (YYYY-MM-DD)');
  }

  const today = new Date().toISOString().slice(0, 10);
  if (dueDate < today) {
    throw new ValidationError('Due date must not be in the past');
  }

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
    throw new ValidationError('Todo must exist and not be deleted');
  }

  await store.append(
    {
      type: 'TodoDueDateSet',
      payload: {
        todoId,
        dueDate,
        setAt: new Date().toISOString(),
      },
    },
    { query: q, expectedVersion: version },
  );

  return { todoId };
}
