import { API_BASE } from '../../config.js';

const template = document.createElement('template');
template.innerHTML = `
  <link rel="stylesheet" href="/slices/reopen-todo/reopen-todo.css" />
  <div class="reopen-todo-card">
    <h2>Reopen Todo</h2>
    <p>Move this todo back to active status?</p>
    <div class="form-error" aria-live="polite"></div>
    <div class="actions">
      <button type="button" class="btn-cancel">Cancel</button>
      <button type="button" class="btn-primary btn-confirm">Reopen</button>
    </div>
  </div>
`;

class ReopenTodo extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this._formError = this.shadowRoot.querySelector('.form-error');
    this._confirmBtn = this.shadowRoot.querySelector('.btn-confirm');

    this._confirmBtn.addEventListener('click', this._handleConfirm.bind(this));
    this.shadowRoot.querySelector('.btn-cancel').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('rt-cancel', { bubbles: true, composed: true }));
    });
  }

  get todoId() {
    return this.getAttribute('todo-id');
  }

  async _handleConfirm() {
    this._formError.textContent = '';
    this._confirmBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/todos/${this.todoId}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const { todoId } = await res.json();
        this.dispatchEvent(
          new CustomEvent('rt-reopened', {
            bubbles: true,
            composed: true,
            detail: { todoId },
          }),
        );
      } else {
        const data = await res.json().catch(() => ({}));
        this._formError.textContent = data.error ?? 'Something went wrong. Please try again.';
      }
    } catch {
      this._formError.textContent = 'Could not reach the server. Please check your connection.';
    } finally {
      this._confirmBtn.disabled = false;
    }
  }
}

customElements.define('reopen-todo', ReopenTodo);
