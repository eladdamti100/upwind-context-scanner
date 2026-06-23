import { test } from 'vitest';
import { FINDINGS, MAP_ASSETS, CLASSIFICATIONS } from '../../data';
import { effPriority } from '../../lib/priority';

test('scratch: print derived overview metrics', () => {
  const activeCreds = FINDINGS.filter(f => f.validation === 'validated-active').length;
  const highPriority = FINDINGS.filter(f => {
    const p = effPriority(f, 'balanced');
    return p === 'critical' || p === 'high';
  }).length;
  const noise = FINDINGS.filter(f => f.isFalsePositive).length;
  const real = FINDINGS.filter(f => !f.isFalsePositive).length;
  const publicAssets = Object.values(MAP_ASSETS).filter(
    a => a.exposure === 'Public' || a.exposure === 'Internet-facing',
  ).length;
  const byCloud: Record<string, number> = {};
  for (const f of FINDINGS) byCloud[f.cloud] = (byCloud[f.cloud] ?? 0) + 1;
  const byPriority: Record<string, number> = {};
  for (const f of FINDINGS) byPriority[f.basePriority] = (byPriority[f.basePriority] ?? 0) + 1;

  // eslint-disable-next-line no-console
  console.log('METRICS', JSON.stringify({
    total: FINDINGS.length,
    activeCreds,
    highPriority,
    noise,
    real,
    publicAssets,
    mapAssetCount: Object.keys(MAP_ASSETS).length,
    classifications: CLASSIFICATIONS.length,
    byCloud,
    byPriority,
  }, null, 2));
});
