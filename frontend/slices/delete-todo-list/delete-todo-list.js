import { API_BASE } from '../../config.js';

const template = document.createElement('template');
template.innerHTML = `
  <link rel="stylesheet" href="/slices/delete-todo-list/delete-todo-list.css" />
  <div class="delete-todo-list-card">
    <h2>Delete Todo List</h2>
    <p class="confirmation-text">Permanently delete this todo list? This cannot be undone.</p>
    <span class="error-msg" aria-live="polite"></span>
    <div class="actions">
      <button type="button" class="btn-cancel">Cancel</button>
      <button type="button" class="btn-danger btn-delete">Delete Todo List</button>
    </div>
  </div>
`;

class DeleteTodoList extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this._deleteBtn = this.shadowRoot.querySelector('.btn-delete');
    this._errorMsg = this.shadowRoot.querySelector('.error-msg');

    this._deleteBtn.addEventListener('click', this._handleDelete.bind(this));
    this.shadowRoot.querySelector('.btn-cancel').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('dtl-cancel', { bubbles: true, composed: true }));
    });
  }

  get listId() {
    return this.getAttribute('list-id');
  }

  async _handleDelete() {
    this._clearError();
    this._deleteBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/todo-lists/${this.listId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const { listId } = await res.json();
        this.dispatchEvent(
          new CustomEvent('dtl-deleted', {
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
      this._deleteBtn.disabled = false;
    }
  }

  _showError(message) {
    this._errorMsg.textContent = message;
  }

  _clearError() {
    this._errorMsg.textContent = '';
  }
}

customElements.define('delete-todo-list', DeleteTodoList);
