// settings.test.tsx — integration tests for SettingsModal via App.
// Render the full App, open the modal via the TopBar settings button,
// exercise sensitivity + vertical selection, then close via Done.

import { render, screen, fireEvent } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from '../../App';

test('Settings modal opens, shows all sections and vertical labels', () => {
  render(<App />);

  // Modal is closed initially
  expect(screen.queryByText('Scanner sensitivity')).not.toBeInTheDocument();

  // Open via TopBar settings button (title="Settings")
  fireEvent.click(screen.getByTitle('Settings'));

  // Core section heading visible
  expect(screen.getByText('Scanner sensitivity')).toBeInTheDocument();

  // All five vertical labels must be visible
  expect(screen.getByText('SaaS')).toBeInTheDocument();
  expect(screen.getByText('Fintech')).toBeInTheDocument();
  expect(screen.getByText('Retail')).toBeInTheDocument();
  expect(screen.getByText('Healthcare')).toBeInTheDocument();
  expect(screen.getByText('General / Default')).toBeInTheDocument();
});

test('Selecting Flexible sensitivity and Fintech vertical keeps modal open', () => {
  render(<App />);

  fireEvent.click(screen.getByTitle('Settings'));

  // Click the "Flexible" segment
  fireEvent.click(screen.getByRole('button', { name: 'Flexible' }));

  // Click the "Fintech" vertical chip
  fireEvent.click(screen.getByRole('button', { name: 'Fintech' }));

  // Modal must still be open
  expect(screen.getByText('Scanner sensitivity')).toBeInTheDocument();
});

test('Clicking Done closes the modal', () => {
  render(<App />);

  fireEvent.click(screen.getByTitle('Settings'));

  // Modal open
  expect(screen.getByText('Scanner sensitivity')).toBeInTheDocument();

  // Click Done
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));

  // Modal closed
  expect(screen.queryByText('Scanner sensitivity')).not.toBeInTheDocument();
});
