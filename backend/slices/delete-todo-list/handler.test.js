import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handleDeleteTodoList } from './handler.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/**
 * Build a store mock that handles two sequential store.load() calls.
 *
 * The handler does a two-pass load:
 *   Pass 1 — list lifecycle + TodoCreated events (returns pass1Events/pass1Version)
 *   Pass 2 — TodoDeleted events per todoId     (returns pass2Events, only called
 *             when there are todos from pass 1)
 *
 * If only one call is expected (no todos or error before pass 2), set pass2Events
 * to null (default) and the mock will throw if unexpectedly called a second time.
 */
function makeStore({
  pass1Events = [],
  pass1Version = 0,
  pass2Events = null,  // null = no second call expected
} = {}) {
  let callCount = 0;
  return {
    load: mock.fn(async () => {
      callCount += 1;
      if (callCount === 1) return { events: pass1Events, version: pass1Version };
      if (callCount === 2 && pass2Events !== null) return { events: pass2Events, version: 0 };
      throw new Error(`Unexpected store.load call #${callCount}`);
    }),
    append: mock.fn(async () => {}),
  };
}

function listCreated(listId = 'list-1') {
  return { type: 'TodoListCreated', payload: { listId } };
}
function listDeleted(listId = 'list-1') {
  return { type: 'TodoListDeleted', payload: { listId } };
}
function todoCreated(todoId, listId = 'list-1') {
  return { type: 'TodoCreated', payload: { todoId, listId } };
}
function todoDeleted(todoId) {
  // Per EM spec: TodoDeleted payload has only { todoId, deletedAt }, no listId
  return { type: 'TodoDeleted', payload: { todoId, deletedAt: new Date().toISOString() } };
}

// ---------------------------------------------------------------------------
// Validation — unit tests
// ---------------------------------------------------------------------------

test('unit: rejects when todo list does not exist', async () => {
  const store = makeStore({ pass1Events: [], pass1Version: 0 });
  await assert.rejects(
    () => handleDeleteTodoList({ listId: 'list-1' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Todo list must exist and not already be deleted' },
  );
  assert.equal(store.append.mock.calls.length, 0);
  // No pass 2 needed — error thrown after pass 1
  assert.equal(store.load.mock.calls.length, 1);
});

test('unit: rejects when todo list is already deleted', async () => {
  const store = makeStore({ pass1Events: [listCreated(), listDeleted()], pass1Version: 2 });
  await assert.rejects(
    () => handleDeleteTodoList({ listId: 'list-1' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Todo list must exist and not already be deleted' },
  );
  assert.equal(store.append.mock.calls.length, 0);
  assert.equal(store.load.mock.calls.length, 1);
});

test('unit: rejects when list has active todos (none deleted)', async () => {
  const store = makeStore({
    pass1Events: [listCreated(), todoCreated('todo-a'), todoCreated('todo-b')],
    pass1Version: 3,
    pass2Events: [], // TodoDeleted pass: no deletions
  });
  await assert.rejects(
    () => handleDeleteTodoList({ listId: 'list-1' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Todo list must be empty (no todos in any status)' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when list has partially deleted todos', async () => {
  const store = makeStore({
    pass1Events: [listCreated(), todoCreated('todo-a'), todoCreated('todo-b')],
    pass1Version: 3,
    pass2Events: [todoDeleted('todo-a')], // only one of two deleted
  });
  await assert.rejects(
    () => handleDeleteTodoList({ listId: 'list-1' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Todo list must be empty (no todos in any status)' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

// ---------------------------------------------------------------------------
// Happy path — unit tests
// ---------------------------------------------------------------------------

test('unit: appends TodoListDeleted for a list with no todos', async () => {
  // No todos created — pass 2 skipped entirely
  const store = makeStore({ pass1Events: [listCreated('list-abc')], pass1Version: 1 });

  const result = await handleDeleteTodoList(
    { listId: 'list-abc' },
    { store, query: makeQuery() },
  );

  assert.equal(result.listId, 'list-abc');
  assert.equal(store.append.mock.calls.length, 1);
  assert.equal(store.load.mock.calls.length, 1); // pass 2 not needed

  const [event, opts] = store.append.mock.calls[0].arguments;
  assert.equal(event.type, 'TodoListDeleted');
  assert.equal(event.payload.listId, 'list-abc');
  assert.ok(event.payload.deletedAt, 'deletedAt must be set');
  assert.equal(opts.expectedVersion, 1);
});

test('unit: allows deletion when all todos have been individually deleted', async () => {
  const store = makeStore({
    pass1Events: [listCreated(), todoCreated('todo-a'), todoCreated('todo-b')],
    pass1Version: 3,
    pass2Events: [todoDeleted('todo-a'), todoDeleted('todo-b')], // all deleted
  });
  const result = await handleDeleteTodoList({ listId: 'list-1' }, { store, query: makeQuery() });
  assert.equal(result.listId, 'list-1');
  assert.equal(store.append.mock.calls.length, 1);
  assert.equal(store.load.mock.calls.length, 2); // both passes executed
});

test('unit: deletedAt is a valid ISO 8601 datetime string', async () => {
  const store = makeStore({ pass1Events: [listCreated()], pass1Version: 1 });
  await handleDeleteTodoList({ listId: 'list-1' }, { store, query: makeQuery() });

  const [event] = store.append.mock.calls[0].arguments;
  const parsed = new Date(event.payload.deletedAt);
  assert.ok(!isNaN(parsed.getTime()), 'deletedAt must be a valid date');
});

test('unit: passes optimistic concurrency version (from pass 1) to store.append', async () => {
  const store = makeStore({ pass1Events: [listCreated()], pass1Version: 7 });
  await handleDeleteTodoList({ listId: 'list-1' }, { store, query: makeQuery() });

  const [, opts] = store.append.mock.calls[0].arguments;
  assert.equal(opts.expectedVersion, 7);
});
