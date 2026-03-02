import { API_BASE } from '../../config.js';

const template = document.createElement('template');
template.innerHTML = `
  <link rel="stylesheet" href="/slices/view-todo-detail/todo-detail.css" />
  <div class="todo-detail">
    <div class="loading" hidden>Loading…</div>
    <div class="error" aria-live="polite"></div>

    <div class="detail-card" hidden>
      <h2 class="td-title"></h2>
      <dl class="td-fields">
        <div class="td-field">
          <dt>Status</dt>
          <dd class="td-status"></dd>
        </div>
        <div class="td-field">
          <dt>Priority</dt>
          <dd class="td-priority"></dd>
        </div>
        <div class="td-field">
          <dt>Due Date</dt>
          <dd class="td-due-date"></dd>
        </div>
        <div class="td-field">
          <dt>Description</dt>
          <dd class="td-description"></dd>
        </div>
        <div class="td-field">
          <dt>Created</dt>
          <dd class="td-created"></dd>
        </div>
      </dl>
    </div>
  </div>
`;

class TodoDetail extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this._loading = this.shadowRoot.querySelector('.loading');
    this._error = this.shadowRoot.querySelector('.error');
    this._card = this.shadowRoot.querySelector('.detail-card');
    this._title = this.shadowRoot.querySelector('.td-title');
    this._status = this.shadowRoot.querySelector('.td-status');
    this._priority = this.shadowRoot.querySelector('.td-priority');
    this._dueDate = this.shadowRoot.querySelector('.td-due-date');
    this._description = this.shadowRoot.querySelector('.td-description');
    this._created = this.shadowRoot.querySelector('.td-created');

    this._load();
  }

  get todoId() {
    return this.getAttribute('todo-id');
  }

  async _load() {
    if (!this.todoId) {
      this._error.textContent = 'No todo-id attribute provided.';
      return;
    }

    this._showLoading(true);
    this._error.textContent = '';
    this._card.hidden = true;

    try {
      const res = await fetch(`${API_BASE}/todos/${encodeURIComponent(this.todoId)}`);
      if (res.status === 404) {
        this._error.textContent = 'Todo not found.';
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        this._error.textContent = body.error ?? 'Failed to load todo detail.';
        return;
      }

      const detail = await res.json();
      this._render(detail);
    } catch {
      this._error.textContent = 'Could not reach the server. Please check your connection.';
    } finally {
      this._showLoading(false);
    }
  }

  _render(detail) {
    this._title.textContent = detail.title;

    this._status.textContent = detail.status;
    this._status.className = `td-status status--${detail.status}`;

    this._priority.textContent = detail.priority;
    this._priority.className = `td-priority priority--${detail.priority}`;

    this._dueDate.textContent = detail.dueDate ?? '—';
    this._description.textContent = detail.description || '—';
    this._created.textContent = detail.createdAt ? detail.createdAt.slice(0, 10) : '—';

    this._card.hidden = false;
  }

  _showLoading(on) {
    this._loading.hidden = !on;
  }
}

customElements.define('todo-detail', TodoDetail);
