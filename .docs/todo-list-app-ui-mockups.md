# Simple Todo List App — UI Mockups

> Generated from: .docs/todo-list-app.yaml
> State change slices: 10 | State view slices: 7

---

# Forms — State Changes

## Create Todo List

**Actor:** User
**Command:** `CreateTodoList`

```
╔══════════════════════════════════════════╗
║  Create Todo List                        ║
║  Actor: User                             ║
╠══════════════════════════════════════════╣
║                                          ║
║  Name *                                  ║
║  [ placeholder...                      ] ║
║                                          ║
╠══════════════════════════════════════════╣
║     [ Cancel ]  [ Create Todo List ]     ║
╚══════════════════════════════════════════╝
```

  Validation notes:
  • Name must not be blank

---

## Rename Todo List

**Actor:** User
**Command:** `RenameTodoList`

```
╔══════════════════════════════════════════╗
║  Rename Todo List                        ║
║  Actor: User                             ║
╠══════════════════════════════════════════╣
║                                          ║
║  ┄ Viewing: TodoListDetailProjection     ║
║             (GetTodoListDetail) ┄        ║
║                                          ║
║  Name *                                  ║
║  [ placeholder...                      ] ║
║                                          ║
╠══════════════════════════════════════════╣
║      [ Cancel ]  [ Rename Todo List ]    ║
╚══════════════════════════════════════════╝
```

  Validation notes:
  • Todo list must exist and not be deleted
  • Name must not be blank

---

## Archive Todo List

**Actor:** User
**Command:** `ArchiveTodoList`

```
╔══════════════════════════════════════════╗
║  Archive Todo List                       ║
║  Actor: User                             ║
╠══════════════════════════════════════════╣
║                                          ║
║  ┄ Viewing: TodoListDetailProjection     ║
║             (GetTodoListDetail) ┄        ║
║                                          ║
║  Archive this todo list?                 ║
║                                          ║
╠══════════════════════════════════════════╣
║     [ Cancel ]  [ Archive Todo List ]    ║
╚══════════════════════════════════════════╝
```

  Validation notes:
  • Todo list must exist and not already be archived or deleted

---

## Delete Todo List

**Actor:** User
**Command:** `DeleteTodoList`

```
╔══════════════════════════════════════════╗
║  Delete Todo List                        ║
║  Actor: User                             ║
╠══════════════════════════════════════════╣
║                                          ║
║  ┄ Viewing: TodoListDetailProjection     ║
║             (GetTodoListDetail) ┄        ║
║                                          ║
║  Permanently delete this todo list?      ║
║                                          ║
╠══════════════════════════════════════════╣
║      [ Cancel ]  [ Delete Todo List ]    ║
╚══════════════════════════════════════════╝
```

  Validation notes:
  • Todo list must exist and not already be deleted
  • Todo list must be empty (no todos in any status)

---

## Create Todo

**Actor:** User
**Command:** `CreateTodo`

```
╔══════════════════════════════════════════╗
║  Create Todo                             ║
║  Actor: User                             ║
╠══════════════════════════════════════════╣
║                                          ║
║  Title *                                 ║
║  [ placeholder...                      ] ║
║                                          ║
║  Description                             ║
║  ┌────────────────────────────────────┐  ║
║  │                                    │  ║
║  │                                    │  ║
║  └────────────────────────────────────┘  ║
║                                          ║
║  Due Date                                ║
║  [ YYYY-MM-DD                          ] ║
║                                          ║
║  Priority *                              ║
║  ( ) Low   (•) Medium   ( ) High         ║
║                                          ║
╠══════════════════════════════════════════╣
║         [ Cancel ]  [ Create Todo ]      ║
╚══════════════════════════════════════════╝
```

  Validation notes:
  • Title must not be blank
  • Priority must be one of: Low, Medium, High — defaults to Medium if omitted
  • Referenced todo list must exist and not be deleted

---

## Edit Todo

**Actor:** User
**Command:** `EditTodo`

```
╔══════════════════════════════════════════╗
║  Edit Todo                               ║
║  Actor: User                             ║
╠══════════════════════════════════════════╣
║                                          ║
║  ┄ Viewing: TodoDetailProjection         ║
║             (GetTodoDetail) ┄            ║
║                                          ║
║  Title *                                 ║
║  [ placeholder...                      ] ║
║                                          ║
║  Description                             ║
║  ┌────────────────────────────────────┐  ║
║  │                                    │  ║
║  │                                    │  ║
║  └────────────────────────────────────┘  ║
║                                          ║
║  Priority *                              ║
║  ( ) Low   ( ) Medium   ( ) High         ║
║                                          ║
╠══════════════════════════════════════════╣
║           [ Cancel ]  [ Edit Todo ]      ║
╚══════════════════════════════════════════╝
```

  Validation notes:
  • Todo must exist and not be deleted
  • Title must not be blank
  • Priority must be one of: Low, Medium, High

---

## Set Due Date on Todo

**Actor:** User
**Command:** `SetTodoDueDate`

```
╔══════════════════════════════════════════╗
║  Set Todo Due Date                       ║
║  Actor: User                             ║
╠══════════════════════════════════════════╣
║                                          ║
║  ┄ Viewing: TodoDetailProjection         ║
║             (GetTodoDetail) ┄            ║
║                                          ║
║  Due Date *                              ║
║  [ YYYY-MM-DD                          ] ║
║                                          ║
╠══════════════════════════════════════════╣
║    [ Cancel ]  [ Set Todo Due Date ]     ║
╚══════════════════════════════════════════╝
```

  Validation notes:
  • Todo must exist and not be deleted
  • Due date must not be in the past

---

## Complete Todo

**Actor:** User
**Command:** `CompleteTodo`

```
╔══════════════════════════════════════════╗
║  Complete Todo                           ║
║  Actor: User                             ║
╠══════════════════════════════════════════╣
║                                          ║
║  ┄ Viewing: ActiveTodosProjection        ║
║             (GetActiveTodos) ┄           ║
║                                          ║
║  Mark this todo as complete?             ║
║                                          ║
╠══════════════════════════════════════════╣
║        [ Cancel ]  [ Complete Todo ]     ║
╚══════════════════════════════════════════╝
```

  Validation notes:
  • Todo must be in Active or Overdue status

---

## Reopen Todo

**Actor:** User
**Command:** `ReopenTodo`

```
╔══════════════════════════════════════════╗
║  Reopen Todo                             ║
║  Actor: User                             ║
╠══════════════════════════════════════════╣
║                                          ║
║  ┄ Viewing: CompletedTodosProjection     ║
║             (GetCompletedTodos) ┄        ║
║                                          ║
║  Reopen this completed todo?             ║
║                                          ║
╠══════════════════════════════════════════╣
║          [ Cancel ]  [ Reopen Todo ]     ║
╚══════════════════════════════════════════╝
```

  Validation notes:
  • Todo must be in Completed status

---

## Delete Todo

**Actor:** User
**Command:** `DeleteTodo`

```
╔══════════════════════════════════════════╗
║  Delete Todo                             ║
║  Actor: User                             ║
╠══════════════════════════════════════════╣
║                                          ║
║  ┄ Viewing: TodoDetailProjection         ║
║             (GetTodoDetail) ┄            ║
║                                          ║
║  Permanently delete this todo?           ║
║                                          ║
╠══════════════════════════════════════════╣
║          [ Cancel ]  [ Delete Todo ]     ║
╚══════════════════════════════════════════╝
```

  Validation notes:
  • Todo must exist and not already be deleted

---

# Screens — State Views

## View My Todo Lists

**Projection:** `TodoListsProjection`
**Query:** `GetMyTodoLists`

```
╔══════════════════════════════════════════╗
║  View My Todo Lists                      ║
║  Query: GetMyTodoLists                   ║
╠══════════════════════════════════════════╣
║  [ Status: All ▼ ]  [ Sort: Created ↑ ] ║
╠══════════════════════════════════════════╣
║                                          ║
║  ┌──────────────┬────────────┬──────────┐║
║  │ Name         │ Status     │ Created  │║
║  ├──────────────┼────────────┼──────────┤║
║  │ Shopping     │ Active     │ 2025-01  │║
║  │ Work tasks   │ Archived   │ 2025-01  │║
║  │ …            │ …          │ …        │║
║  └──────────────┴────────────┴──────────┘║
║                                          ║
╚══════════════════════════════════════════╝
```

---

## View Todo List Detail

**Projection:** `TodoListDetailProjection`
**Query:** `GetTodoListDetail`

```
╔══════════════════════════════════════════╗
║  View Todo List Detail                   ║
║  Query: GetTodoListDetail                ║
╠══════════════════════════════════════════╣
║                                          ║
║  ┌──────────────────────────────────────┐║
║  │  Name:        Work tasks             │║
║  │  Status:      Active                 │║
║  │  Created At:  2025-01-01             │║
║  └──────────────────────────────────────┘║
║                                          ║
╚══════════════════════════════════════════╝
```

---

## View Active Todos

**Projection:** `ActiveTodosProjection`
**Query:** `GetActiveTodos`

```
╔══════════════════════════════════════════╗
║  View Active Todos                       ║
║  Query: GetActiveTodos                   ║
╠══════════════════════════════════════════╣
║  [ List: All ▼ ]  [ Priority: All ▼ ]   ║
║  [ Sort: Due ↑ ]  [ Sort: Created ↑ ]   ║
╠══════════════════════════════════════════╣
║                                          ║
║  ┌──────────────┬────────────┬──────────┐║
║  │ Title        │ Priority   │ Due Date │║
║  ├──────────────┼────────────┼──────────┤║
║  │ Buy milk     │ High       │ 2025-01  │║
║  │ Call dentist │ Medium     │ 2025-02  │║
║  │ …            │ …          │ …        │║
║  └──────────────┴────────────┴──────────┘║
║                                          ║
╚══════════════════════════════════════════╝
```

---

## View Completed Todos

**Projection:** `CompletedTodosProjection`
**Query:** `GetCompletedTodos`

```
╔══════════════════════════════════════════╗
║  View Completed Todos                    ║
║  Query: GetCompletedTodos                ║
╠══════════════════════════════════════════╣
║  [ List: All ▼ ]  [ Sort: Completed ↓ ] ║
╠══════════════════════════════════════════╣
║                                          ║
║  ┌──────────────┬────────────┬──────────┐║
║  │ Title        │ Priority   │ Completed│║
║  ├──────────────┼────────────┼──────────┤║
║  │ Buy milk     │ High       │ 2025-01  │║
║  │ Send report  │ Medium     │ 2025-01  │║
║  │ …            │ …          │ …        │║
║  └──────────────┴────────────┴──────────┘║
║                                          ║
╚══════════════════════════════════════════╝
```

---

## View Overdue Todos

**Projection:** `OverdueTodosProjection`
**Query:** `GetOverdueTodos`

```
╔══════════════════════════════════════════╗
║  View Overdue Todos                      ║
║  Query: GetOverdueTodos                  ║
╠══════════════════════════════════════════╣
║  [ List: All ▼ ]  [ Priority: All ▼ ]   ║
╠══════════════════════════════════════════╣
║                                          ║
║  ┌──────────────┬────────────┬──────────┐║
║  │ Title        │ Priority   │ Due Date │║
║  ├──────────────┼────────────┼──────────┤║
║  │ Fix bug #42  │ High       │ 2024-12  │║
║  │ Review PR    │ Medium     │ 2025-01  │║
║  │ …            │ …          │ …        │║
║  └──────────────┴────────────┴──────────┘║
║                                          ║
╚══════════════════════════════════════════╝
```

---

## View Todo Detail

**Projection:** `TodoDetailProjection`
**Query:** `GetTodoDetail`

```
╔══════════════════════════════════════════╗
║  View Todo Detail                        ║
║  Query: GetTodoDetail                    ║
╠══════════════════════════════════════════╣
║                                          ║
║  ┌──────────────────────────────────────┐║
║  │  Title:        Buy milk              │║
║  │  Description:  From the corner store │║
║  │  Priority:     High                  │║
║  │  Due Date:     2025-01-15            │║
║  │  Status:       Active                │║
║  │  Created At:   2025-01-01            │║
║  └──────────────────────────────────────┘║
║                                          ║
╚══════════════════════════════════════════╝
```

---

## View Notification History

**Projection:** `NotificationHistoryProjection`
**Query:** `GetNotificationHistory`

```
╔══════════════════════════════════════════╗
║  View Notification History               ║
║  Query: GetNotificationHistory           ║
╠══════════════════════════════════════════╣
║  [ Sort: Sent ↓ ]  [ Todo ▼ ]           ║
╠══════════════════════════════════════════╣
║                                          ║
║  ┌──────────────┬────────────┬──────────┐║
║  │ Sent At      │ Todo       │ Due Date │║
║  ├──────────────┼────────────┼──────────┤║
║  │ 2025-01 09:0 │ Buy milk   │ 2025-01  │║
║  │ 2025-01 08:0 │ Fix bug    │ 2024-12  │║
║  │ …            │ …          │ …        │║
║  └──────────────┴────────────┴──────────┘║
║                                          ║
╚══════════════════════════════════════════╝
```

---
