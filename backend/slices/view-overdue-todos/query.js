import { Router } from 'express';
import { pool as dbPool } from '../../store.js';

/**
 * Query the OverdueTodosProjection read-side table.
 *
 * @param {object} pool — pg Pool (injectable for testing)
 * @param {{ listId?: string }} opts
 * @returns {Promise<Array<{ todoId, listId, title, priority, dueDate }>>}
 */
export async function getOverdueTodos(pool, { listId } = {}) {
  const params = [];
  let where = "WHERE status = 'overdue'";
  if (listId) {
    where += ' AND list_id = $1';
    params.push(listId);
  }

  const sql = `
    SELECT todo_id, list_id, title, priority, due_date
      FROM overdue_todos_projection
     ${where}
     ORDER BY
       CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END ASC,
       due_date ASC NULLS LAST
  `;

  const client = await pool.connect();
  try {
    const { rows } = await client.query(sql, params);
    return rows.map((r) => ({
      todoId: r.todo_id,
      listId: r.list_id,
      title: r.title,
      priority: r.priority,
      dueDate: r.due_date,
    }));
  } finally {
    client.release();
  }
}

const router = Router();

// GET /todos/overdue?listId=...
// Response 200: { todos: Array<{ todoId, listId, title, priority, dueDate }> }
router.get('/todos/overdue', async (req, res) => {
  try {
    const todos = await getOverdueTodos(dbPool, { listId: req.query.listId });
    res.json({ todos });
  } catch (err) {
    console.error('GetOverdueTodos error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
