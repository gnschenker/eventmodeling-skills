import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handleCreateTodo } from './handler.js';

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

const baseCommand = {
  todoId: 'todo-1',
  listId: 'list-1',
  title: 'Buy milk',
  description: 'Whole milk from the corner shop',
};

// ---------------------------------------------------------------------------
// Validation — unit tests
// ---------------------------------------------------------------------------

test('unit: rejects when title is empty string', async () => {
  const store = makeStore();
  await assert.rejects(
    () => handleCreateTodo({ ...baseCommand, title: '' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Title must not be blank' },
  );
  assert.equal(store.load.mock.calls.length, 0);
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when title is whitespace only', async () => {
  const store = makeStore();
  await assert.rejects(
    () => handleCreateTodo({ ...baseCommand, title: '   ' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Title must not be blank' },
  );
  assert.equal(store.load.mock.calls.length, 0);
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when title is missing', async () => {
  const store = makeStore();
  const { title: _t, ...commandWithoutTitle } = baseCommand;
  await assert.rejects(
    () => handleCreateTodo(commandWithoutTitle, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Title must not be blank' },
  );
  assert.equal(store.load.mock.calls.length, 0);
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when priority is invalid', async () => {
  const store = makeStore();
  await assert.rejects(
    () => handleCreateTodo({ ...baseCommand, priority: 'Critical' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Priority must be one of: Low, Medium, High' },
  );
  assert.equal(store.load.mock.calls.length, 0);
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when todo list does not exist', async () => {
  const store = makeStore({ events: [], version: 0 });
  await assert.rejects(
    () => handleCreateTodo(baseCommand, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Referenced todo list must exist and not be deleted' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when todo list is deleted', async () => {
  const store = makeStore({ events: [listCreated(), listDeleted()], version: 2 });
  await assert.rejects(
    () => handleCreateTodo(baseCommand, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Referenced todo list must exist and not be deleted' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

// ---------------------------------------------------------------------------
// Happy path — unit tests
// ---------------------------------------------------------------------------

test('unit: appends TodoCreated event with correct fields', async () => {
  const store = makeStore({ events: [listCreated()], version: 1 });

  const result = await handleCreateTodo(
    { ...baseCommand, priority: 'High' },
    { store, query: makeQuery() },
  );

  assert.equal(result.todoId, 'todo-1');
  assert.equal(store.append.mock.calls.length, 1);

  const [event, opts] = store.append.mock.calls[0].arguments;
  assert.equal(event.type, 'TodoCreated');
  assert.equal(event.payload.todoId, 'todo-1');
  assert.equal(event.payload.listId, 'list-1');
  assert.equal(event.payload.title, 'Buy milk');
  assert.equal(event.payload.description, 'Whole milk from the corner shop');
  assert.equal(event.payload.priority, 'High');
  assert.ok(event.payload.createdAt, 'createdAt must be set');
  assert.equal(opts.expectedVersion, 1);
});

test('unit: defaults priority to Medium when omitted', async () => {
  const store = makeStore({ events: [listCreated()], version: 1 });
  const { priority: _p, ...commandWithoutPriority } = baseCommand;

  await handleCreateTodo(commandWithoutPriority, { store, query: makeQuery() });

  const [event] = store.append.mock.calls[0].arguments;
  assert.equal(event.payload.priority, 'Medium');
});

test('unit: defaults priority to Medium when empty string', async () => {
  const store = makeStore({ events: [listCreated()], version: 1 });

  await handleCreateTodo({ ...baseCommand, priority: '' }, { store, query: makeQuery() });

  const [event] = store.append.mock.calls[0].arguments;
  assert.equal(event.payload.priority, 'Medium');
});

test('unit: trims title before storing', async () => {
  const store = makeStore({ events: [listCreated()], version: 1 });

  await handleCreateTodo({ ...baseCommand, title: '  Buy milk  ' }, { store, query: makeQuery() });

  const [event] = store.append.mock.calls[0].arguments;
  assert.equal(event.payload.title, 'Buy milk');
});

test('unit: stores null dueDate when omitted', async () => {
  const store = makeStore({ events: [listCreated()], version: 1 });
  const { dueDate: _d, ...commandWithoutDueDate } = baseCommand;

  await handleCreateTodo(commandWithoutDueDate, { store, query: makeQuery() });

  const [event] = store.append.mock.calls[0].arguments;
  assert.equal(event.payload.dueDate, null);
});

test('unit: stores provided dueDate', async () => {
  const store = makeStore({ events: [listCreated()], version: 1 });

  await handleCreateTodo({ ...baseCommand, dueDate: '2026-04-01' }, { store, query: makeQuery() });

  const [event] = store.append.mock.calls[0].arguments;
  assert.equal(event.payload.dueDate, '2026-04-01');
});

test('unit: createdAt is a valid ISO 8601 datetime string', async () => {
  const store = makeStore({ events: [listCreated()], version: 1 });

  await handleCreateTodo(baseCommand, { store, query: makeQuery() });

  const [event] = store.append.mock.calls[0].arguments;
  const parsed = new Date(event.payload.createdAt);
  assert.ok(!isNaN(parsed.getTime()), 'createdAt must be a valid date');
});

test('unit: passes optimistic concurrency version to store.append', async () => {
  const store = makeStore({ events: [listCreated()], version: 5 });

  await handleCreateTodo(baseCommand, { store, query: makeQuery() });

  const [, opts] = store.append.mock.calls[0].arguments;
  assert.equal(opts.expectedVersion, 5);
});

test('unit: accepts all three valid priority values', async () => {
  for (const priority of ['Low', 'Medium', 'High']) {
    const store = makeStore({ events: [listCreated()], version: 1 });
    await handleCreateTodo({ ...baseCommand, priority }, { store, query: makeQuery() });
    const [event] = store.append.mock.calls[0].arguments;
    assert.equal(event.payload.priority, priority);
  }
});
