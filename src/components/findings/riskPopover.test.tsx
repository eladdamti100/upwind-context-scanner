// riskPopover.test.tsx — integration tests for RiskPopover via App

import { render, screen, fireEvent } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from '../../App';

test('clicking "Why this score?" button opens the risk breakdown modal', () => {
  render(<App />);

  // Find the first "Why this score?" info button (one per risk cell row)
  const infoButtons = screen.getAllByRole('button', { name: 'Why this score?' });
  expect(infoButtons.length).toBeGreaterThan(0);

  fireEvent.click(infoButtons[0]);

  // Modal title should appear
  expect(screen.getByText('Why this score?')).toBeInTheDocument();

  // Breakdown bars from buildBreakdown include these labels — getAllByText handles
  // the case where "Remediation priority" also appears as a table column header.
  expect(screen.getAllByText('Remediation priority').length).toBeGreaterThan(0);
});

test('risk breakdown modal shows authenticity score label', () => {
  render(<App />);

  const infoButtons = screen.getAllByRole('button', { name: 'Why this score?' });
  fireEvent.click(infoButtons[0]);

  expect(screen.getByText('Authenticity score')).toBeInTheDocument();
});

test('closing the risk breakdown modal via backdrop click hides it', () => {
  render(<App />);

  const infoButtons = screen.getAllByRole('button', { name: 'Why this score?' });
  fireEvent.click(infoButtons[0]);

  // Confirm modal is open
  const dialog = screen.getByRole('dialog', { name: 'Risk score breakdown' });
  expect(dialog).toBeInTheDocument();

  // Click the backdrop (the dialog element itself, outside the card)
  fireEvent.click(dialog);

  // After closing, the modal title no longer appears outside the table header area
  // (the column header "Risk score" still exists, but "Why this score?" heading should be gone)
  expect(screen.queryByRole('dialog', { name: 'Risk score breakdown' })).not.toBeInTheDocument();
});
