import { test, expect } from 'vitest';
import { effPriority, band, priorityRank } from './priority';
import type { Finding } from '../types';

const f = (basePriority: Finding['basePriority']) => ({ basePriority }) as Finding;

test('balanced sensitivity returns the base priority unchanged', () => {
  expect(effPriority(f('low'), 'balanced')).toBe('low');
  expect(effPriority(f('critical'), 'balanced')).toBe('critical');
  expect(effPriority(f('suppressed'), 'balanced')).toBe('suppressed');
});

test('strict sensitivity lifts suppressed up to low', () => {
  expect(effPriority(f('suppressed'), 'strict')).toBe('low');
  expect(effPriority(f('high'), 'strict')).toBe('high');
});

test('flexible sensitivity drops low down to suppressed', () => {
  expect(effPriority(f('low'), 'flexible')).toBe('suppressed');
  expect(effPriority(f('critical'), 'flexible')).toBe('critical');
});

test('band maps a risk score to a severity band', () => {
  expect(band(96)).toBe('critical');
  expect(band(90)).toBe('critical');
  expect(band(72)).toBe('high');
  expect(band(45)).toBe('medium');
  expect(band(22)).toBe('low');
  expect(band(10)).toBe('suppressed');
});

test('priorityRank orders severities critical > high > … > suppressed', () => {
  expect(priorityRank('critical')).toBeGreaterThan(priorityRank('high'));
  expect(priorityRank('high')).toBeGreaterThan(priorityRank('medium'));
  expect(priorityRank('low')).toBeGreaterThan(priorityRank('suppressed'));
  expect(priorityRank('info')).toBeGreaterThan(priorityRank('suppressed'));
});
