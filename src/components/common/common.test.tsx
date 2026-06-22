import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from './Avatar';
import { SeverityBadge } from './SeverityBadge';
import { Toast } from './Toast';
import { Icon } from './Icon';

// ---- Avatar ------------------------------------------------------------------

test("Avatar 'Maya Rosen' shows initials 'MR'", () => {
  render(<Avatar name="Maya Rosen" />);
  expect(screen.getByText('MR')).toBeTruthy();
});

test("Avatar 'root' shows initials 'rt'", () => {
  render(<Avatar name="root" />);
  expect(screen.getByText('rt')).toBeTruthy();
});

// ---- SeverityBadge -----------------------------------------------------------

test("SeverityBadge priority='critical' renders 'Critical' by default", () => {
  render(<SeverityBadge priority="critical" />);
  expect(screen.getByText('Critical')).toBeTruthy();
});

// ---- Toast -------------------------------------------------------------------

test('Toast with null renders nothing', () => {
  const { container } = render(<Toast message={null} />);
  expect(container.firstChild).toBeNull();
});

test('Toast with a message renders the message text', () => {
  render(<Toast message="Saved successfully" />);
  expect(screen.getByText('Saved successfully')).toBeTruthy();
});

// ---- Icon --------------------------------------------------------------------

test("Icon name='search' renders an <svg>", () => {
  const { container } = render(<Icon name="search" />);
  const svg = container.querySelector('svg');
  expect(svg).toBeTruthy();
});

test("Icon unknown name renders an empty <svg> with no <path>", () => {
  // Cast through unknown to simulate unknown icon name
  const { container } = render(<Icon name={'nonexistent' as never} />);
  const svg = container.querySelector('svg');
  expect(svg).toBeTruthy();
  expect(container.querySelector('path')).toBeNull();
});
