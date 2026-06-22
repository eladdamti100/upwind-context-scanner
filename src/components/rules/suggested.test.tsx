import { render, screen, fireEvent } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from '../../App';

test('classifications tab shows Suggested rules heading and first rule title', () => {
  render(<App />);

  // Click the "Data classifications" tab
  fireEvent.click(screen.getByText('Data classifications'));

  // The "Suggested rules" heading should be visible
  expect(screen.getByText('Suggested rules')).toBeInTheDocument();

  // The first rule title should be visible
  expect(screen.getByText('Suppress placeholder tokens in documentation')).toBeInTheDocument();
});

test('dismissing a rule hides Approve/Dismiss buttons and shows Dismissed chip', () => {
  render(<App />);

  // Click the "Data classifications" tab
  fireEvent.click(screen.getByText('Data classifications'));

  // The Approve and Dismiss buttons for rule sr-1 should be visible initially
  // Find the Dismiss button associated with "Suppress placeholder tokens in documentation"
  // There may be multiple Dismiss buttons (one per rule), so we get all and click the first
  const dismissButtons = screen.getAllByText('Dismiss');
  expect(dismissButtons.length).toBeGreaterThan(0);

  // Click the first Dismiss button (for "Suppress placeholder tokens in documentation")
  fireEvent.click(dismissButtons[0]);

  // A "Dismissed" status chip should appear
  expect(screen.getByText('Dismissed')).toBeInTheDocument();

  // The Approve and Dismiss buttons for sr-1 should be gone
  // (the other rules still have their buttons, so we check that sr-1's section no longer has them)
  // After dismiss, the count of Dismiss buttons should be reduced by 1
  const remainingDismissButtons = screen.getAllByText('Dismiss');
  expect(remainingDismissButtons.length).toBe(dismissButtons.length - 1);
});
