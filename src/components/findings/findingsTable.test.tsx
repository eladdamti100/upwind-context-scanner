import { render, screen, fireEvent } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from '../../App';
import { FINDINGS } from '../../data';

test('FindingsTable renders column headers', () => {
  render(<App />);
  fireEvent.click(screen.getByText('Exposed Sensitive Data'));
  expect(screen.getByText('Remediation priority')).toBeInTheDocument();
  expect(screen.getByText('% Confidence')).toBeInTheDocument();
});

test('header info icons reveal their tooltips', () => {
  render(<App />);
  fireEvent.click(screen.getByText('Exposed Sensitive Data'));

  // % Confidence
  fireEvent.click(screen.getByLabelText('What is Confidence?'));
  expect(screen.getByText(/Confidence estimates how likely/)).toBeInTheDocument();

  // Remediation Priority (clicking it closes the first via outside-click)
  fireEvent.click(screen.getByLabelText('What is Remediation Priority?'));
  expect(screen.getByText(/Remediation Priority indicates how urgently/)).toBeInTheDocument();
});

test('row three-dot opens the centered Finding actions modal', () => {
  render(<App />);
  fireEvent.click(screen.getByText('Exposed Sensitive Data'));
  const moreButtons = screen.getAllByTitle('More actions');
  expect(moreButtons.length).toBeGreaterThan(0);
  fireEvent.click(moreButtons[0]);

  // Centered modal with a title and the available actions.
  expect(screen.getByText('Finding actions')).toBeInTheDocument();
  expect(screen.getByText('Open details')).toBeInTheDocument();
  expect(screen.getByText('Copy file path')).toBeInTheDocument();
  expect(screen.getByText('Change lifecycle status')).toBeInTheDocument();
  expect(screen.getByText('Mark as false positive')).toBeInTheDocument();
});

test('the Finding actions modal closes via its close button', () => {
  render(<App />);
  fireEvent.click(screen.getByText('Exposed Sensitive Data'));
  fireEvent.click(screen.getAllByTitle('More actions')[0]);
  expect(screen.getByText('Finding actions')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /close finding actions/i }));
  expect(screen.queryByText('Finding actions')).not.toBeInTheDocument();
});

test('column picker locks required columns (no checkbox) and toggles optional ones', () => {
  render(<App />);
  fireEvent.click(screen.getByText('Exposed Sensitive Data'));

  // Open the column picker.
  fireEvent.click(screen.getByTitle('Columns'));

  // No "Required"/"Fixed" labels — required columns are simply checkbox-less.
  expect(screen.queryByText('REQUIRED')).not.toBeInTheDocument();
  expect(screen.queryByText('Required')).not.toBeInTheDocument();
  expect(screen.queryByText('Fixed')).not.toBeInTheDocument();

  // There are 7 required columns → at most (total − 7) checkboxes for optional ones.
  const checkboxes = screen.getAllByRole('checkbox');
  expect(checkboxes.length).toBe(6); // owner, environment, exposure, cloud, createdAt, explanation
});

test('FindingsTable renders at least one row', () => {
  render(<App />);
  fireEvent.click(screen.getByText('Exposed Sensitive Data'));
  // getAllByRole('row') includes the header row; must have more than 1
  expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
});

test('FindingsTable shows result count containing total findings length', () => {
  render(<App />);
  fireEvent.click(screen.getByText('Exposed Sensitive Data'));
  const total = FINDINGS.length;
  // Top toolbar: "of N context-aware findings" (unique phrasing)
  const countText = screen.getByText(new RegExp(`of ${total} context-aware findings`));
  expect(countText).toBeInTheDocument();
});

test('pagination shows 10 rows, page count, range, and navigates', () => {
  render(<App />);
  fireEvent.click(screen.getByText('Exposed Sensitive Data'));
  const total = FINDINGS.length;
  const totalPages = Math.ceil(total / 10);

  // Default 10 rows per page (body rows only — exclude the header row).
  expect(document.querySelectorAll('tbody tr').length).toBe(10);

  // Page indicator + range for page 1.
  expect(screen.getByText(`Page 1 of ${totalPages}`)).toBeInTheDocument();
  expect(screen.getByText(`Showing 1–10 of ${total} findings`)).toBeInTheDocument();

  // Previous is disabled on the first page.
  const prev = screen.getByRole('button', { name: /previous/i });
  expect(prev).toBeDisabled();

  // Next advances to page 2 → range shifts, still 10 rows.
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
  expect(screen.getByText(`Page 2 of ${totalPages}`)).toBeInTheDocument();
  expect(screen.getByText(`Showing 11–20 of ${total} findings`)).toBeInTheDocument();
  expect(document.querySelectorAll('tbody tr').length).toBe(10);

  // Previous is enabled now and returns to page 1.
  expect(screen.getByRole('button', { name: /previous/i })).not.toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /previous/i }));
  expect(screen.getByText(`Page 1 of ${totalPages}`)).toBeInTheDocument();
});

test('searching resets to page 1 and updates the range total', () => {
  render(<App />);
  fireEvent.click(screen.getByText('Exposed Sensitive Data'));
  const totalPages = Math.ceil(FINDINGS.length / 10);

  // Move off page 1 first.
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
  expect(screen.getByText(`Page 2 of ${totalPages}`)).toBeInTheDocument();

  // Typing a search resets pagination to page 1.
  const input = screen.getByPlaceholderText('Search findings…') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'aws' } });
  expect(screen.getByText(/^Page 1 of/)).toBeInTheDocument();
});
