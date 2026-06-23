// DetailDrawer.tsx — full-height slide-in detail panel for a selected finding.
// All styles are inline with CSS vars (no external CSS classes except keyframes).
// Does not expose or log any full secret values — only masked values are rendered.

import React from 'react';
import { FINDINGS } from '../../data';
import { effPriority } from '../../lib/priority';
import { priStyle, valStyle } from '../../lib/classify';
import { buildBreakdown } from '../../lib/scoring';
import { supportsCredentialCheck } from '../../lib/validation';
import { explanationTitle, recommendedActions } from '../../lib/explain';
import { useStore } from '../../state/StoreContext';
import { Icon } from '../common/Icon';
import { SeverityBadge } from '../common/SeverityBadge';
import { CircularScore } from '../common/CircularScore';

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
        padding: '18px 20px',
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
        marginBottom: 12,
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
  const isValidating = state.validatingId === sel.id;

  const breakdown = buildBreakdown(sel);
  const expTitle = explanationTitle(sel, p);
  // Keep the action list short and scannable — show the top recommendations only.
  const actions = recommendedActions(sel, p).slice(0, 3);

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
          width: 400,
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
        <Section>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  lineHeight: 1.3,
                  marginBottom: 3,
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
                width: 28,
                height: 28,
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Icon name="x" size={13} />
            </button>
          </div>
        </Section>

        {/* ── 2. Key facts ──────────────────────────────────────────────── */}
        <Section>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 28,
              flexWrap: 'wrap',
            }}
          >
            {/* Confidence level */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CircularScore score={sel.risk} size={44} stroke={4} />
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-tertiary)',
                  maxWidth: 70,
                  lineHeight: 1.3,
                }}
              >
                Confidence level
              </span>
            </div>

            {/* Remediation priority */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 26, fontWeight: 700, color: ps.fg, lineHeight: 1 }}>
                {sel.scores.remediationPriority}
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-tertiary)',
                  maxWidth: 72,
                  lineHeight: 1.3,
                }}
              >
                Remediation priority
              </span>
            </div>
          </div>

          {/* Status chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
            <SeverityBadge priority={p} />
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 20,
                padding: '0 8px',
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
              {isValidating ? 'Checking…' : vs.label}
            </span>
            {sel.cloud && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 20,
                  padding: '0 8px',
                  borderRadius: 5,
                  background: 'var(--bg-secondary)',
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {sel.cloud}
              </span>
            )}
          </div>

          {/* Masked value */}
          <div
            style={{
              fontFamily: 'var(--font-mono-family, monospace)',
              fontSize: 13,
              color: 'var(--text-primary)',
              background: 'var(--bg-secondary)',
              borderRadius: 6,
              padding: '8px 11px',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              marginTop: 14,
            }}
          >
            {sel.maskedValue}
          </div>
        </Section>

        {/* ── 3. Why this was flagged ───────────────────────────────────── */}
        <Section>
          <SectionLabel>Why this was flagged</SectionLabel>
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
              fontSize: 12.5,
              color: 'var(--text-secondary)',
              lineHeight: 1.55,
            }}
          >
            {sel.explanation}
          </div>
        </Section>

        {/* ── 4. Score breakdown ────────────────────────────────────────── */}
        <Section>
          <SectionLabel>Score breakdown</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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

        {/* ── 5. Location ───────────────────────────────────────────────── */}
        <Section>
          <SectionLabel>Location</SectionLabel>
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono-family, monospace)',
              overflowX: 'auto',
              whiteSpace: 'nowrap',
              marginBottom: 6,
            }}
          >
            {sel.path}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Line {sel.line} · offset {sel.offset}
          </div>
        </Section>

        {/* ── 6. Recommended actions ────────────────────────────────────── */}
        <Section>
          <SectionLabel>Recommended actions</SectionLabel>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {actions.map((action, idx) => (
              <li
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  fontSize: 12.5,
                  color: 'var(--text-primary)',
                  lineHeight: 1.45,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    background: idx === 0 ? ps.fg : 'var(--bg-tertiary)',
                    color: idx === 0 ? '#fff' : 'var(--text-tertiary)',
                    fontSize: 10,
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {idx + 1}
                </span>
                {action}
              </li>
            ))}
          </ol>
        </Section>

        {/* ── 7. Action buttons ─────────────────────────────────────────── */}
        <Section style={{ borderBottom: 'none', paddingBottom: 24 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {supportsCredentialCheck(sel.detectedType) && state.settings.validationEnabled && (
              <button
                onClick={() => dispatch({ type: 'OPEN_VAL_MODAL', id: sel.id })}
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--action-primary)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--action-primary-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--action-primary)')}
              >
                Run credential check
              </button>
            )}

            <button
              onClick={() => dispatch({ type: 'OPEN_LIFECYCLE', id: sel.id })}
              style={{
                padding: '8px 14px',
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
                padding: '8px 14px',
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
              Mark false positive
            </button>
          </div>
        </Section>
      </div>
    </>
  );
}
