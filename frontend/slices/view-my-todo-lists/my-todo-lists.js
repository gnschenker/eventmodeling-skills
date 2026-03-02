import { API_BASE } from '../../config.js';

const template = document.createElement('template');
template.innerHTML = `
  <link rel="stylesheet" href="/slices/view-my-todo-lists/my-todo-lists.css" />
  <div class="my-todo-lists">
    <div class="header">
      <h2>My Todo Lists</h2>
      <div class="filters">
        <select id="mtl-status-filter">
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
        <button class="btn-refresh" title="Refresh">↻</button>
      </div>
    </div>

    <div class="loading" hidden>Loading…</div>
    <div class="error" aria-live="polite"></div>

    <table class="lists-table" hidden>
      <thead>
        <tr>
          <th>Name</th>
          <th>Status</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>

    <p class="empty-state" hidden>No todo lists found.</p>
  </div>
`;

class MyTodoLists extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this._statusFilter = this.shadowRoot.querySelector('#mtl-status-filter');
    this._loading = this.shadowRoot.querySelector('.loading');
    this._error = this.shadowRoot.querySelector('.error');
    this._table = this.shadowRoot.querySelector('.lists-table');
    this._tbody = this.shadowRoot.querySelector('tbody');
    this._emptyState = this.shadowRoot.querySelector('.empty-state');

    this._statusFilter.addEventListener('change', () => this._load());
    this.shadowRoot.querySelector('.btn-refresh').addEventListener('click', () => this._load());

    this._load();
  }

  async _load() {
    this._showLoading(true);
    this._error.textContent = '';

    const status = this._statusFilter.value;
    const url = status
      ? `${API_BASE}/todo-lists?status=${encodeURIComponent(status)}`
      : `${API_BASE}/todo-lists`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        this._showError(body.error ?? 'Failed to load todo lists.');
        return;
      }

      const { lists } = await res.json();
      this._render(lists);
    } catch {
      this._showError('Could not reach the server. Please check your connection.');
    } finally {
      this._showLoading(false);
    }
  }

  _render(lists) {
    this._tbody.innerHTML = '';

    if (lists.length === 0) {
      this._table.hidden = true;
      this._emptyState.hidden = false;
      return;
    }

    this._emptyState.hidden = true;
    this._table.hidden = false;

    for (const list of lists) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${this._esc(list.name)}</td>
        <td class="status status--${list.status}">${this._esc(list.status)}</td>
        <td>${this._formatDate(list.createdAt)}</td>
      `;
      tr.addEventListener('click', () => {
        this.dispatchEvent(
          new CustomEvent('mtl-select', {
            bubbles: true,
            composed: true,
            detail: { listId: list.listId, name: list.name },
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

  _formatDate(iso) {
    if (!iso) return '—';
    return iso.slice(0, 10); // YYYY-MM-DD
  }
}

customElements.define('my-todo-lists', MyTodoLists);
