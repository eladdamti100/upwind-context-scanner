import { render, screen, fireEvent } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from '../../App';
import { FINDINGS } from '../../data';

test('FindingsTable renders column headers', () => {
  render(<App />);
  expect(screen.getByText('Remediation priority')).toBeInTheDocument();
  expect(screen.getByText('Confidence Level')).toBeInTheDocument();
});

test('header info icons reveal their tooltips', () => {
  render(<App />);

  // Confidence Level
  fireEvent.click(screen.getByLabelText('What is Confidence Level?'));
  expect(screen.getByText(/Confidence Level estimates how likely/)).toBeInTheDocument();

  // Remediation Priority (clicking it closes the first via outside-click)
  fireEvent.click(screen.getByLabelText('What is Remediation Priority?'));
  expect(screen.getByText(/Remediation Priority indicates how urgently/)).toBeInTheDocument();
});

test('row three-dot menu opens meaningful actions', () => {
  render(<App />);
  const moreButtons = screen.getAllByTitle('More actions');
  expect(moreButtons.length).toBeGreaterThan(0);
  fireEvent.click(moreButtons[0]);
  expect(screen.getByText('Open details')).toBeInTheDocument();
  expect(screen.getByText('Copy file path')).toBeInTheDocument();
  expect(screen.getByText('Change lifecycle status')).toBeInTheDocument();
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
