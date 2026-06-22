import { render, screen, fireEvent } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from '../../App';
import { CLASSIFICATIONS } from '../../data';

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

test('clicking a classification row opens the drawer with Detection pattern and Guardrail', async () => {
  render(<App />);

  fireEvent.click(screen.getByText('Data classifications'));

  // Click the first classification row
  fireEvent.click(screen.getByText(firstClass.name));

  // Drawer should show Detection pattern section
  expect(screen.getByText('Detection pattern')).toBeInTheDocument();

  // Drawer should show Guardrail section
  expect(screen.getByText('Guardrail')).toBeInTheDocument();
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
