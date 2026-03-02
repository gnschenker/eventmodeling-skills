// App entry point — router, modal system, and navigation event wiring.
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
import './slices/view-notification-history/notification-history.js';

// ── Router ────────────────────────────────────────────────────────────────────

/** Parse "#/route-name/id" → { route: 'route-name', id: 'id' | null } */
function parseHash(hash) {
  const clean = (hash || '').replace(/^#\//, '');
  const slash = clean.indexOf('/');
  if (slash === -1) return { route: clean, id: null };
  return { route: clean.slice(0, slash), id: clean.slice(slash + 1) };
}

/** View routes — replace #app content */
const VIEW_ROUTES = {
  'view-my-todo-lists': () => '<my-todo-lists></my-todo-lists>',
  'view-todo-list-detail': (id) => `<todo-list-detail list-id="${id}"></todo-list-detail>`,
  'view-active-todos': (id) =>
    id
      ? `<active-todo-list list-id="${id}"></active-todo-list>`
      : '<active-todo-list></active-todo-list>',
  'view-completed-todos': (id) =>
    id
      ? `<completed-todo-list list-id="${id}"></completed-todo-list>`
      : '<completed-todo-list></completed-todo-list>',
  'view-overdue-todos': (id) =>
    id
      ? `<overdue-todo-list list-id="${id}"></overdue-todo-list>`
      : '<overdue-todo-list></overdue-todo-list>',
  'view-todo-detail': (id) => `<todo-detail todo-id="${id}"></todo-detail>`,
  'view-notification-history': () => '<notification-history></notification-history>',
};

/** Action routes — open in modal (keep current #app content) */
const ACTION_ROUTES = {
  'create-todo-list': () => '<create-todo-list></create-todo-list>',
  'rename-todo-list': (id) => `<rename-todo-list list-id="${id}"></rename-todo-list>`,
  'archive-todo-list': (id) => `<archive-todo-list list-id="${id}"></archive-todo-list>`,
  'delete-todo-list': (id) => `<delete-todo-list list-id="${id}"></delete-todo-list>`,
  'create-todo': (id) => `<create-todo list-id="${id}"></create-todo>`,
  'edit-todo': (id) => `<edit-todo todo-id="${id}"></edit-todo>`,
  'set-due-date-on-todo': (id) => `<set-due-date-on-todo todo-id="${id}"></set-due-date-on-todo>`,
  'complete-todo': (id) => `<complete-todo todo-id="${id}"></complete-todo>`,
  'reopen-todo': (id) => `<reopen-todo todo-id="${id}"></reopen-todo>`,
  'delete-todo': (id) => `<delete-todo todo-id="${id}"></delete-todo>`,
};

// ── Modal ─────────────────────────────────────────────────────────────────────

const modalEl = document.getElementById('modal');

function openModal(html) {
  modalEl.innerHTML = `<div class="modal-dialog">${html}</div>`;
  modalEl.hidden = false;
}

function closeModal() {
  modalEl.hidden = true;
  modalEl.innerHTML = '';
}

// Backdrop click closes modal
modalEl.addEventListener('click', (e) => {
  if (e.target === modalEl) history.back();
});

// Escape key closes modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modalEl.hidden) history.back();
});

// ── Render ────────────────────────────────────────────────────────────────────

const appEl = document.getElementById('app');

function render() {
  const hash = location.hash || '#/';

  // Redirect bare # or #/ to the lists screen
  if (hash === '#/' || hash === '#') {
    location.replace('#/view-my-todo-lists');
    return;
  }

  const { route, id } = parseHash(hash);

  const ROUTES_REQUIRING_ID = new Set([
    'view-todo-list-detail', 'view-todo-detail',
    'rename-todo-list', 'archive-todo-list', 'delete-todo-list',
    'create-todo', 'edit-todo', 'set-due-date-on-todo',
    'complete-todo', 'reopen-todo', 'delete-todo',
  ]);

  if (ROUTES_REQUIRING_ID.has(route) && !id) {
    location.replace('#/view-my-todo-lists');
    return;
  }

  if (VIEW_ROUTES[route]) {
    closeModal();
    appEl.innerHTML = VIEW_ROUTES[route](id);
    return;
  }

  if (ACTION_ROUTES[route]) {
    // If app is empty (e.g. direct page load to an action URL), render background
    if (!appEl.innerHTML.trim()) {
      appEl.innerHTML = VIEW_ROUTES['view-my-todo-lists']();
    }
    openModal(ACTION_ROUTES[route](id));
    return;
  }

  // Unknown route — fall back to my-todo-lists
  location.replace('#/view-my-todo-lists');
}

window.addEventListener('hashchange', render);
render();

// ── View refresh helper ───────────────────────────────────────────────────────

function refreshCurrentView() {
  // Wait for history.back() to settle AND for the 500ms projection poll to process
  // the new event before reloading the visible component.
  setTimeout(() => {
    const view = appEl.firstElementChild;
    if (view && typeof view._load === 'function') view._load();
  }, 600);
}

// ── Navigation event wiring ───────────────────────────────────────────────────

document.addEventListener('mtl-select', (e) => {
  location.hash = `#/view-todo-list-detail/${e.detail.listId}`;
});

document.addEventListener('atl-select', (e) => {
  location.hash = `#/view-todo-detail/${e.detail.todoId}`;
});

document.addEventListener('ctl-select', (e) => {
  location.hash = `#/view-todo-detail/${e.detail.todoId}`;
});

document.addEventListener('otl-select', (e) => {
  location.hash = `#/view-todo-detail/${e.detail.todoId}`;
});

document.addEventListener('ctl-created', (e) => {
  location.hash = `#/view-todo-list-detail/${e.detail.listId}`;
});

document.addEventListener('ct-created', () => {
  history.back();
  refreshCurrentView();
});

document.addEventListener('dtl-deleted', () => {
  location.hash = '#/view-my-todo-lists';
});

document.addEventListener('dt-deleted', () => {
  // Skip over the delete-todo modal entry in history to land on the list view
  history.go(-2);
  refreshCurrentView();
});

// All "success" events that just need to go back (refreshes previous view)
for (const ev of ['rtl-renamed', 'atl-archived', 'et-edited', 'sdd-set', 'ctd-completed', 'rt-reopened']) {
  document.addEventListener(ev, () => {
    history.back();
    refreshCurrentView();
  });
}

// All "cancel" events — close modal
for (const ev of [
  'ctl-cancel', 'rtl-cancel', 'atl-cancel', 'dtl-cancel',
  'ct-cancel', 'et-cancel', 'sdd-cancel', 'ctd-cancel', 'rt-cancel', 'dt-cancel',
]) {
  document.addEventListener(ev, () => history.back());
}
