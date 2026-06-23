// OverviewView.tsx — landing dashboard summarizing exposure posture.
// Reuses shared components (CircularScore, SeverityBadge, CloudBadge, Icon) and
// existing finding data. SECURITY: shows only safe metadata — never a secret
// value (raw, masked, or fragment).

import React from 'react';
import { FINDINGS } from '../../data';
import { effPriority } from '../../lib/priority';
import { valStyle, envStyle } from '../../lib/classify';
import { useStore } from '../../state/StoreContext';
import type { TabKey } from '../../state/store';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';
import { CircularScore } from '../common/CircularScore';
import { SeverityBadge } from '../common/SeverityBadge';
import { CloudBadge } from '../common/CloudBadge';

// Demo-derived metrics used only on this dashboard (isolated; no dataset change).
const NOISE_REDUCED = 1248;
const NOISE_REASONS: { label: string; count: number }[] = [
  { label: 'Documentation or test paths', count: 612 },
  { label: 'Example or placeholder values', count: 396 },
  { label: 'Known sample values', count: 240 },
];
const EXPOSURE_BREAKDOWN: { label: string; count: number; color: string }[] = [
  { label: 'Static exposed secrets', count: 14, color: 'var(--action-primary)' },
  { label: 'Dynamic exposed secrets', count: 6, color: 'var(--uw-metal-blue-02)' },
  { label: 'Shared with external AI service', count: 4, color: 'var(--uw-royal-purple-02)' },
];
const RISK_BY_CLOUD: { provider: string; count: number }[] = [
  { provider: 'AWS', count: 18 },
  { provider: 'Azure', count: 4 },
  { provider: 'GCP', count: 2 },
];
const SUGGESTED_RULES = [
  'Detect Azure Storage Account Keys in configuration files',
  'Flag secrets in container images and build artifacts',
  'Identify API tokens sent to external domains',
];

// ---------------------------------------------------------------------------
// Shared presentational helpers
// ---------------------------------------------------------------------------

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        boxShadow: 'var(--shadow-sm)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
      {children}
      <Icon name="info" size={13} stroke="var(--text-tertiary)" />
    </div>
  );
}

function Chip({ label, fg, bg }: { label: string; fg: string; bg: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 21,
        padding: '0 8px',
        borderRadius: 5,
        background: bg,
        color: fg,
        fontSize: 11.5,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function LinkButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        border: 'none',
        background: 'transparent',
        color: 'var(--text-link)',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        padding: 0,
      }}
    >
      {label}
      <Icon name="chevron-right" size={14} stroke="var(--text-link)" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function OverviewView() {
  const { state, dispatch } = useStore();
  const sensitivity = state.settings.sensitivity;
  const go = (tab: TabKey) => dispatch({ type: 'SET_TAB', tab });

  const activeCredentials = FINDINGS.filter(
    f => (state.validations[f.id] ?? f.validation) === 'validated-active',
  ).length;
  const publiclyExposed = FINDINGS.filter(
    f => f.exposure === 'Public' || f.exposure === 'Internet-facing',
  ).length;
  const highPriority = FINDINGS.filter(f => {
    const p = effPriority(f, sensitivity);
    return p === 'critical' || p === 'high';
  }).length;

  const topFindings = [...FINDINGS]
    .sort((a, b) => b.scores.remediationPriority - a.scores.remediationPriority)
    .slice(0, 4);

  const kpis: { label: string; value: string; helper: string; icon: IconName; tileBg: string; iconColor: string }[] = [
    { label: 'Active credentials', value: String(activeCredentials), helper: 'Confirmed live credentials', icon: 'shield', tileBg: 'var(--severity-safe-bg)', iconColor: 'var(--severity-safe)' },
    { label: 'High priority findings', value: String(highPriority), helper: 'Need immediate attention', icon: 'alert-triangle', tileBg: 'var(--severity-critical-bg)', iconColor: 'var(--severity-critical)' },
    { label: 'Publicly exposed assets', value: String(publiclyExposed), helper: 'Public or internet-facing', icon: 'globe', tileBg: 'var(--uw-cyan-06, var(--severity-info-bg))', iconColor: 'var(--uw-cyan-02)' },
    { label: 'Noise reduced', value: NOISE_REDUCED.toLocaleString(), helper: 'Downgraded or suppressed', icon: 'bar-chart', tileBg: 'var(--uw-royal-purple-06)', iconColor: 'var(--uw-royal-purple-02)' },
  ];

  return (
    <div data-testid="overview-view" style={{ padding: '12px 24px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── 1. Insight banner ── */}
      <Card
        style={{
          background: 'linear-gradient(180deg, var(--uw-blue-06), var(--surface))',
          borderColor: 'var(--uw-primary-04, var(--border-subtle))',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 42,
            height: 42,
            borderRadius: 10,
            background: 'var(--uw-primary-05, var(--bg-secondary))',
            flexShrink: 0,
          }}
        >
          <Icon name="shield" size={20} stroke="var(--action-primary)" />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            {activeCredentials} active credentials are exposed across public or internet-facing assets
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
            SignalLens prioritized what needs attention first and reduced noisy findings.
          </div>
        </div>
        <button
          onClick={() => go('findings')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid var(--border-primary)',
            background: 'var(--surface)',
            color: 'var(--text-link)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          View exposed findings
          <Icon name="chevron-right" size={14} stroke="var(--text-link)" />
        </button>
      </Card>

      {/* ── 2. KPI cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {kpis.map(k => (
          <Card key={k.label} style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 40,
                borderRadius: 10,
                background: k.tileBg,
                flexShrink: 0,
              }}
            >
              <Icon name={k.icon} size={19} stroke={k.iconColor} strokeWidth={2} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                {k.value}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>{k.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{k.helper}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── 3 + 4. Main + right column ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16, alignItems: 'start' }}>
        {/* Needs attention now */}
        <Card style={{ padding: '16px 18px' }}>
          <CardTitle>Needs attention now</CardTitle>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 12 }}>
            Top prioritized findings based on confidence, priority, and exposure.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {topFindings.map(f => {
              const p = effPriority(f, sensitivity);
              const vs = valStyle(state.validations[f.id] ?? f.validation);
              const es = envStyle(f.environment);
              return (
                <div
                  key={f.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 0',
                    borderTop: '1px solid var(--border-subtle)',
                  }}
                >
                  <CircularScore score={f.risk} size={34} stroke={3.5} />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="key" size={14} stroke="var(--uw-royal-purple-02)" />
                    <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {f.classification}
                    </span>
                  </div>
                  <SeverityBadge priority={p} />
                  <Chip label={vs.label} fg={vs.fg} bg={vs.bg} />
                  <div style={{ width: 150, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.file}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text-tertiary)',
                        fontFamily: 'var(--font-mono-family, monospace)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={f.path}
                    >
                      {f.path}
                    </div>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, width: 130 }}>
                    <CloudBadge provider={f.cloud} size={20} />
                    <Chip label={f.environment} fg={es.fg} bg={es.bg} />
                  </div>
                  <LinkButton label="Open details" onClick={() => dispatch({ type: 'OPEN_DETAIL', id: f.id })} />
                </div>
              );
            })}
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 4, paddingTop: 14, textAlign: 'center' }}>
            <LinkButton label="View all exposed findings" onClick={() => go('findings')} />
          </div>
        </Card>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Exposure breakdown */}
          <Card style={{ padding: '16px 18px' }}>
            <CardTitle>Exposure breakdown</CardTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              {EXPOSURE_BREAKDOWN.map(row => {
                const max = Math.max(...EXPOSURE_BREAKDOWN.map(r => r.count));
                return (
                  <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text-secondary)' }}>{row.label}</span>
                    <div style={{ width: 90, height: 6, borderRadius: 3, background: 'var(--bg-tertiary)', overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ width: `${(row.count / max) * 100}%`, height: '100%', background: row.color, borderRadius: 3 }} />
                    </div>
                    <span style={{ width: 22, textAlign: 'right', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>
                      {row.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Risk by cloud */}
          <Card style={{ padding: '16px 18px' }}>
            <CardTitle>Risk by cloud</CardTitle>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 16 }}>
              {RISK_BY_CLOUD.map(c => (
                <div key={c.provider} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <CloudBadge provider={c.provider} size={38} />
                  <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>{c.count}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Suggested rules */}
          <Card style={{ padding: '16px 18px' }}>
            <CardTitle>Suggested rules</CardTitle>
            <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {SUGGESTED_RULES.map(r => (
                <li key={r}>
                  <button
                    onClick={() => dispatch({ type: 'OPEN_ADD_RULES' })}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      width: '100%',
                      textAlign: 'left',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      padding: '7px 0',
                      fontSize: 12.5,
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Icon name="plus" size={13} stroke="var(--action-primary)" />
                    <span style={{ flex: 1, minWidth: 0 }}>{r}</span>
                    <Icon name="chevron-right" size={13} stroke="var(--text-tertiary)" />
                  </button>
                </li>
              ))}
            </ul>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <LinkButton label="Review rules" onClick={() => dispatch({ type: 'OPEN_ADD_RULES' })} />
            </div>
          </Card>
        </div>
      </div>

      {/* ── 5. Bottom cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16 }}>
        {/* Noise reduced */}
        <Card style={{ padding: '16px 18px' }}>
          <CardTitle>Noise reduced</CardTitle>
          <p style={{ margin: '10px 0 14px', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            We downgraded or suppressed {NOISE_REDUCED.toLocaleString()} findings because they matched documentation,
            tests, or other low-risk context.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {NOISE_REASONS.map(r => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <Icon name="check" size={14} stroke="var(--severity-safe)" />
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text-secondary)' }}>{r.label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.count}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14 }}>
            <LinkButton label="View data classifications" onClick={() => go('classifications')} />
          </div>
        </Card>

        {/* Exposure map preview */}
        <Card style={{ padding: '16px 18px' }}>
          <CardTitle>Exposure map preview</CardTitle>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 14 }}>
            See how data and secrets flow across your environments.
          </div>
          <MapPreview />
          <div style={{ marginTop: 14 }}>
            <LinkButton label="Open exposure map" onClick={() => go('map')} />
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lightweight exposure-map preview (visual only, no graph engine)
// ---------------------------------------------------------------------------

function NodePill({ icon, label, iconColor }: { icon: IconName; label: string; iconColor?: string }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        borderRadius: 8,
        border: '1px solid var(--border-subtle)',
        background: 'var(--surface)',
        fontSize: 12,
        color: 'var(--text-primary)',
        whiteSpace: 'nowrap',
      }}
    >
      <Icon name={icon} size={13} stroke={iconColor ?? 'var(--text-secondary)'} />
      {label}
    </div>
  );
}

function MapPreview() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      {/* Left: providers */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <CloudBadge provider="AWS" size={28} />
        <CloudBadge provider="Azure" size={28} />
        <CloudBadge provider="GCP" size={28} />
      </div>

      {/* connector */}
      <div style={{ flex: 1, height: 1, background: 'var(--border-primary)', minWidth: 16 }} />

      {/* Center node */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          width: 56,
          height: 56,
          borderRadius: 12,
          border: '1px solid var(--uw-royal-purple-04, var(--border-primary))',
          background: 'var(--uw-royal-purple-06)',
          flexShrink: 0,
        }}
      >
        <Icon name="key" size={16} stroke="var(--uw-royal-purple-02)" />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>24</span>
      </div>

      {/* connector */}
      <div style={{ flex: 1, height: 1, background: 'var(--border-primary)', minWidth: 16 }} />

      {/* Right: destinations */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <NodePill icon="globe" label="Internet" iconColor="var(--uw-cyan-02)" />
        <NodePill icon="external-link" label="External Services" />
        <NodePill icon="layers" label="AI Services" iconColor="var(--uw-royal-purple-02)" />
      </div>
    </div>
  );
}
