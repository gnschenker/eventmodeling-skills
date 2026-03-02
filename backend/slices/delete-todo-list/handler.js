import { ValidationError } from '../../errors.js';

/**
 * Handle the DeleteTodoList command.
 *
 * EM slice: Delete Todo List (state_change)
 * Business rules:
 *   - Todo list must exist and not already be deleted
 *   - Todo list must be empty (no todos in any status)
 *
 * Two-pass load strategy:
 *   Pass 1 — query by listId: loads TodoListCreated, TodoListDeleted, TodoCreated.
 *             Validates list state and collects the set of todo IDs in the list.
 *   Pass 2 — query by todoId: loads TodoDeleted for each collected todoId.
 *             Determines which todos still exist (not yet deleted).
 *
 * Note: TodoDeleted (per the EM spec) carries only { todoId, deletedAt } — no
 * listId — so it cannot be filtered by listId in the DCB event_keys index.
 * Hence the two-pass approach rather than a single combined query.
 *
 * Optimistic concurrency uses the version from Pass 1 (list-scoped events).
 * This guards against concurrent list-level writes between check and append.
 *
 * @param {{ listId: string }} command
 * @param {{ store: object, query: Function }} deps
 * @returns {{ listId: string }}
 */
export async function handleDeleteTodoList({ listId }, { store, query }) {
  // ── Pass 1: list lifecycle + todos created in this list ──────────────────
  const q1 = query
    .eventsOfType('TodoListCreated').where.key('listId').equals(listId)
    .eventsOfType('TodoListDeleted').where.key('listId').equals(listId)
    .eventsOfType('TodoCreated').where.key('listId').equals(listId);

  const { events: q1Events, version } = await store.load(q1);

  let exists = false;
  let deleted = false;
  const todoIds = new Set();

  for (const event of q1Events) {
    if (event.type === 'TodoListCreated') exists = true;
    if (event.type === 'TodoListDeleted') deleted = true;
    if (event.type === 'TodoCreated') todoIds.add(event.payload.todoId);
  }

  if (!exists || deleted) {
    throw new ValidationError('Todo list must exist and not already be deleted');
  }

  // ── Pass 2: check which todos have been deleted ───────────────────────────
  if (todoIds.size > 0) {
    let q2 = null;
    for (const todoId of todoIds) {
      q2 = q2 === null
        ? query.eventsOfType('TodoDeleted').where.key('todoId').equals(todoId)
        : q2.eventsOfType('TodoDeleted').where.key('todoId').equals(todoId);
    }

    const { events: deletedEvents } = await store.load(q2);
    const deletedTodoIds = new Set(deletedEvents.map((e) => e.payload.todoId));
    const activeTodos = [...todoIds].filter((id) => !deletedTodoIds.has(id));

    if (activeTodos.length > 0) {
      throw new ValidationError('Todo list must be empty (no todos in any status)');
    }
  }

  await store.append(
    {
      type: 'TodoListDeleted',
      payload: {
        listId,
        deletedAt: new Date().toISOString(),
      },
    },
    { query: q1, expectedVersion: version },
  );

  return { listId };
}
