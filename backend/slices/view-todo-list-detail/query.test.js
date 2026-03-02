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

test('unit: TodoListCreated inserts a new active row', async () => {
  const client = makeClient();
  await handleEvent(
    {
      type: 'TodoListCreated',
      payload: { listId: 'l1', name: 'Work', createdAt: '2026-01-01T00:00:00.000Z' },
    },
    client,
  );
  assert.equal(client.query.mock.calls.length, 1);
  const [sql, params] = client.query.mock.calls[0].arguments;
  assert.match(sql, /INSERT INTO todo_list_detail_projection/i);
  assert.deepEqual(params, ['l1', 'Work', '2026-01-01T00:00:00.000Z']);
});

test('unit: TodoListCreated uses ON CONFLICT DO NOTHING (idempotent)', async () => {
  const client = makeClient();
  await handleEvent(
    {
      type: 'TodoListCreated',
      payload: { listId: 'l1', name: 'Work', createdAt: '2026-01-01T00:00:00.000Z' },
    },
    client,
  );
  const [sql] = client.query.mock.calls[0].arguments;
  assert.match(sql, /ON CONFLICT.*DO NOTHING/i);
});

test('unit: TodoListRenamed updates name', async () => {
  const client = makeClient();
  await handleEvent(
    { type: 'TodoListRenamed', payload: { listId: 'l1', name: 'Personal' } },
    client,
  );
  assert.equal(client.query.mock.calls.length, 1);
  const [sql, params] = client.query.mock.calls[0].arguments;
  assert.match(sql, /UPDATE todo_list_detail_projection SET name/i);
  assert.deepEqual(params, ['Personal', 'l1']);
});

test('unit: TodoListArchived sets status to archived', async () => {
  const client = makeClient();
  await handleEvent(
    { type: 'TodoListArchived', payload: { listId: 'l1' } },
    client,
  );
  assert.equal(client.query.mock.calls.length, 1);
  const [sql, params] = client.query.mock.calls[0].arguments;
  assert.match(sql, /UPDATE todo_list_detail_projection SET status/i);
  assert.match(sql, /archived/);
  assert.deepEqual(params, ['l1']);
});

test('unit: TodoListDeleted sets status to deleted (row kept for audit)', async () => {
  const client = makeClient();
  await handleEvent(
    { type: 'TodoListDeleted', payload: { listId: 'l1' } },
    client,
  );
  assert.equal(client.query.mock.calls.length, 1);
  const [sql, params] = client.query.mock.calls[0].arguments;
  assert.match(sql, /UPDATE todo_list_detail_projection SET status/i);
  assert.match(sql, /deleted/);
  assert.deepEqual(params, ['l1']);
});

test('unit: TodoListDeleted does NOT delete the row', async () => {
  const client = makeClient();
  await handleEvent(
    { type: 'TodoListDeleted', payload: { listId: 'l1' } },
    client,
  );
  const [sql] = client.query.mock.calls[0].arguments;
  assert.ok(!sql.toUpperCase().startsWith('DELETE'), 'must UPDATE, not DELETE');
});

test('unit: unknown event type issues no query (idempotent no-op)', async () => {
  const client = makeClient();
  await handleEvent({ type: 'SomethingElse', payload: {} }, client);
  assert.equal(client.query.mock.calls.length, 0);
});

test('unit: handling the same event twice issues two identical queries', async () => {
  const client = makeClient();
  const event = {
    type: 'TodoListCreated',
    payload: { listId: 'l2', name: 'Groceries', createdAt: '2026-02-01T00:00:00.000Z' },
  };
  await handleEvent(event, client);
  await handleEvent(event, client);
  assert.equal(client.query.mock.calls.length, 2);
});
