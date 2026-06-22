// ExposureMap.tsx — Exposure topology map with asset nodes, flow edges, and external-AI nodes.
// All data is MASKED placeholder. No full secrets are ever rendered.

import { useState } from 'react';
import { MAP_ASSETS, MAP_FLOWS, EXTERNAL_AI_NODES } from '../../data';
import { priStyle } from '../../lib/classify';
import { useStore } from '../../state/StoreContext';
import { Icon } from '../common/Icon';

// ---- Helpers -----------------------------------------------------------------

function SeverityDot({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    critical: 'var(--severity-critical)',
    high: 'var(--severity-high)',
    medium: 'var(--severity-medium)',
    low: 'var(--severity-low)',
  };
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: colors[priority] ?? 'var(--text-tertiary)',
        flexShrink: 0,
      }}
    />
  );
}

// ---- Filter chips ------------------------------------------------------------

interface ChipProps {
  label: string;
  active: boolean;
  color: string;
  onToggle: () => void;
}

function FilterChip({ label, active, color, onToggle }: ChipProps) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 20,
        border: `1px solid ${active ? color : 'var(--border-subtle)'}`,
        background: active ? `${color}22` : 'transparent',
        color: active ? color : 'var(--text-tertiary)',
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'var(--font-default-family)',
        transition: 'all 120ms',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: active ? color : 'var(--text-tertiary)',
          flexShrink: 0,
        }}
      />
      {label}
    </button>
  );
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
        fontSize: 11,
        color: 'var(--text-secondary)',
        zIndex: 10,
        minWidth: 170,
      }}
    >
      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, fontSize: 11 }}>Legend</div>
      {/* Severity */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
        {[
          { label: 'Critical', color: 'var(--severity-critical)' },
          { label: 'High', color: 'var(--severity-high)' },
          { label: 'Medium', color: 'var(--severity-medium)' },
          { label: 'Low', color: 'var(--severity-low)' },
        ].map(({ label, color }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
            {label}
          </div>
        ))}
      </div>
      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '6px 0' }} />
      {/* Edge styles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={28} height={8} style={{ flexShrink: 0 }}>
            <line x1={0} y1={4} x2={28} y2={4} stroke="var(--uw-metal-blue-04)" strokeWidth={1.5} />
          </svg>
          Static (asset)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={28} height={8} style={{ flexShrink: 0 }}>
            <line x1={0} y1={4} x2={28} y2={4} stroke="var(--uw-cyan-02)" strokeWidth={1.5} strokeDasharray="4 2" />
          </svg>
          Dynamic (flow)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width={28} height={8} style={{ flexShrink: 0 }}>
            <line x1={0} y1={4} x2={28} y2={4} stroke="var(--uw-royal-purple-02)" strokeWidth={1.5} />
          </svg>
          External AI
        </div>
      </div>
    </div>
  );
}

// ---- ExposureMap -------------------------------------------------------------

export function ExposureMap() {
  const { dispatch } = useStore();
  const [showStatic, setShowStatic] = useState(true);
  const [showDynamic, setShowDynamic] = useState(true);
  const [showExternalAi, setShowExternalAi] = useState(true);

  const assets = Object.values(MAP_ASSETS);
  const aiNodeKeys = new Set(EXTERNAL_AI_NODES.map(n => n.key));

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
        height: 620,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Filter row */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          display: 'flex',
          gap: 6,
          zIndex: 10,
        }}
      >
        <FilterChip
          label="Static (asset)"
          active={showStatic}
          color="var(--uw-metal-blue-03)"
          onToggle={() => setShowStatic(v => !v)}
        />
        <FilterChip
          label="Dynamic (flow)"
          active={showDynamic}
          color="var(--uw-cyan-02)"
          onToggle={() => setShowDynamic(v => !v)}
        />
        <FilterChip
          label="External AI"
          active={showExternalAi}
          color="var(--uw-royal-purple-02)"
          onToggle={() => setShowExternalAi(v => !v)}
        />
      </div>

      {/* Legend */}
      <Legend />

      {/* SVG edges overlay */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {/* Static asset edges */}
        {showStatic && assets.flatMap(asset =>
          asset.edges.map(toKey => {
            const target = MAP_ASSETS[toKey];
            if (!target) return null;
            return (
              <line
                key={`static-${asset.key}-${toKey}`}
                x1={asset.position.xPct}
                y1={asset.position.yPct}
                x2={target.position.xPct}
                y2={target.position.yPct}
                stroke="var(--uw-metal-blue-04)"
                strokeWidth={0.4}
                vectorEffect="non-scaling-stroke"
              />
            );
          })
        )}

        {/* Dynamic flow edges */}
        {showDynamic && MAP_FLOWS.filter(f => !aiNodeKeys.has(f.toKey)).map(flow => {
          const from = MAP_ASSETS[flow.fromKey];
          const to = MAP_ASSETS[flow.toKey];
          if (!from || !to) return null;
          return (
            <line
              key={flow.id}
              x1={from.position.xPct}
              y1={from.position.yPct}
              x2={to.position.xPct}
              y2={to.position.yPct}
              stroke="var(--uw-cyan-02)"
              strokeWidth={0.4}
              strokeDasharray="2 1.5"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {/* External AI edges */}
        {showExternalAi && MAP_FLOWS.filter(f => aiNodeKeys.has(f.toKey)).map(flow => {
          const from = MAP_ASSETS[flow.fromKey];
          const aiNode = EXTERNAL_AI_NODES.find(n => n.key === flow.toKey);
          if (!from || !aiNode) return null;
          return (
            <line
              key={flow.id}
              x1={from.position.xPct}
              y1={from.position.yPct}
              x2={aiNode.position.xPct}
              y2={aiNode.position.yPct}
              stroke="var(--uw-royal-purple-02)"
              strokeWidth={0.4}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      {/* Asset nodes */}
      {showStatic && assets.map(asset => {
        const { fg } = priStyle(asset.highestSeverity);
        return (
          <button
            key={asset.key}
            data-testid={`map-asset-${asset.key}`}
            onClick={() => dispatch({ type: 'OPEN_MAP_ASSET', key: asset.key })}
            style={{
              position: 'absolute',
              left: `${asset.position.xPct}%`,
              top: `${asset.position.yPct}%`,
              transform: 'translate(-50%, -50%)',
              background: 'var(--surface-elevated)',
              border: `1px solid ${fg}`,
              borderRadius: 8,
              padding: '8px 10px',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'var(--font-default-family)',
              minWidth: 130,
              zIndex: 5,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
              <SeverityDot priority={asset.highestSeverity} />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{asset.name}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{asset.kind}</div>
          </button>
        );
      })}

      {/* External AI nodes */}
      {showExternalAi && EXTERNAL_AI_NODES.map(node => (
        <button
          key={node.key}
          data-testid={`map-asset-${node.key}`}
          onClick={() => dispatch({ type: 'OPEN_MAP_ASSET', key: node.key })}
          style={{
            position: 'absolute',
            left: `${node.position.xPct}%`,
            top: `${node.position.yPct}%`,
            transform: 'translate(-50%, -50%)',
            background: 'var(--uw-royal-purple-06)',
            border: '1px solid var(--uw-royal-purple-02)',
            borderRadius: 8,
            padding: '8px 10px',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'var(--font-default-family)',
            minWidth: 120,
            zIndex: 5,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
            <Icon name="globe" size={12} stroke="var(--uw-royal-purple-02)" />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--uw-royal-purple-02)' }}>{node.provider}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--uw-royal-purple-03)' }}>External AI service</div>
        </button>
      ))}
    </div>
  );
}
