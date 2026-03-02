import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handleEditTodo } from './handler.js';

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

const baseCommand = {
  todoId: 'todo-1',
  title: 'Buy milk',
  description: 'Whole milk from the corner shop',
  priority: 'Medium',
};

// ---------------------------------------------------------------------------
// Validation — unit tests
// ---------------------------------------------------------------------------

test('unit: rejects when title is empty string', async () => {
  const store = makeStore();
  await assert.rejects(
    () => handleEditTodo({ ...baseCommand, title: '' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Title must not be blank' },
  );
  assert.equal(store.load.mock.calls.length, 0);
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when title is whitespace only', async () => {
  const store = makeStore();
  await assert.rejects(
    () => handleEditTodo({ ...baseCommand, title: '   ' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Title must not be blank' },
  );
  assert.equal(store.load.mock.calls.length, 0);
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when title is missing', async () => {
  const store = makeStore();
  const { title: _t, ...commandWithoutTitle } = baseCommand;
  await assert.rejects(
    () => handleEditTodo(commandWithoutTitle, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Title must not be blank' },
  );
  assert.equal(store.load.mock.calls.length, 0);
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when priority is invalid', async () => {
  const store = makeStore();
  await assert.rejects(
    () => handleEditTodo({ ...baseCommand, priority: 'Critical' }, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Priority must be one of: Low, Medium, High' },
  );
  assert.equal(store.load.mock.calls.length, 0);
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when priority is missing', async () => {
  const store = makeStore();
  const { priority: _p, ...commandWithoutPriority } = baseCommand;
  await assert.rejects(
    () => handleEditTodo(commandWithoutPriority, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Priority must be one of: Low, Medium, High' },
  );
  assert.equal(store.load.mock.calls.length, 0);
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when todo does not exist', async () => {
  const store = makeStore({ events: [], version: 0 });
  await assert.rejects(
    () => handleEditTodo(baseCommand, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Todo must exist and not be deleted' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when todo is deleted', async () => {
  const store = makeStore({ events: [todoCreated(), todoDeleted()], version: 2 });
  await assert.rejects(
    () => handleEditTodo(baseCommand, { store, query: makeQuery() }),
    { name: 'ValidationError', message: 'Todo must exist and not be deleted' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

// ---------------------------------------------------------------------------
// Happy path — unit tests
// ---------------------------------------------------------------------------

test('unit: appends TodoEdited event with correct fields', async () => {
  const store = makeStore({ events: [todoCreated()], version: 1 });

  const result = await handleEditTodo(
    { ...baseCommand, priority: 'High' },
    { store, query: makeQuery() },
  );

  assert.equal(result.todoId, 'todo-1');
  assert.equal(store.append.mock.calls.length, 1);

  const [event, opts] = store.append.mock.calls[0].arguments;
  assert.equal(event.type, 'TodoEdited');
  assert.equal(event.payload.todoId, 'todo-1');
  assert.equal(event.payload.title, 'Buy milk');
  assert.equal(event.payload.description, 'Whole milk from the corner shop');
  assert.equal(event.payload.priority, 'High');
  assert.ok(event.payload.editedAt, 'editedAt must be set');
  assert.equal(opts.expectedVersion, 1);
});

test('unit: trims title before storing', async () => {
  const store = makeStore({ events: [todoCreated()], version: 1 });

  await handleEditTodo({ ...baseCommand, title: '  Buy milk  ' }, { store, query: makeQuery() });

  const [event] = store.append.mock.calls[0].arguments;
  assert.equal(event.payload.title, 'Buy milk');
});

test('unit: defaults description to empty string when omitted', async () => {
  const store = makeStore({ events: [todoCreated()], version: 1 });
  const { description: _d, ...commandWithoutDescription } = baseCommand;

  await handleEditTodo(commandWithoutDescription, { store, query: makeQuery() });

  const [event] = store.append.mock.calls[0].arguments;
  assert.equal(event.payload.description, '');
});

test('unit: editedAt is a valid ISO 8601 datetime string', async () => {
  const store = makeStore({ events: [todoCreated()], version: 1 });

  await handleEditTodo(baseCommand, { store, query: makeQuery() });

  const [event] = store.append.mock.calls[0].arguments;
  const parsed = new Date(event.payload.editedAt);
  assert.ok(!isNaN(parsed.getTime()), 'editedAt must be a valid date');
});

test('unit: passes optimistic concurrency version to store.append', async () => {
  const store = makeStore({ events: [todoCreated()], version: 7 });

  await handleEditTodo(baseCommand, { store, query: makeQuery() });

  const [, opts] = store.append.mock.calls[0].arguments;
  assert.equal(opts.expectedVersion, 7);
});

test('unit: accepts all three valid priority values', async () => {
  for (const priority of ['Low', 'Medium', 'High']) {
    const store = makeStore({ events: [todoCreated()], version: 1 });
    await handleEditTodo({ ...baseCommand, priority }, { store, query: makeQuery() });
    const [event] = store.append.mock.calls[0].arguments;
    assert.equal(event.payload.priority, priority);
  }
});
