// DomainRulesBanner.tsx — shows when the DomainRulesAgent (the post-regex
// structural/semantic filter) hard-suppressed a candidate, with the named cause.
// Rendered in the risk-breakdown surfaces (DetailDrawer + RiskPopover). Inline
// styles + CSS vars only; never displays a full secret value.
import type { Finding } from '../../types';

export function DomainRulesBanner({ finding }: { finding: Finding }) {
  if (!finding.suppressedByAgent) return null;
  const reason = finding.suppressReason ?? 'failed structural / semantic validation';

  return (
    <div
      role="note"
      aria-label="DomainRulesAgent suppression"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '8px 10px',
        marginBottom: 14,
        borderRadius: 6,
        border: '1px solid var(--severity-safe)',
        background: 'var(--severity-safe-bg, rgba(34,197,94,0.10))',
      }}
    >
      <span style={{ color: 'var(--severity-safe)', flexShrink: 0, lineHeight: 1.4, fontSize: 12 }}>
        ⛉
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--severity-safe)' }}>
          Suppressed by DomainRulesAgent
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          {reason}
        </span>
      </div>
    </div>
  );
}
