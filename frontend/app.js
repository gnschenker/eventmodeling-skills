// App entry point.
//
// As slices are implemented, import their Web Components here:
//   import './slices/create-todo-list/create-todo-list.js';
//
// Simple hash-based router — each slice registers its own route.

const routes = {
  // '#/todo-lists': '<todo-lists-screen></todo-lists-screen>',
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
