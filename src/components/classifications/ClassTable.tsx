// ClassTable.tsx — filterable table of classification rows.
// Inline styles with CSS vars; no external CSS.

import { useStore } from '../../state/StoreContext';
import { CLASSIFICATIONS } from '../../data';
import { categoryStyle } from '../../lib/classify';
import { Icon } from '../common/Icon';

export function ClassTable() {
  const { state, dispatch } = useStore();
  const q = state.classSearch.trim().toLowerCase();

  const rows = CLASSIFICATIONS.filter(
    c => !q || c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q),
  );

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
          background: 'var(--bg-primary, var(--surface))',
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
                {[
                  'Sensitive data classification',
                  'Category',
                  'Patterns',
                  'Rule packs',
                  'Findings',
                  'Critical',
                  'FP reduction',
                  'Created by',
                  'Status',
                ].map(col => (
                  <th
                    key={col}
                    style={{
                      padding: '8px 12px',
                      textAlign: 'left',
                      fontSize: 11.5,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      borderBottom: '1px solid var(--border-subtle)',
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
                return (
                  <tr
                    key={c.id}
                    onClick={() => dispatch({ type: 'OPEN_CLASS', id: c.id })}
                    style={{ cursor: 'pointer', transition: 'background 80ms' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLTableRowElement).style.background =
                        'var(--interactive-hover)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLTableRowElement).style.background = '';
                    }}
                  >
                    {/* Name */}
                    <td style={{ padding: '14px 12px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 26,
                            height: 26,
                            borderRadius: 6,
                            background: 'var(--uw-green-06)',
                            flexShrink: 0,
                          }}
                        >
                          <Icon name="leaf" size={14} stroke="var(--uw-green-02)" />
                        </div>
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{c.name}</span>
                      </div>
                    </td>

                    {/* Category */}
                    <td style={{ padding: '14px 12px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            display: 'inline-block',
                            width: 7,
                            height: 7,
                            borderRadius: 2,
                            background: catStyle.fg,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ color: catStyle.fg, fontSize: 12, fontWeight: 500 }}>{c.category}</span>
                      </div>
                    </td>

                    {/* Patterns */}
                    <td style={{ padding: '14px 12px', color: 'var(--text-secondary)' }}>
                      {c.patterns}
                    </td>

                    {/* Rule packs */}
                    <td style={{ padding: '14px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {c.rulePacks}
                    </td>

                    {/* Findings */}
                    <td style={{ padding: '14px 12px', color: 'var(--text-secondary)' }}>
                      {c.findings.toLocaleString()}
                    </td>

                    {/* Critical */}
                    <td
                      style={{
                        padding: '14px 12px',
                        fontWeight: c.critical > 0 ? 600 : 400,
                        color:
                          c.critical > 0
                            ? 'var(--severity-critical)'
                            : 'var(--text-tertiary)',
                      }}
                    >
                      {c.critical}
                    </td>

                    {/* FP reduction */}
                    <td style={{ padding: '14px 12px' }}>
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
                              background: 'var(--uw-green-02)',
                              borderRadius: 3,
                            }}
                          />
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {c.fpReductionPct}%
                        </span>
                      </div>
                    </td>

                    {/* Created by */}
                    <td style={{ padding: '14px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {c.createdBy}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 12px', whiteSpace: 'nowrap' }}>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: 12,
                          color: enabled ? 'var(--severity-safe)' : 'var(--text-tertiary)',
                          fontWeight: 500,
                        }}
                      >
                        <Icon
                          name="check"
                          size={13}
                          stroke={enabled ? 'var(--severity-safe)' : 'var(--text-tertiary)'}
                        />
                        {enabled ? 'Enabled' : 'Disabled'}
                      </div>
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
