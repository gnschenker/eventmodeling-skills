import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handleReopenTodo } from './handler.js';

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

const e = (type) => ({ type, payload: { todoId: 'todo-1' } });

// ---------------------------------------------------------------------------
// Validation — unit tests
// ---------------------------------------------------------------------------

test('unit: rejects when todo does not exist (no events)', async () => {
  const store = makeStore({ events: [], version: 0 });
  await assert.rejects(
    () => handleReopenTodo({ todoId: 'todo-1' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Todo must be in Completed status' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when todo is active', async () => {
  const store = makeStore({ events: [e('TodoCreated')], version: 1 });
  await assert.rejects(
    () => handleReopenTodo({ todoId: 'todo-1' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Todo must be in Completed status' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when todo is overdue', async () => {
  const store = makeStore({ events: [e('TodoCreated'), e('TodoMarkedOverdue')], version: 2 });
  await assert.rejects(
    () => handleReopenTodo({ todoId: 'todo-1' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Todo must be in Completed status' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when todo is deleted', async () => {
  const store = makeStore({ events: [e('TodoCreated'), e('TodoDeleted')], version: 2 });
  await assert.rejects(
    () => handleReopenTodo({ todoId: 'todo-1' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Todo must be in Completed status' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

// ---------------------------------------------------------------------------
// Happy path — unit tests
// ---------------------------------------------------------------------------

test('unit: reopens a completed todo', async () => {
  const store = makeStore({ events: [e('TodoCreated'), e('TodoCompleted')], version: 2 });

  const result = await handleReopenTodo({ todoId: 'todo-1' }, { store, query: makeQuery() });

  assert.equal(result.todoId, 'todo-1');
  assert.equal(store.append.mock.calls.length, 1);

  const [event, opts] = store.append.mock.calls[0].arguments;
  assert.equal(event.type, 'TodoReopened');
  assert.equal(event.payload.todoId, 'todo-1');
  assert.ok(event.payload.reopenedAt, 'reopenedAt must be set');
  assert.equal(opts.expectedVersion, 2);
});

test('unit: reopens a todo that was completed after being overdue', async () => {
  const store = makeStore({
    events: [e('TodoCreated'), e('TodoMarkedOverdue'), e('TodoCompleted')],
    version: 3,
  });

  await handleReopenTodo({ todoId: 'todo-1' }, { store, query: makeQuery() });

  const [event] = store.append.mock.calls[0].arguments;
  assert.equal(event.type, 'TodoReopened');
});

test('unit: reopenedAt is a valid ISO 8601 datetime string', async () => {
  const store = makeStore({ events: [e('TodoCreated'), e('TodoCompleted')], version: 2 });

  await handleReopenTodo({ todoId: 'todo-1' }, { store, query: makeQuery() });

  const [event] = store.append.mock.calls[0].arguments;
  const parsed = new Date(event.payload.reopenedAt);
  assert.ok(!isNaN(parsed.getTime()), 'reopenedAt must be a valid date');
});

test('unit: passes optimistic concurrency version to store.append', async () => {
  const store = makeStore({ events: [e('TodoCreated'), e('TodoCompleted')], version: 6 });

  await handleReopenTodo({ todoId: 'todo-1' }, { store, query: makeQuery() });

  const [, opts] = store.append.mock.calls[0].arguments;
  assert.equal(opts.expectedVersion, 6);
});
