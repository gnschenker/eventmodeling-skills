import { Router } from 'express';
import { query } from 'es-dcb-library';
import { store } from '../../store.js';
import { handleReopenTodo } from './handler.js';
import { ValidationError } from '../../errors.js';

const router = Router();

// POST /todos/:todoId/reopen
// Response 200: { todoId: string }
router.post('/todos/:todoId/reopen', async (req, res) => {
  try {
    const result = await handleReopenTodo(
      { todoId: req.params.todoId },
      { store, query },
    );
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error('ReopenTodo error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
