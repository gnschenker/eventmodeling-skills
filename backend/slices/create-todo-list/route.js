import { Router } from 'express';
import { randomUUID } from 'crypto';
import { store } from '../../store.js';
import { handleCreateTodoList } from './handler.js';
import { ValidationError } from '../../errors.js';

const router = Router();

// POST /todo-lists
// Body: { name: string }
// Response 201: { listId: string }
router.post('/todo-lists', async (req, res) => {
  try {
    const listId = randomUUID();
    const result = await handleCreateTodoList({ listId, name: req.body.name }, { store });
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error('CreateTodoList error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
