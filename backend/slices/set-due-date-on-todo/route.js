import { Router } from 'express';
import { query } from 'es-dcb-library';
import { store } from '../../store.js';
import { handleSetTodoDueDate } from './handler.js';
import { ValidationError } from '../../errors.js';

const router = Router();

// PATCH /todos/:todoId/due-date
// Body: { dueDate: string }  — YYYY-MM-DD
// Response 200: { todoId: string }
router.patch('/todos/:todoId/due-date', async (req, res) => {
  try {
    const { dueDate } = req.body;
    const result = await handleSetTodoDueDate(
      { todoId: req.params.todoId, dueDate },
      { store, query },
    );
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error('SetTodoDueDate error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
