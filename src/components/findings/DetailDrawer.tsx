// DetailDrawer.tsx — full-height slide-in detail panel for a selected finding.
// All styles are inline with CSS vars (no external CSS classes except keyframes).
// Does not expose or log any full secret values — only masked values are rendered.

import React from 'react';
import { FINDINGS } from '../../data/placeholder';
import { effPriority } from '../../lib/priority';
import { priStyle, priLabel, valStyle } from '../../lib/classify';
import { buildBreakdown } from '../../lib/scoring';
import { explanationTitle, recommendedActions } from '../../lib/explain';
import { useStore } from '../../state/StoreContext';
import { Icon } from '../common/Icon';
import { SeverityBadge } from '../common/SeverityBadge';

// Inject keyframes once into document head (no-op if already present)
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

// ---------------------------------------------------------------------------
// Small layout helpers
// ---------------------------------------------------------------------------

function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--text-tertiary)',
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DetailDrawer() {
  ensureSlideKeyframes();

  const { state, dispatch } = useStore();

  const sel = FINDINGS.find(f => f.id === state.selectedId);
  if (!sel) return null;

  const p = effPriority(sel, state.settings.sensitivity);
  const ps = priStyle(p);
  const v = state.validations[sel.id] ?? sel.validation;
  const vs = valStyle(v);
  const isFp = sel.isFalsePositive || p === 'suppressed';
  const isValidating = state.validatingId === sel.id;

  const breakdown = buildBreakdown(sel);
  const expTitle = explanationTitle(sel, p);
  const actions = recommendedActions(sel, p);

  function close() {
    dispatch({ type: 'CLOSE_DETAIL' });
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
        aria-label="Finding detail"
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: 480,
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
        {/* ── 1. Header ─────────────────────────────────────────────────── */}
        <Section
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            padding: '16px 20px',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--text-primary)',
                lineHeight: 1.3,
                marginBottom: 4,
              }}
            >
              {sel.classification}
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono-family, monospace)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {sel.detectedType}
            </div>
          </div>
          <button
            aria-label="Close detail"
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
        </Section>

        {/* ── 2. Masked value + badges ──────────────────────────────────── */}
        <Section>
          {/* Masked value box */}
          <div
            style={{
              fontFamily: 'var(--font-mono-family, monospace)',
              fontSize: 14,
              color: 'var(--text-primary)',
              background: 'var(--bg-secondary)',
              borderRadius: 6,
              padding: '10px 12px',
              marginBottom: 10,
              overflowX: 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            {sel.maskedValue}
          </div>

          {/* Severity + validation row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <SeverityBadge priority={p} />

            {/* Validation chip */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 21,
                padding: '0 7px',
                borderRadius: 5,
                background: vs.bg,
                fontSize: 11,
                fontWeight: 600,
                color: vs.fg,
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: isValidating ? 'var(--text-tertiary)' : vs.fg,
                  flexShrink: 0,
                }}
              />
              {isValidating ? 'Validating…' : vs.label}
            </span>
          </div>
        </Section>

        {/* ── 3. Explanation ────────────────────────────────────────────── */}
        <Section>
          <div
            style={{
              background: isFp ? 'var(--severity-safe-bg)' : ps.bg,
              borderLeft: `3px solid ${isFp ? 'var(--uw-green-04)' : ps.fg}`,
              borderRadius: '0 6px 6px 0',
              padding: '10px 14px',
            }}
          >
            <div
              style={{
                fontWeight: 700,
                fontSize: 13,
                color: 'var(--text-primary)',
                marginBottom: 6,
              }}
            >
              {expTitle}
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              {sel.explanation}
            </div>
          </div>
        </Section>

        {/* ── 4. Facts grid ─────────────────────────────────────────────── */}
        <Section>
          <SectionLabel>Details</SectionLabel>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px 12px',
            }}
          >
            {(
              [
                ['Classification',    sel.classification],
                ['Remediation priority', priLabel(p)],
                ['Cloud',            sel.cloud],
                ['Environment',      sel.environment],
                ['Exposure',         sel.exposure],
                ['Access scope',     sel.accessScope],
                ['Activity',         sel.activity],
                ['Asset criticality',sel.assetCriticality],
                ['Asset / storage',  sel.asset],
                ['Owner',            sel.owner],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div key={label}>
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: 'var(--text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginBottom: 2,
                  }}
                >
                  {label}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>
                  {value}
                </div>
              </div>
            ))}

            {/* File path — mono, full width */}
            <div style={{ gridColumn: '1 / -1' }}>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: 2,
                }}
              >
                File path
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono-family, monospace)',
                  overflowX: 'auto',
                  whiteSpace: 'nowrap',
                }}
              >
                {sel.path}
              </div>
            </div>

            {/* Line : offset — mono */}
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  marginBottom: 2,
                }}
              >
                Line : offset
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-mono-family, monospace)',
                }}
              >
                {sel.line} : {sel.offset}
              </div>
            </div>
          </div>
        </Section>

        {/* ── 5. Score breakdown ────────────────────────────────────────── */}
        <Section>
          <SectionLabel>Score breakdown</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {breakdown.map(row => (
              <div key={row.label}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    marginBottom: 4,
                  }}
                >
                  <span>{row.label}</span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono-family, monospace)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {row.value}
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
                  <div
                    style={{
                      width: row.width,
                      height: '100%',
                      background: row.color,
                      borderRadius: 3,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* ── 6. Risk factors ───────────────────────────────────────────── */}
        {(sel.riskUpReasons.length > 0 || sel.riskDownReasons.length > 0) && (
          <Section>
            <SectionLabel>Risk factors</SectionLabel>

            {sel.riskUpReasons.length > 0 && (
              <div style={{ marginBottom: sel.riskDownReasons.length > 0 ? 12 : 0 }}>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: 'var(--severity-high)',
                    marginBottom: 6,
                  }}
                >
                  Increases risk
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {sel.riskUpReasons.map((r, i) => (
                    <li
                      key={i}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12.5, color: 'var(--text-secondary)' }}
                    >
                      <span style={{ color: 'var(--severity-high)', flexShrink: 0, lineHeight: 1.5 }}>▲</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {sel.riskDownReasons.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: 'var(--severity-safe)',
                    marginBottom: 6,
                  }}
                >
                  Reduces risk
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {sel.riskDownReasons.map((r, i) => (
                    <li
                      key={i}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12.5, color: 'var(--text-secondary)' }}
                    >
                      <span style={{ color: 'var(--severity-safe)', flexShrink: 0, lineHeight: 1.5 }}>▼</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
        )}

        {/* ── 7. Recommended actions ────────────────────────────────────── */}
        <Section>
          <SectionLabel>Recommended actions</SectionLabel>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {actions.map((action, idx) => {
              const isEmphasized = idx < 2;
              return (
                <li
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    padding: isEmphasized ? '8px 10px' : '4px 0',
                    borderRadius: isEmphasized ? 6 : 0,
                    background: isEmphasized ? ps.bg : 'transparent',
                    border: isEmphasized ? `1px solid ${ps.fg}` : 'none',
                    borderLeft: isEmphasized ? `3px solid ${ps.fg}` : 'none',
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: isEmphasized ? ps.fg : 'var(--text-tertiary)',
                      minWidth: 18,
                      lineHeight: 1.6,
                      flexShrink: 0,
                    }}
                  >
                    {idx + 1}.
                  </span>
                  {action}
                </li>
              );
            })}
          </ol>
        </Section>

        {/* ── 8. Action buttons ─────────────────────────────────────────── */}
        <Section style={{ borderBottom: 'none', paddingBottom: 24 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {vs.canValidate && state.settings.validationEnabled && (
              <button
                onClick={() => dispatch({ type: 'OPEN_VAL_MODAL', id: sel.id })}
                style={{
                  padding: '7px 14px',
                  borderRadius: 6,
                  border: '1px solid var(--action-primary)',
                  background: 'var(--action-primary)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Validate
              </button>
            )}

            <button
              onClick={() => dispatch({ type: 'OPEN_LIFECYCLE', id: sel.id })}
              style={{
                padding: '7px 14px',
                borderRadius: 6,
                border: '1px solid var(--border-primary)',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Manage status
            </button>

            <button
              onClick={() => {
                dispatch({ type: 'SET_LIFECYCLE_STATUS', id: sel.id, status: 'false-positive' });
                dispatch({ type: 'SHOW_TOAST', message: 'Marked as false positive' });
              }}
              style={{
                padding: '7px 14px',
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Mark false positive
            </button>
          </div>
        </Section>
      </div>
    </>
  );
}
