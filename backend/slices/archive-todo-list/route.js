import { Router } from 'express';
import { query } from 'es-dcb-library';
import { store } from '../../store.js';
import { handleArchiveTodoList } from './handler.js';
import { ValidationError } from '../../errors.js';

const router = Router();

// POST /todo-lists/:listId/archive
// Body: (empty)
// Response 200: { listId: string }
router.post('/todo-lists/:listId/archive', async (req, res) => {
  try {
    const result = await handleArchiveTodoList(
      { listId: req.params.listId },
      { store, query },
    );
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error('ArchiveTodoList error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
