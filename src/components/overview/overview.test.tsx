// overview.test.tsx — Overview landing dashboard: default tab, KPIs, navigation.

import { render, screen, fireEvent } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from '../../App';
import { FINDINGS, MAP_ASSETS } from '../../data';
import { effPriority } from '../../lib/priority';

// Expected metrics derived from the committed dataset the SAME way OverviewView
// derives them (default 'balanced' sensitivity, no in-session overrides). This
// pins the Overview to the real data: if the dataset changes, both move together;
// if someone re-hardcodes a curated number, these assertions fail.
const expected = (() => {
  const isHigh = (f: (typeof FINDINGS)[number]) => {
    const p = effPriority(f, 'balanced');
    return p === 'critical' || p === 'high';
  };
  const total = FINDINGS.length;
  const activeCredentials = FINDINGS.filter(f => f.validation === 'validated-active').length;
  const highPriority = FINDINGS.filter(isHigh).length;
  const noise = FINDINGS.filter(f => f.isFalsePositive).length;
  const publicAssets = Object.values(MAP_ASSETS).filter(
    a => a.exposure === 'Public' || a.exposure === 'Internet-facing',
  ).length;
  return { total, activeCredentials, highPriority, noise, publicAssets };
})();

test('app opens on the Overview tab by default', () => {
  render(<App />);
  expect(screen.getByTestId('overview-view')).toBeInTheDocument();
  expect(screen.getByText('Needs attention now')).toBeInTheDocument();
});

test('Overview shows the four KPI cards', () => {
  render(<App />);
  expect(screen.getByText('Active credentials')).toBeInTheDocument();
  expect(screen.getByText('High priority findings')).toBeInTheDocument();
  expect(screen.getByText('Public-facing assets')).toBeInTheDocument();
  // "Noise reduced" appears as both the KPI label and the recent-scan row.
  expect(screen.getAllByText('Noise reduced').length).toBeGreaterThan(0);
});

test('Overview KPI values are derived from the real dataset', () => {
  render(<App />);
  const view = screen.getByTestId('overview-view');
  const text = view.textContent ?? '';

  // Derived values are present.
  expect(screen.getAllByText(String(expected.activeCredentials)).length).toBeGreaterThan(0);
  expect(screen.getAllByText(String(expected.highPriority)).length).toBeGreaterThan(0);
  expect(screen.getAllByText(String(expected.publicAssets)).length).toBeGreaterThan(0);
  expect(screen.getAllByText(String(expected.noise)).length).toBeGreaterThan(0);

  // Sanity anchors on the known dataset.
  expect(expected.activeCredentials).toBe(34);
  expect(expected.publicAssets).toBe(3);

  // The old curated/contradictory values must be gone.
  expect(text).not.toContain('188'); // impossible public-asset count
  expect(text).not.toContain('1,248'); // ungrounded noise number
});

test('Overview funnel uses derived dataset values', () => {
  render(<App />);
  const view = screen.getByTestId('overview-view');
  const text = view.textContent ?? '';
  // First stage = total candidates; last = validated-active credentials.
  expect(text).toContain(String(expected.total));
  expect(text).toContain(String(expected.activeCredentials));
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
