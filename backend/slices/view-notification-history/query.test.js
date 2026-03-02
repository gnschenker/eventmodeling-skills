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

test('unit: TodoDueReminderSent inserts a notification row', async () => {
  const client = makeClient();
  await handleEvent(
    {
      type: 'TodoDueReminderSent',
      payload: {
        todoId: 't1',
        userId: 'u1',
        dueDate: '2026-04-01',
        sentAt: '2026-03-31T08:00:00.000Z',
      },
    },
    client,
  );
  assert.equal(client.query.mock.calls.length, 1);
  const [sql, params] = client.query.mock.calls[0].arguments;
  assert.match(sql, /INSERT INTO notification_history_projection/i);
  assert.deepEqual(params, ['t1', 'u1', '2026-04-01', '2026-03-31T08:00:00.000Z']);
});

test('unit: TodoDueReminderSent uses ON CONFLICT DO NOTHING (idempotent)', async () => {
  const client = makeClient();
  await handleEvent(
    {
      type: 'TodoDueReminderSent',
      payload: { todoId: 't1', userId: 'u1', dueDate: '2026-04-01', sentAt: '2026-03-31T08:00:00.000Z' },
    },
    client,
  );
  const [sql] = client.query.mock.calls[0].arguments;
  assert.match(sql, /ON CONFLICT.*DO NOTHING/i);
});

test('unit: duplicate TodoDueReminderSent for same todo+due-date does not insert twice', async () => {
  const client = makeClient();
  const event = {
    type: 'TodoDueReminderSent',
    payload: { todoId: 't1', userId: 'u1', dueDate: '2026-04-01', sentAt: '2026-03-31T08:00:00.000Z' },
  };
  await handleEvent(event, client);
  await handleEvent(event, client);
  // Both calls issued INSERT with ON CONFLICT — the DB deduplicates; the projection
  // itself issues the same SQL both times (idempotency is in the ON CONFLICT clause).
  assert.equal(client.query.mock.calls.length, 2);
  const [sql1] = client.query.mock.calls[0].arguments;
  const [sql2] = client.query.mock.calls[1].arguments;
  assert.match(sql1, /ON CONFLICT.*DO NOTHING/i);
  assert.match(sql2, /ON CONFLICT.*DO NOTHING/i);
});

test('unit: different due dates for same todo produce separate rows', async () => {
  const client = makeClient();
  await handleEvent(
    {
      type: 'TodoDueReminderSent',
      payload: { todoId: 't1', userId: 'u1', dueDate: '2026-04-01', sentAt: '2026-03-31T08:00:00.000Z' },
    },
    client,
  );
  await handleEvent(
    {
      type: 'TodoDueReminderSent',
      payload: { todoId: 't1', userId: 'u1', dueDate: '2026-05-01', sentAt: '2026-04-30T08:00:00.000Z' },
    },
    client,
  );
  assert.equal(client.query.mock.calls.length, 2);
  const params1 = client.query.mock.calls[0].arguments[1];
  const params2 = client.query.mock.calls[1].arguments[1];
  assert.equal(params1[2], '2026-04-01');
  assert.equal(params2[2], '2026-05-01');
});

test('unit: unknown event type issues no query (idempotent no-op)', async () => {
  const client = makeClient();
  await handleEvent({ type: 'SomethingElse', payload: {} }, client);
  assert.equal(client.query.mock.calls.length, 0);
});
