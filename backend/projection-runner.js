/**
 * Polling-based projection runner for the Todo List App.
 *
 * Each projection module exports:
 *   NAME           — string, unique projection identifier (e.g. 'TodoListsProjection')
 *   SOURCE_EVENTS  — string[], event types to subscribe to
 *   initSchema(client) — creates the projection's read-side table (idempotent)
 *   handleEvent(event, client) — processes one event inside a transaction
 *
 * The runner:
 *   1. Creates a shared `projection_checkpoints` table (if it doesn't exist)
 *   2. Calls initSchema(client) to create the projection's own table
 *   3. Polls the events table every intervalMs ms for new events above the checkpoint
 *   4. Processes each event in its own transaction, advancing the checkpoint
 *
 * If handleEvent throws, the checkpoint is NOT advanced and the event is retried
 * on the next poll. This keeps the projection eventually consistent and idempotent.
 */
export async function initProjection(pool, projection, { intervalMs = 500 } = {}) {
  const { NAME, SOURCE_EVENTS, initSchema, handleEvent } = projection;

  // 1. Create checkpoints table + projection's own table
  const setupClient = await pool.connect();
  try {
    await setupClient.query(`
      CREATE TABLE IF NOT EXISTS projection_checkpoints (
        name     TEXT   PRIMARY KEY,
        last_seq BIGINT NOT NULL DEFAULT 0
      )
    `);
    await initSchema(setupClient);
  } finally {
    setupClient.release();
  }

  // 2. Start the polling loop
  async function poll() {
    // Read current checkpoint
    let checkpoint = 0;
    const ckClient = await pool.connect();
    try {
      const { rows } = await ckClient.query(
        'SELECT last_seq FROM projection_checkpoints WHERE name = $1',
        [NAME],
      );
      if (rows.length > 0) checkpoint = Number(rows[0].last_seq);
    } finally {
      ckClient.release();
    }

    // Fetch next batch of matching events (max 100 per poll)
    let events = [];
    const fetchClient = await pool.connect();
    try {
      const { rows } = await fetchClient.query(
        `SELECT seq, type, payload
           FROM events
          WHERE seq > $1 AND type = ANY($2::text[])
          ORDER BY seq
          LIMIT 100`,
        [checkpoint, SOURCE_EVENTS],
      );
      events = rows;
    } finally {
      fetchClient.release();
    }

    // Process each event in its own transaction
    for (const row of events) {
      const txClient = await pool.connect();
      try {
        await txClient.query('BEGIN');
        await handleEvent(
          { seq: Number(row.seq), type: row.type, payload: row.payload },
          txClient,
        );
        await txClient.query(
          `INSERT INTO projection_checkpoints (name, last_seq) VALUES ($1, $2)
             ON CONFLICT (name) DO UPDATE SET last_seq = EXCLUDED.last_seq`,
          [NAME, Number(row.seq)],
        );
        await txClient.query('COMMIT');
      } catch (err) {
        await txClient.query('ROLLBACK').catch(() => {});
        console.error(`[${NAME}] error processing seq=${row.seq}:`, err);
        break; // stop; retry from same checkpoint on next poll
      } finally {
        txClient.release();
      }
    }
  }

  // Poll immediately at startup (catch up any existing events), then repeat.
  async function loop() {
    try {
      await poll();
    } catch (err) {
      console.error(`[${NAME}] unexpected poll error:`, err);
    }
    setTimeout(loop, intervalMs);
  }

  loop();
}
