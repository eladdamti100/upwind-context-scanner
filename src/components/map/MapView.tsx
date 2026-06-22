// MapView.tsx — Shell wrapper for the Exposure Map feature.
// Renders the map canvas and the asset detail panel side-by-side via a shared store.

import { ExposureMap } from './ExposureMap';
import { AssetPanel } from './AssetPanel';

export function MapView() {
  return (
    <div data-testid="map-view" style={{ padding: '18px 32px 60px' }}>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-secondary)' }}>
        Visual topology of exposed assets, data flows, and external AI service connections. Click any node to inspect findings.
      </p>
      <ExposureMap />
      <AssetPanel />
    </div>
  );
}
