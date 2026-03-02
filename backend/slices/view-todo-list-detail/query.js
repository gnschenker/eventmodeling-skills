import { Router } from 'express';
import { pool as dbPool } from '../../store.js';

/**
 * Query the TodoListDetailProjection read-side table for a single list.
 *
 * @param {object} pool — pg Pool (injectable for testing)
 * @param {string} listId
 * @returns {Promise<{ listId, name, status, createdAt } | null>} null if not found
 */
export async function getTodoListDetail(pool, listId) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT list_id, name, status, created_at
         FROM todo_list_detail_projection
        WHERE list_id = $1`,
      [listId],
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      listId: r.list_id,
      name: r.name,
      status: r.status,
      createdAt: r.created_at,
    };
  } finally {
    client.release();
  }
}

const router = Router();

// GET /todo-lists/:listId
// Response 200: { listId, name, status, createdAt }
// Response 404: { error: '...' }  — list never existed or has been deleted
router.get('/todo-lists/:listId', async (req, res) => {
  try {
    const detail = await getTodoListDetail(dbPool, req.params.listId);
    if (!detail) {
      return res.status(404).json({ error: 'Todo list not found' });
    }
    res.json(detail);
  } catch (err) {
    console.error('GetTodoListDetail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
