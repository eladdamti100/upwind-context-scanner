// drawer.test.tsx — integration tests for DetailDrawer via App

import { render, screen, fireEvent } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from '../../App';

test('clicking an AWS Access Key row opens the drawer with masked value and score breakdown', () => {
  render(<App />);

  // Find the table row that contains "AWS Access Key" text and click it
  const awsRows = screen.getAllByText('AWS Access Key');
  // The first occurrence in the table body is the classification chip in the row
  // Click the closest <tr> ancestor
  const row = awsRows[0].closest('tr');
  expect(row).not.toBeNull();
  fireEvent.click(row!);

  // Drawer should show the masked value
  expect(screen.getByText('AKIA••••••••5T2Q')).toBeInTheDocument();

  // Drawer should show the "Score breakdown" section label
  expect(screen.getByText('Score breakdown')).toBeInTheDocument();

  // Drawer should show the first recommended action
  expect(screen.getByText('Rotate this secret')).toBeInTheDocument();
});

test('closing the drawer hides the masked value', () => {
  render(<App />);

  // Open drawer
  const awsRows = screen.getAllByText('AWS Access Key');
  const row = awsRows[0].closest('tr');
  fireEvent.click(row!);

  // Confirm it's open
  expect(screen.getByText('AKIA••••••••5T2Q')).toBeInTheDocument();

  // Click the close button
  const closeBtn = screen.getByRole('button', { name: /close detail/i });
  fireEvent.click(closeBtn);

  // Masked value should no longer be visible
  expect(screen.queryByText('AKIA••••••••5T2Q')).not.toBeInTheDocument();
});
