class NavBar extends HTMLElement {
  connectedCallback() {
    this.className = 'nav-bar';
    this.innerHTML = `
      <a class="nav-brand" href="#/view-my-todo-lists">📋 Todo App</a>
      <a href="#/view-my-todo-lists">My Lists</a>
      <a href="#/view-notification-history">Notifications</a>
    `;
  }
}

customElements.define('nav-bar', NavBar);
