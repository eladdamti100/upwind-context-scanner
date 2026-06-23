// overview.test.tsx — Overview landing dashboard: default tab, KPIs, navigation.

import { render, screen, fireEvent } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from '../../App';
import { FINDINGS } from '../../data';

test('app opens on the Overview tab by default', () => {
  render(<App />);
  expect(screen.getByTestId('overview-view')).toBeInTheDocument();
  expect(screen.getByText('Needs attention now')).toBeInTheDocument();
});

test('Overview shows the four KPI cards', () => {
  render(<App />);
  // "Active credentials" is both a KPI label and the funnel stage → use getAllByText.
  expect(screen.getAllByText('Active credentials').length).toBeGreaterThan(0);
  expect(screen.getByText('High priority findings')).toBeInTheDocument();
  expect(screen.getByText('Publicly exposed')).toBeInTheDocument();
  expect(screen.getAllByText('Noise reduced').length).toBeGreaterThan(0);
});

test('Overview metrics are backend-derived, not mock numbers', () => {
  render(<App />);
  const text = screen.getByTestId('overview-view').textContent ?? '';
  // raw-candidates count equals the real dataset size
  expect(screen.getAllByText(String(FINDINGS.length)).length).toBeGreaterThan(0);
  // the old hardcoded mock numbers must be gone
  expect(text).not.toContain('1,248');
  expect(text).not.toContain('188');
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
  expect(screen.getByText('Context-aware surfaced')).toBeInTheDocument();
  expect(screen.getByText('Noise / false positives reduced')).toBeInTheDocument();
  // funnel's last stage shares the 'Active credentials' label with the KPI card
  expect(screen.getAllByText('Active credentials').length).toBeGreaterThan(0);
});

test('Overview renders no secret-like values (no mask glyphs)', () => {
  render(<App />);
  const text = screen.getByTestId('overview-view').textContent ?? '';
  expect(text).not.toMatch(/[•*]/);
  expect(text).not.toMatch(/AKIA/);
  expect(text).not.toMatch(/sk_live_/);
  expect(text).not.toMatch(/ghp_/);
});
