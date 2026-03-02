import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { runOverdueDetectionJob } from './job.js';

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
  const self = {
    eventsOfType: () => self,
    where: null,
    and: null,
  };
  const keyBuilder = { equals: () => self };
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

test('unit: marks an active overdue todo', async () => {
  const pool = makePool([{ todo_id: 't1' }]);
  const store = makeStore([
    { type: 'TodoCreated', payload: { todoId: 't1' } },
  ], 1);
  const query = makeQuery();

  await runOverdueDetectionJob({ pool, store, query });

  assert.equal(store.append.mock.calls.length, 1);
  const [event] = store.append.mock.calls[0].arguments;
  assert.equal(event.type, 'TodoMarkedOverdue');
  assert.equal(event.payload.todoId, 't1');
  assert.ok(event.payload.markedOverdueAt, 'markedOverdueAt must be present');
});

test('unit: skips a todo that is already overdue (TodoMarkedOverdue in events)', async () => {
  const pool = makePool([{ todo_id: 't1' }]);
  const store = makeStore([
    { type: 'TodoCreated', payload: { todoId: 't1' } },
    { type: 'TodoMarkedOverdue', payload: { todoId: 't1' } },
  ], 2);
  const query = makeQuery();

  await runOverdueDetectionJob({ pool, store, query });

  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: skips a todo that has been completed', async () => {
  const pool = makePool([{ todo_id: 't1' }]);
  const store = makeStore([
    { type: 'TodoCreated', payload: { todoId: 't1' } },
    { type: 'TodoCompleted', payload: { todoId: 't1' } },
  ], 2);
  const query = makeQuery();

  await runOverdueDetectionJob({ pool, store, query });

  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: skips a deleted todo', async () => {
  const pool = makePool([{ todo_id: 't1' }]);
  const store = makeStore([
    { type: 'TodoCreated', payload: { todoId: 't1' } },
    { type: 'TodoDeleted', payload: { todoId: 't1' } },
  ], 2);
  const query = makeQuery();

  await runOverdueDetectionJob({ pool, store, query });

  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: marks multiple eligible todos', async () => {
  const pool = makePool([{ todo_id: 't1' }, { todo_id: 't2' }]);
  const store = makeStore([
    { type: 'TodoCreated', payload: {} },
  ], 1);
  const query = makeQuery();

  await runOverdueDetectionJob({ pool, store, query });

  assert.equal(store.append.mock.calls.length, 2);
});

test('unit: does nothing when no overdue todos found', async () => {
  const pool = makePool([]);
  const store = makeStore([], 0);
  const query = makeQuery();

  await runOverdueDetectionJob({ pool, store, query });

  assert.equal(store.append.mock.calls.length, 0);
});

test('unit: swallows ConcurrencyError and continues processing other todos', async () => {
  const pool = makePool([{ todo_id: 't1' }, { todo_id: 't2' }]);
  const store = {
    load: mock.fn(async () => ({
      events: [{ type: 'TodoCreated', payload: {} }],
      version: 1,
    })),
    append: mock.fn(async () => {
      if (store.append.mock.calls.length === 1) {
        const err = new Error('conflict');
        err.name = 'ConcurrencyError';
        throw err;
      }
    }),
  };
  const query = makeQuery();

  await runOverdueDetectionJob({ pool, store, query });

  // Both todos attempted; first threw ConcurrencyError (swallowed), second succeeded
  assert.equal(store.append.mock.calls.length, 2);
});

test('unit: TodoMarkedOverdue payload contains markedOverdueAt ISO timestamp', async () => {
  const pool = makePool([{ todo_id: 't1' }]);
  const store = makeStore([{ type: 'TodoCreated', payload: { todoId: 't1' } }], 1);
  const query = makeQuery();

  await runOverdueDetectionJob({ pool, store, query });

  const [event] = store.append.mock.calls[0].arguments;
  assert.match(event.payload.markedOverdueAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('unit: reopened todo (active after overdue) is correctly re-marked overdue', async () => {
  // Sequence: created → marked overdue → completed → reopened → still overdue
  // The DCB query includes TodoReopened so the fold correctly shows status='active'
  // after the reopen, and the job re-marks it overdue.
  const pool = makePool([{ todo_id: 't1' }]);
  const store = makeStore([
    { type: 'TodoCreated', payload: { todoId: 't1' } },
    { type: 'TodoMarkedOverdue', payload: { todoId: 't1' } },
    { type: 'TodoCompleted', payload: { todoId: 't1' } },
    { type: 'TodoReopened', payload: { todoId: 't1' } },
  ], 4);
  const query = makeQuery();

  await runOverdueDetectionJob({ pool, store, query });

  // Fold: created→active, markedOverdue→overdue, completed→completed, reopened→active
  // Final status = 'active' → job appends TodoMarkedOverdue
  assert.equal(store.append.mock.calls.length, 1);
  const [event] = store.append.mock.calls[0].arguments;
  assert.equal(event.type, 'TodoMarkedOverdue');
});
