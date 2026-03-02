import { Router } from 'express';
import { pool as dbPool } from '../../store.js';

/**
 * Query the NotificationHistoryProjection read-side table.
 *
 * @param {object} pool — pg Pool (injectable for testing)
 * @param {object} [opts]
 * @param {string} [opts.todoId] — optional filter by todoId
 * @returns {Promise<Array<{ todoId, userId, dueDate, sentAt }>>}
 */
export async function getNotificationHistory(pool, { todoId } = {}) {
  const client = await pool.connect();
  try {
    let sql = `SELECT todo_id, user_id, due_date, sent_at
                 FROM notification_history_projection`;
    const params = [];
    if (todoId) {
      sql += ` WHERE todo_id = $1`;
      params.push(todoId);
    }
    sql += ` ORDER BY sent_at DESC`;

    const { rows } = await client.query(sql, params);
    return rows.map((r) => ({
      todoId: r.todo_id,
      userId: r.user_id,
      dueDate: r.due_date,
      sentAt: r.sent_at,
    }));
  } finally {
    client.release();
  }
}

const router = Router();

// GET /notifications?todoId=...  (todoId filter is optional)
// Response 200: [{ todoId, userId, dueDate, sentAt }, ...]  ordered by sentAt DESC
router.get('/notifications', async (req, res) => {
  try {
    const { todoId } = req.query;
    const items = await getNotificationHistory(dbPool, { todoId });
    res.json(items);
  } catch (err) {
    console.error('GetNotificationHistory error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
