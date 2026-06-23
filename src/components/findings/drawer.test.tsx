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

function getDrawer(): HTMLElement {
  return screen.getByRole('dialog', { name: /finding detail/i });
}

test('clicking a data row does NOT open the drawer', () => {
  render(<App />);

  const row = getFirstDataRow();
  expect(row).not.toBeNull();
  fireEvent.click(row);

  // The drawer must stay closed — its "Score breakdown" label should be absent.
  expect(screen.queryByText('Score breakdown')).not.toBeInTheDocument();
});

test('the eye icon opens the drawer with score breakdown and a recommended action', () => {
  render(<App />);

  openFirstDetail();

  // Drawer should show the "Score breakdown" section label
  expect(screen.getByText('Score breakdown')).toBeInTheDocument();

  // Drawer should show the first recommended action
  expect(screen.getByText('Rotate this secret')).toBeInTheDocument();
});

test('the detail panel never renders a secret value — not even masked', () => {
  render(<App />);

  openFirstDetail();

  // No secret value of any kind in the panel: no mask glyphs (• / *), and no
  // raw/fragment secret patterns.
  const text = getDrawer().textContent ?? '';
  expect(text).not.toMatch(/[•*]/);
  expect(text).not.toMatch(/AKIA/);
  expect(text).not.toMatch(/sk_live_/);
  expect(text).not.toMatch(/ghp_/);
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
