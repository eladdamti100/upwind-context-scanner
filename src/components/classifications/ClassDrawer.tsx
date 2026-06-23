// ClassDrawer.tsx — slide-in drawer showing classification detail.
// Mirrors the findings DetailDrawer for a consistent light-theme look:
// backdrop + panel, scrollable content with a sticky footer, inline styles.

import React from 'react';
import { useStore } from '../../state/StoreContext';
import { CLASSIFICATIONS, classificationDetail } from '../../data';
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
        letterSpacing: '0.06em',
        color: 'var(--text-secondary)',
        marginBottom: 10,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 19, fontWeight: 700, color: color ?? 'var(--text-primary)', lineHeight: 1 }}>
        {value}
      </div>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-tertiary)',
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// One compact risk-signal group (increases / reduces).
function RiskGroup({ title, color, items }: { title: string; color: string; items: string[] }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.map((r, i) => (
          <li
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 9,
              fontSize: 12.5,
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
            }}
          >
            <span style={{ flexShrink: 0, marginTop: 6, width: 5, height: 5, borderRadius: '50%', background: color }} />
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
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
        style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', zIndex: 50 }}
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
          {/* ── Header ── */}
          <Section style={{ padding: '20px 20px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                  {c.name}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
                  {c.category} classification
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

          {/* ── Compact summary ── */}
          <Section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 26, flexWrap: 'wrap' }}>
              <Stat label="Findings" value={c.findings.toLocaleString()} />
              <Stat
                label="Critical"
                value={String(c.critical)}
                color={c.critical > 0 ? 'var(--severity-critical)' : 'var(--text-primary)'}
              />
              <Stat label="FP reduction" value={`${c.fpReductionPct}%`} color="var(--severity-safe)" />
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 22,
                  padding: '0 9px',
                  borderRadius: 6,
                  background: enabled ? 'var(--severity-safe-bg)' : 'var(--severity-info-bg)',
                  color: enabled ? 'var(--severity-safe)' : 'var(--text-tertiary)',
                  fontSize: 11.5,
                  fontWeight: 600,
                  marginLeft: 'auto',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: enabled ? 'var(--severity-safe)' : 'var(--text-tertiary)',
                  }}
                />
                {enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </Section>

          {/* ── What this classification detects ── */}
          <Section>
            <SectionLabel>What this classification detects</SectionLabel>
            <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              {det.description}
            </p>
          </Section>

          {/* ── Detection pattern ── */}
          <Section>
            <SectionLabel>Detection pattern</SectionLabel>
            <div
              style={{
                fontFamily: 'var(--font-mono-family, monospace)',
                fontSize: 12.5,
                color: 'var(--text-primary)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                padding: '9px 11px',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              {det.pattern}
            </div>
          </Section>

          {/* ── Risk signals ── */}
          {(det.up.length > 0 || det.down.length > 0) && (
            <Section>
              <SectionLabel>Risk signals</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {det.up.length > 0 && (
                  <RiskGroup title="Increases risk" color="var(--severity-high)" items={det.up} />
                )}
                {det.down.length > 0 && (
                  <RiskGroup title="Reduces risk" color="var(--severity-safe)" items={det.down} />
                )}
              </div>
            </Section>
          )}

          {/* ── Guardrail ── */}
          {det.guardrail && (
            <Section style={{ borderBottom: 'none' }}>
              <SectionLabel>Guardrail</SectionLabel>
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  background: 'var(--bg-secondary)',
                  borderRadius: 8,
                  padding: '10px 12px',
                }}
              >
                {det.guardrail}
              </div>
            </Section>
          )}
        </div>

        {/* ── Sticky footer: status ── */}
        <div
          style={{
            flexShrink: 0,
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--surface)',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Classification status</span>
          <button
            role="switch"
            aria-checked={enabled}
            onClick={() => dispatch({ type: 'TOGGLE_CLASS_ENABLED', id: c.id })}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              borderRadius: 8,
              border: `1px solid ${enabled ? 'var(--severity-safe)' : 'var(--border-primary)'}`,
              background: enabled ? 'var(--severity-safe-bg)' : 'transparent',
              color: enabled ? 'var(--severity-safe)' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 120ms',
            }}
          >
            <Icon name="check" size={13} stroke={enabled ? 'var(--severity-safe)' : 'var(--text-tertiary)'} />
            {enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>
    </>
  );
}
