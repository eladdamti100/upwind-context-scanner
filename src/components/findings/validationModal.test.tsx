// validationModal.test.tsx — credential-check flow via the row actions menu.
// The inline table button was removed; the check is launched from the
// three-dot row menu ("Run credential check") which opens ValidationModal.

import { render, screen, fireEvent, act } from '@testing-library/react';
import { test, expect, vi, afterEach } from 'vitest';
import App from '../../App';

afterEach(() => {
  vi.useRealTimers();
});

// Open row menus until one exposes an enabled "Run credential check" item.
function openRunnableCheck() {
  const moreButtons = screen.getAllByTitle('More actions');
  for (const btn of moreButtons) {
    fireEvent.click(btn);
    const item = screen.queryByText('Run credential check'); // exact — skips "(unavailable)"
    if (item) return item;
  }
  return null;
}

test('running a credential check from the row menu updates the chip', async () => {
  vi.useFakeTimers();
  render(<App />);

  const runItem = openRunnableCheck();
  expect(runItem).not.toBeNull();

  // Menu item opens the modal
  fireEvent.click(runItem!);
  const runBtn = screen.getByRole('button', { name: 'Run credential check' });
  expect(runBtn).toBeInTheDocument();

  // Run it — modal closes immediately (START_VALIDATION clears valModalId)
  fireEvent.click(runBtn);
  expect(screen.queryByRole('button', { name: 'Run credential check' })).not.toBeInTheDocument();

  // Advance past VALIDATION_DELAY_MS (1500ms) — check resolves
  await act(async () => {
    vi.advanceTimersByTime(1600);
  });

  // A resolved credential-check chip is shown
  expect(screen.getAllByText(/Active credential|Inactive/).length).toBeGreaterThan(0);
});

test('Cancel closes the credential-check modal without running it', () => {
  render(<App />);

  const runItem = openRunnableCheck();
  expect(runItem).not.toBeNull();
  fireEvent.click(runItem!);

  expect(screen.getByRole('button', { name: 'Run credential check' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

  expect(screen.queryByRole('button', { name: 'Run credential check' })).not.toBeInTheDocument();
});
