import { API_BASE } from '../../config.js';

const template = document.createElement('template');
template.innerHTML = `
  <link rel="stylesheet" href="/slices/rename-todo-list/rename-todo-list.css" />
  <form class="rename-todo-list-form" novalidate>
    <h2>Rename Todo List</h2>
    <div class="field">
      <label for="rtl-name">Name <span class="required" aria-hidden="true">*</span></label>
      <input
        type="text"
        id="rtl-name"
        name="name"
        placeholder="New list name…"
        autocomplete="off"
        required
      />
      <span class="field-error" aria-live="polite"></span>
    </div>
    <div class="actions">
      <button type="button" class="btn-cancel">Cancel</button>
      <button type="submit" class="btn-primary">Rename Todo List</button>
    </div>
  </form>
`;

class RenameTodoList extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this._form = this.shadowRoot.querySelector('form');
    this._nameInput = this.shadowRoot.querySelector('#rtl-name');
    this._nameError = this.shadowRoot.querySelector('.field-error');
    this._submitBtn = this.shadowRoot.querySelector('[type="submit"]');

    this._form.addEventListener('submit', this._handleSubmit.bind(this));
    this.shadowRoot.querySelector('.btn-cancel').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('rtl-cancel', { bubbles: true, composed: true }));
    });
  }

  get listId() {
    return this.getAttribute('list-id');
  }

  async _handleSubmit(e) {
    e.preventDefault();
    this._clearError();

    const name = this._nameInput.value.trim();
    if (!name) {
      this._showError('Name must not be blank');
      this._nameInput.focus();
      return;
    }

    this._submitBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/todo-lists/${this.listId}/name`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (res.ok) {
        const { listId } = await res.json();
        this.dispatchEvent(
          new CustomEvent('rtl-renamed', {
            bubbles: true,
            composed: true,
            detail: { listId, name },
          }),
        );
        this._form.reset();
      } else {
        const body = await res.json().catch(() => ({}));
        this._showError(body.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      this._showError('Could not reach the server. Please check your connection.');
    } finally {
      this._submitBtn.disabled = false;
    }
  }

  _showError(message) {
    this._nameError.textContent = message;
    this._nameInput.setAttribute('aria-invalid', 'true');
  }

  _clearError() {
    this._nameError.textContent = '';
    this._nameInput.removeAttribute('aria-invalid');
  }
}

customElements.define('rename-todo-list', RenameTodoList);
