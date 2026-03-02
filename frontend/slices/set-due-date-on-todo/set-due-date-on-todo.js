import { API_BASE } from '../../config.js';

const template = document.createElement('template');
template.innerHTML = `
  <link rel="stylesheet" href="/slices/set-due-date-on-todo/set-due-date-on-todo.css" />
  <form class="set-due-date-form" novalidate>
    <h2>Set Due Date</h2>

    <div class="field">
      <label for="sdd-due-date">Due Date <span class="required" aria-hidden="true">*</span></label>
      <input
        type="date"
        id="sdd-due-date"
        name="dueDate"
        required
      />
      <span class="field-error" aria-live="polite"></span>
    </div>

    <div class="form-error" aria-live="polite"></div>

    <div class="actions">
      <button type="button" class="btn-cancel">Cancel</button>
      <button type="submit" class="btn-primary">Set Due Date</button>
    </div>
  </form>
`;

class SetDueDateOnTodo extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this._form = this.shadowRoot.querySelector('form');
    this._dueDateInput = this.shadowRoot.querySelector('#sdd-due-date');
    this._dueDateError = this.shadowRoot.querySelector('.field-error');
    this._formError = this.shadowRoot.querySelector('.form-error');
    this._submitBtn = this.shadowRoot.querySelector('[type="submit"]');

    this._form.addEventListener('submit', this._handleSubmit.bind(this));
    this.shadowRoot.querySelector('.btn-cancel').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('sdd-cancel', { bubbles: true, composed: true }));
    });
  }

  get todoId() {
    return this.getAttribute('todo-id');
  }

  async _handleSubmit(e) {
    e.preventDefault();
    this._clearErrors();

    const dueDate = this._dueDateInput.value;
    if (!dueDate) {
      this._showDueDateError('Due date is required');
      this._dueDateInput.focus();
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    if (dueDate < today) {
      this._showDueDateError('Due date must not be in the past');
      this._dueDateInput.focus();
      return;
    }

    this._submitBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/todos/${this.todoId}/due-date`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dueDate }),
      });

      if (res.ok) {
        const { todoId } = await res.json();
        this.dispatchEvent(
          new CustomEvent('sdd-set', {
            bubbles: true,
            composed: true,
            detail: { todoId, dueDate },
          }),
        );
      } else {
        const data = await res.json().catch(() => ({}));
        this._showFormError(data.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      this._showFormError('Could not reach the server. Please check your connection.');
    } finally {
      this._submitBtn.disabled = false;
    }
  }

  _showDueDateError(message) {
    this._dueDateError.textContent = message;
    this._dueDateInput.setAttribute('aria-invalid', 'true');
  }

  _showFormError(message) {
    this._formError.textContent = message;
  }

  _clearErrors() {
    this._dueDateError.textContent = '';
    this._dueDateInput.removeAttribute('aria-invalid');
    this._formError.textContent = '';
  }
}

customElements.define('set-due-date-on-todo', SetDueDateOnTodo);
