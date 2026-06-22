import { render, screen, fireEvent } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from '../../App';

test('classifications tab shows Placeholder API Key row and 98% FP reduction', async () => {
  render(<App />);

  // Click the "Data classifications" tab
  fireEvent.click(screen.getByText('Data classifications'));

  // The row name should be visible
  expect(screen.getByText('Placeholder API Key')).toBeInTheDocument();

  // Its FP reduction (98%) should appear
  expect(screen.getByText('98%')).toBeInTheDocument();
});

test('clicking a classification row opens the drawer with Detection pattern and Guardrail', async () => {
  render(<App />);

  fireEvent.click(screen.getByText('Data classifications'));

  // Click the Placeholder API Key row
  fireEvent.click(screen.getByText('Placeholder API Key'));

  // Drawer should show Detection pattern section
  expect(screen.getByText('Detection pattern')).toBeInTheDocument();

  // Drawer should show Guardrail section
  expect(screen.getByText('Guardrail')).toBeInTheDocument();
});

test('searching "stripe" hides Placeholder API Key row', async () => {
  render(<App />);

  fireEvent.click(screen.getByText('Data classifications'));

  // Type "stripe" in the search box
  const input = screen.getByPlaceholderText('Search classifications…') as HTMLInputElement;
  fireEvent.input(input, { target: { value: 'stripe' } });

  // Placeholder API Key should no longer be in the document
  expect(screen.queryByText('Placeholder API Key')).not.toBeInTheDocument();
});
