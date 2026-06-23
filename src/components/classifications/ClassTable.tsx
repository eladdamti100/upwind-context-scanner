// ClassTable.tsx — filterable table of classification rows.
// Inline styles with CSS vars; no external CSS. Styling mirrors the findings
// table (header treatment, chips, hover/selected rows) for consistency.

import { useStore } from '../../state/StoreContext';
import { CLASSIFICATIONS } from '../../data';
import { categoryStyle } from '../../lib/classify';
import type { Category } from '../../types';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';

// Category-aware icon + short, safe display description (derived from category;
// no new data model).
const CATEGORY_META: Record<Category, { icon: IconName; desc: string }> = {
  'Secret': { icon: 'key', desc: 'infrastructure credential' },
  'Fintech': { icon: 'landmark', desc: 'financial data' },
  'SaaS': { icon: 'globe', desc: 'service token' },
  'PII': { icon: 'user', desc: 'personal identifier' },
  'PCI': { icon: 'credit-card', desc: 'payment data' },
  'Healthcare': { icon: 'activity', desc: 'health data' },
  'Retail': { icon: 'layers', desc: 'retail data' },
  'False Positive Pattern': { icon: 'filter', desc: 'false-positive pattern' },
  'Documentation Example': { icon: 'file', desc: 'low-risk pattern' },
  'Test Value': { icon: 'file', desc: 'test data' },
};

function catMeta(c: Category) {
  return CATEGORY_META[c] ?? { icon: 'layers' as IconName, desc: 'classification' };
}

// Column hierarchy: important columns lead, supporting ones follow and are
// rendered in a muted treatment.
const COLUMNS = [
  'Sensitive data classification',
  'Category',
  'Findings',
  'Critical',
  'FP reduction',
  'Status',
  'Patterns',
  'Rule packs',
  'Created by',
  '', // chevron affordance
];

export function ClassTable() {
  const { state, dispatch } = useStore();
  const q = state.classSearch.trim().toLowerCase();

  const rows = CLASSIFICATIONS.filter(
    c => !q || c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q),
  );

  // Muted style for supporting columns.
  const mutedTd: React.CSSProperties = { padding: '12px 12px', color: 'var(--text-tertiary)', fontSize: 12.5, whiteSpace: 'nowrap' };

  return (
    <div>
      {/* Filter row */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            width: 230,
            height: 32,
            padding: '0 10px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
          }}
        >
          <Icon name="search" size={14} stroke="var(--text-tertiary)" />
          <input
            type="text"
            placeholder="Search classifications…"
            value={state.classSearch}
            onInput={e =>
              dispatch({ type: 'SET_CLASS_SEARCH', search: (e.target as HTMLInputElement).value })
            }
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: 13,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-default-family)',
            }}
          />
        </div>
      </div>

      {/* Card */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {/* Count line */}
        <div
          style={{
            padding: '10px 16px',
            fontSize: 13,
            color: 'var(--text-secondary)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          Showing <b style={{ color: 'var(--text-primary)' }}>{rows.length}</b> classifications
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 13,
              color: 'var(--text-primary)',
            }}
          >
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                {COLUMNS.map((col, i) => (
                  <th
                    key={col || `col-${i}`}
                    style={{
                      // Extra left gutter on the first column so it lines up
                      // cleanly with the icon chips below.
                      padding: i === 0 ? '9px 12px 9px 16px' : '9px 12px',
                      textAlign: 'left',
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      borderBottom: '1px solid var(--border-primary)',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(c => {
                const enabled = state.classEnabled[c.id] ?? c.enabled;
                const catStyle = categoryStyle(c.category);
                const meta = catMeta(c.category);
                const selected = state.classId === c.id;
                const restBg = selected ? 'var(--row-selected-bg)' : '';
                return (
                  <tr
                    key={c.id}
                    onClick={() => dispatch({ type: 'OPEN_CLASS', id: c.id })}
                    style={{ cursor: 'pointer', background: restBg, transition: 'background 80ms' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLTableRowElement).style.background = 'var(--interactive-hover)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLTableRowElement).style.background = restBg;
                    }}
                  >
                    {/* Name + category-aware icon + secondary description */}
                    <td style={{ padding: '11px 12px 11px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            background: catStyle.bg,
                            flexShrink: 0,
                          }}
                        >
                          <Icon name={meta.icon} size={15} stroke={catStyle.fg} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{c.name}</span>
                          <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                            {c.category} · {meta.desc}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          height: 21,
                          padding: '0 9px',
                          borderRadius: 5,
                          background: catStyle.bg,
                          color: catStyle.fg,
                          fontSize: 11.5,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.category}
                      </span>
                    </td>

                    {/* Findings */}
                    <td style={{ padding: '11px 12px', color: 'var(--text-primary)' }}>
                      {c.findings.toLocaleString()}
                    </td>

                    {/* Critical */}
                    <td
                      style={{
                        padding: '11px 12px',
                        fontWeight: c.critical > 0 ? 600 : 400,
                        color: c.critical > 0 ? 'var(--severity-critical)' : 'var(--text-tertiary)',
                      }}
                    >
                      {c.critical}
                    </td>

                    {/* FP reduction — dash for 0%, subtle green bar otherwise */}
                    <td style={{ padding: '11px 12px' }}>
                      {c.fpReductionPct === 0 ? (
                        <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            style={{
                              width: 54,
                              height: 6,
                              borderRadius: 3,
                              background: 'var(--bg-tertiary)',
                              overflow: 'hidden',
                              flexShrink: 0,
                            }}
                          >
                            <div
                              style={{
                                width: `${c.fpReductionPct}%`,
                                height: '100%',
                                background: 'var(--severity-safe)',
                                borderRadius: 3,
                              }}
                            />
                          </div>
                          <span style={{ width: 32, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                            {c.fpReductionPct}%
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '11px 12px', whiteSpace: 'nowrap' }}>
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
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: enabled ? 'var(--severity-safe)' : 'var(--text-tertiary)',
                            flexShrink: 0,
                          }}
                        />
                        {enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>

                    {/* Supporting columns — muted */}
                    <td style={mutedTd}>{c.patterns}</td>
                    <td style={mutedTd}>{c.rulePacks}</td>
                    <td style={mutedTd}>{c.createdBy}</td>

                    {/* Chevron affordance */}
                    <td style={{ padding: '11px 14px 11px 8px', textAlign: 'right', width: 36 }}>
                      <Icon name="chevron-right" size={15} stroke="var(--text-tertiary)" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
