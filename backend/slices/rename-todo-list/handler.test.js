import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handleRenameTodoList } from './handler.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Minimal stand-in for the DCB query builder.
 * Unit tests mock store.load, so the query object itself is irrelevant —
 * we just need something chainable that the handler can call without error.
 *
 * The DCB API shape used in handler.js:
 *   query.eventsOfType(t).where.key(k).equals(v).eventsOfType(t)...
 * `.where`, `.and`, `.or` are property getters (not method calls).
 *
 * Note: chain.key and chain.equals are placed directly on `chain` for
 * simplicity. The whereProxy also returns them via its `target` fallback
 * (prop-in-target branch). This is intentionally looser than the real
 * library Proxy — it satisfies the handler's call pattern and avoids
 * pulling in es-dcb-library during unit tests.
 */
function makeQuery() {
  const chain = {};
  const whereProxy = new Proxy(chain, {
    get(target, prop) {
      if (prop in target) return target[prop];
      // Any unknown property (field name accessors) returns a callable that
      // chains back, matching the real library's dynamic key selectors.
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

function existingList(listId = 'list-1') {
  return [{ type: 'TodoListCreated', payload: { listId } }];
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

test('unit: rejects when name is empty string', async () => {
  const store = makeStore({ events: existingList() });
  await assert.rejects(
    () => handleRenameTodoList({ listId: 'list-1', name: '' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Name must not be blank' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when name is whitespace only', async () => {
  const store = makeStore({ events: existingList() });
  await assert.rejects(
    () => handleRenameTodoList({ listId: 'list-1', name: '   ' }, { store, query: makeQuery() }),
    { name: 'ValidationError' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when name is missing', async () => {
  const store = makeStore({ events: existingList() });
  await assert.rejects(
    () => handleRenameTodoList({ listId: 'list-1' }, { store, query: makeQuery() }),
    { name: 'ValidationError' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when todo list does not exist', async () => {
  const store = makeStore({ events: [], version: 0 });
  await assert.rejects(
    () => handleRenameTodoList({ listId: 'list-1', name: 'New Name' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Todo list must exist and not be deleted' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when todo list is deleted', async () => {
  const store = makeStore({ events: deletedList(), version: 2 });
  await assert.rejects(
    () => handleRenameTodoList({ listId: 'list-1', name: 'New Name' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Todo list must exist and not be deleted' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

// ---------------------------------------------------------------------------
// Happy path — unit tests
// ---------------------------------------------------------------------------

test('unit: appends TodoListRenamed event with trimmed name', async () => {
  const store = makeStore({ events: existingList('list-abc'), version: 1 });

  const result = await handleRenameTodoList(
    { listId: 'list-abc', name: '  My New Name  ' },
    { store, query: makeQuery() },
  );

  assert.equal(result.listId, 'list-abc');
  assert.equal(store.append.mock.calls.length, 1);

  const [event, opts] = store.append.mock.calls[0].arguments;
  assert.equal(event.type, 'TodoListRenamed');
  assert.equal(event.payload.listId, 'list-abc');
  assert.equal(event.payload.name, 'My New Name');
  assert.ok(event.payload.renamedAt, 'renamedAt must be set');
  assert.equal(opts.expectedVersion, 1);
});

test('unit: renamedAt is a valid ISO 8601 datetime string', async () => {
  const store = makeStore({ events: existingList(), version: 1 });
  await handleRenameTodoList({ listId: 'list-1', name: 'Groceries' }, { store, query: makeQuery() });

  const [event] = store.append.mock.calls[0].arguments;
  const parsed = new Date(event.payload.renamedAt);
  assert.ok(!isNaN(parsed.getTime()), 'renamedAt must be a valid date');
});

test('unit: passes optimistic concurrency version to store.append', async () => {
  const store = makeStore({ events: existingList(), version: 5 });
  await handleRenameTodoList({ listId: 'list-1', name: 'Updated' }, { store, query: makeQuery() });

  const [, opts] = store.append.mock.calls[0].arguments;
  assert.equal(opts.expectedVersion, 5);
});

test('unit: name validation runs before store.load', async () => {
  const store = makeStore();
  await assert.rejects(
    () => handleRenameTodoList({ listId: 'list-1', name: '' }, { store, query: makeQuery() }),
    { name: 'ValidationError' },
  );
  assert.equal(store.load.mock.calls.length, 0);
});
