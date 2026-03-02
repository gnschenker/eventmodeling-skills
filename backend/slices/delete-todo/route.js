import { Router } from 'express';
import { query } from 'es-dcb-library';
import { store } from '../../store.js';
import { handleDeleteTodo } from './handler.js';
import { ValidationError } from '../../errors.js';

const router = Router();

// DELETE /todos/:todoId
// Response 200: { todoId: string }
router.delete('/todos/:todoId', async (req, res) => {
  try {
    const result = await handleDeleteTodo(
      { todoId: req.params.todoId },
      { store, query },
    );
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error('DeleteTodo error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
