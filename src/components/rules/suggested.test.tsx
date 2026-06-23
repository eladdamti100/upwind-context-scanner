import { render, screen, fireEvent } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from '../../App';
import { SUGGESTED_RULES, FINDINGS } from '../../data';

function openAddRules() {
  render(<App />);
  fireEvent.click(screen.getByText('Data classifications'));
  fireEvent.click(screen.getByText('Add rules'));
}

test('suggested-rule counts are derived and never exceed the corpus', () => {
  for (const r of SUGGESTED_RULES) {
    expect(r.affectedFindingsCount).toBeLessThanOrEqual(FINDINGS.length);
    expect(r.affectedFindingsCount).toBeGreaterThanOrEqual(0);
  }
  // The old fabricated counts must be gone everywhere.
  openAddRules();
  const text = document.body.textContent ?? '';
  expect(text).not.toContain('4,310');
  expect(text).not.toContain('1,902');
});

test('Add rules modal opens with Upwind recommended rules', () => {
  openAddRules();
  expect(screen.getByText('Recommended by Upwind')).toBeInTheDocument();
  expect(screen.getByText('Suppress placeholder tokens in documentation')).toBeInTheDocument();
});

test('dismissing a recommended rule shows a Dismissed chip and removes its buttons', () => {
  openAddRules();
  const dismissButtons = screen.getAllByText('Dismiss');
  expect(dismissButtons.length).toBeGreaterThan(0);
  fireEvent.click(dismissButtons[0]);
  expect(screen.getByText('Dismissed')).toBeInTheDocument();
  expect(screen.getAllByText('Dismiss').length).toBe(dismissButtons.length - 1);
});

test('Create custom rule tab exposes manual and natural-language modes', () => {
  openAddRules();
  fireEvent.click(screen.getByText('Create custom rule'));
  expect(screen.getByText('Manual form')).toBeInTheDocument();
  expect(screen.getByText('Natural language')).toBeInTheDocument();
});

test('natural-language builder produces a mocked draft preview', () => {
  openAddRules();
  fireEvent.click(screen.getByText('Create custom rule'));
  fireEvent.click(screen.getByText('Natural language'));
  const textarea = screen.getByPlaceholderText(/Downgrade API-key/i);
  fireEvent.change(textarea, { target: { value: 'Suppress example tokens in README documentation' } });
  fireEvent.click(screen.getByText('Generate rule'));
  expect(screen.getByText('Rule preview')).toBeInTheDocument();
});
