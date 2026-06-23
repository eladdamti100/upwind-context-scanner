import { render, screen, fireEvent } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from '../../App';
import { CLASSIFICATIONS, classificationDetail } from '../../data';

// The first classification by findings count
const firstClass = CLASSIFICATIONS[0];
// The second classification (to assert it disappears after search)
const secondClass = CLASSIFICATIONS[1];

test('classifications tab renders rows and shows first real classification name', async () => {
  render(<App />);

  // Click the "Data classifications" tab
  fireEvent.click(screen.getByText('Data classifications'));

  // The first classification name should be visible
  expect(screen.getByText(firstClass.name)).toBeInTheDocument();
});

test('clicking a classification row opens the drawer with Detection method and Guardrail', async () => {
  render(<App />);

  fireEvent.click(screen.getByText('Data classifications'));

  // Click the first classification row
  fireEvent.click(screen.getByText(firstClass.name));

  // Drawer should show Detection method section (truthful, not a fake regex)
  expect(screen.getByText('Detection method')).toBeInTheDocument();

  // Drawer should show Guardrail section
  expect(screen.getByText('Guardrail')).toBeInTheDocument();
});

test('classification detail uses no fabricated regex and varies by category', () => {
  const details = CLASSIFICATIONS.map(classificationDetail);

  for (const d of details) {
    // No fake regex / pattern-looking detection text.
    expect(d.detectionNote.startsWith('/')).toBe(false);
    expect(d.detectionNote).not.toMatch(/\[a-z0-9|\{\d+,\}|\[-_\]\?/);
    // No secret-looking glyphs or fragments.
    expect(d.detectionNote).not.toMatch(/[•*]/);
  }

  // Detail content is not identical boilerplate across every classification.
  const distinctDetection = new Set(details.map(d => d.detectionNote));
  const distinctGuardrail = new Set(details.map(d => d.guardrail));
  expect(distinctDetection.size).toBeGreaterThan(1);
  expect(distinctGuardrail.size).toBeGreaterThan(1);
});

test('searching a substring hides a different classification row', async () => {
  render(<App />);

  fireEvent.click(screen.getByText('Data classifications'));

  // Type a substring of the first classification name in the search box
  const searchTerm = firstClass.name.substring(0, 4).toLowerCase();
  const input = screen.getByPlaceholderText('Search classifications…') as HTMLInputElement;
  fireEvent.input(input, { target: { value: searchTerm } });

  // If firstClass and secondClass names don't share this substring, secondClass should be hidden
  if (!secondClass.name.toLowerCase().includes(searchTerm)) {
    expect(screen.queryByText(secondClass.name)).not.toBeInTheDocument();
  } else {
    // Both match — just verify firstClass is still visible
    expect(screen.getByText(firstClass.name)).toBeInTheDocument();
  }
});
