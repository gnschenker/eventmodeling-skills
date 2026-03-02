import { API_BASE } from '../../config.js';

const template = document.createElement('template');
template.innerHTML = `
  <link rel="stylesheet" href="/slices/edit-todo/edit-todo.css" />
  <form class="edit-todo-form" novalidate>
    <h2>Edit Todo</h2>

    <div class="field">
      <label for="et-title">Title <span class="required" aria-hidden="true">*</span></label>
      <input
        type="text"
        id="et-title"
        name="title"
        placeholder="What needs to be done?"
        autocomplete="off"
        required
      />
      <span class="field-error" aria-live="polite"></span>
    </div>

    <div class="field">
      <label for="et-description">Description</label>
      <textarea
        id="et-description"
        name="description"
        rows="3"
        placeholder="Optional details…"
      ></textarea>
    </div>

    <div class="field">
      <label for="et-priority">Priority <span class="required" aria-hidden="true">*</span></label>
      <select id="et-priority" name="priority">
        <option value="Low">Low</option>
        <option value="Medium" selected>Medium</option>
        <option value="High">High</option>
      </select>
    </div>

    <div class="form-error" aria-live="polite"></div>

    <div class="actions">
      <button type="button" class="btn-cancel">Cancel</button>
      <button type="submit" class="btn-primary">Edit Todo</button>
    </div>
  </form>
`;

class EditTodo extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this._form = this.shadowRoot.querySelector('form');
    this._titleInput = this.shadowRoot.querySelector('#et-title');
    this._titleError = this.shadowRoot.querySelector('.field-error');
    this._descriptionInput = this.shadowRoot.querySelector('#et-description');
    this._prioritySelect = this.shadowRoot.querySelector('#et-priority');
    this._formError = this.shadowRoot.querySelector('.form-error');
    this._submitBtn = this.shadowRoot.querySelector('[type="submit"]');

    this._form.addEventListener('submit', this._handleSubmit.bind(this));
    this.shadowRoot.querySelector('.btn-cancel').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('et-cancel', { bubbles: true, composed: true }));
    });
  }

  get todoId() {
    return this.getAttribute('todo-id');
  }

  async _handleSubmit(e) {
    e.preventDefault();
    this._clearErrors();

    const title = this._titleInput.value.trim();
    if (!title) {
      this._showTitleError('Title must not be blank');
      this._titleInput.focus();
      return;
    }

    this._submitBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/todos/${this.todoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: this._descriptionInput.value.trim(),
          priority: this._prioritySelect.value,
        }),
      });

      if (res.ok) {
        const { todoId } = await res.json();
        this.dispatchEvent(
          new CustomEvent('et-edited', {
            bubbles: true,
            composed: true,
            detail: { todoId, title },
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

  _showTitleError(message) {
    this._titleError.textContent = message;
    this._titleInput.setAttribute('aria-invalid', 'true');
  }

  _showFormError(message) {
    this._formError.textContent = message;
  }

  _clearErrors() {
    this._titleError.textContent = '';
    this._titleInput.removeAttribute('aria-invalid');
    this._formError.textContent = '';
  }
}

customElements.define('edit-todo', EditTodo);
