// App entry point.
// Import slice Web Components as they are implemented.
import './slices/create-todo-list/create-todo-list.js';
import './slices/rename-todo-list/rename-todo-list.js';

// Simple hash-based router — each slice registers its own route.
const routes = {
  '#/create-todo-list': '<create-todo-list></create-todo-list>',
  '#/rename-todo-list': '<rename-todo-list list-id="demo-list-id"></rename-todo-list>',
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
