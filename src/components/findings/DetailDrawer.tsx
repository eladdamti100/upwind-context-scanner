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
import type { IconName } from '../common/Icon';
import { SeverityBadge } from '../common/SeverityBadge';
import { CircularScore } from '../common/CircularScore';
import { DomainRulesBanner } from './DomainRulesBanner';

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

// Pick a leading icon for a recommended action from its wording.
function actionIcon(text: string, idx: number): IconName {
  const t = text.toLowerCase();
  if (/rotate|revoke|reissue|regenerate/.test(t)) return 'rotate';
  if (/remove|delete|strip|purge/.test(t)) return 'trash';
  if (/manager|vault|secret store|store it|move it/.test(t)) return 'lock';
  return (['rotate', 'trash', 'lock'] as IconName[])[idx] ?? 'check';
}

// ---------------------------------------------------------------------------
// Small layout helpers
// ---------------------------------------------------------------------------

function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', ...style }}>
      {children}
    </div>
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--text-secondary)',
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

  // Breadcrumb segments for the path (filename shown separately, no secret value).
  const segments = sel.path.includes('/') ? sel.path.slice(0, sel.path.lastIndexOf('/')).split('/').filter(Boolean) : [];

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
  const chip = (bg: string, fg: string, withDot: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: withDot ? 6 : 0,
    height: 24,
    padding: '0 10px',
    borderRadius: 6,
    background: bg,
    fontSize: 12,
    fontWeight: 600,
    color: fg,
    lineHeight: 1,
    whiteSpace: 'nowrap',
  });
  const dot = (c: string) => (
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, flexShrink: 0 }} />
  );

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={close}
        style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', zIndex: 50 }}
      />

      {/* Drawer panel — flex column so the footer can stick to the bottom */}
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
          width: 420,
          maxWidth: '94vw',
          zIndex: 51,
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-lg)',
          animation: 'uwslide 140ms ease',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* ── 1. Header ───────────────────────────────────────────────── */}
          <Section style={{ padding: '20px 20px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                  {sel.classification}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text-tertiary)',
                    fontFamily: 'var(--font-mono-family, monospace)',
                    marginTop: 4,
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
                  borderRadius: 8,
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
          </Section>

          {/* ── 2. Compact risk summary ─────────────────────────────────── */}
          <Section>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              {/* Confidence */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                <CircularScore score={sel.risk} size={60} stroke={5} />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                  }}
                >
                  Confidence
                </span>
              </div>

              {/* Status chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignContent: 'flex-start', paddingTop: 2 }}>
                <SeverityBadge priority={p} label={`Priority · ${priLabel(p)}`} />
                <span style={chip(vs.bg, vs.fg, true)}>
                  {dot(isValidating ? 'var(--text-tertiary)' : vs.fg)}
                  {isValidating ? 'Checking…' : vs.label}
                </span>
                {sel.cloud && <span style={chip('var(--bg-secondary)', 'var(--text-secondary)', false)}>{sel.cloud}</span>}
                {sel.environment && <span style={chip('var(--bg-secondary)', 'var(--text-secondary)', false)}>{sel.environment}</span>}
                <span style={chip(ps.bg, ps.fg, false)}>Remediation · {sel.scores.remediationPriority}</span>
              </div>
            </div>
          </Section>

          {/* ── 3. Location ─────────────────────────────────────────────── */}
          <Section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
              <SectionLabel>Location</SectionLabel>
              <button
                onClick={copyPath}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-link)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                Copy
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              <Icon name="file" size={16} stroke="var(--text-tertiary)" />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  title={sel.path}
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {sel.file}
                </div>
                {segments.length > 0 && (
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-tertiary)',
                      marginTop: 3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {segments.join(' / ')}
                  </div>
                )}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    marginTop: 8,
                    height: 22,
                    padding: '0 9px',
                    borderRadius: 6,
                    background: 'var(--bg-secondary)',
                    fontSize: 11.5,
                    fontWeight: 600,
                    fontFamily: 'var(--font-mono-family, monospace)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  L{sel.line}
                </span>
              </div>
            </div>
          </Section>

          {/* ── 4. Why it matters ───────────────────────────────────────── */}
          <Section>
            {/* Surfaces the DomainRulesAgent suppression reason when present. */}
            <DomainRulesBanner finding={sel} />
            <SectionLabel style={{ marginBottom: 12 }}>Why it matters</SectionLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: reasons.length ? 12 : 0 }}>
              <Icon name="shield" size={16} stroke={ps.fg} />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{expTitle}</span>
            </div>
            {reasons.length > 0 && (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
                {reasons.map((r, i) => (
                  <li
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                      lineHeight: 1.4,
                    }}
                  >
                    <span style={{ flexShrink: 0, marginTop: 6, width: 5, height: 5, borderRadius: '50%', background: ps.fg }} />
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* ── 5. Recommended actions ──────────────────────────────────── */}
          <Section>
            <SectionLabel style={{ marginBottom: 10 }}>Recommended actions</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {actions.map((action, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '6px 0',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      background: 'var(--uw-blue-06)',
                      flexShrink: 0,
                    }}
                  >
                    <Icon name={actionIcon(action, idx)} size={15} stroke="var(--action-primary)" />
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {action}
                  </span>
                  <Icon name="chevron-right" size={15} stroke="var(--text-tertiary)" />
                </div>
              ))}
            </div>
          </Section>

          {/* ── 6. Score breakdown — collapsed row ──────────────────────── */}
          <Section style={{ borderBottom: showBreakdown ? '1px solid var(--border-subtle)' : 'none' }}>
            <button
              onClick={() => setShowBreakdown(s => !s)}
              aria-expanded={showBreakdown}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <Icon name="bar-chart" size={16} stroke="var(--text-secondary)" />
              <span style={{ flex: 1, textAlign: 'left', fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>
                Score breakdown
              </span>
              <Icon name={showBreakdown ? 'chevron-down' : 'chevron-right'} size={15} stroke="var(--text-tertiary)" />
            </button>

            {showBreakdown && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 }}>
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
        </div>

        {/* ── 7. Sticky footer ──────────────────────────────────────────── */}
        <div
          style={{
            flexShrink: 0,
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--surface)',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {supportsCredentialCheck(sel.detectedType) && state.settings.validationEnabled && (
            <button
              onClick={() => dispatch({ type: 'OPEN_VAL_MODAL', id: sel.id })}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                padding: '11px 14px',
                borderRadius: 10,
                border: 'none',
                background: 'var(--action-primary)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--action-primary-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--action-primary)')}
            >
              <Icon name="shield" size={15} stroke="#fff" />
              Run credential check
            </button>
          )}

          <button
            onClick={() => dispatch({ type: 'OPEN_LIFECYCLE', id: sel.id })}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              padding: '11px 14px',
              borderRadius: 10,
              border: '1px solid var(--border-primary)',
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--interactive-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
          >
            <Icon name="flag" size={15} stroke="var(--text-secondary)" />
            Manage status
          </button>

          {/* Low-emphasis text actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 2 }}>
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
            <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>·</span>
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
        </div>
      </div>
    </>
  );
}
