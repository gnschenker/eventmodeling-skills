import { ValidationError } from '../../errors.js';

/**
 * Handle the DeleteTodoList command.
 *
 * EM slice: Delete Todo List (state_change)
 * Business rules:
 *   - Todo list must exist and not already be deleted
 *   - Todo list must be empty (no todos in any status)
 *
 * @param {{ listId: string }} command
 * @param {{ store: object, query: Function }} deps
 * @returns {{ listId: string }}
 */
export async function handleDeleteTodoList({ listId }, { store, query }) {
  const q = query
    .eventsOfType('TodoListCreated').where.key('listId').equals(listId)
    .eventsOfType('TodoListDeleted').where.key('listId').equals(listId)
    .eventsOfType('TodoCreated').where.key('listId').equals(listId)
    .eventsOfType('TodoDeleted').where.key('listId').equals(listId);

  const { events, version } = await store.load(q);

  let exists = false;
  let deleted = false;
  const activeTodos = new Set(); // todoIds that have been created but not deleted

  for (const event of events) {
    if (event.type === 'TodoListCreated') exists = true;
    if (event.type === 'TodoListDeleted') deleted = true;
    if (event.type === 'TodoCreated') activeTodos.add(event.payload.todoId);
    if (event.type === 'TodoDeleted') activeTodos.delete(event.payload.todoId);
  }

  if (!exists || deleted) {
    throw new ValidationError('Todo list must exist and not already be deleted');
  }

  if (activeTodos.size > 0) {
    throw new ValidationError('Todo list must be empty (no todos in any status)');
  }

  await store.append(
    {
      type: 'TodoListDeleted',
      payload: {
        listId,
        deletedAt: new Date().toISOString(),
      },
    },
    { query: q, expectedVersion: version },
  );

  return { listId };
}
