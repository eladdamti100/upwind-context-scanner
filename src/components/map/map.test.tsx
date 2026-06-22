import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from '../../App';
import { MAP_ASSETS } from '../../data';

const firstAssetKey = Object.keys(MAP_ASSETS)[0];

function clickTab(label: string) {
  fireEvent.click(screen.getByText(label));
}

test('Exposure map tab shows asset nodes, AI node, and filter chips', async () => {
  render(<App />);

  // Navigate to Exposure map tab
  clickTab('Exposure map');

  // First real asset node should be visible
  expect(await screen.findByTestId(`map-asset-${firstAssetKey}`)).toBeInTheDocument();

  // External AI node for OpenAI should be visible
  expect(screen.getByTestId('map-asset-openai')).toBeInTheDocument();

  // The three category filter chips should be visible (chip + legend both contain these labels)
  expect(screen.getAllByText('Static (asset)').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Dynamic (flow)').length).toBeGreaterThan(0);
  expect(screen.getAllByText('External AI').length).toBeGreaterThan(0);
});

test('Clicking an asset node opens the panel with Exposure and a finding', async () => {
  render(<App />);

  // Navigate to Exposure map tab
  clickTab('Exposure map');

  // Click the first real asset node
  const node = await screen.findByTestId(`map-asset-${firstAssetKey}`);
  fireEvent.click(node);

  // Panel should show "Exposure" label
  await waitFor(() => {
    expect(screen.getByText('Exposure')).toBeInTheDocument();
  });

  // Panel should list at least one finding's detectedType
  const asset = MAP_ASSETS[firstAssetKey];
  if (asset.findings.length > 0) {
    const detectedType = asset.findings[0].detectedType;
    expect(screen.getAllByText(detectedType).length).toBeGreaterThan(0);
  }
});
