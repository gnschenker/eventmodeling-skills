import { API_BASE } from '../../config.js';

const template = document.createElement('template');
template.innerHTML = `
  <link rel="stylesheet" href="/slices/archive-todo-list/archive-todo-list.css" />
  <div class="archive-todo-list-card">
    <h2>Archive Todo List</h2>
    <p class="confirmation-text">Archive this todo list?</p>
    <span class="error-msg" aria-live="polite"></span>
    <div class="actions">
      <button type="button" class="btn-cancel">Cancel</button>
      <button type="button" class="btn-primary btn-archive">Archive Todo List</button>
    </div>
  </div>
`;

class ArchiveTodoList extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this._archiveBtn = this.shadowRoot.querySelector('.btn-archive');
    this._errorMsg = this.shadowRoot.querySelector('.error-msg');

    this._archiveBtn.addEventListener('click', this._handleArchive.bind(this));
    this.shadowRoot.querySelector('.btn-cancel').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('atl-cancel', { bubbles: true, composed: true }));
    });
  }

  get listId() {
    return this.getAttribute('list-id');
  }

  async _handleArchive() {
    this._clearError();
    this._archiveBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/todo-lists/${this.listId}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const { listId } = await res.json();
        this.dispatchEvent(
          new CustomEvent('atl-archived', {
            bubbles: true,
            composed: true,
            detail: { listId },
          }),
        );
      } else {
        const body = await res.json().catch(() => ({}));
        this._showError(body.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      this._showError('Could not reach the server. Please check your connection.');
    } finally {
      this._archiveBtn.disabled = false;
    }
  }

  _showError(message) {
    this._errorMsg.textContent = message;
  }

  _clearError() {
    this._errorMsg.textContent = '';
  }
}

customElements.define('archive-todo-list', ArchiveTodoList);
