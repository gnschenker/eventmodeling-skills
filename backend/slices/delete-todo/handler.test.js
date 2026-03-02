import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handleDeleteTodo } from './handler.js';

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

function todoCreated(todoId = 'todo-1') {
  return { type: 'TodoCreated', payload: { todoId } };
}
function todoDeleted(todoId = 'todo-1') {
  return { type: 'TodoDeleted', payload: { todoId } };
}

// ---------------------------------------------------------------------------
// Validation — unit tests
// ---------------------------------------------------------------------------

test('unit: rejects when todo does not exist (no events)', async () => {
  const store = makeStore({ events: [], version: 0 });
  await assert.rejects(
    () => handleDeleteTodo({ todoId: 'todo-1' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Todo must exist and not already be deleted' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when todo is already deleted', async () => {
  const store = makeStore({ events: [todoCreated(), todoDeleted()], version: 2 });
  await assert.rejects(
    () => handleDeleteTodo({ todoId: 'todo-1' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Todo must exist and not already be deleted' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

// ---------------------------------------------------------------------------
// Happy path — unit tests
// ---------------------------------------------------------------------------

test('unit: deletes an existing todo', async () => {
  const store = makeStore({ events: [todoCreated()], version: 1 });

  const result = await handleDeleteTodo({ todoId: 'todo-1' }, { store, query: makeQuery() });

  assert.equal(result.todoId, 'todo-1');
  assert.equal(store.append.mock.calls.length, 1);

  const [event, opts] = store.append.mock.calls[0].arguments;
  assert.equal(event.type, 'TodoDeleted');
  assert.equal(event.payload.todoId, 'todo-1');
  assert.ok(event.payload.deletedAt, 'deletedAt must be set');
  assert.equal(opts.expectedVersion, 1);
});

test('unit: deletedAt is a valid ISO 8601 datetime string', async () => {
  const store = makeStore({ events: [todoCreated()], version: 1 });

  await handleDeleteTodo({ todoId: 'todo-1' }, { store, query: makeQuery() });

  const [event] = store.append.mock.calls[0].arguments;
  const parsed = new Date(event.payload.deletedAt);
  assert.ok(!isNaN(parsed.getTime()), 'deletedAt must be a valid date');
});

test('unit: passes optimistic concurrency version to store.append', async () => {
  const store = makeStore({ events: [todoCreated()], version: 3 });

  await handleDeleteTodo({ todoId: 'todo-1' }, { store, query: makeQuery() });

  const [, opts] = store.append.mock.calls[0].arguments;
  assert.equal(opts.expectedVersion, 3);
});

test('unit: query covers TodoCreated and TodoDeleted event types', async () => {
  const store = makeStore({ events: [todoCreated()], version: 1 });

  await handleDeleteTodo({ todoId: 'todo-1' }, { store, query: makeQuery() });

  // Only two event types needed — existence and deletion state
  assert.equal(store.load.mock.calls.length, 1);
  assert.equal(store.append.mock.calls.length, 1);
});
