import { render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import App from './App';

test('App renders the SignalLens brand', () => {
  render(<App />);
  expect(screen.getByTestId('app-root')).toHaveTextContent('SignalLens');
});
