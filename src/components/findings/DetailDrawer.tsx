// DetailDrawer.tsx — concise decision-support card for a selected finding.
// All styles are inline with CSS vars (no external CSS classes except keyframes).
// SECURITY: this panel never renders the detected secret — not raw, masked,
// redacted, or as a prefix/suffix fragment, and offers no reveal/copy-secret
// control. Only safe metadata is shown.

import React, { useState } from 'react';
import { FINDINGS } from '../../data';
import { effPriority } from '../../lib/priority';
import { priStyle, priLabel, valStyle } from '../../lib/classify';
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

// Score-breakdown metrics shown first; the rest sit under "More details".
const PRIMARY_METRICS = new Set([
  'Regex confidence',
  'LightGBM probability',
  'Remediation priority',
]);

// ---------------------------------------------------------------------------
// Small layout helpers
// ---------------------------------------------------------------------------

function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border-subtle)', ...style }}>
      {children}
    </div>
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--text-tertiary)',
        marginBottom: 9,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function ScoreBar({
  row,
}: {
  row: { label: string; value: string; width: string; color: string };
}) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11.5,
          color: 'var(--text-secondary)',
          marginBottom: 3,
        }}
      >
        <span>{row.label}</span>
        <span style={{ fontFamily: 'var(--font-mono-family, monospace)', color: 'var(--text-primary)' }}>
          {row.value}
        </span>
      </div>
      <div style={{ background: 'var(--bg-tertiary)', height: 4, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: row.width, height: '100%', background: row.color, borderRadius: 2, transition: 'width 0.3s ease' }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DetailDrawer() {
  ensureSlideKeyframes();

  const { state, dispatch } = useStore();
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const sel = FINDINGS.find(f => f.id === state.selectedId);
  if (!sel) return null;

  const p = effPriority(sel, state.settings.sensitivity);
  const ps = priStyle(p);
  const v = state.validations[sel.id] ?? sel.validation;
  const vs = valStyle(v);
  const isValidating = state.validatingId === sel.id;

  const breakdown = buildBreakdown(sel);
  const primaryRows = breakdown.filter(r => PRIMARY_METRICS.has(r.label));
  const moreRows = breakdown.filter(r => !PRIMARY_METRICS.has(r.label));

  const expTitle = explanationTitle(sel, p);
  const reasons = sel.riskUpReasons.slice(0, 3);
  const actions = recommendedActions(sel, p).slice(0, 3);

  // Directory portion of the path (filename shown separately for a compact row).
  const dir = sel.path.includes('/') ? sel.path.slice(0, sel.path.lastIndexOf('/')) : '';

  function close() {
    dispatch({ type: 'CLOSE_DETAIL' });
  }

  function copyPath() {
    try {
      navigator.clipboard?.writeText?.(sel!.path);
    } catch {
      /* clipboard unavailable */
    }
    dispatch({ type: 'SHOW_TOAST', message: 'File path copied' });
  }

  // Shared compact metadata-chip style.
  const chip = (bg: string, fg: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    height: 21,
    padding: '0 8px',
    borderRadius: 5,
    background: bg,
    fontSize: 11,
    fontWeight: 600,
    color: fg,
    lineHeight: 1,
    whiteSpace: 'nowrap',
  });

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={close}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50 }}
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
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 15.5,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  lineHeight: 1.3,
                  marginBottom: 2,
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

        {/* ── 2. Compact risk summary ───────────────────────────────────── */}
        <Section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Confidence */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 4 }}>
              <CircularScore score={sel.risk} size={44} stroke={4} />
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-tertiary)',
                  maxWidth: 56,
                  lineHeight: 1.3,
                }}
              >
                Confidence
              </span>
            </div>

            {/* Priority + status badges */}
            <SeverityBadge priority={p} label={`Priority · ${priLabel(p)}`} />
            <span style={chip(vs.bg, vs.fg)}>
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
            {sel.cloud && <span style={chip('var(--bg-secondary)', 'var(--text-secondary)')}>{sel.cloud}</span>}
            {sel.environment && <span style={chip('var(--bg-secondary)', 'var(--text-secondary)')}>{sel.environment}</span>}
          </div>
        </Section>

        {/* ── 3. Compact location ───────────────────────────────────────── */}
        <Section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
            <SectionLabel style={{ marginBottom: 0 }}>Location</SectionLabel>
            <button
              onClick={copyPath}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-link)',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
                flexShrink: 0,
              }}
            >
              Copy
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon name="file" size={14} stroke="var(--text-tertiary)" />
            <span
              title={sel.path}
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 12.5,
                fontFamily: 'var(--font-mono-family, monospace)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ color: 'var(--text-primary)' }}>{sel.file}</span>
              {dir && <span style={{ color: 'var(--text-tertiary)' }}> · {dir}</span>}
              <span style={{ color: 'var(--text-tertiary)' }}> · L{sel.line}</span>
            </span>
          </div>
        </Section>

        {/* ── 4. Why it matters ─────────────────────────────────────────── */}
        <Section>
          <SectionLabel>Why it matters</SectionLabel>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: reasons.length ? 8 : 0,
              lineHeight: 1.4,
            }}
          >
            {expTitle}
          </div>
          {reasons.length > 0 && (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {reasons.map((r, i) => (
                <li
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    fontSize: 12.5,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.4,
                  }}
                >
                  <span style={{ flexShrink: 0, marginTop: 5, width: 4, height: 4, borderRadius: '50%', background: ps.fg }} />
                  {r}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* ── 5. Recommended actions ────────────────────────────────────── */}
        <Section>
          <SectionLabel>Recommended actions</SectionLabel>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
            {actions.map((action, idx) => (
              <li
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 9,
                  fontSize: 12.5,
                  color: 'var(--text-primary)',
                  lineHeight: 1.4,
                }}
              >
                <Icon name="check" size={14} stroke={idx === 0 ? ps.fg : 'var(--text-tertiary)'} />
                {action}
              </li>
            ))}
          </ul>
        </Section>

        {/* ── 6. Score breakdown — collapsed by default ─────────────────── */}
        <Section>
          <button
            onClick={() => setShowBreakdown(s => !s)}
            aria-expanded={showBreakdown}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <SectionLabel style={{ marginBottom: 0 }}>Score breakdown</SectionLabel>
            <Icon name={showBreakdown ? 'chevron-up' : 'chevron-down'} size={14} stroke="var(--text-secondary)" />
          </button>

          {showBreakdown && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {primaryRows.map(row => (
                <ScoreBar key={row.label} row={row} />
              ))}
              {showMore && moreRows.map(row => <ScoreBar key={row.label} row={row} />)}
              {moreRows.length > 0 && (
                <button
                  onClick={() => setShowMore(s => !s)}
                  style={{
                    alignSelf: 'flex-start',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-link)',
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {showMore ? 'Less detail' : 'More details'}
                  <Icon name={showMore ? 'chevron-up' : 'chevron-down'} size={12} stroke="var(--text-link)" />
                </button>
              )}
            </div>
          )}
        </Section>

        {/* ── 7. Footer workflow actions ────────────────────────────────── */}
        <Section style={{ borderBottom: 'none', paddingTop: 14, paddingBottom: 18, marginTop: 'auto' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {supportsCredentialCheck(sel.detectedType) && state.settings.validationEnabled && (
              <button
                onClick={() => dispatch({ type: 'OPEN_VAL_MODAL', id: sel.id })}
                style={{
                  flex: 1,
                  padding: '8px 12px',
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
                flex: 1,
                padding: '8px 12px',
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
          </div>

          {/* Secondary, low-emphasis actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12 }}>
            <button
              onClick={() => {
                dispatch({ type: 'SET_LIFECYCLE_STATUS', id: sel.id, status: 'false-positive' });
                dispatch({ type: 'SHOW_TOAST', message: 'Marked as false positive' });
              }}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 12.5,
                fontWeight: 500,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Mark false positive
            </button>
            <button
              onClick={() => {
                dispatch({ type: 'SET_LIFECYCLE_STATUS', id: sel.id, status: 'accepted-risk' });
                dispatch({ type: 'SHOW_TOAST', message: 'Risk accepted' });
              }}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 12.5,
                fontWeight: 500,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              Accept risk
            </button>
          </div>
        </Section>
      </div>
    </>
  );
}
