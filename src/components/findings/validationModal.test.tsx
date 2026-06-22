// validationModal.test.tsx — integration tests for ValidationModal via App

import { render, screen, fireEvent, act } from '@testing-library/react';
import { test, expect, vi, afterEach } from 'vitest';
import App from '../../App';

afterEach(() => {
  vi.useRealTimers();
});

test('clicking "Run validation" on the first available Validate button updates the chip', async () => {
  vi.useFakeTimers();

  render(<App />);

  // Open the validation modal via the first available "Validate" button
  const validateButtons = screen.getAllByText('Validate');
  expect(validateButtons.length).toBeGreaterThan(0);

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

  // After validation completes, the chip should show a validated state
  expect(screen.getAllByText(/Validated (active|inactive)/).length).toBeGreaterThan(0);
});

test('Cancel button closes the validation modal without running validation', () => {
  render(<App />);

  const validateButtons = screen.getAllByText('Validate');
  fireEvent.click(validateButtons[0]);

  expect(screen.getByRole('dialog', { name: 'Validate credential' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

  expect(screen.queryByRole('dialog', { name: 'Validate credential' })).not.toBeInTheDocument();
});
