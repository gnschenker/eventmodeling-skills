import { Router } from 'express';
import { query } from 'es-dcb-library';
import { store } from '../../store.js';
import { handleDeleteTodoList } from './handler.js';
import { ValidationError } from '../../errors.js';

const router = Router();

// DELETE /todo-lists/:listId
// Body: (empty)
// Response 200: { listId: string }
router.delete('/todo-lists/:listId', async (req, res) => {
  try {
    const result = await handleDeleteTodoList(
      { listId: req.params.listId },
      { store, query },
    );
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error('DeleteTodoList error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
