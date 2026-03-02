import { Router } from 'express';
import { pool as dbPool } from '../../store.js';

/**
 * Query the ActiveTodosProjection read-side table.
 *
 * @param {object} pool — pg Pool (injectable for testing)
 * @param {{ listId?: string }} opts
 * @returns {Promise<Array<{ todoId, listId, title, description, dueDate, priority, status, createdAt }>>}
 */
export async function getActiveTodos(pool, { listId } = {}) {
  const params = [['active', 'overdue']];
  let where = 'WHERE status = ANY($1::text[])';
  if (listId) {
    where += ' AND list_id = $2';
    params.push(listId);
  }

  const sql = `
    SELECT todo_id, list_id, title, description, due_date, priority, status, created_at
      FROM active_todos_projection
     ${where}
     ORDER BY
       CASE priority WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END ASC,
       due_date ASC NULLS LAST,
       created_at ASC
  `;

  const client = await pool.connect();
  try {
    const { rows } = await client.query(sql, params);
    return rows.map((r) => ({
      todoId: r.todo_id,
      listId: r.list_id,
      title: r.title,
      description: r.description,
      dueDate: r.due_date,
      priority: r.priority,
      status: r.status,
      createdAt: r.created_at,
    }));
  } finally {
    client.release();
  }
}

const router = Router();

// GET /todos/active?listId=...
// Response 200: { todos: Array<{ todoId, listId, title, description, dueDate, priority, status, createdAt }> }
router.get('/todos/active', async (req, res) => {
  try {
    const todos = await getActiveTodos(dbPool, { listId: req.query.listId });
    res.json({ todos });
  } catch (err) {
    console.error('GetActiveTodos error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
