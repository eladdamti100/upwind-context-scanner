// ClassDrawer.tsx — slide-in drawer showing classification detail.
// Matches the DetailDrawer pattern: backdrop + panel, inline styles with CSS vars.

import { useStore } from '../../state/StoreContext';
import { CLASSIFICATIONS, classificationDetail } from '../../data/placeholder';
import { Icon } from '../common/Icon';

// Inject keyframes once (same as DetailDrawer)
function ensureSlideKeyframes() {
  if (typeof document === 'undefined') return;
  const id = '__uw_slide_kf__';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    @keyframes uwslide {
      from { transform: translateX(100%); opacity: 0.6; }
      to   { transform: translateX(0);    opacity: 1;   }
    }
  `;
  document.head.appendChild(style);
}

export function ClassDrawer() {
  ensureSlideKeyframes();

  const { state, dispatch } = useStore();

  const c = CLASSIFICATIONS.find(x => x.id === state.classId);
  if (!c) return null;

  const det = classificationDetail(c);
  const enabled = state.classEnabled[c.id] ?? c.enabled;

  function close() {
    dispatch({ type: 'CLOSE_CLASS' });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={close}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 50,
        }}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Classification detail"
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: 460,
          maxWidth: '92vw',
          zIndex: 51,
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-lg, -8px 0 32px rgba(0,0,0,0.45))',
          overflowY: 'auto',
          animation: 'uwslide 140ms ease',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--text-primary)',
                lineHeight: 1.3,
              }}
            >
              {c.name}
            </div>
          </div>
          <button
            aria-label="Close classification detail"
            onClick={close}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              borderRadius: 6,
              border: '1px solid var(--border-subtle)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        {/* ── Stats row: findings + FP reduction ── */}
        <div
          style={{
            display: 'flex',
            gap: 24,
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-tertiary)',
                marginBottom: 3,
              }}
            >
              Findings
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
              {c.findings.toLocaleString()}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-tertiary)',
                marginBottom: 3,
              }}
            >
              FP Reduction
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--uw-green-02, var(--severity-safe))' }}>
              {c.fpReductionPct}%
            </div>
          </div>
        </div>

        {/* ── Description ── */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {det.description}
          </p>
        </div>

        {/* ── Detection pattern ── */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-tertiary)',
              marginBottom: 8,
            }}
          >
            Detection pattern
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono-family, monospace)',
              fontSize: 12.5,
              color: 'var(--text-primary)',
              background: 'var(--bg-secondary)',
              borderRadius: 6,
              padding: '10px 12px',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            {det.pattern}
          </div>
        </div>

        {/* ── Increases risk ── */}
        {det.up.length > 0 && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: 'var(--severity-high)',
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Increases risk
            </div>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {det.up.map((r, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 6,
                    fontSize: 12.5,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span
                    style={{ color: 'var(--severity-high)', flexShrink: 0, lineHeight: 1.5 }}
                  >
                    ▲
                  </span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Reduces risk ── */}
        {det.down.length > 0 && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: 'var(--severity-safe)',
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Reduces risk
            </div>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {det.down.map((r, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 6,
                    fontSize: 12.5,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span
                    style={{ color: 'var(--severity-safe)', flexShrink: 0, lineHeight: 1.5 }}
                  >
                    ▼
                  </span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Guardrail ── */}
        {det.guardrail && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-tertiary)',
                marginBottom: 8,
              }}
            >
              Guardrail
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 12.5,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              {det.guardrail}
            </p>
          </div>
        )}

        {/* ── Enable / Disable toggle ── */}
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Classification status
          </span>
          <button
            role="switch"
            aria-checked={enabled}
            onClick={() => dispatch({ type: 'TOGGLE_CLASS_ENABLED', id: c.id })}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 6,
              border: `1px solid ${enabled ? 'var(--severity-safe)' : 'var(--border-primary)'}`,
              background: enabled ? 'var(--severity-safe-bg)' : 'transparent',
              color: enabled ? 'var(--severity-safe)' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 120ms',
            }}
          >
            <Icon
              name="check"
              size={13}
              stroke={enabled ? 'var(--severity-safe)' : 'var(--text-tertiary)'}
            />
            {enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>
    </>
  );
}
