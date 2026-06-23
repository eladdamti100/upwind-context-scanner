// OverviewView.tsx — landing dashboard summarizing exposure posture.
// Reuses shared components (CircularScore, SeverityBadge, CloudBadge, Icon) and
// existing finding data. SECURITY: shows only safe metadata — never a secret
// value (raw, masked, or fragment).

import React, { useMemo } from 'react';
import { FINDINGS, CLASSIFICATIONS, SUGGESTED_RULES as SUGGESTED_RULES_DATA } from '../../data';
import { effPriority } from '../../lib/priority';
import { valStyle, envStyle } from '../../lib/classify';
import { useStore } from '../../state/StoreContext';
import type { TabKey } from '../../state/store';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';
import { CircularScore } from '../common/CircularScore';
import { SeverityBadge } from '../common/SeverityBadge';
import { CloudBadge } from '../common/CloudBadge';
import type { ValidationStatus, Sensitivity } from '../../types';

// All headline metrics are DERIVED from the live backend FINDINGS at render time
// (see deriveStats below) — no hardcoded demo values. Only static presentation
// metadata (titles / icons / colors) lives here.

// Funnel stage presentation (values injected from live stats at render).
const FUNNEL_META: { key: 'raw' | 'surfaced' | 'noise' | 'highValue'; title: string; desc: string; icon: IconName; accent: string; tint: string }[] = [
  { key: 'raw', title: 'Raw regex candidates', desc: 'Broad pattern matches across repos and assets. Includes docs, tests, and placeholders.', icon: 'search', accent: 'var(--action-primary)', tint: 'var(--uw-blue-06)' },
  { key: 'surfaced', title: 'Context-aware surfaced', desc: 'Smart context analysis (rules + tree model + spatial) kept these as real risk.', icon: 'filter', accent: 'var(--uw-cyan-02)', tint: 'var(--uw-cyan-06, var(--severity-info-bg))' },
  { key: 'noise', title: 'Noise / false positives reduced', desc: 'Filtered out documentation placeholders, test paths, dev keys, and synthetic values.', icon: 'alert-triangle', accent: 'var(--severity-medium)', tint: 'var(--severity-medium-bg)' },
  { key: 'highValue', title: 'Active credentials', desc: 'Validated, live credentials requiring immediate attention.', icon: 'shield', accent: 'var(--severity-safe)', tint: 'var(--severity-safe-bg)' },
];
const BENEFITS = ['Fewer false positives', 'Faster triage', 'Better signal-to-noise', 'Focus on real risk'];

// Suggested rules shown on the overview — derived from the shared dataset.
const SUGGESTED_RULES = SUGGESTED_RULES_DATA.map(r => r.title);

// Shared grid template for the "Needs attention now" table (header + rows).
const NA_COLS = '52px minmax(0, 1fr) 78px 130px 168px 138px 96px';

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

function HeaderCell({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'center' | 'right' }) {
  return (
    <span
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--text-tertiary)',
        textAlign: align,
      }}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Funnel
// ---------------------------------------------------------------------------

interface FunnelStageView { value: number; title: string; desc: string; icon: IconName; accent: string; tint: string }

function FunnelStage({ stage, first, last }: { stage: FunnelStageView; first: boolean; last: boolean }) {
  const clip = first
    ? 'polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%)'
    : last
      ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 16px 50%)'
      : 'polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%, 16px 50%)';
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: stage.tint,
        clipPath: clip,
        padding: `16px ${last ? 18 : 30}px 18px ${first ? 18 : 30}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: stage.accent,
          flexShrink: 0,
        }}
      >
        <Icon name={stage.icon} size={15} stroke="#fff" />
      </span>
      <span style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
        {stage.value}
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.25 }}>{stage.title}</span>
      <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>{stage.desc}</span>
    </div>
  );
}

function FunnelCard({ stages }: { stages: FunnelStageView[] }) {
  return (
    <Card style={{ gridArea: 'bottom', padding: '18px 20px' }}>
      <CardTitle>How SignalLens reduces noise to surface real risk</CardTitle>
      <p style={{ margin: '8px 0 18px', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55, maxWidth: 720 }}>
        Our context-aware layer filters documentation patterns, placeholder values, test paths, and other low-risk
        findings so you can focus on what truly matters.
      </p>

      {/* Funnel stages with arrow connectors */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {stages.map((s, i) => (
          <React.Fragment key={s.title}>
            <FunnelStage stage={s} first={i === 0} last={i === stages.length - 1} />
            {i < stages.length - 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, flexShrink: 0 }}>
                <Icon name="chevron-right" size={18} stroke="var(--text-tertiary)" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Benefit chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
        {BENEFITS.map(b => (
          <span
            key={b}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              flex: '1 1 0',
              minWidth: 150,
              justifyContent: 'center',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-secondary)',
              fontSize: 12.5,
              fontWeight: 500,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
            }}
          >
            <Icon name="check" size={14} stroke="var(--severity-safe)" />
            {b}
          </span>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Backend-derived metrics (no mock numbers — everything from live FINDINGS)
// ---------------------------------------------------------------------------
// "Surfaced" = the backend predicts a real secret (authenticityScore >= 50, the
// same cutoff the evaluator uses). "Noise reduced" = everything it filtered out.
const SURFACED_CUTOFF = 50;

function deriveStats(validations: Record<number, ValidationStatus>, sensitivity: Sensitivity) {
  const total = FINDINGS.length;
  const surfacedList = FINDINGS.filter(f => f.scores.authenticityScore >= SURFACED_CUTOFF);
  const surfaced = surfacedList.length;
  const noiseReduced = total - surfaced;
  const valOf = (f: typeof FINDINGS[number]) => validations[f.id] ?? f.validation;
  const activeCreds = FINDINGS.filter(f => valOf(f) === 'validated-active').length;
  const highPriority = FINDINGS.filter(f => {
    const p = effPriority(f, sensitivity);
    return p === 'critical' || p === 'high';
  }).length;
  const isPublic = (f: typeof FINDINGS[number]) => f.exposure === 'Public' || f.exposure === 'Internet-facing';
  const publicExposed = surfacedList.filter(isPublic).length;

  // exposure breakdown over surfaced findings
  const exposure = { pub: 0, internal: 0, restricted: 0 };
  for (const f of surfacedList) {
    if (isPublic(f)) exposure.pub++;
    else if (f.exposure === 'Internal') exposure.internal++;
    else exposure.restricted++;
  }

  return { total, surfaced, noiseReduced, activeCreds, highPriority, publicExposed, exposure };
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function OverviewView() {
  const { state, dispatch } = useStore();
  const sensitivity = state.settings.sensitivity;
  const go = (tab: TabKey) => dispatch({ type: 'SET_TAB', tab });

  const stats = useMemo(() => deriveStats(state.validations, sensitivity), [state.validations, sensitivity]);

  const kpis: { label: string; value: string; helper: string; icon: IconName; tileBg: string; iconColor: string }[] = [
    { label: 'Active credentials', value: String(stats.activeCreds), helper: 'Confirmed live credentials', icon: 'shield', tileBg: 'var(--severity-safe-bg)', iconColor: 'var(--severity-safe)' },
    { label: 'High priority findings', value: String(stats.highPriority), helper: 'Need immediate attention', icon: 'alert-triangle', tileBg: 'var(--severity-critical-bg)', iconColor: 'var(--severity-critical)' },
    { label: 'Publicly exposed', value: String(stats.publicExposed), helper: 'Surfaced on public / internet-facing', icon: 'globe', tileBg: 'var(--uw-cyan-06, var(--severity-info-bg))', iconColor: 'var(--uw-cyan-02)' },
  ];
  const exposureBreakdown = [
    { label: 'Public / internet-facing', count: stats.exposure.pub, color: 'var(--action-primary)' },
    { label: 'Internal', count: stats.exposure.internal, color: 'var(--uw-metal-blue-02)' },
    { label: 'Restricted / dev-test', count: stats.exposure.restricted, color: 'var(--uw-royal-purple-02)' },
  ];
  const funnelValues: Record<(typeof FUNNEL_META)[number]['key'], number> = {
    raw: stats.total, surfaced: stats.surfaced, noise: stats.noiseReduced, highValue: stats.activeCreds,
  };
  const funnelStages: FunnelStageView[] = FUNNEL_META.map(m => ({ ...m, value: funnelValues[m.key] }));

  const topFindings = [...FINDINGS]
    .sort((a, b) => b.scores.remediationPriority - a.scores.remediationPriority)
    .slice(0, 4);

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
            {stats.activeCreds} active credentials are exposed across public or internet-facing assets
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
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

      {/* ── 3 + 4 + funnel. One grid: main + right column + funnel below main ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gridTemplateAreas: '"main side" "bottom side"',
          gap: 16,
          alignItems: 'start',
        }}
      >
        {/* Needs attention now */}
        <Card style={{ gridArea: 'main', padding: '16px 18px' }}>
          <CardTitle>Needs attention now</CardTitle>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4, marginBottom: 12 }}>
            Top prioritized findings based on confidence, priority, and exposure.
          </div>

          {/* Column headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: NA_COLS,
              gap: 12,
              alignItems: 'center',
              padding: '0 0 8px',
            }}
          >
            <HeaderCell align="center">Confidence</HeaderCell>
            <HeaderCell>Finding</HeaderCell>
            <HeaderCell>Priority</HeaderCell>
            <HeaderCell>Credential check</HeaderCell>
            <HeaderCell>File | path</HeaderCell>
            <HeaderCell>Cloud &amp; env</HeaderCell>
            <HeaderCell align="right">Action</HeaderCell>
          </div>

          {topFindings.map(f => {
            const p = effPriority(f, sensitivity);
            const vs = valStyle(state.validations[f.id] ?? f.validation);
            const es = envStyle(f.environment);
            return (
              <div
                key={f.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: NA_COLS,
                  gap: 12,
                  alignItems: 'center',
                  padding: '10px 0',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <CircularScore score={f.risk} size={34} stroke={3.5} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <Icon name="key" size={14} stroke="var(--uw-royal-purple-02)" />
                  <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.classification}
                  </span>
                </div>
                <SeverityBadge priority={p} />
                <Chip label={vs.label} fg={vs.fg} bg={vs.bg} />
                <div style={{ minWidth: 0 }}>
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
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  <CloudBadge provider={f.cloud} size={20} />
                  <Chip label={f.environment} fg={es.fg} bg={es.bg} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <LinkButton label="Open details" onClick={() => dispatch({ type: 'OPEN_DETAIL', id: f.id })} />
                </div>
              </div>
            );
          })}

          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 4, paddingTop: 14, textAlign: 'center' }}>
            <LinkButton label="View all exposed findings" onClick={() => go('findings')} />
          </div>
        </Card>

        {/* Right column */}
        <div style={{ gridArea: 'side', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Exposure breakdown */}
          <Card style={{ padding: '16px 18px' }}>
            <CardTitle>Exposure breakdown</CardTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
              {exposureBreakdown.map(row => {
                const max = Math.max(...exposureBreakdown.map(r => r.count));
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
                    <Icon name="check" size={13} stroke="var(--severity-safe)" />
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

          {/* Recent scan summary */}
          <Card style={{ padding: '16px 18px' }}>
            <CardTitle>Recent scan summary</CardTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 12 }}>
              {([
                ['Findings analyzed', stats.total.toLocaleString()],
                ['Classifications', String(CLASSIFICATIONS.length)],
                ['Noise reduced', stats.noiseReduced.toLocaleString()],
              ] as [string, string][]).map(([label, value]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <LinkButton label="View scan history" onClick={() => dispatch({ type: 'SHOW_TOAST', message: 'Scan history is coming soon' })} />
            </div>
          </Card>
        </div>

        {/* ── Funnel card (lower-left, spans the main column) ── */}
        <FunnelCard stages={funnelStages} />
      </div>
    </div>
  );
}
