import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handleEvent } from './projection.js';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeClient() {
  return { query: mock.fn(async () => ({ rows: [] })) };
}

// ---------------------------------------------------------------------------
// Projection — unit tests
// ---------------------------------------------------------------------------

test('unit: TodoCreated inserts a staging active row', async () => {
  const client = makeClient();
  await handleEvent(
    {
      type: 'TodoCreated',
      payload: {
        todoId: 't1', listId: 'l1', title: 'Buy milk',
        priority: 'High', dueDate: '2026-01-15', createdAt: '2026-01-01T00:00:00.000Z',
      },
    },
    client,
  );
  assert.equal(client.query.mock.calls.length, 1);
  const [sql, params] = client.query.mock.calls[0].arguments;
  assert.match(sql, /INSERT INTO overdue_todos_projection/i);
  assert.equal(params[0], 't1');
  assert.equal(params[1], 'l1');
  assert.equal(params[3], 'High');
  assert.equal(params[4], '2026-01-15');
});

test('unit: TodoCreated uses ON CONFLICT DO NOTHING (idempotent)', async () => {
  const client = makeClient();
  await handleEvent(
    { type: 'TodoCreated', payload: { todoId: 't1', listId: 'l1', title: 'Buy milk', priority: 'Medium', dueDate: null } },
    client,
  );
  const [sql] = client.query.mock.calls[0].arguments;
  assert.match(sql, /ON CONFLICT.*DO NOTHING/i);
});

test('unit: TodoDueDateSet updates due_date', async () => {
  const client = makeClient();
  await handleEvent(
    { type: 'TodoDueDateSet', payload: { todoId: 't1', dueDate: '2026-02-01' } },
    client,
  );
  assert.equal(client.query.mock.calls.length, 1);
  const [sql, params] = client.query.mock.calls[0].arguments;
  assert.match(sql, /UPDATE overdue_todos_projection SET due_date/i);
  assert.deepEqual(params, ['t1', '2026-02-01']);
});

test('unit: TodoMarkedOverdue sets status to overdue', async () => {
  const client = makeClient();
  await handleEvent(
    { type: 'TodoMarkedOverdue', payload: { todoId: 't1' } },
    client,
  );
  assert.equal(client.query.mock.calls.length, 1);
  const [sql, params] = client.query.mock.calls[0].arguments;
  assert.match(sql, /UPDATE overdue_todos_projection SET status/i);
  assert.match(sql, /overdue/);
  assert.deepEqual(params, ['t1']);
});

test('unit: TodoCompleted sets status to completed', async () => {
  const client = makeClient();
  await handleEvent(
    { type: 'TodoCompleted', payload: { todoId: 't1' } },
    client,
  );
  assert.equal(client.query.mock.calls.length, 1);
  const [sql, params] = client.query.mock.calls[0].arguments;
  assert.match(sql, /UPDATE overdue_todos_projection SET status/i);
  assert.match(sql, /completed/);
  assert.deepEqual(params, ['t1']);
});

test('unit: TodoEdited updates title and priority', async () => {
  const client = makeClient();
  await handleEvent(
    { type: 'TodoEdited', payload: { todoId: 't1', title: 'New title', priority: 'Low' } },
    client,
  );
  assert.equal(client.query.mock.calls.length, 1);
  const [sql, params] = client.query.mock.calls[0].arguments;
  assert.match(sql, /UPDATE overdue_todos_projection SET title/i);
  assert.deepEqual(params, ['t1', 'New title', 'Low']);
});

test('unit: TodoDeleted removes the row', async () => {
  const client = makeClient();
  await handleEvent(
    { type: 'TodoDeleted', payload: { todoId: 't1' } },
    client,
  );
  assert.equal(client.query.mock.calls.length, 1);
  const [sql, params] = client.query.mock.calls[0].arguments;
  assert.match(sql, /DELETE FROM overdue_todos_projection/i);
  assert.deepEqual(params, ['t1']);
});

test('unit: TodoListArchived removes all todos for that list', async () => {
  const client = makeClient();
  await handleEvent(
    { type: 'TodoListArchived', payload: { listId: 'l1' } },
    client,
  );
  assert.equal(client.query.mock.calls.length, 1);
  const [sql, params] = client.query.mock.calls[0].arguments;
  assert.match(sql, /DELETE FROM overdue_todos_projection/i);
  assert.match(sql, /list_id/i);
  assert.deepEqual(params, ['l1']);
});

test('unit: TodoListDeleted removes all todos for that list', async () => {
  const client = makeClient();
  await handleEvent(
    { type: 'TodoListDeleted', payload: { listId: 'l1' } },
    client,
  );
  assert.equal(client.query.mock.calls.length, 1);
  const [sql, params] = client.query.mock.calls[0].arguments;
  assert.match(sql, /DELETE FROM overdue_todos_projection/i);
  assert.match(sql, /list_id/i);
  assert.deepEqual(params, ['l1']);
});

test('unit: unknown event type issues no query (idempotent no-op)', async () => {
  const client = makeClient();
  await handleEvent({ type: 'SomethingElse', payload: {} }, client);
  assert.equal(client.query.mock.calls.length, 0);
});
