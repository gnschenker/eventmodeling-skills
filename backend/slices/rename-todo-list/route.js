import { Router } from 'express';
import { query } from 'es-dcb-library';
import { store } from '../../store.js';
import { handleRenameTodoList } from './handler.js';
import { ValidationError } from '../../errors.js';

const router = Router();

// PATCH /todo-lists/:listId/name
// Body: { name: string }
// Response 200: { listId: string }
router.patch('/todo-lists/:listId/name', async (req, res) => {
  try {
    const result = await handleRenameTodoList(
      { listId: req.params.listId, name: req.body.name },
      { store, query },
    );
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error('RenameTodoList error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
