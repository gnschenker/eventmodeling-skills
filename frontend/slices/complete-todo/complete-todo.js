import { API_BASE } from '../../config.js';

const template = document.createElement('template');
template.innerHTML = `
  <link rel="stylesheet" href="/slices/complete-todo/complete-todo.css" />
  <div class="complete-todo-card">
    <h2>Complete Todo</h2>
    <p>Mark this todo as completed?</p>
    <div class="form-error" aria-live="polite"></div>
    <div class="actions">
      <button type="button" class="btn-cancel">Cancel</button>
      <button type="button" class="btn-primary btn-confirm">Complete</button>
    </div>
  </div>
`;

class CompleteTodo extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this._formError = this.shadowRoot.querySelector('.form-error');
    this._confirmBtn = this.shadowRoot.querySelector('.btn-confirm');

    this._confirmBtn.addEventListener('click', this._handleConfirm.bind(this));
    this.shadowRoot.querySelector('.btn-cancel').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('ctd-cancel', { bubbles: true, composed: true }));
    });
  }

  get todoId() {
    return this.getAttribute('todo-id');
  }

  async _handleConfirm() {
    this._formError.textContent = '';
    this._confirmBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/todos/${this.todoId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const { todoId } = await res.json();
        this.dispatchEvent(
          new CustomEvent('ctd-completed', {
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

customElements.define('complete-todo', CompleteTodo);
