// FileTreeView — a collapsible explorer of the REAL scanned repo
// (customer-data/evenup), with each file's findings + worst severity overlaid,
// aggregated up into folders. Left: the tree. Right: the selected file's findings.
import { useMemo, useState } from 'react';
import { FILE_TREE, FINDINGS } from '../../data';
import type { AnnotatedTreeNode, Finding, Priority } from '../../types';
import { priStyle, priLabel } from '../../lib/classify';
import { Icon } from '../common/Icon';
import { useStore } from '../../state/StoreContext';

const sevColor = (p?: Priority): string =>
  p ? priStyle(p).fg : 'var(--text-tertiary)';

// dir paths that contain findings — expanded by default so secret-bearing paths
// are visible immediately; clean folders start collapsed.
function defaultExpanded(node: AnnotatedTreeNode, acc: Set<string>): Set<string> {
  if (node.type === 'dir' && node.findingCount > 0) {
    acc.add(node.path);
    for (const c of node.children ?? []) defaultExpanded(c, acc);
  }
  return acc;
}

function SeverityDot({ p }: { p?: Priority }) {
  return (
    <span
      title={p ? priLabel(p) : 'clean'}
      style={{
        width: 8, height: 8, borderRadius: 999, flexShrink: 0,
        background: p ? sevColor(p) : 'transparent',
        border: p ? 'none' : '1px solid var(--border-primary)',
        display: 'inline-block',
      }}
    />
  );
}

function CountBadge({ n, p }: { n: number; p?: Priority }) {
  if (n === 0) return null;
  return (
    <span
      style={{
        fontSize: 11, fontWeight: 600, lineHeight: 1, padding: '2px 6px', borderRadius: 999,
        color: sevColor(p), background: p ? priStyle(p).bg : 'var(--severity-info-bg)',
      }}
    >
      {n}
    </span>
  );
}

interface RowProps {
  node: AnnotatedTreeNode;
  depth: number;
  expanded: Set<string>;
  toggle: (path: string) => void;
  selected: string | null;
  onSelect: (node: AnnotatedTreeNode) => void;
}

function TreeRow({ node, depth, expanded, toggle, selected, onSelect }: RowProps) {
  const isDir = node.type === 'dir';
  const isOpen = expanded.has(node.path);
  const isSel = selected === node.path;
  const clean = node.findingCount === 0;

  return (
    <>
      <div
        onClick={() => (isDir ? toggle(node.path) : onSelect(node))}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
          padding: '4px 8px', paddingLeft: 8 + depth * 16, borderRadius: 6,
          background: isSel ? 'var(--surface-elevated)' : 'transparent',
          opacity: clean && !isDir ? 0.55 : 1,
          fontSize: 13, color: 'var(--text-primary)',
        }}
        onMouseEnter={(e) => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'var(--interactive-hover)'; }}
        onMouseLeave={(e) => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        {isDir ? (
          <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={13} stroke="var(--text-tertiary)" />
        ) : (
          <span style={{ width: 13, display: 'inline-block' }} />
        )}
        <Icon name={isDir ? 'database' : 'file'} size={13} stroke={isDir ? 'var(--action-primary)' : 'var(--text-tertiary)'} />
        <span style={{ flex: 1, fontWeight: isDir ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {node.name}
        </span>
        <SeverityDot p={node.highestPriority} />
        <CountBadge n={node.findingCount} p={node.highestPriority} />
      </div>
      {isDir && isOpen && (node.children ?? []).map((c) => (
        <TreeRow key={c.path} node={c} depth={depth + 1} expanded={expanded} toggle={toggle} selected={selected} onSelect={onSelect} />
      ))}
    </>
  );
}

export function FileTreeView() {
  const { dispatch } = useStore();
  const [expanded, setExpanded] = useState<Set<string>>(() => defaultExpanded(FILE_TREE, new Set([FILE_TREE.path])));
  const [selected, setSelected] = useState<AnnotatedTreeNode | null>(null);

  const byId = useMemo(() => new Map<number, Finding>(FINDINGS.map((f) => [f.id, f])), []);
  const totals = useMemo(() => {
    let files = 0, withF = 0;
    const walk = (n: AnnotatedTreeNode) => { if (n.type === 'file') { files++; if (n.findingCount) withF++; } (n.children ?? []).forEach(walk); };
    walk(FILE_TREE);
    return { files, withF };
  }, []);

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });

  const selFindings = selected ? selected.findingIds.map((id) => byId.get(id)).filter(Boolean) as Finding[] : [];

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%' }}>
      {/* Tree */}
      <div style={{ flex: '0 0 46%', minWidth: 360, border: '1px solid var(--border-primary)', borderRadius: 10, background: 'var(--surface-elevated)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-primary)' }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Repository — {FILE_TREE.path}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {totals.files} files · {totals.withF} with findings · {FILE_TREE.findingCount} total
          </div>
        </div>
        <div style={{ overflow: 'auto', padding: 8 }}>
          {(FILE_TREE.children ?? []).map((c) => (
            <TreeRow key={c.path} node={c} depth={0} expanded={expanded} toggle={toggle} selected={selected?.path ?? null} onSelect={setSelected} />
          ))}
        </div>
      </div>

      {/* Selected file's findings */}
      <div style={{ flex: 1, border: '1px solid var(--border-primary)', borderRadius: 10, background: 'var(--surface-elevated)', overflow: 'auto', padding: 16 }}>
        {!selected ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Select a file to see the findings the backend produced for it.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-all' }}>{selected.path}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 14px' }}>
              {selFindings.length === 0 ? 'No findings — clean file.' : `${selFindings.length} finding(s)`}
            </div>
            {selFindings
              .slice()
              .sort((a, b) => b.scores.authenticityScore - a.scores.authenticityScore)
              .map((f) => {
                const st = priStyle(f.basePriority);
                return (
                  <div key={f.id} style={{ border: '1px solid var(--border-primary)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: st.fg, background: st.bg, padding: '2px 8px', borderRadius: 999 }}>
                        {priLabel(f.basePriority)}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{f.classification}</span>
                      <span style={{ fontFamily: 'var(--font-mono-family, monospace)', fontSize: 12, color: 'var(--text-secondary)' }}>{f.maskedValue}</span>
                      <button
                        onClick={() => dispatch({ type: 'OPEN_DETAIL', id: f.id })}
                        style={{ marginLeft: 'auto', fontSize: 12, cursor: 'pointer', background: 'none', border: '1px solid var(--border-primary)', borderRadius: 6, padding: '3px 9px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 5 }}
                      >
                        <Icon name="eye" size={12} stroke="var(--text-tertiary)" /> Details
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>authenticity {f.scores.authenticityScore}/100</span>
                      <span>model {f.scores.lgbmProbability.toFixed(2)}</span>
                      <span>rules {f.scores.deterministicRules >= 0 ? '+' : ''}{f.scores.deterministicRules}</span>
                      <span>{f.exposure} · {f.assetCriticality} asset</span>
                    </div>
                    {f.riskDownReasons.length > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--severity-safe)', marginTop: 6 }}>↓ {f.riskDownReasons.join(' · ')}</div>
                    )}
                    {f.riskUpReasons.length > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--severity-high)', marginTop: 4 }}>↑ {f.riskUpReasons.join(' · ')}</div>
                    )}
                  </div>
                );
              })}
          </>
        )}
      </div>
    </div>
  );
}
