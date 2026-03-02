import { ValidationError } from '../../errors.js';

/**
 * Handle the RenameTodoList command.
 *
 * EM slice: Rename Todo List (state_change)
 * Business rules:
 *   - Todo list must exist and not be deleted
 *   - Name must not be blank
 *
 * @param {{ listId: string, name: string }} command
 * @param {{ store: object, query: Function }} deps
 * @returns {{ listId: string }}
 */
export async function handleRenameTodoList({ listId, name }, { store, query }) {
  if (!name || name.trim() === '') {
    throw new ValidationError('Name must not be blank');
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
    throw new ValidationError('Todo list must exist and not be deleted');
  }

  await store.append(
    {
      type: 'TodoListRenamed',
      payload: {
        listId,
        name: name.trim(),
        renamedAt: new Date().toISOString(),
      },
    },
    { query: q, expectedVersion: version },
  );

  return { listId };
}
