// settings.test.tsx — integration tests for the user-facing SettingsModal.
// Opens the modal via the TopBar settings button and verifies the new
// end-user sections are present and the internal/demo controls are gone.

import { render, screen, fireEvent } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from '../../App';

test('Settings modal shows user-facing sections, not internal demo controls', () => {
  render(<App />);

  // Closed initially
  expect(screen.queryByText('Detection sensitivity')).not.toBeInTheDocument();

  // Open via TopBar settings button (title="Settings")
  fireEvent.click(screen.getByTitle('Settings'));

  // New user-facing sections
  expect(screen.getByText('Detection sensitivity')).toBeInTheDocument();
  expect(screen.getByText('User preferences')).toBeInTheDocument();
  expect(screen.getByText('Display preferences')).toBeInTheDocument();
  expect(screen.getByText('Notifications')).toBeInTheDocument();
  expect(screen.getByText('Workspace context')).toBeInTheDocument();

  // Internal/demo controls removed
  expect(screen.queryByText('Customer vertical')).not.toBeInTheDocument();
  expect(screen.queryByText('Rule packs')).not.toBeInTheDocument();
  expect(screen.queryByText('SaaS')).not.toBeInTheDocument();
  expect(screen.queryByText(/Mocked validation/i)).not.toBeInTheDocument();

  // Workspace context is read-only / auto-managed (Customer + Cloud both "Auto-detected")
  expect(screen.getAllByText('Auto-detected').length).toBeGreaterThan(0);
  expect(screen.getByText('Managed automatically')).toBeInTheDocument();
});

test('Selecting Flexible sensitivity keeps the modal open', () => {
  render(<App />);
  fireEvent.click(screen.getByTitle('Settings'));
  fireEvent.click(screen.getByRole('button', { name: 'Flexible' }));
  expect(screen.getByText('Detection sensitivity')).toBeInTheDocument();
});

test('Clicking Done closes the modal', () => {
  render(<App />);
  fireEvent.click(screen.getByTitle('Settings'));
  expect(screen.getByText('Detection sensitivity')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  expect(screen.queryByText('Detection sensitivity')).not.toBeInTheDocument();
});
