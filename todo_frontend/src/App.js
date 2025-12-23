import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

/*
  -- Style Guide Reference:
    - Clean, modern, single-column layout
    - Accent: #3b82f6 (primary), #06b6d4 (success), #EF4444 (error)
    - Background: #f9fafb
    - Text: #111827
    - Input bar for new tasks
    - List of existing tasks
*/

// FastAPI backend on port 3001 (assume endpoint base: http://localhost:3001)
const API_BASE = 'http://localhost:3001';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

// PUBLIC_INTERFACE
function App() {
  // App state
  const [todos, setTodos] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Style
  useEffect(() => {
    document.body.style.background = "#f9fafb";
    document.body.style.color = "#111827";
  }, []);

  // Fetch todos from API
  const fetchTodos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/todos`);
      if (!res.ok) throw new Error('Failed to fetch todos');
      const data = await res.json();
      setTodos(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load todos on mount
  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  // PUBLIC_INTERFACE
  async function handleAddTodo(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSubmitting(true);
    setError(null);

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticTodo = {
      id: tempId,
      title: newTitle,
      completed: false,
    };
    setTodos((prev) => [optimisticTodo, ...prev]);
    setNewTitle('');
    try {
      const res = await fetch(`${API_BASE}/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      if (!res.ok) throw new Error('Failed to add todo');
      const todo = await res.json();
      setTodos((prev) =>
        prev.map((t) => (t.id === tempId ? todo : t))
      );
    } catch (e) {
      setTodos((prev) => prev.filter((t) => t.id !== tempId));
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // PUBLIC_INTERFACE
  function handleEditTodo(todo) {
    setEditingId(todo.id);
    setEditingTitle(todo.title);
  }

  // PUBLIC_INTERFACE
  async function handleSaveEdit(todo) {
    if (!editingTitle.trim()) return;
    setSubmitting(true);
    setError(null);
    const oldTitle = todo.title;
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todo.id ? { ...t, title: editingTitle } : t
      )
    );
    setEditingId(null);

    try {
      const res = await fetch(`${API_BASE}/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editingTitle, completed: todo.completed }),
      });
      if (!res.ok) throw new Error('Failed to save todo');
    } catch (e) {
      setTodos((prev) =>
        prev.map((t) =>
          t.id === todo.id ? { ...t, title: oldTitle } : t
        )
      );
      setError(e.message);
    } finally {
      setSubmitting(false);
      setEditingTitle('');
    }
  }

  // PUBLIC_INTERFACE
  async function handleToggleComplete(todo) {
    setSubmitting(true);
    setError(null);
    const oldCompleted = todo.completed;
    setTodos((prev) =>
      prev.map((t) =>
        t.id === todo.id ? { ...t, completed: !t.completed } : t
      )
    );
    try {
      const res = await fetch(`${API_BASE}/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...todo, completed: !todo.completed }),
      });
      if (!res.ok) throw new Error('Failed to update todo');
    } catch (e) {
      setTodos((prev) =>
        prev.map((t) =>
          t.id === todo.id ? { ...t, completed: oldCompleted } : t
        )
      );
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // PUBLIC_INTERFACE
  async function handleDeleteTodo(todoId) {
    setSubmitting(true);
    setError(null);
    const cache = todos;
    setTodos((prev) => prev.filter((t) => t.id !== todoId));
    try {
      const res = await fetch(`${API_BASE}/todos/${todoId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete todo');
    } catch (e) {
      setTodos(cache);
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Keyboard events for editing
  function handleEditKeyDown(e, todo) {
    if (e.key === 'Enter') {
      handleSaveEdit(todo);
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditingTitle('');
    }
  }

  return (
    <div className="App" style={{ minHeight: '100vh', fontFamily: 'Inter,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto' }}>
      <header style={{ margin: '32px 0', textAlign: 'center' }}>
        <h1 style={{
          color: '#3b82f6',
          fontWeight: 800,
          fontSize: '2rem',
          letterSpacing: '-1px',
        }}>TODO</h1>
        <p style={{ color: '#64748b', fontSize: '1rem', marginTop: '4px' }}>
          Manage your tasks simply
        </p>
      </header>
      <main style={{
        width: '100%',
        maxWidth: 420,
        margin: '0 auto',
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 6px 32px rgba(59,130,246, .07), 0 1.5px 4px rgba(100,116,139,.05)',
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}>
        <form onSubmit={handleAddTodo} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Add a new todo..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            style={{
              flex: 1,
              padding: '0.8em 1em',
              fontSize: '1em',
              borderRadius: 8,
              border: '1px solid #e9ecef',
              outline: 'none',
              background: '#f9fafb',
            }}
            aria-label="New todo"
            disabled={submitting}
            maxLength={128}
          />
          <button
            type="submit"
            style={{
              background: '#3b82f6',
              color: 'white',
              fontWeight: 700,
              border: 'none',
              borderRadius: 8,
              minWidth: 44,
              fontSize: '1em',
              padding: '0 1.2em',
              cursor: submitting || !newTitle.trim() ? 'not-allowed' : 'pointer',
              opacity: submitting || !newTitle.trim() ? 0.6 : 1,
              transition: 'all 0.2s',
            }}
            disabled={submitting || !newTitle.trim()}
            aria-label="Add todo"
          >
            Add
          </button>
        </form>
        {loading && (
          <div style={{ margin: '32px 0', textAlign: 'center', color: '#3b82f6' }}>
            Loading tasks...
          </div>
        )}
        {error && (
          <div style={{ background: '#fff1f2', color: '#EF4444', padding: 12, borderRadius: 8, textAlign: 'center', marginBottom: 8 }}>
            {error}
          </div>
        )}
        <ul style={{
          padding: 0,
          margin: 0,
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {(!loading && todos.length === 0) && (
            <li style={{
              color: '#94a3b8',
              fontStyle: 'italic',
              padding: '20px 0',
              textAlign: 'center',
            }}>No todos. All caught up!</li>
          )}
          {todos.map((todo) => (
            <li key={todo.id} style={{
              display: 'flex',
              alignItems: 'center',
              background: '#f9fafb',
              borderRadius: 8,
              padding: '15px 10px',
              border: `1.5px solid ${todo.completed ? '#06b6d4' : '#e9ecef'}`,
              opacity: todo.completed ? 0.65 : 1,
              boxShadow: '0 1px 2px rgba(100,116,139,.02)',
              transition: 'border 0.3s, opacity 0.2s',
            }}>
              <input
                type="checkbox"
                checked={!!todo.completed}
                onChange={() => handleToggleComplete(todo)}
                style={{ accentColor: '#06b6d4', width: 20, height: 20, marginRight: 12 }}
                aria-label={todo.completed ? "Mark as incomplete" : "Mark as done"}
                disabled={submitting}
              />
              {editingId === todo.id ? (
                <>
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => handleEditKeyDown(e, todo)}
                    onBlur={() => handleSaveEdit(todo)}
                    autoFocus
                    style={{
                      flex: 1,
                      fontSize: '1em',
                      padding: '0.4em 0.75em',
                      borderRadius: 6,
                      border: '1.5px solid #3b82f6',
                    }}
                    maxLength={128}
                    aria-label="Edit todo"
                    disabled={submitting}
                  />
                  <button
                    onClick={() => handleSaveEdit(todo)}
                    style={{
                      background: '#3b82f6',
                      color: '#fff',
                      fontWeight: 600,
                      border: 'none',
                      borderRadius: 7,
                      padding: '0.4em 1em',
                      marginLeft: 8,
                      fontSize: '1em',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      opacity: submitting ? 0.7 : 1,
                    }}
                    disabled={submitting}
                    aria-label="Save"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setEditingId(null); setEditingTitle(''); }}
                    style={{
                      background: '#e5e5e5',
                      color: '#64748b',
                      marginLeft: 6,
                      border: 'none',
                      borderRadius: 7,
                      padding: '0.4em .8em',
                      fontSize: '1em',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                    aria-label="Cancel edit"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span
                    onDoubleClick={() => handleEditTodo(todo)}
                    style={{
                      flex: 1,
                      fontSize: '1.09em',
                      textDecoration: todo.completed ? 'line-through' : 'none',
                      color: todo.completed ? '#06b6d4' : '#111827',
                      wordBreak: 'break-word'
                    }}
                  >
                    {todo.title}
                  </span>
                  <button
                    onClick={() => handleEditTodo(todo)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#3b82f6',
                      fontSize: '1em',
                      fontWeight: 700,
                      marginLeft: 6,
                      padding: 4,
                      cursor: 'pointer',
                      borderRadius: 5,
                    }}
                    aria-label="Edit"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteTodo(todo.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#EF4444',
                      fontWeight: 700,
                      marginLeft: 6,
                      fontSize: '1.15em',
                      padding: 4,
                      cursor: 'pointer',
                      borderRadius: 5,
                    }}
                    aria-label="Delete"
                    disabled={submitting}
                  >
                    🗑
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </main>
      <footer style={{
        maxWidth: 420,
        margin: '32px auto 0 auto',
        textAlign: 'center',
        fontSize: '0.92em',
        color: '#94a3b8',
        background: 'none'
      }}>
        &copy; {new Date().getFullYear()} Simple Todo. Powered by FastAPI & React.
      </footer>
    </div>
  );
}

export default App;
