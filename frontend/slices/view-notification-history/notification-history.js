import { API_BASE } from '../../config.js';

const template = document.createElement('template');
template.innerHTML = `
  <link rel="stylesheet" href="/slices/view-notification-history/notification-history.css" />
  <div class="notification-history">
    <h2 class="nh-heading">Notification History</h2>
    <div class="loading" hidden>Loading…</div>
    <div class="error" aria-live="polite"></div>
    <div class="empty" hidden>No notifications found.</div>

    <table class="nh-table" hidden>
      <thead>
        <tr>
          <th>Todo ID</th>
          <th>Due Date</th>
          <th>Sent At</th>
        </tr>
      </thead>
      <tbody class="nh-body"></tbody>
    </table>
  </div>
`;

class NotificationHistory extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this._loading = this.shadowRoot.querySelector('.loading');
    this._error = this.shadowRoot.querySelector('.error');
    this._empty = this.shadowRoot.querySelector('.empty');
    this._table = this.shadowRoot.querySelector('.nh-table');
    this._body = this.shadowRoot.querySelector('.nh-body');

    this._load();
  }

  get todoId() {
    return this.getAttribute('todo-id');
  }

  async _load() {
    this._showLoading(true);
    this._error.textContent = '';
    this._empty.hidden = true;
    this._table.hidden = true;

    try {
      let url = `${API_BASE}/notifications`;
      if (this.todoId) url += `?todoId=${encodeURIComponent(this.todoId)}`;

      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        this._error.textContent = body.error ?? 'Failed to load notification history.';
        return;
      }

      const items = await res.json();
      this._render(items);
    } catch {
      this._error.textContent = 'Could not reach the server. Please check your connection.';
    } finally {
      this._showLoading(false);
    }
  }

  _render(items) {
    if (items.length === 0) {
      this._empty.hidden = false;
      return;
    }

    this._body.innerHTML = '';
    for (const item of items) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="nh-todo-id">${this._esc(item.todoId)}</td>
        <td class="nh-due-date">${this._esc(item.dueDate)}</td>
        <td class="nh-sent-at">${this._esc(item.sentAt ? item.sentAt.slice(0, 19).replace('T', ' ') : '—')}</td>
      `;
      this._body.appendChild(tr);
    }
    this._table.hidden = false;
  }

  _showLoading(on) {
    this._loading.hidden = !on;
  }

  _esc(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
  }
}

customElements.define('notification-history', NotificationHistory);
