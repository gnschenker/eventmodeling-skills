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

function makeStore({ events = [], version = 0 } = {}) {
  return {
    load: mock.fn(async () => ({ events, version })),
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
function todoDeleted(todoId, listId = 'list-1') {
  return { type: 'TodoDeleted', payload: { todoId, listId } };
}

// ---------------------------------------------------------------------------
// Validation — unit tests
// ---------------------------------------------------------------------------

test('unit: rejects when todo list does not exist', async () => {
  const store = makeStore({ events: [], version: 0 });
  await assert.rejects(
    () => handleDeleteTodoList({ listId: 'list-1' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Todo list must exist and not already be deleted' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when todo list is already deleted', async () => {
  const store = makeStore({ events: [listCreated(), listDeleted()], version: 2 });
  await assert.rejects(
    () => handleDeleteTodoList({ listId: 'list-1' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Todo list must exist and not already be deleted' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when list has active todos', async () => {
  const store = makeStore({
    events: [listCreated(), todoCreated('todo-a'), todoCreated('todo-b')],
    version: 3,
  });
  await assert.rejects(
    () => handleDeleteTodoList({ listId: 'list-1' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Todo list must be empty (no todos in any status)' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when list has partially deleted todos', async () => {
  // one todo deleted, one still active
  const store = makeStore({
    events: [listCreated(), todoCreated('todo-a'), todoCreated('todo-b'), todoDeleted('todo-a')],
    version: 4,
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

test('unit: appends TodoListDeleted for an empty list', async () => {
  const store = makeStore({ events: [listCreated('list-abc')], version: 1 });

  const result = await handleDeleteTodoList(
    { listId: 'list-abc' },
    { store, query: makeQuery() },
  );

  assert.equal(result.listId, 'list-abc');
  assert.equal(store.append.mock.calls.length, 1);

  const [event, opts] = store.append.mock.calls[0].arguments;
  assert.equal(event.type, 'TodoListDeleted');
  assert.equal(event.payload.listId, 'list-abc');
  assert.ok(event.payload.deletedAt, 'deletedAt must be set');
  assert.equal(opts.expectedVersion, 1);
});

test('unit: allows deletion when all todos have been deleted', async () => {
  const events = [
    listCreated(),
    todoCreated('todo-a'),
    todoCreated('todo-b'),
    todoDeleted('todo-a'),
    todoDeleted('todo-b'),
  ];
  const store = makeStore({ events, version: 5 });
  const result = await handleDeleteTodoList({ listId: 'list-1' }, { store, query: makeQuery() });
  assert.equal(result.listId, 'list-1');
  assert.equal(store.append.mock.calls.length, 1);
});

test('unit: deletedAt is a valid ISO 8601 datetime string', async () => {
  const store = makeStore({ events: [listCreated()], version: 1 });
  await handleDeleteTodoList({ listId: 'list-1' }, { store, query: makeQuery() });

  const [event] = store.append.mock.calls[0].arguments;
  const parsed = new Date(event.payload.deletedAt);
  assert.ok(!isNaN(parsed.getTime()), 'deletedAt must be a valid date');
});

test('unit: passes optimistic concurrency version to store.append', async () => {
  const store = makeStore({ events: [listCreated()], version: 7 });
  await handleDeleteTodoList({ listId: 'list-1' }, { store, query: makeQuery() });

  const [, opts] = store.append.mock.calls[0].arguments;
  assert.equal(opts.expectedVersion, 7);
});
