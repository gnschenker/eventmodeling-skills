/**
 * es-dcb-library — local stub
 *
 * Implements the aggregateless DCB event-sourcing API used by the Todo List App.
 * This stub replaces the (non-existent on npm) es-dcb-library package so that
 * the Docker build succeeds.
 *
 * API surface:
 *   import { PostgresEventStore, query } from 'es-dcb-library';
 *
 * PostgresEventStore:
 *   const store = new PostgresEventStore({ pool });
 *   await store.initializeSchema();
 *   const { events, version } = await store.load(q);
 *   await store.append(event, { query: q, expectedVersion: version });  // opts optional
 *
 * query DSL (property getters, not method calls for .where / .and / .or):
 *   query.eventsOfType('TypeA').where.key('field').equals(value)
 *        .eventsOfType('TypeB').where.key('field').equals(value)
 */

// ---------------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------------

function buildQueryNode(type, field, value) {
  return { type, field, value };
}

class QueryBuilder {
  constructor(nodes = []) {
    this._nodes = nodes;
    this._pendingType = null;
    this._pendingField = null;
  }

  eventsOfType(type) {
    const next = new QueryBuilder([...this._nodes]);
    next._pendingType = type;
    return next;
  }

  // .where / .and / .or are property getters that return a key-selector proxy
  get where() { return this._keySelector(); }
  get and()   { return this._keySelector(); }
  get or()    { return this._keySelector(); }

  _keySelector() {
    const builder = this;
    return new Proxy({}, {
      get(_target, field) {
        return (f) => {
          // called as .key('fieldName') or .field('fieldName')
          const next = new QueryBuilder([...builder._nodes]);
          next._pendingType = builder._pendingType;
          next._pendingField = typeof f === 'string' ? f : field;
          return {
            equals(value) {
              const completed = new QueryBuilder([
                ...next._nodes,
                buildQueryNode(next._pendingType, next._pendingField, value),
              ]);
              // Allow further chaining
              return completed;
            },
          };
        };
      },
    });
  }

  // Internal: return the list of {type, field, value} matchers
  _matchers() {
    return this._nodes;
  }
}

// The `query` singleton is the entry point for building DCB queries.
export const query = new QueryBuilder();

// ---------------------------------------------------------------------------
// ConcurrencyError
// ---------------------------------------------------------------------------

export class ConcurrencyError extends Error {
  constructor(message = 'Concurrency conflict') {
    super(message);
    this.name = 'ConcurrencyError';
  }
}

// ---------------------------------------------------------------------------
// PostgresEventStore
// ---------------------------------------------------------------------------

export class PostgresEventStore {
  constructor({ pool }) {
    this._pool = pool;
  }

  async initializeSchema() {
    const client = await this._pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS events (
          seq      BIGSERIAL PRIMARY KEY,
          type     TEXT        NOT NULL,
          payload  JSONB       NOT NULL,
          appended_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS event_keys (
          seq    BIGINT REFERENCES events(seq) ON DELETE CASCADE,
          key    TEXT   NOT NULL,
          value  TEXT   NOT NULL,
          PRIMARY KEY (seq, key, value)
        );

        CREATE INDEX IF NOT EXISTS idx_event_keys_lookup ON event_keys (key, value);
      `);
    } finally {
      client.release();
    }
  }

  /**
   * Load events matching the DCB query.
   * Returns { events: Array<{seq, type, payload}>, version: number }
   * where version is the max seq seen (0 if no events found).
   */
  async load(q) {
    const matchers = q._matchers ? q._matchers() : [];

    if (matchers.length === 0) {
      return { events: [], version: 0 };
    }

    // Build: SELECT DISTINCT e.seq, e.type, e.payload
    //        FROM events e JOIN event_keys ek ON ek.seq = e.seq
    //        WHERE (e.type = $1 AND ek.key = $2 AND ek.value = $3)
    //           OR (e.type = $4 AND ek.key = $5 AND ek.value = $6) ...
    //        ORDER BY e.seq
    const conditions = [];
    const params = [];
    let pi = 1;

    for (const m of matchers) {
      conditions.push(`(e.type = $${pi++} AND ek.key = $${pi++} AND ek.value = $${pi++})`);
      params.push(m.type, m.field, String(m.value));
    }

    const sql = `
      SELECT DISTINCT e.seq, e.type, e.payload
      FROM events e
      JOIN event_keys ek ON ek.seq = e.seq
      WHERE ${conditions.join(' OR ')}
      ORDER BY e.seq
    `;

    const client = await this._pool.connect();
    try {
      const result = await client.query(sql, params);
      const events = result.rows.map((r) => ({ seq: r.seq, type: r.type, payload: r.payload }));
      const version = events.length > 0 ? Number(events[events.length - 1].seq) : 0;
      return { events, version };
    } finally {
      client.release();
    }
  }

  /**
   * Append a single event, optionally with optimistic concurrency.
   * opts: { query, expectedVersion }  — both optional
   */
  async append(event, opts = {}) {
    const client = await this._pool.connect();
    try {
      await client.query('BEGIN');

      // Optimistic concurrency check
      if (opts.query !== undefined && opts.expectedVersion !== undefined) {
        const { events: current } = await this._loadWithClient(client, opts.query);
        const currentVersion = current.length > 0
          ? Number(current[current.length - 1].seq)
          : 0;
        if (currentVersion !== opts.expectedVersion) {
          await client.query('ROLLBACK');
          throw new ConcurrencyError(
            `Expected version ${opts.expectedVersion} but found ${currentVersion}`,
          );
        }
      }

      // Insert event
      const insertEvent = await client.query(
        'INSERT INTO events (type, payload) VALUES ($1, $2) RETURNING seq',
        [event.type, JSON.stringify(event.payload)],
      );
      const seq = insertEvent.rows[0].seq;

      // Insert event_keys for all payload fields (primitive values only)
      const payload = event.payload ?? {};
      for (const [key, value] of Object.entries(payload)) {
        if (value !== null && value !== undefined && typeof value !== 'object') {
          await client.query(
            'INSERT INTO event_keys (seq, key, value) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [seq, key, String(value)],
          );
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async _loadWithClient(client, q) {
    const matchers = q._matchers ? q._matchers() : [];
    if (matchers.length === 0) return { events: [], version: 0 };

    const conditions = [];
    const params = [];
    let pi = 1;
    for (const m of matchers) {
      conditions.push(`(e.type = $${pi++} AND ek.key = $${pi++} AND ek.value = $${pi++})`);
      params.push(m.type, m.field, String(m.value));
    }

    const sql = `
      SELECT DISTINCT e.seq, e.type, e.payload
      FROM events e
      JOIN event_keys ek ON ek.seq = e.seq
      WHERE ${conditions.join(' OR ')}
      ORDER BY e.seq
    `;

    const result = await client.query(sql, params);
    const events = result.rows.map((r) => ({ seq: r.seq, type: r.type, payload: r.payload }));
    const version = events.length > 0 ? Number(events[events.length - 1].seq) : 0;
    return { events, version };
  }
}
