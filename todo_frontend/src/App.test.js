import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const API_BASE = 'http://localhost:3001';

const mockTodos = [
  { id: 1, title: 'First Task', completed: false },
  { id: 2, title: 'Completed Task', completed: true },
];

let todosData = [...mockTodos];

// MSW handlers for mocking CRUD endpoints
const handlers = [
  rest.get(`${API_BASE}/todos`, (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(todosData));
  }),
  rest.post(`${API_BASE}/todos`, async (req, res, ctx) => {
    const { title } = await req.json();
    const newTodo = { id: Date.now(), title, completed: false };
    todosData = [newTodo, ...todosData];
    return res(ctx.status(200), ctx.json(newTodo));
  }),
  rest.put(`${API_BASE}/todos/:id`, async (req, res, ctx) => {
    const { id } = req.params;
    const body = await req.json();
    todosData = todosData.map((todo) =>
      todo.id === Number(id) ? { ...todo, ...body, id: Number(id) } : todo
    );
    return res(ctx.status(200), ctx.json({}));
  }),
  rest.delete(`${API_BASE}/todos/:id`, (req, res, ctx) => {
    const { id } = req.params;
    todosData = todosData.filter((todo) => todo.id !== Number(id));
    return res(ctx.status(200));
  }),
];

// MSW server
const server = setupServer(...handlers);

// Setup/teardown for MSW
beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  todosData = [...mockTodos]; // Reset data for deterministic tests
});
afterAll(() => server.close());

// Util: Add a new todo by simulating the form input
async function addTodo(todoText) {
  const input = screen.getByPlaceholderText(/add a new todo/i);
  fireEvent.change(input, { target: { value: todoText } });
  const addBtn = screen.getByRole('button', { name: /add/i });
  fireEvent.click(addBtn);
}

// Util: Helper to wait until tasks are loaded/displayed
async function waitForTodosToLoad() {
  // Wait for one of the todo items to appear and the loader to disappear
  await waitFor(() => expect(screen.queryByText(/loading tasks/i)).not.toBeInTheDocument());
  expect(screen.getByText('First Task')).toBeInTheDocument();
}

// Core test cases

test('renders initial todo list from API', async () => {
  render(<App />);
  expect(screen.getByText(/loading tasks/i)).toBeInTheDocument();
  await waitForTodosToLoad();
  expect(screen.getByText('First Task')).toBeInTheDocument();
  expect(screen.getByText('Completed Task')).toBeInTheDocument();
  // Shows proper 'no todos' UI if empty
  todosData = [];
  server.use(
    rest.get(`${API_BASE}/todos`, (req, res, ctx) => res(ctx.status(200), ctx.json([])))
  );
  render(<App />);
  await waitFor(() => screen.getByText(/no todos/i));
});

test('can add a new todo', async () => {
  render(<App />);
  await waitForTodosToLoad();
  await addTodo('Buy milk');
  expect(screen.getByDisplayValue('')).toBeInTheDocument(); // Input cleared
  // Optimistic UI: Should show the todo even before confirmed
  expect(screen.getByText('Buy milk')).toBeInTheDocument();
  // Wait for POST complete (no error)
  await waitFor(() => expect(screen.getByText('Buy milk')).toBeInTheDocument());
});

test('prevents adding blank/whitespace todo', async () => {
  render(<App />);
  await waitForTodosToLoad();
  const input = screen.getByPlaceholderText(/add a new todo/i);
  const addBtn = screen.getByRole('button', { name: /add/i });
  fireEvent.change(input, { target: { value: '   ' } });
  expect(addBtn).toBeDisabled();
  fireEvent.click(addBtn);
  expect(screen.queryByText('   ')).not.toBeInTheDocument();
});

test('can toggle complete/incomplete', async () => {
  render(<App />);
  await waitForTodosToLoad();
  // Checkbox for 'First Task'
  const firstTaskCheckbox = screen.getAllByRole('checkbox')[0];
  expect(firstTaskCheckbox).not.toBeChecked();
  fireEvent.click(firstTaskCheckbox);
  await waitFor(() => expect(firstTaskCheckbox).toBeChecked());
  // Toggle back
  fireEvent.click(firstTaskCheckbox);
  await waitFor(() => expect(firstTaskCheckbox).not.toBeChecked());
});

test('can edit a todo title and save/cancel', async () => {
  render(<App />);
  await waitForTodosToLoad();
  // Enter editing mode
  const editBtn = screen.getAllByRole('button', { name: /edit/i })[0];
  fireEvent.click(editBtn);

  const editInput = screen.getByRole('textbox', { name: /edit todo/i });
  fireEvent.change(editInput, { target: { value: 'Make dinner' } });

  // Save by clicking Save
  const saveBtn = screen.getByRole('button', { name: /save/i });
  fireEvent.click(saveBtn);

  await waitFor(() => expect(screen.getByText('Make dinner')).toBeInTheDocument());

  // Enter edit, then cancel edit
  fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0]);
  const editInput2 = screen.getByRole('textbox', { name: /edit todo/i });
  fireEvent.change(editInput2, { target: { value: 'Cancelled Title' } });
  const cancelBtn = screen.getByRole('button', { name: /cancel edit/i });
  fireEvent.click(cancelBtn);
  // Title not updated
  expect(screen.getByText('Make dinner')).toBeInTheDocument();
  expect(screen.queryByText('Cancelled Title')).not.toBeInTheDocument();
});

// Simulate editing via keyboard (enter and escape keys)
test('can save/cancel edit with keyboard', async () => {
  render(<App />);
  await waitForTodosToLoad();
  fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0]);
  const editInput = screen.getByRole('textbox', { name: /edit todo/i });
  fireEvent.change(editInput, { target: { value: 'Press Enter' } });
  fireEvent.keyDown(editInput, { key: 'Enter' });
  await waitFor(() => expect(screen.getByText('Press Enter')).toBeInTheDocument());

  // ESC key cancels
  fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0]);
  const editInput2 = screen.getByRole('textbox', { name: /edit todo/i });
  fireEvent.change(editInput2, { target: { value: 'Should Not Save' } });
  fireEvent.keyDown(editInput2, { key: 'Escape' });
  expect(screen.queryByText('Should Not Save')).not.toBeInTheDocument();
});

test('can delete a todo', async () => {
  render(<App />);
  await waitForTodosToLoad();
  // Delete the first task
  const deleteBtn = screen.getAllByRole('button', { name: /delete/i })[0];
  fireEvent.click(deleteBtn);
  await waitFor(() =>
    expect(screen.queryByText('First Task')).not.toBeInTheDocument()
  );
});

// Simulate backend error for add, edit, toggle, delete
test('handles backend errors gracefully for all actions', async () => {
  // GET error
  server.use(
    rest.get(`${API_BASE}/todos`, (req, res, ctx) =>
      res(ctx.status(500), ctx.json({ message: 'Internal error' }))
    )
  );
  render(<App />);
  await waitFor(() =>
    expect(screen.getByText('Failed to fetch todos')).toBeInTheDocument()
  );

  // Reset to normal for further actions
  server.use(...handlers);
  render(<App />);
  await waitForTodosToLoad();

  // ADD error
  server.use(
    rest.post(`${API_BASE}/todos`, (req, res, ctx) =>
      res(ctx.status(500), ctx.json({ message: 'Failed to add' }))
    )
  );
  await addTodo('Should Fail');
  await waitFor(() => expect(screen.getByText('Failed to add todo')).toBeInTheDocument());
  expect(screen.queryByText('Should Fail')).not.toBeInTheDocument();

  // EDIT/PUT error
  server.use(
    rest.put(`${API_BASE}/todos/:id`, (req, res, ctx) =>
      res(ctx.status(500), ctx.json({ message: 'Failed to save' }))
    )
  );
  fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0]);
  const editInput = screen.getByRole('textbox', { name: /edit todo/i });
  fireEvent.change(editInput, { target: { value: 'Edit Fails' } });
  const saveBtn = screen.getByRole('button', { name: /save/i });
  fireEvent.click(saveBtn);
  // Error appears and value should revert
  await waitFor(() =>
    expect(screen.getByText('Failed to save todo')).toBeInTheDocument()
  );
  expect(screen.queryByText('Edit Fails')).not.toBeInTheDocument();

  // TOGGLE error
  server.use(
    rest.put(`${API_BASE}/todos/:id`, (req, res, ctx) =>
      res(ctx.status(500), ctx.json({ message: 'Failed to update' }))
    )
  );
  const checkbox = screen.getAllByRole('checkbox')[0];
  fireEvent.click(checkbox);
  await waitFor(() =>
    expect(screen.getByText('Failed to update todo')).toBeInTheDocument()
  );

  // DELETE error
  server.use(
    rest.delete(`${API_BASE}/todos/:id`, (req, res, ctx) =>
      res(ctx.status(500), ctx.json({ message: 'Failed to delete' }))
    )
  );
  const delBtn = screen.getAllByRole('button', { name: /delete/i })[0];
  fireEvent.click(delBtn);
  await waitFor(() =>
    expect(screen.getByText('Failed to delete todo')).toBeInTheDocument()
  );
});

test('shows loading state on initial load and when submitting', async () => {
  // Simulate slow GET
  server.use(
    rest.get(`${API_BASE}/todos`, (req, res, ctx) =>
      res(ctx.delay(300), ctx.status(200), ctx.json(mockTodos))
    )
  );
  render(<App />);
  expect(screen.getByText(/loading tasks/i)).toBeInTheDocument();
  await waitForTodosToLoad();
});
