// drawer.test.tsx — integration tests for DetailDrawer via App

import { render, screen, fireEvent } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from '../../App';

function getFirstDataRow() {
  // The first tbody tr is the highest-risk finding (sorted by risk desc)
  const rows = document.querySelectorAll('tbody tr');
  return rows[0] as HTMLElement;
}

function openFirstDetail() {
  const eyeButton = screen.getAllByTitle('View detail')[0];
  fireEvent.click(eyeButton);
}

test('clicking a data row does NOT open the drawer', () => {
  render(<App />);

  const row = getFirstDataRow();
  expect(row).not.toBeNull();
  fireEvent.click(row);

  // The drawer must stay closed — its "Score breakdown" label should be absent.
  expect(screen.queryByText('Score breakdown')).not.toBeInTheDocument();
});

test('the eye icon opens the drawer with a masked value and score breakdown', () => {
  render(<App />);

  openFirstDetail();

  // Drawer should show a masked value (contains • or *)
  const maskedEls = screen.getAllByText(/[•*]/);
  expect(maskedEls.length).toBeGreaterThan(0);

  // Drawer should show the "Score breakdown" section label
  expect(screen.getByText('Score breakdown')).toBeInTheDocument();

  // Drawer should show the first recommended action
  expect(screen.getByText('Rotate this secret')).toBeInTheDocument();
});

test('closing the drawer hides the score breakdown', () => {
  render(<App />);

  openFirstDetail();

  // Confirm drawer is open
  expect(screen.getByText('Score breakdown')).toBeInTheDocument();

  // Click the close button
  const closeBtn = screen.getByRole('button', { name: /close detail/i });
  fireEvent.click(closeBtn);

  // Score breakdown should no longer be visible
  expect(screen.queryByText('Score breakdown')).not.toBeInTheDocument();
});
