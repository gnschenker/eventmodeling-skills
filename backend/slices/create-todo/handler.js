import { ValidationError } from '../../errors.js';

const VALID_PRIORITIES = new Set(['Low', 'Medium', 'High']);

/**
 * Handle the CreateTodo command.
 *
 * EM slice: Create Todo (state_change)
 * Business rules:
 *   - Title must not be blank
 *   - Priority must be one of: Low, Medium, High — defaults to Medium if omitted
 *   - Referenced todo list must exist and not be deleted
 *
 * @param {{ todoId: string, listId: string, title: string, description: string, dueDate?: string, priority?: string }} command
 * @param {{ store: object, query: Function }} deps
 * @returns {{ todoId: string }}
 */
export async function handleCreateTodo(
  { todoId, listId, title, description, dueDate, priority },
  { store, query },
) {
  if (!title || title.trim() === '') {
    throw new ValidationError('Title must not be blank');
  }

  const resolvedPriority = priority && priority.trim() !== '' ? priority : 'Medium';
  if (!VALID_PRIORITIES.has(resolvedPriority)) {
    throw new ValidationError('Priority must be one of: Low, Medium, High');
  }

  const q = query
    .eventsOfType('TodoListCreated').where.key('listId').equals(listId)
    .eventsOfType('TodoListDeleted').where.key('listId').equals(listId);

  const { events, version } = await store.load(q);

  let exists = false;
  let deleted = false;
  for (const event of events) {
    if (event.type === 'TodoListCreated') exists = true;
    if (event.type === 'TodoListDeleted') deleted = true;
  }

  if (!exists || deleted) {
    throw new ValidationError('Referenced todo list must exist and not be deleted');
  }

  await store.append(
    {
      type: 'TodoCreated',
      payload: {
        todoId,
        listId,
        title: title.trim(),
        description: description ?? '',
        dueDate: dueDate ?? null,
        priority: resolvedPriority,
        createdAt: new Date().toISOString(),
      },
    },
    { query: q, expectedVersion: version },
  );

  return { todoId };
}
