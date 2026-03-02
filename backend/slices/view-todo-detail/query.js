import { Router } from 'express';
import { pool as dbPool } from '../../store.js';

/**
 * Query the TodoDetailProjection read-side table for a single todo.
 *
 * @param {object} pool — pg Pool (injectable for testing)
 * @param {string} todoId
 * @returns {Promise<{ todoId, listId, title, description, dueDate, priority, status, createdAt } | null>}
 */
export async function getTodoDetail(pool, todoId) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT todo_id, list_id, title, description, due_date, priority, status, created_at
         FROM todo_detail_projection
        WHERE todo_id = $1`,
      [todoId],
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      todoId: r.todo_id,
      listId: r.list_id,
      title: r.title,
      description: r.description,
      dueDate: r.due_date,
      priority: r.priority,
      status: r.status,
      createdAt: r.created_at,
    };
  } finally {
    client.release();
  }
}

const router = Router();

// GET /todos/:todoId
// Response 200: { todoId, listId, title, description, dueDate, priority, status, createdAt }
//              (status may be 'deleted' — row kept for audit)
// Response 404: { error: '...' }  — todo never existed in this system
router.get('/todos/:todoId', async (req, res) => {
  try {
    const detail = await getTodoDetail(dbPool, req.params.todoId);
    if (!detail) {
      return res.status(404).json({ error: 'Todo not found' });
    }
    res.json(detail);
  } catch (err) {
    console.error('GetTodoDetail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
