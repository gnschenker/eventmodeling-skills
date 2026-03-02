import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handleArchiveTodoList } from './handler.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Chainable DCB query mock.
 * store.load is mocked, so the query object's content is irrelevant —
 * we only need something that satisfies the handler's call pattern.
 * See rename-todo-list lessons learned for rationale on this approach.
 */
function makeQuery() {
  const chain = {};
  const whereProxy = new Proxy(chain, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => chain;
    },
  });
  chain.eventsOfType = () => chain;
  chain.where = whereProxy;
  chain.and = whereProxy;
  chain.or = whereProxy;
  chain.key = () => chain;
  chain.equals = () => chain;
  return chain;
}

function makeStore({ events = [], version = 0 } = {}) {
  return {
    load: mock.fn(async () => ({ events, version })),
    append: mock.fn(async () => {}),
  };
}

function activeList(listId = 'list-1') {
  return [{ type: 'TodoListCreated', payload: { listId } }];
}

function archivedList(listId = 'list-1') {
  return [
    { type: 'TodoListCreated', payload: { listId } },
    { type: 'TodoListArchived', payload: { listId } },
  ];
}

function deletedList(listId = 'list-1') {
  return [
    { type: 'TodoListCreated', payload: { listId } },
    { type: 'TodoListDeleted', payload: { listId } },
  ];
}

// ---------------------------------------------------------------------------
// Validation — unit tests
// ---------------------------------------------------------------------------

test('unit: rejects when todo list does not exist', async () => {
  const store = makeStore({ events: [], version: 0 });
  await assert.rejects(
    () => handleArchiveTodoList({ listId: 'list-1' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Todo list must exist and not already be archived or deleted' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when todo list is already archived', async () => {
  const store = makeStore({ events: archivedList(), version: 2 });
  await assert.rejects(
    () => handleArchiveTodoList({ listId: 'list-1' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Todo list must exist and not already be archived or deleted' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when todo list is deleted', async () => {
  const store = makeStore({ events: deletedList(), version: 2 });
  await assert.rejects(
    () => handleArchiveTodoList({ listId: 'list-1' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Todo list must exist and not already be archived or deleted' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

// ---------------------------------------------------------------------------
// Happy path — unit tests
// ---------------------------------------------------------------------------

test('unit: appends TodoListArchived event for an active list', async () => {
  const store = makeStore({ events: activeList('list-abc'), version: 1 });

  const result = await handleArchiveTodoList(
    { listId: 'list-abc' },
    { store, query: makeQuery() },
  );

  assert.equal(result.listId, 'list-abc');
  assert.equal(store.append.mock.calls.length, 1);

  const [event, opts] = store.append.mock.calls[0].arguments;
  assert.equal(event.type, 'TodoListArchived');
  assert.equal(event.payload.listId, 'list-abc');
  assert.ok(event.payload.archivedAt, 'archivedAt must be set');
  assert.equal(opts.expectedVersion, 1);
});

test('unit: archivedAt is a valid ISO 8601 datetime string', async () => {
  const store = makeStore({ events: activeList(), version: 1 });
  await handleArchiveTodoList({ listId: 'list-1' }, { store, query: makeQuery() });

  const [event] = store.append.mock.calls[0].arguments;
  const parsed = new Date(event.payload.archivedAt);
  assert.ok(!isNaN(parsed.getTime()), 'archivedAt must be a valid date');
});

test('unit: passes optimistic concurrency version to store.append', async () => {
  const store = makeStore({ events: activeList(), version: 3 });
  await handleArchiveTodoList({ listId: 'list-1' }, { store, query: makeQuery() });

  const [, opts] = store.append.mock.calls[0].arguments;
  assert.equal(opts.expectedVersion, 3);
});

test('unit: returns the listId passed in the command', async () => {
  const store = makeStore({ events: activeList('xyz-999'), version: 1 });
  const result = await handleArchiveTodoList({ listId: 'xyz-999' }, { store, query: makeQuery() });
  assert.equal(result.listId, 'xyz-999');
});
