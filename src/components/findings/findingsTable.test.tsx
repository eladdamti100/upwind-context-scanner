import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from '../../App';
import { FINDINGS } from '../../data';

test('FindingsTable renders column headers', () => {
  render(<App />);
  expect(screen.getByText('Remediation priority')).toBeInTheDocument();
  expect(screen.getByText('Risk score')).toBeInTheDocument();
});

test('FindingsTable renders at least one row', () => {
  render(<App />);
  // getAllByRole('row') includes the header row; must have more than 1
  expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
});

test('FindingsTable shows result count containing total findings length', () => {
  render(<App />);
  const total = FINDINGS.length;
  // "of N context-aware findings"
  const countText = screen.getByText(new RegExp(`of ${total}`));
  expect(countText).toBeInTheDocument();
});
