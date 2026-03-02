import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handleSetTodoDueDate } from './handler.js';

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

// A date guaranteed to be in the future (10 years out)
const futureDate = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);

// A date guaranteed to be in the past
const pastDate = '2000-01-01';

const baseCommand = { todoId: 'todo-1', dueDate: futureDate };

// ---------------------------------------------------------------------------
// Validation — unit tests
// ---------------------------------------------------------------------------

test('unit: rejects when dueDate is missing', async () => {
  const store = makeStore();
  await assert.rejects(
    () => handleSetTodoDueDate({ todoId: 'todo-1' }, { store, query: makeQuery() }),
    { name: 'ValidationError' },
  );
  assert.equal(store.load.mock.calls.length, 0);
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when dueDate is not a valid YYYY-MM-DD string', async () => {
  const store = makeStore();
  await assert.rejects(
    () => handleSetTodoDueDate({ todoId: 'todo-1', dueDate: 'not-a-date' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Due date must be a valid date (YYYY-MM-DD)' },
  );
  assert.equal(store.load.mock.calls.length, 0);
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when dueDate is in the past', async () => {
  const store = makeStore();
  await assert.rejects(
    () => handleSetTodoDueDate({ todoId: 'todo-1', dueDate: pastDate }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Due date must not be in the past' },
  );
  assert.equal(store.load.mock.calls.length, 0);
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when todo does not exist', async () => {
  const store = makeStore({ events: [], version: 0 });
  await assert.rejects(
    () => handleSetTodoDueDate(baseCommand, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Todo must exist and not be deleted' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when todo is deleted', async () => {
  const store = makeStore({ events: [todoCreated(), todoDeleted()], version: 2 });
  await assert.rejects(
    () => handleSetTodoDueDate(baseCommand, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Todo must exist and not be deleted' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

// ---------------------------------------------------------------------------
// Happy path — unit tests
// ---------------------------------------------------------------------------

test('unit: appends TodoDueDateSet event with correct fields', async () => {
  const store = makeStore({ events: [todoCreated()], version: 1 });

  const result = await handleSetTodoDueDate(baseCommand, { store, query: makeQuery() });

  assert.equal(result.todoId, 'todo-1');
  assert.equal(store.append.mock.calls.length, 1);

  const [event, opts] = store.append.mock.calls[0].arguments;
  assert.equal(event.type, 'TodoDueDateSet');
  assert.equal(event.payload.todoId, 'todo-1');
  assert.equal(event.payload.dueDate, futureDate);
  assert.ok(event.payload.setAt, 'setAt must be set');
  assert.equal(opts.expectedVersion, 1);
});

test('unit: setAt is a valid ISO 8601 datetime string', async () => {
  const store = makeStore({ events: [todoCreated()], version: 1 });

  await handleSetTodoDueDate(baseCommand, { store, query: makeQuery() });

  const [event] = store.append.mock.calls[0].arguments;
  const parsed = new Date(event.payload.setAt);
  assert.ok(!isNaN(parsed.getTime()), 'setAt must be a valid date');
});

test('unit: passes optimistic concurrency version to store.append', async () => {
  const store = makeStore({ events: [todoCreated()], version: 5 });

  await handleSetTodoDueDate(baseCommand, { store, query: makeQuery() });

  const [, opts] = store.append.mock.calls[0].arguments;
  assert.equal(opts.expectedVersion, 5);
});

test('unit: accepts today as a valid due date (not in the past)', async () => {
  const today = new Date().toISOString().slice(0, 10);
  const store = makeStore({ events: [todoCreated()], version: 1 });

  await handleSetTodoDueDate({ todoId: 'todo-1', dueDate: today }, { store, query: makeQuery() });

  assert.equal(store.append.mock.calls.length, 1);
  const [event] = store.append.mock.calls[0].arguments;
  assert.equal(event.payload.dueDate, today);
});
