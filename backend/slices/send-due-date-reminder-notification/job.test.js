import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { runDueDateReminderJob } from './job.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePool(rows = []) {
  const client = {
    query: mock.fn(async () => ({ rows })),
    release: mock.fn(),
  };
  return {
    connect: mock.fn(async () => client),
    _client: client,
  };
}

function makeQuery() {
  // Chainable stub that satisfies the DCB query DSL shape
  const self = {
    eventsOfType: () => self,
    where: null,
    and: null,
  };
  const keyBuilder = {
    equals: () => self,
  };
  const whereProxy = { key: () => keyBuilder };
  self.where = whereProxy;
  self.and = whereProxy;
  return self;
}

function makeStore(events = [], version = 0) {
  return {
    load: mock.fn(async () => ({ events, version })),
    append: mock.fn(async () => {}),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('unit: sends a reminder for an eligible todo', async () => {
  const pool = makePool([{ todo_id: 't1', due_date: '2026-03-03' }]);
  const store = makeStore([], 0);
  const query = makeQuery();

  await runDueDateReminderJob({ pool, store, query });

  assert.equal(store.append.mock.calls.length, 1);
  const [event] = store.append.mock.calls[0].arguments;
  assert.equal(event.type, 'TodoDueReminderSent');
  assert.equal(event.payload.todoId, 't1');
  assert.equal(event.payload.dueDate, '2026-03-03');
});

test('unit: skips if reminder already sent for same due date', async () => {
  const pool = makePool([{ todo_id: 't1', due_date: '2026-03-03' }]);
  const existingEvent = {
    type: 'TodoDueReminderSent',
    payload: { todoId: 't1', dueDate: '2026-03-03', sentAt: '2026-03-02T08:00:00.000Z' },
  };
  const store = makeStore([existingEvent], 1);
  const query = makeQuery();

  await runDueDateReminderJob({ pool, store, query });

  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: sends reminder again when due date changes (different dueDate)', async () => {
  const pool = makePool([{ todo_id: 't1', due_date: '2026-04-01' }]);
  // Previous reminder was for a different due date
  const existingEvent = {
    type: 'TodoDueReminderSent',
    payload: { todoId: 't1', dueDate: '2026-03-03', sentAt: '2026-03-02T08:00:00.000Z' },
  };
  const store = makeStore([existingEvent], 1);
  const query = makeQuery();

  await runDueDateReminderJob({ pool, store, query });

  assert.equal(store.append.mock.calls.length, 1);
  const [event] = store.append.mock.calls[0].arguments;
  assert.equal(event.payload.dueDate, '2026-04-01');
});

test('unit: sends reminders for multiple eligible todos', async () => {
  const pool = makePool([
    { todo_id: 't1', due_date: '2026-03-03' },
    { todo_id: 't2', due_date: '2026-03-03' },
  ]);
  const store = makeStore([], 0);
  const query = makeQuery();

  await runDueDateReminderJob({ pool, store, query });

  assert.equal(store.append.mock.calls.length, 2);
  const ids = store.append.mock.calls.map((c) => c.arguments[0].payload.todoId);
  assert.deepEqual(ids.sort(), ['t1', 't2']);
});

test('unit: does nothing when no todos are due within the window', async () => {
  const pool = makePool([]);
  const store = makeStore([], 0);
  const query = makeQuery();

  await runDueDateReminderJob({ pool, store, query });

  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: swallows ConcurrencyError and continues processing other todos', async () => {
  const pool = makePool([
    { todo_id: 't1', due_date: '2026-03-03' },
    { todo_id: 't2', due_date: '2026-03-03' },
  ]);
  let callCount = 0;
  const store = {
    load: mock.fn(async () => ({ events: [], version: 0 })),
    append: mock.fn(async () => {
      callCount++;
      if (callCount === 1) {
        const err = new Error('conflict');
        err.name = 'ConcurrencyError';
        throw err;
      }
    }),
  };
  const query = makeQuery();

  await runDueDateReminderJob({ pool, store, query });

  // t1 threw ConcurrencyError (swallowed), t2 succeeded
  assert.equal(store.append.mock.calls.length, 2);
});

test('unit: TodoDueReminderSent payload includes userId and sentAt', async () => {
  const pool = makePool([{ todo_id: 't1', due_date: '2026-03-03' }]);
  const store = makeStore([], 0);
  const query = makeQuery();

  await runDueDateReminderJob({ pool, store, query });

  const [event] = store.append.mock.calls[0].arguments;
  assert.ok(event.payload.userId, 'userId must be present');
  assert.ok(event.payload.sentAt, 'sentAt must be present');
  assert.match(event.payload.sentAt, /^\d{4}-\d{2}-\d{2}T/, 'sentAt must be ISO 8601');
});
