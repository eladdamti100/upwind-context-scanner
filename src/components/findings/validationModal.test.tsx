// validationModal.test.tsx — credential-check flow via the row actions modal.
// The inline table button was removed; the check is launched from the
// three-dot "Finding actions" modal ("Run credential check") which opens
// the ValidationModal.

import { render, screen, fireEvent, act } from '@testing-library/react';
import { test, expect, vi, afterEach } from 'vitest';
import App from '../../App';

afterEach(() => {
  vi.useRealTimers();
});

// Open the row actions modal for each finding until one exposes an ENABLED
// "Run credential check" action (disabled ones share the same label).
function openRunnableCheck() {
  const moreButtons = screen.getAllByTitle('More actions');
  for (const btn of moreButtons) {
    fireEvent.click(btn);
    const enabled = screen
      .queryAllByText('Run credential check')
      .map(el => el.closest('button'))
      .find(b => b && !(b as HTMLButtonElement).disabled);
    if (enabled) return enabled as HTMLButtonElement;
    // Not available for this finding — close the modal and try the next row.
    fireEvent.click(screen.getByRole('button', { name: /close finding actions/i }));
  }
  return null;
}

test('running a credential check from the row menu updates the chip', async () => {
  vi.useFakeTimers();
  render(<App />);

  const runItem = openRunnableCheck();
  expect(runItem).not.toBeNull();

  // The action opens the confirmation modal with context + safety copy
  fireEvent.click(runItem!);
  expect(screen.getByText('Run credential check?')).toBeInTheDocument();
  expect(screen.getByText('Checks against')).toBeInTheDocument();
  expect(screen.getByText('The raw secret is not stored.')).toBeInTheDocument();
  const runBtn = screen.getByRole('button', { name: 'Run check' });
  expect(runBtn).toBeInTheDocument();

  // Run it — modal closes immediately (START_VALIDATION clears valModalId)
  fireEvent.click(runBtn);
  expect(screen.queryByRole('button', { name: 'Run check' })).not.toBeInTheDocument();

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

  expect(screen.getByRole('button', { name: 'Run check' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

  expect(screen.queryByRole('button', { name: 'Run check' })).not.toBeInTheDocument();
});
