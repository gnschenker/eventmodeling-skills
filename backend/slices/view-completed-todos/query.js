import { Router } from 'express';
import { pool as dbPool } from '../../store.js';

/**
 * Query the CompletedTodosProjection read-side table.
 *
 * @param {object} pool — pg Pool (injectable for testing)
 * @param {{ listId?: string }} opts
 * @returns {Promise<Array<{ todoId, listId, title, completedAt }>>}
 */
export async function getCompletedTodos(pool, { listId } = {}) {
  const params = [];
  let where = "WHERE status = 'completed'";
  if (listId) {
    where += ' AND list_id = $1';
    params.push(listId);
  }

  const sql = `
    SELECT todo_id, list_id, title, completed_at
      FROM completed_todos_projection
     ${where}
     ORDER BY completed_at DESC
  `;

  const client = await pool.connect();
  try {
    const { rows } = await client.query(sql, params);
    return rows.map((r) => ({
      todoId: r.todo_id,
      listId: r.list_id,
      title: r.title,
      completedAt: r.completed_at,
    }));
  } finally {
    client.release();
  }
}

const router = Router();

// GET /todos/completed?listId=...
// Response 200: { todos: Array<{ todoId, listId, title, completedAt }> }
router.get('/todos/completed', async (req, res) => {
  try {
    const todos = await getCompletedTodos(dbPool, { listId: req.query.listId });
    res.json({ todos });
  } catch (err) {
    console.error('GetCompletedTodos error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
