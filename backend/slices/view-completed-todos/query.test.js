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
      payload: { todoId: 't1', listId: 'l1', title: 'Buy milk', createdAt: '2026-01-01T00:00:00.000Z' },
    },
    client,
  );
  assert.equal(client.query.mock.calls.length, 1);
  const [sql, params] = client.query.mock.calls[0].arguments;
  assert.match(sql, /INSERT INTO completed_todos_projection/i);
  assert.deepEqual(params, ['t1', 'l1', 'Buy milk']);
});

test('unit: TodoCreated uses ON CONFLICT DO NOTHING (idempotent)', async () => {
  const client = makeClient();
  await handleEvent(
    { type: 'TodoCreated', payload: { todoId: 't1', listId: 'l1', title: 'Buy milk' } },
    client,
  );
  const [sql] = client.query.mock.calls[0].arguments;
  assert.match(sql, /ON CONFLICT.*DO NOTHING/i);
});

test('unit: TodoCompleted sets status to completed and stores completedAt', async () => {
  const client = makeClient();
  await handleEvent(
    { type: 'TodoCompleted', payload: { todoId: 't1', completedAt: '2026-03-01T10:00:00.000Z' } },
    client,
  );
  assert.equal(client.query.mock.calls.length, 1);
  const [sql, params] = client.query.mock.calls[0].arguments;
  assert.match(sql, /UPDATE completed_todos_projection/i);
  assert.match(sql, /completed/);
  assert.deepEqual(params, ['t1', '2026-03-01T10:00:00.000Z']);
});

test('unit: TodoReopened sets status back to active and clears completedAt', async () => {
  const client = makeClient();
  await handleEvent(
    { type: 'TodoReopened', payload: { todoId: 't1' } },
    client,
  );
  assert.equal(client.query.mock.calls.length, 1);
  const [sql, params] = client.query.mock.calls[0].arguments;
  assert.match(sql, /UPDATE completed_todos_projection/i);
  assert.match(sql, /active/);
  assert.match(sql, /completed_at.*NULL/i);
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
  assert.match(sql, /DELETE FROM completed_todos_projection/i);
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
  assert.match(sql, /DELETE FROM completed_todos_projection/i);
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
  assert.match(sql, /DELETE FROM completed_todos_projection/i);
  assert.match(sql, /list_id/i);
  assert.deepEqual(params, ['l1']);
});

test('unit: unknown event type issues no query (idempotent no-op)', async () => {
  const client = makeClient();
  await handleEvent({ type: 'SomethingElse', payload: {} }, client);
  assert.equal(client.query.mock.calls.length, 0);
});
