// RiskPopover.tsx — centered modal overlay explaining why a finding has its risk score.
// Uses only inline styles + CSS vars (no external CSS classes).
// Never logs or displays full secret values — only masked, structured data.

import { FINDINGS } from '../../data';
import { band } from '../../lib/priority';
import { priStyle, priLabel } from '../../lib/classify';
import { buildBreakdown } from '../../lib/scoring';
import { useStore } from '../../state/StoreContext';
import { Icon } from '../common/Icon';

export function RiskPopover() {
  const { state, dispatch } = useStore();

  const f = FINDINGS.find(x => x.id === state.riskId);
  if (!f) return null;

  const b = band(f.risk);
  const ps = priStyle(b);
  const breakdown = buildBreakdown(f);

  return (
    // Full-screen backdrop
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Risk score breakdown"
      onClick={() => dispatch({ type: 'CLOSE_RISK' })}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 55,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Card — stops click propagation so backdrop click closes, card click doesn't */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-lg, 0 10px 30px rgba(0,0,0,0.5))',
          maxWidth: 420,
          width: '100%',
          padding: 20,
        }}
      >
        {/* Title row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            Why this score?
          </span>
          <button
            aria-label="Close risk breakdown"
            onClick={() => dispatch({ type: 'CLOSE_RISK' })}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
            }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Risk score + band label */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
          <span
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: ps.fg,
              lineHeight: 1,
            }}
          >
            {f.risk}
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: ps.fg,
            }}
          >
            {priLabel(b)}
          </span>
        </div>

        {/* Breakdown bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
          {breakdown.map(bar => (
            <div key={bar.label}>
              {/* Label + value row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {bar.label}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {bar.value}
                </span>
              </div>
              {/* Track */}
              <div
                style={{
                  background: 'var(--bg-tertiary)',
                  height: 6,
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                {/* Fill */}
                <div
                  style={{
                    width: bar.width,
                    height: '100%',
                    background: bar.color,
                    borderRadius: 3,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Explanation paragraph */}
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            color: 'var(--text-secondary)',
            lineHeight: 1.55,
          }}
        >
          {f.explanation}
        </p>
      </div>
    </div>
  );
}
