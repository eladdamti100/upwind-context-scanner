import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from '../../App';
import { FINDINGS } from '../../data';
import { effPriority } from '../../lib/priority';

function expectedCriticalCount() {
  return FINDINGS.filter((f) => effPriority(f, 'balanced') === 'critical').length;
}

test('SummaryCards shows Critical findings label and correct count', () => {
  render(<App />);
  expect(screen.getByText('Critical findings')).toBeInTheDocument();
  const count = expectedCriticalCount();
  const allNums = screen.getAllByText(String(count));
  expect(allNums.length).toBeGreaterThan(0);
});

test('search box reflects typed value', async () => {
  render(<App />);
  const input = screen.getByPlaceholderText('Search findings…') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'phi' } });
  expect(input.value).toBe('phi');
});

test('Add filters → Cloud: AWS creates chip', async () => {
  render(<App />);
  const addBtn = screen.getByText('Add filters');
  fireEvent.click(addBtn);
  const awsOption = await screen.findByText('Cloud: AWS');
  fireEvent.click(awsOption);
  await waitFor(() => {
    expect(screen.getByText('Cloud is AWS')).toBeInTheDocument();
  });
});
