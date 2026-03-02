import { API_BASE } from '../../config.js';

const template = document.createElement('template');
template.innerHTML = `
  <link rel="stylesheet" href="/slices/view-todo-list-detail/todo-list-detail.css" />
  <div class="todo-list-detail">
    <div class="loading" hidden>Loading…</div>
    <div class="error" aria-live="polite"></div>

    <div class="detail-card" hidden>
      <h2 class="tld-name"></h2>
      <dl class="tld-fields">
        <div class="tld-field">
          <dt>Status</dt>
          <dd class="tld-status"></dd>
        </div>
        <div class="tld-field">
          <dt>Created</dt>
          <dd class="tld-created"></dd>
        </div>
      </dl>

      <div class="tld-actions"></div>

      <div class="tld-tabs"></div>
    </div>
  </div>
`;

class TodoListDetail extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this._loading = this.shadowRoot.querySelector('.loading');
    this._error = this.shadowRoot.querySelector('.error');
    this._card = this.shadowRoot.querySelector('.detail-card');
    this._name = this.shadowRoot.querySelector('.tld-name');
    this._status = this.shadowRoot.querySelector('.tld-status');
    this._created = this.shadowRoot.querySelector('.tld-created');
    this._actions = this.shadowRoot.querySelector('.tld-actions');
    this._tabs = this.shadowRoot.querySelector('.tld-tabs');

    this._load();
  }

  get listId() {
    return this.getAttribute('list-id');
  }

  async _load() {
    if (!this.listId) {
      this._showError('No list-id attribute provided.');
      return;
    }

    this._showLoading(true);
    this._error.textContent = '';
    this._card.hidden = true;

    try {
      const res = await fetch(`${API_BASE}/todo-lists/${encodeURIComponent(this.listId)}`);
      if (res.status === 404) {
        this._showError('Todo list not found.');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        this._showError(body.error ?? 'Failed to load todo list detail.');
        return;
      }

      const detail = await res.json();
      this._render(detail);
    } catch {
      this._showError('Could not reach the server. Please check your connection.');
    } finally {
      this._showLoading(false);
    }
  }

  _render(detail) {
    this._name.textContent = detail.name;
    this._status.textContent = detail.status;
    this._status.className = `tld-status status--${detail.status}`;
    this._created.textContent = detail.createdAt ? detail.createdAt.slice(0, 10) : '—';

    const id = this.listId;
    const isActive = detail.status === 'active';
    const isArchived = detail.status === 'archived';

    this._actions.innerHTML = `
      <div class="action-bar">
        <a class="btn-action" href="#/rename-todo-list/${id}">Rename</a>
        ${isActive ? `<a class="btn-action" href="#/archive-todo-list/${id}">Archive</a>` : ''}
        ${!isArchived ? `<a class="btn-action btn-danger" href="#/delete-todo-list/${id}">Delete</a>` : ''}
        <a class="btn-primary" href="#/create-todo/${id}">+ Add Todo</a>
      </div>
    `;

    this._tabs.innerHTML = `
      <div class="tab-bar">
        <a class="tab-link" href="#/view-active-todos/${id}">Active Todos</a>
        <a class="tab-link" href="#/view-completed-todos/${id}">Completed</a>
        <a class="tab-link" href="#/view-overdue-todos/${id}">Overdue</a>
      </div>
    `;

    this._card.hidden = false;
  }

  _showLoading(on) {
    this._loading.hidden = !on;
  }

  _showError(message) {
    this._error.textContent = message;
  }
}

customElements.define('todo-list-detail', TodoListDetail);
