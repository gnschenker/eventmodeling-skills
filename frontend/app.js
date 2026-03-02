// App entry point.
// Import slice Web Components as they are implemented.
import './slices/create-todo-list/create-todo-list.js';
import './slices/rename-todo-list/rename-todo-list.js';
import './slices/archive-todo-list/archive-todo-list.js';
import './slices/delete-todo-list/delete-todo-list.js';
import './slices/create-todo/create-todo.js';
import './slices/view-my-todo-lists/my-todo-lists.js';
import './slices/view-todo-list-detail/todo-list-detail.js';
import './slices/edit-todo/edit-todo.js';
import './slices/set-due-date-on-todo/set-due-date-on-todo.js';
import './slices/complete-todo/complete-todo.js';
import './slices/reopen-todo/reopen-todo.js';
import './slices/delete-todo/delete-todo.js';
import './slices/view-active-todos/active-todo-list.js';
import './slices/view-completed-todos/completed-todo-list.js';
import './slices/view-overdue-todos/overdue-todo-list.js';
import './slices/view-todo-detail/todo-detail.js';

// Simple hash-based router — each slice registers its own route.
const routes = {
  '#/create-todo-list': '<create-todo-list></create-todo-list>',
  '#/rename-todo-list': '<rename-todo-list list-id="demo-list-id"></rename-todo-list>',
  '#/archive-todo-list': '<archive-todo-list list-id="demo-list-id"></archive-todo-list>',
  '#/delete-todo-list': '<delete-todo-list list-id="demo-list-id"></delete-todo-list>',
  '#/create-todo': '<create-todo list-id="demo-list-id"></create-todo>',
  '#/view-my-todo-lists': '<my-todo-lists></my-todo-lists>',
  '#/view-todo-list-detail': '<todo-list-detail list-id="demo-list-id"></todo-list-detail>',
  '#/edit-todo': '<edit-todo todo-id="demo-todo-id"></edit-todo>',
  '#/set-due-date-on-todo': '<set-due-date-on-todo todo-id="demo-todo-id"></set-due-date-on-todo>',
  '#/complete-todo': '<complete-todo todo-id="demo-todo-id"></complete-todo>',
  '#/reopen-todo': '<reopen-todo todo-id="demo-todo-id"></reopen-todo>',
  '#/delete-todo': '<delete-todo todo-id="demo-todo-id"></delete-todo>',
  '#/view-active-todos': '<active-todo-list list-id="demo-list-id"></active-todo-list>',
  '#/view-completed-todos': '<completed-todo-list list-id="demo-list-id"></completed-todo-list>',
  '#/view-overdue-todos': '<overdue-todo-list list-id="demo-list-id"></overdue-todo-list>',
  '#/view-todo-detail': '<todo-detail todo-id="demo-todo-id"></todo-detail>',
};

function render() {
  const hash = location.hash || '#/';
  const app = document.getElementById('app');
  const template = routes[hash];

  if (template) {
    app.innerHTML = template;
  } else {
    app.innerHTML = '<p>Todo List App — scaffolding ready.</p>';
  }
}

window.addEventListener('hashchange', render);
render();
