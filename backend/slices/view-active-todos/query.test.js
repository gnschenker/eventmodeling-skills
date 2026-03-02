import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { handleEvent } from './projection.js';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/** Mock pg client — captures query calls, returns no rows by default */
function makeClient() {
  return { query: mock.fn(async () => ({ rows: [] })) };
}

// ---------------------------------------------------------------------------
// Projection — unit tests
// ---------------------------------------------------------------------------

test('unit: TodoCreated inserts a new active row', async () => {
  const client = makeClient();
  await handleEvent(
    {
      type: 'TodoCreated',
      payload: {
        todoId: 't1',
        listId: 'l1',
        title: 'Buy milk',
        description: 'Whole milk',
        dueDate: '2026-12-31',
        priority: 'High',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    },
    client,
  );
  assert.equal(client.query.mock.calls.length, 1);
  const [sql, params] = client.query.mock.calls[0].arguments;
  assert.match(sql, /INSERT INTO active_todos_projection/i);
  assert.equal(params[0], 't1');
  assert.equal(params[1], 'l1');
  assert.equal(params[5], 'High');
});

test('unit: TodoCreated uses ON CONFLICT DO NOTHING (idempotent)', async () => {
  const client = makeClient();
  await handleEvent(
    {
      type: 'TodoCreated',
      payload: {
        todoId: 't1', listId: 'l1', title: 'Buy milk', description: '',
        dueDate: null, priority: 'Medium', createdAt: '2026-01-01T00:00:00.000Z',
      },
    },
    client,
  );
  const [sql] = client.query.mock.calls[0].arguments;
  assert.match(sql, /ON CONFLICT.*DO NOTHING/i);
});

test('unit: TodoCompleted sets status to completed', async () => {
  const client = makeClient();
  await handleEvent(
    { type: 'TodoCompleted', payload: { todoId: 't1' } },
    client,
  );
  assert.equal(client.query.mock.calls.length, 1);
  const [sql, params] = client.query.mock.calls[0].arguments;
  assert.match(sql, /UPDATE active_todos_projection SET status/i);
  assert.match(sql, /completed/);
  assert.deepEqual(params, ['t1']);
});

test('unit: TodoReopened sets status back to active', async () => {
  const client = makeClient();
  await handleEvent(
    { type: 'TodoReopened', payload: { todoId: 't1' } },
    client,
  );
  assert.equal(client.query.mock.calls.length, 1);
  const [sql, params] = client.query.mock.calls[0].arguments;
  assert.match(sql, /UPDATE active_todos_projection SET status/i);
  assert.match(sql, /active/);
  assert.deepEqual(params, ['t1']);
});

test('unit: TodoDeleted removes the row', async () => {
  const client = makeClient();
  await handleEvent(
    { type: 'TodoDeleted', payload: { todoId: 't1' } },
    client,
  );
  assert.equal(client.query.mock.calls.length, 1);
  const [sql, params] = client.query.mock.calls[0].arguments;
  assert.match(sql, /DELETE FROM active_todos_projection/i);
  assert.deepEqual(params, ['t1']);
});

test('unit: TodoMarkedOverdue sets status to overdue', async () => {
  const client = makeClient();
  await handleEvent(
    { type: 'TodoMarkedOverdue', payload: { todoId: 't1' } },
    client,
  );
  assert.equal(client.query.mock.calls.length, 1);
  const [sql, params] = client.query.mock.calls[0].arguments;
  assert.match(sql, /UPDATE active_todos_projection SET status/i);
  assert.match(sql, /overdue/);
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
  assert.match(sql, /DELETE FROM active_todos_projection/i);
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
  assert.match(sql, /DELETE FROM active_todos_projection/i);
  assert.match(sql, /list_id/i);
  assert.deepEqual(params, ['l1']);
});

test('unit: unknown event type issues no query (idempotent no-op)', async () => {
  const client = makeClient();
  await handleEvent({ type: 'SomethingElse', payload: {} }, client);
  assert.equal(client.query.mock.calls.length, 0);
});
