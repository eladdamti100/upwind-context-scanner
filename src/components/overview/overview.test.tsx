// overview.test.tsx — Overview landing dashboard: default tab, KPIs, navigation.

import { render, screen, fireEvent } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from '../../App';

test('app opens on the Overview tab by default', () => {
  render(<App />);
  expect(screen.getByTestId('overview-view')).toBeInTheDocument();
  expect(screen.getByText('Needs attention now')).toBeInTheDocument();
});

test('Overview shows the four KPI cards', () => {
  render(<App />);
  expect(screen.getByText('Active credentials')).toBeInTheDocument();
  expect(screen.getByText('High priority findings')).toBeInTheDocument();
  expect(screen.getByText('Publicly exposed assets')).toBeInTheDocument();
  // "Noise reduced" appears as both the KPI label and the bottom card title.
  expect(screen.getAllByText('Noise reduced').length).toBeGreaterThan(0);
});

test('"View exposed findings" navigates to the findings table', () => {
  render(<App />);
  fireEvent.click(screen.getByText('View exposed findings'));
  // Findings toolbar landmark
  expect(screen.getByText(/context-aware findings/)).toBeInTheDocument();
});

test('Overview shows the noise-reduction funnel with its four stages', () => {
  render(<App />);
  expect(screen.getByText('How SignalLens reduces noise to surface real risk')).toBeInTheDocument();
  expect(screen.getByText('Raw regex candidates')).toBeInTheDocument();
  expect(screen.getByText('Context-aware filtering')).toBeInTheDocument();
  expect(screen.getByText('Noise / false positives reduced')).toBeInTheDocument();
  expect(screen.getByText('High-value surfaced findings')).toBeInTheDocument();
});

test('Overview renders no secret-like values (no mask glyphs)', () => {
  render(<App />);
  const text = screen.getByTestId('overview-view').textContent ?? '';
  expect(text).not.toMatch(/[•*]/);
  expect(text).not.toMatch(/AKIA/);
  expect(text).not.toMatch(/sk_live_/);
  expect(text).not.toMatch(/ghp_/);
});
