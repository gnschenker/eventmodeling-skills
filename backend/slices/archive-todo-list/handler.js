import { ValidationError } from '../../errors.js';

/**
 * Handle the ArchiveTodoList command.
 *
 * EM slice: Archive Todo List (state_change)
 * Business rules:
 *   - Todo list must exist and not already be archived or deleted
 *
 * @param {{ listId: string }} command
 * @param {{ store: object, query: Function }} deps
 * @returns {{ listId: string }}
 */
export async function handleArchiveTodoList({ listId }, { store, query }) {
  const q = query
    .eventsOfType('TodoListCreated').where.key('listId').equals(listId)
    .eventsOfType('TodoListArchived').where.key('listId').equals(listId)
    .eventsOfType('TodoListDeleted').where.key('listId').equals(listId);

  const { events, version } = await store.load(q);

  let exists = false;
  let archived = false;
  let deleted = false;
  for (const event of events) {
    if (event.type === 'TodoListCreated') exists = true;
    if (event.type === 'TodoListArchived') archived = true;
    if (event.type === 'TodoListDeleted') deleted = true;
  }

  if (!exists || archived || deleted) {
    throw new ValidationError('Todo list must exist and not already be archived or deleted');
  }

  await store.append(
    {
      type: 'TodoListArchived',
      payload: {
        listId,
        archivedAt: new Date().toISOString(),
      },
    },
    { query: q, expectedVersion: version },
  );

  return { listId };
}
