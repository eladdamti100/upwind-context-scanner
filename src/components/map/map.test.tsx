import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from '../../App';

function clickTab(label: string) {
  fireEvent.click(screen.getByText(label));
}

test('Exposure map tab shows asset nodes, AI node, and filter chips', async () => {
  render(<App />);

  // Navigate to Exposure map tab
  clickTab('Exposure map');

  // Asset node for customer-prod-bucket should be visible
  expect(await screen.findByTestId('map-asset-customer-prod-bucket')).toBeInTheDocument();

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

  // Click the customer-prod-bucket node
  const node = await screen.findByTestId('map-asset-customer-prod-bucket');
  fireEvent.click(node);

  // Panel should show "Exposure" label
  await waitFor(() => {
    expect(screen.getByText('Exposure')).toBeInTheDocument();
  });

  // Panel should list the aws-access-key finding
  expect(screen.getByText('aws-access-key')).toBeInTheDocument();
});
