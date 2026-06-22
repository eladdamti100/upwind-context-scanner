/**
 * demoFlow.test.tsx
 *
 * End-to-end RTL test that walks the full SignalLens demo path:
 *   1. Findings tab — assert the AWS Access Key row is visible.
 *   2. Open the detail drawer — assert "Validated active", "Rotate this secret",
 *      and the "Score breakdown" section.  Close the drawer.
 *   3. Settings modal — open via the Settings button (title="Settings"),
 *      select "Flexible" sensitivity, close with "Done".
 *   4. Exposure map tab — assert the "OpenAI" external-AI node and the
 *      "customer-prod-bucket" asset node; click "customer-prod-bucket"; assert
 *      the asset panel shows "Exposure".
 */

import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../App';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Click the first element whose accessible text matches the given string. */
function clickText(text: string) {
  fireEvent.click(screen.getByText(text));
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test('demo flow: findings → drawer → settings → exposure map', async () => {
  render(<App />);

  // ── 1. Findings tab ──────────────────────────────────────────────────────
  // The default tab is "findings".  The AWS Access Key row must be present.
  expect(await screen.findByText('AWS Access Key')).toBeInTheDocument();

  // ── 2. Open detail drawer for AWS Access Key ─────────────────────────────
  // Click the row (there may be multiple cells, click the classification chip).
  const classificationChips = screen.getAllByText('AWS Access Key');
  fireEvent.click(classificationChips[0]);

  // Drawer: "Validated active" validation badge — may appear multiple times
  // (table rows still visible), so use queryAllByText and confirm at least one exists.
  const validatedActiveItems = await screen.findAllByText('Validated active');
  expect(validatedActiveItems.length).toBeGreaterThan(0);

  // Drawer: "Rotate this secret" recommended action
  expect(screen.getByText('Rotate this secret')).toBeInTheDocument();

  // Drawer: "Score breakdown" section header
  expect(screen.getByText('Score breakdown')).toBeInTheDocument();

  // Close the drawer via its close button (aria-label="Close detail")
  fireEvent.click(screen.getByRole('button', { name: 'Close detail' }));

  // Drawer is gone — the dialog element should no longer be present
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  // ── 3. Settings modal ────────────────────────────────────────────────────
  // Open via the Settings icon button (title="Settings")
  const settingsBtn = screen.getByTitle('Settings');
  fireEvent.click(settingsBtn);

  // Settings modal is visible
  expect(await screen.findByText('Scanner sensitivity')).toBeInTheDocument();

  // Click the "Flexible" sensitivity option (segmented control button)
  fireEvent.click(screen.getByRole('button', { name: 'Flexible' }));

  // Click "Done" to close — modal should disappear
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));

  // "Scanner sensitivity" is no longer visible
  expect(screen.queryByText('Scanner sensitivity')).not.toBeInTheDocument();

  // ── 4. Exposure map tab ─────────────────────────────────────────────────
  clickText('Exposure map');

  // The map-view wrapper should be present
  expect(screen.getByTestId('map-view')).toBeInTheDocument();

  // External AI node: "OpenAI" provider label
  expect(await screen.findByText('OpenAI')).toBeInTheDocument();

  // Asset node: "customer-prod-bucket"
  const assetBtn = screen.getByTestId('map-asset-customer-prod-bucket');
  expect(assetBtn).toBeInTheDocument();
  // The button contains the asset name text
  expect(within(assetBtn).getByText('customer-prod-bucket')).toBeInTheDocument();

  // Click the asset node to open the asset panel
  fireEvent.click(assetBtn);

  // Asset panel: "Exposure" fact row should be visible
  // The panel renders a label "Exposure" alongside its value "Public / Broad access"
  expect(await screen.findByText('Exposure')).toBeInTheDocument();
});
