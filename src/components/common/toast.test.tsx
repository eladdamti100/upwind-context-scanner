import { render, screen, fireEvent, act } from '@testing-library/react';
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import App from '../../App';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('toast appears on action and auto-dismisses after ~3s', () => {
  render(<App />);

  // "Save view" on the findings toolbar synchronously shows a toast.
  fireEvent.click(screen.getByText('Save view'));
  expect(screen.getByText('View saved')).toBeInTheDocument();

  // It should still be there just before the timeout.
  act(() => {
    vi.advanceTimersByTime(2500);
  });
  expect(screen.queryByText('View saved')).toBeInTheDocument();

  // ...and gone shortly after the ~3s auto-dismiss window.
  act(() => {
    vi.advanceTimersByTime(800);
  });
  expect(screen.queryByText('View saved')).not.toBeInTheDocument();
});
