import { ValidationError } from '../../errors.js';

const VALID_PRIORITIES = new Set(['Low', 'Medium', 'High']);

/**
 * Handle the EditTodo command.
 *
 * EM slice: Edit Todo (state_change)
 * Business rules:
 *   - Todo must exist and not be deleted
 *   - Title must not be blank
 *   - Priority must be one of: Low, Medium, High
 *
 * @param {{ todoId: string, title: string, description: string, priority: string }} command
 * @param {{ store: object, query: Function }} deps
 * @returns {{ todoId: string }}
 */
export async function handleEditTodo(
  { todoId, title, description, priority },
  { store, query },
) {
  if (!title || title.trim() === '') {
    throw new ValidationError('Title must not be blank');
  }

  if (!VALID_PRIORITIES.has(priority)) {
    throw new ValidationError('Priority must be one of: Low, Medium, High');
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
      type: 'TodoEdited',
      payload: {
        todoId,
        title: title.trim(),
        description: description ?? '',
        priority,
        editedAt: new Date().toISOString(),
      },
    },
    { query: q, expectedVersion: version },
  );

  return { todoId };
}
