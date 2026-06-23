/**
 * demoFlow.test.tsx
 *
 * End-to-end RTL test that walks the full SignalLens demo path:
 *   1. Findings tab — assert the table has at least one row.
 *   2. Open the detail drawer via the first data row — assert "Score breakdown"
 *      and a masked value. Close the drawer.
 *   3. Settings modal — open via the Settings button (title="Settings"),
 *      select "Flexible" sensitivity, close with "Done".
 *   4. Exposure map tab — assert the "OpenAI" external-AI node and the first
 *      real asset node; click it; assert the asset panel shows "Exposure".
 */

import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../App';
import { MAP_ASSETS } from '../data';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Click the first element whose accessible text matches the given string. */
function clickText(text: string) {
  fireEvent.click(screen.getByText(text));
}

function getFirstDataRow(): HTMLElement {
  const rows = document.querySelectorAll('tbody tr');
  return rows[0] as HTMLElement;
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test('demo flow: findings → drawer → settings → exposure map', async () => {
  render(<App />);

  // ── 1. Findings tab ──────────────────────────────────────────────────────
  // The default tab is "findings". At least one data row must be present.
  const rows = document.querySelectorAll('tbody tr');
  expect(rows.length).toBeGreaterThan(0);

  // ── 2. Open detail drawer for the first row ──────────────────────────────
  const firstRow = getFirstDataRow();
  fireEvent.click(firstRow);

  // Drawer: "Score breakdown" section header
  expect(await screen.findByText('Score breakdown')).toBeInTheDocument();

  // Drawer: a masked value is displayed (contains • or *)
  const maskedEls = screen.getAllByText(/[•*]/);
  expect(maskedEls.length).toBeGreaterThan(0);

  // Close the drawer via its close button (aria-label="Close detail")
  fireEvent.click(screen.getByRole('button', { name: 'Close detail' }));

  // Drawer is gone — the dialog element should no longer be present
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  // ── 3. Settings modal ────────────────────────────────────────────────────
  // Open via the Settings icon button (title="Settings")
  const settingsBtn = screen.getByTitle('Settings');
  fireEvent.click(settingsBtn);

  // Settings modal is visible
  expect(await screen.findByText('Detection sensitivity')).toBeInTheDocument();

  // Click the "Flexible" sensitivity option (segmented control button)
  fireEvent.click(screen.getByRole('button', { name: 'Flexible' }));

  // Click "Done" to close — modal should disappear
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));

  // "Detection sensitivity" is no longer visible
  expect(screen.queryByText('Detection sensitivity')).not.toBeInTheDocument();

  // ── 4. Exposure map tab ─────────────────────────────────────────────────
  clickText('Exposure map');

  // The map-view wrapper should be present
  expect(screen.getByTestId('map-view')).toBeInTheDocument();

  // External AI node: "OpenAI" provider label
  expect(await screen.findByText('OpenAI')).toBeInTheDocument();

  // First real asset key from MAP_ASSETS
  const firstAssetKey = Object.keys(MAP_ASSETS)[0];
  const assetBtn = screen.getByTestId(`map-asset-${firstAssetKey}`);
  expect(assetBtn).toBeInTheDocument();
  // The button contains the asset name text
  expect(within(assetBtn).getByText(firstAssetKey)).toBeInTheDocument();

  // Click the asset node to open the asset panel
  fireEvent.click(assetBtn);

  // Asset panel: "Exposure" fact row should be visible
  expect(await screen.findByText('Exposure')).toBeInTheDocument();
});
