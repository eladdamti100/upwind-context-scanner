/**
 * masking.test.tsx — Security backstop
 *
 * Product rule: full secrets MUST NEVER be displayed in the UI.
 * Only masked values (containing the bullet "•" glyph) may be shown.
 *
 * This test renders the full App, navigates through every major view that
 * displays secret-related content, captures the rendered text from each
 * view, then asserts:
 *
 *   A) No raw secret patterns appear anywhere in the collected text.
 *   B) The masked-bullet glyph (•) IS present, proving the test actually
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
  // Ensure the table has rendered before snapshotting.
  await screen.findByText('AWS Access Key');
  textSnapshots.push(document.body.textContent ?? '');

  // ── 2. Detail drawer for AWS Access Key ───────────────────────────────
  // Click the first classification chip for "AWS Access Key" to open the drawer.
  const chips = screen.getAllByText('AWS Access Key');
  fireEvent.click(chips[0]);

  // Wait for the drawer to open — "Validated active" appears in both the table and
  // the drawer chip, so use findAllByText (returns once ≥1 match exists).
  const validatedItems = await screen.findAllByText('Validated active');
  expect(validatedItems.length).toBeGreaterThan(0);
  textSnapshots.push(document.body.textContent ?? '');

  // Close the drawer before navigating.
  fireEvent.click(screen.getByRole('button', { name: 'Close detail' }));

  // ── 3. Exposure map tab ─────────────────────────────────────────────
  fireEvent.click(screen.getByText('Exposure map'));
  await screen.findByText('OpenAI'); // wait for map nodes
  textSnapshots.push(document.body.textContent ?? '');

  // ── 4. Classifications tab ──────────────────────────────────────────
  fireEvent.click(screen.getByText('Data classifications'));
  await screen.findByText('AWS Access Key'); // classifications table row
  textSnapshots.push(document.body.textContent ?? '');

  // ── Assertions ──────────────────────────────────────────────────────

  // Concatenate all snapshots into one big string for a single scan.
  const allText = textSnapshots.join('\n');

  // B) The bullet glyph MUST be present — proves we captured real masked content.
  expect(allText).toContain('•');

  // A) None of the raw-secret patterns should match anywhere.
  for (const pattern of RAW_SECRET_PATTERNS) {
    expect(allText).not.toMatch(pattern);
  }
});
