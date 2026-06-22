import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';
test('renders SignalLens brand and switches to map tab', () => {
  render(<App />);
  expect(screen.getByText('SignalLens')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Exposure map'));
  expect(screen.getByTestId('map-view')).toBeInTheDocument();
});
