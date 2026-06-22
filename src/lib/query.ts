import type { Finding, Sensitivity } from '../types';
import { effPriority, priorityRank } from './priority';

export interface Filter {
  key: string; // 'priority' | 'env' | 'cloud' | 'validation' | 'exposure'
  val: string;
  label: string;
}

// Does a finding pass the active filters + free-text search under the current sensitivity?
export function rankFilter(f: Finding, filters: Filter[], search: string, sensitivity: Sensitivity): boolean {
  for (const ft of filters) {
    if (ft.key === 'priority' && effPriority(f, sensitivity) !== ft.val) return false;
    if (ft.key === 'env' && f.environment !== ft.val) return false;
    if (ft.key === 'cloud' && f.cloud !== ft.val) return false;
    if (ft.key === 'validation' && f.validation !== ft.val) return false;
    if (ft.key === 'exposure' && f.exposure !== ft.val) return false;
  }
  const q = search.trim().toLowerCase();
  if (q) {
    const hay = `${f.detectedType} ${f.classification} ${f.file} ${f.path} ${f.asset} ${f.owner} ${f.cloud}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

// Sort a copy of the rows by the given key/direction (does not mutate input).
export function sortRows(
  rows: Finding[],
  key: string,
  dir: 'asc' | 'desc',
  sensitivity: Sensitivity,
): Finding[] {
  const sign = dir === 'asc' ? 1 : -1;
  const value = (f: Finding): number => {
    switch (key) {
      case 'priority': return priorityRank(effPriority(f, sensitivity));
      case 'created': return f.id; // id is a stable proxy for creation order in the MVP
      case 'line': return f.line;
      case 'off': return f.offset;
      case 'risk':
      default: return f.risk;
    }
  };
  return rows.slice().sort((a, b) => (value(a) - value(b)) * sign);
}
