import { Router } from 'express';
import { randomUUID } from 'crypto';
import { query } from 'es-dcb-library';
import { store } from '../../store.js';
import { handleCreateTodo } from './handler.js';
import { ValidationError } from '../../errors.js';

const router = Router();

// POST /todo-lists/:listId/todos
// Body: { title: string, description?: string, dueDate?: string, priority?: string }
// Response 201: { todoId: string }
router.post('/todo-lists/:listId/todos', async (req, res) => {
  try {
    const todoId = randomUUID();
    const { title, description, dueDate, priority } = req.body;
    const result = await handleCreateTodo(
      { todoId, listId: req.params.listId, title, description, dueDate, priority },
      { store, query },
    );
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error('CreateTodo error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
