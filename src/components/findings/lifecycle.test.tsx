// lifecycle.test.tsx — integration tests for LifecycleDialog via App

import { render, screen, fireEvent } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from '../../App';

function getFirstDataRow(): HTMLElement {
  const rows = document.querySelectorAll('tbody tr');
  return rows[0] as HTMLElement;
}

test('opens LifecycleDialog from drawer and shows "Manage finding" with a "Resolved" option', async () => {
  render(<App />);

  // Click the first data row
  const row = getFirstDataRow();
  expect(row).not.toBeNull();
  fireEvent.click(row);

  // The drawer should be open; click "Manage status"
  const manageBtn = screen.getByRole('button', { name: /manage status/i });
  fireEvent.click(manageBtn);

  // Dialog should show the title
  expect(screen.getByText('Manage finding')).toBeInTheDocument();

  // "Resolved" button should be present
  expect(screen.getByRole('button', { name: /^Resolved$/i })).toBeInTheDocument();
});

test('clicking "Resolved" closes the LifecycleDialog', async () => {
  render(<App />);

  // Open the drawer
  const row = getFirstDataRow();
  fireEvent.click(row);

  // Open the lifecycle dialog
  const manageBtn = screen.getByRole('button', { name: /manage status/i });
  fireEvent.click(manageBtn);

  // Confirm dialog is open
  expect(screen.getByText('Manage finding')).toBeInTheDocument();

  // Click "Resolved"
  const resolvedBtn = screen.getByRole('button', { name: /^Resolved$/i });
  fireEvent.click(resolvedBtn);

  // Dialog should be closed (title gone from DOM)
  expect(screen.queryByText('Manage finding')).not.toBeInTheDocument();
});
