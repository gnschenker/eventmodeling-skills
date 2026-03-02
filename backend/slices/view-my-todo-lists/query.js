import { Router } from 'express';
import { pool as dbPool } from '../../store.js';

/**
 * Query the TodoListsProjection read-side table.
 *
 * @param {object} pool — pg Pool (injectable for testing)
 * @param {{ status?: string }} opts — optional status filter ('active' | 'archived')
 * @returns {Promise<Array<{ listId, name, status, createdAt }>>}
 */
export async function getMyTodoLists(pool, { status } = {}) {
  const params = [];
  let where = '';
  if (status === 'active' || status === 'archived') {
    where = ' WHERE status = $1';
    params.push(status);
  }
  const sql = `
    SELECT list_id, name, status, created_at
      FROM todo_lists_projection${where}
     ORDER BY created_at ASC
  `;

  const client = await pool.connect();
  try {
    const { rows } = await client.query(sql, params);
    return rows.map((r) => ({
      listId: r.list_id,
      name: r.name,
      status: r.status,
      createdAt: r.created_at,
    }));
  } finally {
    client.release();
  }
}

const router = Router();

// GET /todo-lists?status=active|archived
// Response 200: { lists: Array<{ listId, name, status, createdAt }> }
router.get('/todo-lists', async (req, res) => {
  try {
    const lists = await getMyTodoLists(dbPool, { status: req.query.status });
    res.json({ lists });
  } catch (err) {
    console.error('GetMyTodoLists error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
