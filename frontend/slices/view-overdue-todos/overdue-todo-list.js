import { API_BASE } from '../../config.js';

const template = document.createElement('template');
template.innerHTML = `
  <link rel="stylesheet" href="/slices/view-overdue-todos/overdue-todo-list.css" />
  <div class="overdue-todo-list">
    <div class="header">
      <h2>Overdue Todos</h2>
      <button class="btn-refresh" title="Refresh">↻</button>
    </div>

    <div class="loading" hidden>Loading…</div>
    <div class="error" aria-live="polite"></div>

    <table class="todos-table" hidden>
      <thead>
        <tr>
          <th>Title</th>
          <th>Priority</th>
          <th>Due Date</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>

    <p class="empty-state" hidden>No overdue todos.</p>
  </div>
`;

class OverdueTodoList extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this._loading = this.shadowRoot.querySelector('.loading');
    this._error = this.shadowRoot.querySelector('.error');
    this._table = this.shadowRoot.querySelector('.todos-table');
    this._tbody = this.shadowRoot.querySelector('tbody');
    this._emptyState = this.shadowRoot.querySelector('.empty-state');

    this.shadowRoot.querySelector('.btn-refresh').addEventListener('click', () => this._load());
    this._load();
  }

  get listId() {
    return this.getAttribute('list-id');
  }

  async _load() {
    this._showLoading(true);
    this._error.textContent = '';

    const url = this.listId
      ? `${API_BASE}/todos/overdue?listId=${encodeURIComponent(this.listId)}`
      : `${API_BASE}/todos/overdue`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        this._showError(body.error ?? 'Failed to load overdue todos.');
        return;
      }
      const { todos } = await res.json();
      this._render(todos);
    } catch {
      this._showError('Could not reach the server. Please check your connection.');
    } finally {
      this._showLoading(false);
    }
  }

  _render(todos) {
    this._tbody.innerHTML = '';

    if (todos.length === 0) {
      this._table.hidden = true;
      this._emptyState.hidden = false;
      return;
    }

    this._emptyState.hidden = true;
    this._table.hidden = false;

    for (const todo of todos) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${this._esc(todo.title)}</td>
        <td class="priority--${this._esc(todo.priority)}">${this._esc(todo.priority)}</td>
        <td class="due-date">${todo.dueDate ? this._esc(todo.dueDate) : '—'}</td>
      `;
      tr.addEventListener('click', () => {
        this.dispatchEvent(
          new CustomEvent('otl-select', {
            bubbles: true,
            composed: true,
            detail: { todoId: todo.todoId, title: todo.title },
          }),
        );
      });
      this._tbody.appendChild(tr);
    }
  }

  _showLoading(on) {
    this._loading.hidden = !on;
  }

  _showError(message) {
    this._error.textContent = message;
    this._table.hidden = true;
    this._emptyState.hidden = true;
  }

  _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

customElements.define('overdue-todo-list', OverdueTodoList);
