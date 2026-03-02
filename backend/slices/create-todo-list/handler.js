import { ValidationError } from '../../errors.js';

/**
 * Handle the CreateTodoList command.
 *
 * EM slice: Create Todo List (state_change)
 * Business rules:
 *   - Name must not be blank
 *
 * @param {{ listId: string, name: string }} command
 * @param {{ store: object }} deps
 * @returns {{ listId: string }}
 */
export async function handleCreateTodoList({ listId, name }, { store }) {
  if (!name || name.trim() === '') {
    throw new ValidationError('Name must not be blank');
  }

  await store.append({
    type: 'TodoListCreated',
    payload: {
      listId,
      name: name.trim(),
      createdAt: new Date().toISOString(),
    },
  });

  return { listId };
}
