// lifecycle.test.tsx — integration tests for LifecycleDialog via App

import { render, screen, fireEvent } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from '../../App';

test('opens LifecycleDialog from drawer and shows "Manage finding" with a "Resolved" option', async () => {
  render(<App />);

  // Click the table row containing "AWS Access Key"
  const awsRows = screen.getAllByText('AWS Access Key');
  const row = awsRows[0].closest('tr');
  expect(row).not.toBeNull();
  fireEvent.click(row!);

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
  const awsRows = screen.getAllByText('AWS Access Key');
  const row = awsRows[0].closest('tr');
  fireEvent.click(row!);

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
