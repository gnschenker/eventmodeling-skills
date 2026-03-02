import { API_BASE } from '../../config.js';

const template = document.createElement('template');
template.innerHTML = `
  <link rel="stylesheet" href="/slices/create-todo/create-todo.css" />
  <form class="create-todo-form" novalidate>
    <h2>Create Todo</h2>

    <div class="field">
      <label for="ct-title">Title <span class="required" aria-hidden="true">*</span></label>
      <input
        type="text"
        id="ct-title"
        name="title"
        placeholder="What needs to be done?"
        autocomplete="off"
        required
      />
      <span class="field-error" aria-live="polite"></span>
    </div>

    <div class="field">
      <label for="ct-description">Description</label>
      <textarea
        id="ct-description"
        name="description"
        rows="3"
        placeholder="Optional details…"
      ></textarea>
    </div>

    <div class="field">
      <label for="ct-due-date">Due date</label>
      <input type="date" id="ct-due-date" name="dueDate" />
    </div>

    <div class="field">
      <label for="ct-priority">Priority</label>
      <select id="ct-priority" name="priority">
        <option value="Low">Low</option>
        <option value="Medium" selected>Medium</option>
        <option value="High">High</option>
      </select>
    </div>

    <div class="form-error" aria-live="polite"></div>

    <div class="actions">
      <button type="button" class="btn-cancel">Cancel</button>
      <button type="submit" class="btn-primary">Create Todo</button>
    </div>
  </form>
`;

class CreateTodo extends HTMLElement {
  connectedCallback() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this._form = this.shadowRoot.querySelector('form');
    this._titleInput = this.shadowRoot.querySelector('#ct-title');
    this._titleError = this.shadowRoot.querySelector('.field-error');
    this._descriptionInput = this.shadowRoot.querySelector('#ct-description');
    this._dueDateInput = this.shadowRoot.querySelector('#ct-due-date');
    this._prioritySelect = this.shadowRoot.querySelector('#ct-priority');
    this._formError = this.shadowRoot.querySelector('.form-error');
    this._submitBtn = this.shadowRoot.querySelector('[type="submit"]');

    this._form.addEventListener('submit', this._handleSubmit.bind(this));
    this.shadowRoot.querySelector('.btn-cancel').addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('ct-cancel', { bubbles: true, composed: true }));
    });
  }

  get listId() {
    return this.getAttribute('list-id');
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
      const body = {
        title,
        description: this._descriptionInput.value.trim(),
        priority: this._prioritySelect.value,
      };
      const dueDate = this._dueDateInput.value;
      if (dueDate) body.dueDate = dueDate;

      const res = await fetch(`${API_BASE}/todo-lists/${this.listId}/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const { todoId } = await res.json();
        this.dispatchEvent(
          new CustomEvent('ct-created', {
            bubbles: true,
            composed: true,
            detail: { todoId, listId: this.listId, title },
          }),
        );
        this._form.reset();
        this._prioritySelect.value = 'Medium';
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

customElements.define('create-todo', CreateTodo);
