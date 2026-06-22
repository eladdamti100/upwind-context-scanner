/**
 * masking.test.tsx — Security backstop
 *
 * Product rule: full secrets MUST NEVER be displayed in the UI.
 * Only masked values (containing the bullet "•" glyph or asterisk "*") may be shown.
 *
 * This test renders the full App, navigates through every major view that
 * displays secret-related content, captures the rendered text from each
 * view, then asserts:
 *
 *   A) No raw secret patterns appear anywhere in the collected text.
 *   B) A masking glyph (• or *) IS present, proving the test actually
 *      inspected real rendered content rather than an empty page.
 *
 * Raw secret patterns checked:
 *   /AKIA[A-Z0-9]{16}/              — AWS access key ID
 *   /sk_live_[A-Za-z0-9]{16,}/      — Stripe live secret key
 *   /ghp_[A-Za-z0-9]{30,}/          — GitHub PAT
 *   /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*[A-Za-z0-9+/]{40,}/  — PEM body
 */

import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';

// ---------------------------------------------------------------------------
// Raw-secret patterns — a match means a full secret leaked into the DOM.
// ---------------------------------------------------------------------------
const RAW_SECRET_PATTERNS: RegExp[] = [
  /AKIA[A-Z0-9]{16}/,                                              // AWS access key id
  /sk_live_[A-Za-z0-9]{16,}/,                                      // Stripe live key
  /ghp_[A-Za-z0-9]{30,}/,                                          // GitHub PAT
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*[A-Za-z0-9+/]{40,}/,  // raw PEM body
];

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test('no raw secrets are ever rendered — only masked values', async () => {
  render(<App />);

  const textSnapshots: string[] = [];

  // ── 1. Findings tab (default) ──────────────────────────────────────────
  // Ensure the table has rendered before snapshotting (at least one row)
  await screen.findByText('Remediation priority'); // header always present
  textSnapshots.push(document.body.textContent ?? '');

  // ── 2. Detail drawer for first row ────────────────────────────────────
  // Click the first tbody row to open the drawer
  const firstRow = document.querySelectorAll('tbody tr')[0] as HTMLElement;
  fireEvent.click(firstRow);

  // Wait for the drawer to open — Score breakdown is always present
  await screen.findByText('Score breakdown');
  textSnapshots.push(document.body.textContent ?? '');

  // Close the drawer before navigating.
  fireEvent.click(screen.getByRole('button', { name: 'Close detail' }));

  // ── 3. Exposure map tab ─────────────────────────────────────────────
  fireEvent.click(screen.getByText('Exposure map'));
  await screen.findByText('OpenAI'); // wait for map nodes
  textSnapshots.push(document.body.textContent ?? '');

  // ── 4. Classifications tab ──────────────────────────────────────────
  fireEvent.click(screen.getByText('Data classifications'));
  await screen.findByText('Suggested rules'); // classifications tab landmark
  textSnapshots.push(document.body.textContent ?? '');

  // ── Assertions ──────────────────────────────────────────────────────

  // Concatenate all snapshots into one big string for a single scan.
  const allText = textSnapshots.join('\n');

  // B) A masking glyph MUST be present — proves we captured real masked content.
  expect(allText).toMatch(/[•*]/);

  // A) None of the raw-secret patterns should match anywhere.
  for (const pattern of RAW_SECRET_PATTERNS) {
    expect(allText).not.toMatch(pattern);
  }
});
