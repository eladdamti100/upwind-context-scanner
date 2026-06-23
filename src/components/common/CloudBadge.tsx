// CloudBadge.tsx — circular cloud-provider badge (brand color + cloud glyph).
// The provider name is exposed via tooltip + aria-label, never as cell text.
// Shared by the findings table and the Overview dashboard.

import { Icon } from './Icon';

// Brand colors (not theme tokens) so each provider reads at a glance.
const CLOUD_COLOR: Record<string, string> = {
  AWS: '#ED7100',
  Azure: '#0089D6',
  GCP: '#1A73E8',
  GitHub: '#24292F',
  'Multi-cloud': '#64748B',
};

export function CloudBadge({ provider, size = 22 }: { provider: string; size?: number }) {
  const bg = CLOUD_COLOR[provider] ?? 'var(--text-tertiary)';
  return (
    <span
      role="img"
      title={provider}
      aria-label={`Cloud provider: ${provider}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        flexShrink: 0,
      }}
    >
      <Icon name="cloud" size={Math.round(size * 0.55)} stroke="#fff" />
    </span>
  );
}
