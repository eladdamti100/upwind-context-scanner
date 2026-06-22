import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from '../../App';
import { FINDINGS } from '../../data/placeholder';

test('FindingsTable renders column headers', () => {
  render(<App />);
  expect(screen.getByText('Remediation priority')).toBeInTheDocument();
  expect(screen.getByText('Risk score')).toBeInTheDocument();
});

test('FindingsTable renders AWS Access Key and Stripe Secret Key rows', () => {
  render(<App />);
  expect(screen.getByText('AWS Access Key')).toBeInTheDocument();
  expect(screen.getByText('Stripe Secret Key')).toBeInTheDocument();
});

test('FindingsTable default sort (risk desc) places AWS Access Key before Stripe Secret Key', () => {
  render(<App />);
  const cells = screen.getAllByText(/AWS Access Key|Stripe Secret Key/);
  const awsIndex = cells.findIndex(el => el.textContent === 'AWS Access Key');
  const stripeIndex = cells.findIndex(el => el.textContent === 'Stripe Secret Key');
  expect(awsIndex).toBeGreaterThanOrEqual(0);
  expect(stripeIndex).toBeGreaterThanOrEqual(0);
  expect(awsIndex).toBeLessThan(stripeIndex);
});

test('FindingsTable shows result count containing total findings length', () => {
  render(<App />);
  const total = FINDINGS.length;
  // "of 6 context-aware findings" (or whatever the total is)
  const countText = screen.getByText(new RegExp(`of ${total}`));
  expect(countText).toBeInTheDocument();
});
