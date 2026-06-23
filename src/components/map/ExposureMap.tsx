// ExposureMap.tsx — Dark Upwind-style topology view.
// Visual polish only — no new graph logic, no data/scoring changes.
// All data is MASKED placeholder. No full secrets are ever rendered.

import { useState, useMemo } from 'react';
import { MAP_ASSETS, MAP_FLOWS, EXTERNAL_AI_NODES } from '../../data';
import { priStyle } from '../../lib/classify';
import { useStore } from '../../state/StoreContext';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';

// ---- Icon selection per asset kind ------------------------------------------

function kindIcon(kind: string): IconName {
  if (kind.toLowerCase().includes('bucket') || kind.toLowerCase().includes('storage')) return 'database';
  if (kind.toLowerCase().includes('workload')) return 'layers';
  if (kind.toLowerCase().includes('repo') || kind.toLowerCase().includes('repository')) return 'file';
  return 'globe';
}

// ---- Cloud tint tokens -------------------------------------------------------

const CLOUD_TINT: Record<string, { border: string; bg: string; badge: string }> = {
  AWS:    { border: 'var(--uw-amber-04)',        bg: 'rgba(255,200,122,0.045)', badge: 'var(--uw-amber-02)' },
  GCP:    { border: 'var(--uw-blue-04)',         bg: 'rgba(44,114,221,0.04)',   badge: 'var(--uw-blue-02)'  },
  Azure:  { border: 'var(--uw-metal-blue-04)',   bg: 'rgba(56,172,255,0.04)',   badge: 'var(--uw-metal-blue-02)' },
  GitHub: { border: 'var(--border-primary)',     bg: 'rgba(148,163,184,0.04)', badge: 'var(--text-secondary)' },
};

function cloudTint(cloud: string) {
  return CLOUD_TINT[cloud] ?? { border: 'var(--border-primary)', bg: 'rgba(148,163,184,0.04)', badge: 'var(--text-secondary)' };
}

// ---- Layout engine -----------------------------------------------------------
// Group MAP_ASSETS by cloud; assign a clean grid per group.
// Returns: nodeCenter map (key → {xPct, yPct}) and group boxes for rendering.

interface NodePos { xPct: number; yPct: number }
interface CloudGroup {
  cloud: string;
  keys: string[];
  /** box in % of canvas */
  box: { left: number; top: number; width: number; height: number };
}

const CANVAS_H = 640; // px — must match the container height below

function computeLayout(assets: ReturnType<typeof Object.values<(typeof MAP_ASSETS)[string]>>) {
  // Group by cloud
  const byCloud: Record<string, string[]> = {};
  for (const a of assets) {
    if (!byCloud[a.cloud]) byCloud[a.cloud] = [];
    byCloud[a.cloud].push(a.key);
  }

  const clouds = Object.keys(byCloud);
  const n = clouds.length;

  // column layout: split horizontally
  // Left 82% for cloud groups, right 18% reserved for External AI
  const colBand = 82 / n; // % width per cloud column

  const groups: CloudGroup[] = clouds.map((cloud, ci) => {
    const keys = byCloud[cloud];
    const boxLeft = ci * colBand + 2;
    const boxTop = 10;
    const boxW = colBand - 4;
    const boxH = 78;
    return { cloud, keys, box: { left: boxLeft, top: boxTop, width: boxW, height: boxH } };
  });

  // Compute per-node center %
  const nodeCenters: Record<string, NodePos> = {};

  for (const g of groups) {
    const rows = Math.ceil(Math.sqrt(g.keys.length));
    const numCols = Math.ceil(g.keys.length / rows);
    // usable area within the box (leaving header chip + padding)
    const innerLeft = g.box.left + 4;
    const innerTop = g.box.top + 14; // below header chip
    const innerW = g.box.width - 8;
    const innerH = g.box.height - 18;

    g.keys.forEach((key, i) => {
      const row = Math.floor(i / numCols);
      const col = i % numCols;
      const cellW = innerW / numCols;
      const cellH = innerH / rows;
      nodeCenters[key] = {
        xPct: innerLeft + cellW * col + cellW / 2,
        yPct: innerTop + cellH * row + cellH / 2,
      };
    });
  }

  // External AI nodes — top-right area
  EXTERNAL_AI_NODES.forEach((node, i) => {
    nodeCenters[node.key] = {
      xPct: 88 + (i % 2) * 7,
      yPct: 18 + i * 18,
    };
  });

  return { groups, nodeCenters };
}

// ---- Legend ------------------------------------------------------------------

function Legend() {
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 11.5,
        color: 'var(--text-secondary)',
        zIndex: 10,
        minWidth: 160,
        pointerEvents: 'none',
      }}
    >
      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, fontSize: 11.5 }}>Legend</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
        {[
          { label: 'Critical', color: 'var(--severity-critical)' },
          { label: 'High',     color: 'var(--severity-high)' },
          { label: 'Medium',   color: 'var(--severity-medium)' },
          { label: 'Low',      color: 'var(--uw-yellow-02)' },
        ].map(({ label, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 11.5 }}>{label}</span>
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '6px 0' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="check" size={11} stroke="var(--severity-safe)" strokeWidth={2.5} />
        <span style={{ fontSize: 11.5, color: 'var(--severity-safe)' }}>Validated active</span>
      </div>
    </div>
  );
}

// ---- Filter chips ------------------------------------------------------------

interface ChipProps {
  label: string;
  active: boolean;
  onToggle: () => void;
}

function FilterChip({ label, active, onToggle }: ChipProps) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '4px 11px',
        borderRadius: 20,
        border: `1px solid ${active ? 'var(--uw-primary-04)' : 'var(--border-subtle)'}`,
        background: active ? 'var(--uw-primary-06)' : 'transparent',
        color: active ? 'var(--uw-primary-01)' : 'var(--text-tertiary)',
        fontSize: 11.5,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'var(--font-default-family)',
        transition: 'all 120ms',
      }}
    >
      {label}
    </button>
  );
}

// ---- Zoom controls -----------------------------------------------------------

function ZoomControls({ onAction }: { onAction: (msg: string) => void }) {
  const btnStyle: React.CSSProperties = {
    width: 30,
    height: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 6,
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    padding: 0,
  };
  return (
    <div
      style={{
        position: 'absolute',
        left: 12,
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        zIndex: 10,
      }}
    >
      <button style={btnStyle} onClick={() => onAction('Zoom in')} title="Zoom in">
        <Icon name="plus" size={14} strokeWidth={2} />
      </button>
      <button style={btnStyle} onClick={() => onAction('Zoom out')} title="Zoom out">
        <span style={{ fontSize: 16, lineHeight: 1, fontWeight: 300, color: 'var(--text-secondary)' }}>−</span>
      </button>
      <button style={btnStyle} onClick={() => onAction('Fit view')} title="Fit view">
        <Icon name="map" size={13} strokeWidth={2} />
      </button>
      <button style={btnStyle} onClick={() => onAction('Toggle layers')} title="Layers">
        <Icon name="layers" size={13} strokeWidth={2} />
      </button>
    </div>
  );
}

// ---- Timeline card -----------------------------------------------------------

function Timeline() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--surface-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: '7px 12px',
        fontSize: 11.5,
        color: 'var(--text-secondary)',
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      <Icon name="clock" size={13} stroke="var(--text-tertiary)" strokeWidth={2} />
      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Timeline</span>
      <span
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 20,
          padding: '2px 8px',
          fontSize: 11,
          color: 'var(--text-secondary)',
        }}
      >
        Last 24 hours
      </span>
      <Icon name="chevron-down" size={12} stroke="var(--text-tertiary)" strokeWidth={2} />
    </div>
  );
}

// ---- Count badge -------------------------------------------------------------

function CountBadge({ count, fgColor }: { count: number; fgColor: string }) {
  if (count === 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: -6,
        right: -6,
        width: 17,
        height: 17,
        borderRadius: '50%',
        background: fgColor,
        color: '#fff',
        fontSize: 10,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '2px solid var(--surface)',
        flexShrink: 0,
        zIndex: 2,
        lineHeight: 1,
      }}
    >
      {count > 99 ? '99+' : count}
    </div>
  );
}

// ---- Asset node --------------------------------------------------------------

function AssetNode({
  asset,
  pos,
  onOpen,
}: {
  asset: (typeof MAP_ASSETS)[string];
  pos: NodePos;
  onOpen: () => void;
}) {
  const { fg, bg } = priStyle(asset.highestSeverity);
  const icon = kindIcon(asset.kind);
  const [hovered, setHovered] = useState(false);

  return (
    <button
      data-testid={`map-asset-${asset.key}`}
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={asset.name}
      style={{
        position: 'absolute',
        left: `${pos.xPct}%`,
        top: `${pos.yPct}%`,
        transform: `translate(-50%, -50%) ${hovered ? 'scale(1.08)' : 'scale(1)'}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 5,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        fontFamily: 'var(--font-default-family)',
        zIndex: 5,
        transition: 'transform 130ms ease',
      }}
    >
      {/* Circle */}
      <div style={{ position: 'relative' }}>
        <div
          style={{
            width: 50,
            height: 50,
            borderRadius: '50%',
            background: bg,
            border: `2px solid ${fg}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: hovered ? `0 0 12px ${fg}55` : 'none',
            transition: 'box-shadow 130ms ease',
          }}
        >
          <Icon name={icon} size={20} stroke={fg} strokeWidth={1.6} />
        </div>
        <CountBadge count={asset.findings.length} fgColor={fg} />
      </div>
      {/* Label */}
      <span
        style={{
          fontSize: 11.5,
          color: 'var(--text-secondary)',
          maxWidth: 90,
          textAlign: 'center',
          lineHeight: 1.35,
          wordBreak: 'break-word',
        }}
      >
        {asset.name}
      </span>
    </button>
  );
}

// ---- External AI node --------------------------------------------------------

function AiNode({ node, pos, onOpen }: { node: (typeof EXTERNAL_AI_NODES)[number]; pos: NodePos; onOpen: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      data-testid={`map-asset-${node.key}`}
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={node.provider}
      style={{
        position: 'absolute',
        left: `${pos.xPct}%`,
        top: `${pos.yPct}%`,
        transform: `translate(-50%, -50%) ${hovered ? 'scale(1.08)' : 'scale(1)'}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 5,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
        fontFamily: 'var(--font-default-family)',
        zIndex: 5,
        transition: 'transform 130ms ease',
      }}
    >
      <div style={{ position: 'relative' }}>
        <div
          style={{
            width: 50,
            height: 50,
            borderRadius: '50%',
            background: 'var(--uw-royal-purple-06)',
            border: '2px solid var(--uw-royal-purple-02)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: hovered ? '0 0 12px var(--uw-royal-purple-02)55' : 'none',
            transition: 'box-shadow 130ms ease',
          }}
        >
          <Icon name="globe" size={20} stroke="var(--uw-royal-purple-02)" strokeWidth={1.6} />
        </div>
        <CountBadge count={node.findings.length} fgColor="var(--uw-royal-purple-02)" />
      </div>
      <span
        style={{
          fontSize: 11.5,
          color: 'var(--uw-royal-purple-03)',
          maxWidth: 90,
          textAlign: 'center',
          lineHeight: 1.35,
        }}
      >
        {node.provider}
      </span>
    </button>
  );
}

// ---- Cloud group box ---------------------------------------------------------

function CloudGroupBox({ group }: { group: CloudGroup }) {
  const tint = cloudTint(group.cloud);
  return (
    <div
      style={{
        position: 'absolute',
        left: `${group.box.left}%`,
        top: `${group.box.top}%`,
        width: `${group.box.width}%`,
        height: `${group.box.height}%`,
        border: `1px solid ${tint.border}`,
        background: tint.bg,
        borderRadius: 10,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      {/* Header chip */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          background: 'var(--surface-elevated)',
          border: `1px solid ${tint.border}`,
          borderRadius: 20,
          padding: '2px 8px',
          fontSize: 12,
          fontWeight: 600,
          color: tint.badge,
          pointerEvents: 'none',
        }}
      >
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: tint.border,
          color: 'var(--surface)',
          fontSize: 9,
          fontWeight: 800,
        }}>
          {group.cloud.charAt(0)}
        </span>
        {group.cloud}
      </div>
    </div>
  );
}

// ---- Bezier curve helper -----------------------------------------------------

function bezier(x1: number, y1: number, x2: number, y2: number): string {
  const dx = (x2 - x1) * 0.45;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

// ---- ExposureMap -------------------------------------------------------------

export function ExposureMap() {
  const { dispatch } = useStore();
  const [showStatic,     setShowStatic]     = useState(true);
  const [showDynamic,    setShowDynamic]     = useState(true);
  const [showExternalAi, setShowExternalAi]  = useState(true);

  const assets = useMemo(() => Object.values(MAP_ASSETS), []);
  const aiNodeKeys = useMemo(() => new Set(EXTERNAL_AI_NODES.map(n => n.key)), []);

  // Compute layout once
  const { groups, nodeCenters } = useMemo(() => computeLayout(assets), [assets]);

  const toast = (msg: string) => dispatch({ type: 'SHOW_TOAST', message: msg });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Filter row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Icon name="filter" size={14} stroke="var(--text-tertiary)" strokeWidth={1.8} />
        {/* Visual search box */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 20,
            padding: '4px 12px',
            fontSize: 11.5,
            color: 'var(--text-tertiary)',
            minWidth: 160,
          }}
        >
          <Icon name="search" size={12} stroke="var(--text-tertiary)" strokeWidth={2} />
          <span>Search anything</span>
        </div>
        <div style={{ width: 1, height: 18, background: 'var(--border-subtle)', margin: '0 2px' }} />
        <FilterChip label="Static (asset)"  active={showStatic}     onToggle={() => setShowStatic(v => !v)} />
        <FilterChip label="Dynamic (flow)"  active={showDynamic}    onToggle={() => setShowDynamic(v => !v)} />
        <FilterChip label="External AI"     active={showExternalAi} onToggle={() => setShowExternalAi(v => !v)} />
      </div>

      {/* Canvas */}
      <div
        style={{
          position: 'relative',
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          height: CANVAS_H,
          overflow: 'hidden',
        }}
      >
        {/* Cloud group boxes */}
        {showStatic && groups.map(g => <CloudGroupBox key={g.cloud} group={g} />)}

        {/* SVG edges overlay */}
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {/* Static asset edges */}
          {showStatic && assets.flatMap(asset =>
            asset.edges.map(toKey => {
              const fromPos = nodeCenters[asset.key];
              const toPos   = nodeCenters[toKey];
              if (!fromPos || !toPos) return null;
              return (
                <path
                  key={`static-${asset.key}-${toKey}`}
                  d={bezier(fromPos.xPct, fromPos.yPct, toPos.xPct, toPos.yPct)}
                  fill="none"
                  stroke="var(--uw-metal-blue-04)"
                  strokeWidth={0.4}
                  opacity={0.7}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })
          )}

          {/* Dynamic flow edges */}
          {showDynamic && MAP_FLOWS.filter(f => !aiNodeKeys.has(f.toKey)).map(flow => {
            const fromPos = nodeCenters[flow.fromKey];
            const toPos   = nodeCenters[flow.toKey];
            if (!fromPos || !toPos) return null;
            return (
              <path
                key={flow.id}
                d={bezier(fromPos.xPct, fromPos.yPct, toPos.xPct, toPos.yPct)}
                fill="none"
                stroke="var(--uw-cyan-02)"
                strokeWidth={0.4}
                strokeDasharray="2 1.5"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}

          {/* External AI edges */}
          {showExternalAi && MAP_FLOWS.filter(f => aiNodeKeys.has(f.toKey)).map(flow => {
            const fromPos = nodeCenters[flow.fromKey];
            const toPos   = nodeCenters[flow.toKey];
            if (!fromPos || !toPos) return null;
            return (
              <path
                key={flow.id}
                d={bezier(fromPos.xPct, fromPos.yPct, toPos.xPct, toPos.yPct)}
                fill="none"
                stroke="var(--uw-royal-purple-02)"
                strokeWidth={0.4}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {/* Asset nodes */}
        {showStatic && assets.map(asset => {
          const pos = nodeCenters[asset.key];
          if (!pos) return null;
          return (
            <AssetNode
              key={asset.key}
              asset={asset}
              pos={pos}
              onOpen={() => dispatch({ type: 'OPEN_MAP_ASSET', key: asset.key })}
            />
          );
        })}

        {/* External AI nodes */}
        {showExternalAi && EXTERNAL_AI_NODES.map(node => {
          const pos = nodeCenters[node.key];
          if (!pos) return null;
          return (
            <AiNode
              key={node.key}
              node={node}
              pos={pos}
              onOpen={() => dispatch({ type: 'OPEN_MAP_ASSET', key: node.key })}
            />
          );
        })}

        {/* Legend */}
        <Legend />

        {/* Zoom controls */}
        <ZoomControls onAction={toast} />

        {/* Timeline */}
        <Timeline />
      </div>
    </div>
  );
}
