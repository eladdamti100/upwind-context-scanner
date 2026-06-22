import { test, expect } from 'vitest';
import { VERTICALS, VERTICAL_LABELS, type Vertical } from './types';

test('supports the five customer verticals', () => {
  expect([...VERTICALS]).toEqual(['saas', 'fintech', 'retail', 'healthcare', 'general']);
});

test('every vertical has a human label', () => {
  for (const v of VERTICALS) {
    expect(VERTICAL_LABELS[v]).toBeTruthy();
  }
  expect(VERTICAL_LABELS.general).toBe('General / Default');
});

test('Vertical type is usable in annotations', () => {
  const v: Vertical = 'fintech';
  expect(VERTICALS).toContain(v);
});
