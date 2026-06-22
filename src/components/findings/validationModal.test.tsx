// validationModal.test.tsx — integration tests for ValidationModal via App

import { render, screen, fireEvent, act } from '@testing-library/react';
import { test, expect, vi, afterEach } from 'vitest';
import App from '../../App';

afterEach(() => {
  vi.useRealTimers();
});

test('clicking "Run validation" on a Stripe finding updates the chip to "Validated active"', async () => {
  vi.useFakeTimers();

  render(<App />);

  // The Stripe Secret Key row (id=2) has validation='not-validated', so a "Validate" button appears.
  // getAllByRole finds all "Validate" buttons; Stripe is the second row by default sort (risk desc),
  // so its "Validate" button is among the first ones in the DOM.
  const validateButtons = screen.getAllByRole('button', { name: /validate/i });
  expect(validateButtons.length).toBeGreaterThan(0);

  // Find the one in the Stripe row — look for a cell near "Stripe Secret Key" text.
  // The Stripe row has "not-validated" status, so the first Validate button that opens the
  // modal for id=2 is what we want. We click the first validate button (risk sorted desc,
  // Stripe is the only not-validated finding with canValidate=true at risk 84).
  // AWS (risk 96) is already 'validated-active' (canValidate=false), so first Validate = Stripe.
  fireEvent.click(validateButtons[0]);

  // The modal should open
  expect(screen.getByRole('dialog', { name: 'Validate credential' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /run validation/i })).toBeInTheDocument();

  // Click "Run validation"
  fireEvent.click(screen.getByRole('button', { name: /run validation/i }));

  // Modal closes immediately (START_VALIDATION clears valModalId)
  expect(screen.queryByRole('dialog', { name: 'Validate credential' })).not.toBeInTheDocument();

  // Advance timers past VALIDATION_DELAY_MS (1500ms)
  await act(async () => {
    vi.advanceTimersByTime(1600);
  });

  // Stripe is 'stripe-secret-key' → ACTIVE_TYPES → 'validated-active' → label "Validated active"
  // getAllByText handles cases where multiple rows may show "Validated active"
  expect(screen.getAllByText('Validated active').length).toBeGreaterThan(0);
});

test('Cancel button closes the validation modal without running validation', () => {
  render(<App />);

  const validateButtons = screen.getAllByRole('button', { name: /validate/i });
  fireEvent.click(validateButtons[0]);

  expect(screen.getByRole('dialog', { name: 'Validate credential' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

  expect(screen.queryByRole('dialog', { name: 'Validate credential' })).not.toBeInTheDocument();
});
