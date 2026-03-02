import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handleCreateTodoList } from './handler.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStore() {
  return { append: mock.fn(async () => {}) };
}

// ---------------------------------------------------------------------------
// Validation — unit tests
// ---------------------------------------------------------------------------

test('unit: rejects when name is empty string', async () => {
  const store = makeStore();
  await assert.rejects(
    () => handleCreateTodoList({ listId: 'id-1', name: '' }, { store }),
    { name: 'ValidationError', message: 'Name must not be blank' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when name is whitespace only', async () => {
  const store = makeStore();
  await assert.rejects(
    () => handleCreateTodoList({ listId: 'id-1', name: '   ' }, { store }),
    { name: 'ValidationError' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: rejects when name is missing', async () => {
  const store = makeStore();
  await assert.rejects(
    () => handleCreateTodoList({ listId: 'id-1' }, { store }),
    { name: 'ValidationError' },
  );
  assert.equal(store.append.mock.calls.length, 0);
});

// ---------------------------------------------------------------------------
// Happy path — unit tests
// ---------------------------------------------------------------------------

test('unit: appends TodoListCreated event with trimmed name', async () => {
  const store = makeStore();

  const result = await handleCreateTodoList(
    { listId: 'list-abc', name: '  My Shopping List  ' },
    { store },
  );

  assert.equal(result.listId, 'list-abc');
  assert.equal(store.append.mock.calls.length, 1);

  const [event] = store.append.mock.calls[0].arguments;
  assert.equal(event.type, 'TodoListCreated');
  assert.equal(event.payload.listId, 'list-abc');
  assert.equal(event.payload.name, 'My Shopping List');
  assert.ok(event.payload.createdAt, 'createdAt must be set');
});

test('unit: returns the listId passed in the command', async () => {
  const store = makeStore();
  const result = await handleCreateTodoList({ listId: 'xyz-999', name: 'Work' }, { store });
  assert.equal(result.listId, 'xyz-999');
});

test('unit: createdAt is a valid ISO 8601 datetime string', async () => {
  const store = makeStore();
  await handleCreateTodoList({ listId: 'id-1', name: 'Groceries' }, { store });

  const [event] = store.append.mock.calls[0].arguments;
  const parsed = new Date(event.payload.createdAt);
  assert.ok(!isNaN(parsed.getTime()), 'createdAt must be a valid date');
});
