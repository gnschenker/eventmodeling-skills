import { Router } from 'express';
import { query } from 'es-dcb-library';
import { store } from '../../store.js';
import { handleEditTodo } from './handler.js';
import { ValidationError } from '../../errors.js';

const router = Router();

// PATCH /todos/:todoId
// Body: { title: string, description?: string, priority: string }
// Response 200: { todoId: string }
router.patch('/todos/:todoId', async (req, res) => {
  try {
    const { title, description, priority } = req.body;
    const result = await handleEditTodo(
      { todoId: req.params.todoId, title, description, priority },
      { store, query },
    );
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error('EditTodo error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
