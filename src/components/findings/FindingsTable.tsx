// FindingsTable.tsx — bordered findings table with toolbar and pagination.
// Uses only inline styles + CSS vars (no external CSS classes).

import React from 'react';
import { FINDINGS } from '../../data';
import { rankFilter, sortRows } from '../../lib/query';
import { effPriority } from '../../lib/priority';
import {
  priStyle,
  categoryStyle,
  envStyle,
  valStyle,
  techOf,
} from '../../lib/classify';
import { useStore } from '../../state/StoreContext';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';
import { Avatar } from '../common/Avatar';
import { SeverityBadge } from '../common/SeverityBadge';
import { Popover } from '../common/Popover';
import { InfoTooltip } from '../common/InfoTooltip';
import { CircularScore } from '../common/CircularScore';

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

function Chip({ label, fg, bg, dot = true }: { label: string; fg: string; bg: string; dot?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: dot ? 5 : 0,
        height: 20,
        padding: '0 7px',
        borderRadius: 4,
        background: bg,
        fontSize: 11,
        fontWeight: 500,
        color: fg,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {dot && (
        <span
          style={{ width: 5, height: 5, borderRadius: '50%', background: fg, flexShrink: 0 }}
        />
      )}
      {label}
    </span>
  );
}

function IconBtn({
  onClick,
  title,
  children,
  active,
}: {
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        borderRadius: 6,
        border: active ? '1px solid var(--action-primary)' : '1px solid var(--border-subtle)',
        background: active ? 'var(--action-primary)' : 'transparent',
        color: active ? '#fff' : 'var(--text-secondary)',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

// Header info tooltips (shown via the native title attribute on a small info icon).
const CONFIDENCE_TOOLTIP =
  'Confidence estimates how likely this finding is to be a real secret or sensitive data, based on regex confidence, context features, deterministic rules, and the model signal.';
const PRIORITY_TOOLTIP =
  'Remediation Priority indicates how urgently this finding should be handled, based on confidence, access, exposure, secret type severity, and activity.';
const CREDENTIAL_CHECK_TOOLTIP =
  'Checks whether the detected credential is still active. Active credentials increase remediation priority.';

// Header columns that get an info tooltip, keyed by column id.
const HEADER_INFO: Record<string, { text: string; label: string }> = {
  risk: { text: CONFIDENCE_TOOLTIP, label: 'What is Confidence?' },
  priority: { text: PRIORITY_TOOLTIP, label: 'What is Remediation Priority?' },
  validation: { text: CREDENTIAL_CHECK_TOOLTIP, label: 'What is Credential Check?' },
};

const SORT_OPTIONS: { key: string; label: string }[] = [
  { key: 'risk', label: 'Risk score' },
  { key: 'priority', label: 'Remediation priority' },
  { key: 'created', label: 'Created at' },
  { key: 'line', label: 'Line number' },
  { key: 'off', label: 'Line offset' },
];

// Map col.id → sort key
const COL_SORT_MAP: Record<string, string> = {
  priority: 'priority',
  risk: 'risk',
  createdAt: 'created',
};

// Per-column widths (auto table layout). `file` is greedy (100%) so it absorbs
// slack, keeping the other columns tight instead of letting them stretch.
// Columns not listed size to their content.
const COL_WIDTH: Record<string, string> = {
  actions: '72px',      // Actions — narrow, leads the row
  risk: '130px',        // % Confidence — header + icons + centered ring
  priority: '184px',    // Remediation priority — header + info + badge
  validation: '152px',  // Credential Check
  cloud: '80px',        // Cloud — centered provider badge
  file: '100%',         // File name | path — flexible, absorbs remaining width
};

// Columns whose cell content is a chip/badge/ring/icon group — centered in
// the column (header included). Plain-text columns stay left-aligned.
const CENTERED_COLS = new Set([
  'actions',
  'risk',
  'priority',
  'classification',
  'validation',
  'environment',
  'cloud',
]);

// Cloud-provider badge styling. Brand colors (not theme tokens) so each
// provider reads at a glance; the name lives in the tooltip / aria-label.
const CLOUD_BADGE: Record<string, string> = {
  AWS: '#ED7100',
  Azure: '#0089D6',
  GCP: '#1A73E8',
  GitHub: '#24292F',
  'Multi-cloud': '#64748B',
};

function CloudBadge({ provider }: { provider: string }) {
  const bg = CLOUD_BADGE[provider] ?? 'var(--text-tertiary)';
  return (
    <span
      role="img"
      title={provider}
      aria-label={`Cloud provider: ${provider}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: bg,
        flexShrink: 0,
      }}
    >
      <Icon name="cloud" size={12} stroke="#fff" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// TableToolbar
// ---------------------------------------------------------------------------

function TableToolbar({
  filteredCount,
  totalCount,
}: {
  filteredCount: number;
  totalCount: number;
}) {
  const { state, dispatch } = useStore();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      {/* Left: result count */}
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        Showing{' '}
        <b style={{ color: 'var(--text-primary)' }}>{filteredCount}</b>
        {' '}of {totalCount} context-aware findings
      </span>

      {/* Right: toolbar icons */}
      <div style={{ display: 'flex', gap: 6, position: 'relative' }}>
        {/* Sort */}
        <div style={{ position: 'relative' }}>
          <IconBtn
            title="Sort"
            active={state.menu === 'sort'}
            onClick={() => dispatch({ type: 'TOGGLE_MENU', menu: 'sort' })}
          >
            <Icon name="filter" size={14} />
          </IconBtn>
          <Popover
            open={state.menu === 'sort'}
            onClose={() => dispatch({ type: 'CLOSE_MENU' })}
            style={{ top: 34, right: 0, minWidth: 200 }}
          >
            <div style={{ padding: '4px 2px' }}>
              {SORT_OPTIONS.map(opt => {
                const active = state.sortKey === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => dispatch({ type: 'SET_SORT', key: opt.key })}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: 5,
                      border: 'none',
                      background: active ? 'var(--interactive-hover)' : 'transparent',
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontSize: 13,
                      cursor: 'pointer',
                      textAlign: 'left',
                      gap: 6,
                    }}
                  >
                    {opt.label}
                    {active && (
                      <Icon
                        name={state.sortDir === 'asc' ? 'chevron-up' : 'chevron-down'}
                        size={13}
                        stroke="var(--action-primary)"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </Popover>
        </div>

        {/* Columns */}
        <div style={{ position: 'relative' }}>
          <IconBtn
            title="Columns"
            active={state.menu === 'cols'}
            onClick={() => dispatch({ type: 'TOGGLE_MENU', menu: 'cols' })}
          >
            <Icon name="layers" size={14} />
          </IconBtn>
          <Popover
            open={state.menu === 'cols'}
            onClose={() => dispatch({ type: 'CLOSE_MENU' })}
            style={{ top: 34, right: 0, minWidth: 214 }}
          >
            <div style={{ padding: '2px 0' }}>
              {state.cols.map((col, idx) => (
                <div
                  key={col.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '3px 8px',
                    borderRadius: 4,
                    height: 26,
                  }}
                >
                  {/* Required columns are locked — no checkbox. Optional columns toggle. */}
                  {col.required ? (
                    // Locked column — reserve the checkbox slot so labels stay aligned.
                    <span
                      aria-hidden="true"
                      style={{ width: 13, flexShrink: 0 }}
                    />
                  ) : (
                    <input
                      type="checkbox"
                      checked={col.vis}
                      onChange={() => dispatch({ type: 'TOGGLE_COL', index: idx })}
                      style={{
                        width: 13,
                        height: 13,
                        cursor: 'pointer',
                        accentColor: 'var(--action-primary)',
                        flexShrink: 0,
                        margin: 0,
                      }}
                    />
                  )}
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col.label}
                  </span>
                  {/* Move up */}
                  <button
                    onClick={() => dispatch({ type: 'MOVE_COL', index: idx, dir: 'up' })}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: idx > 0 ? 'pointer' : 'default',
                      color: idx > 0 ? 'var(--text-secondary)' : 'var(--text-disabled)',
                      padding: 1,
                      display: 'flex',
                    }}
                    disabled={idx === 0}
                  >
                    <Icon name="chevron-up" size={11} />
                  </button>
                  {/* Move down */}
                  <button
                    onClick={() => dispatch({ type: 'MOVE_COL', index: idx, dir: 'down' })}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: idx < state.cols.length - 1 ? 'pointer' : 'default',
                      color: idx < state.cols.length - 1 ? 'var(--text-secondary)' : 'var(--text-disabled)',
                      padding: 1,
                      display: 'flex',
                    }}
                    disabled={idx === state.cols.length - 1}
                  >
                    <Icon name="chevron-down" size={11} />
                  </button>
                </div>
              ))}
              <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 4, paddingTop: 5, paddingLeft: 8 }}>
                <button
                  onClick={() => dispatch({ type: 'RESET_COLS' })}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-link)',
                    fontSize: 11.5,
                    cursor: 'pointer',
                    padding: '2px 0',
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          </Popover>
        </div>

        {/* Export */}
        <div style={{ position: 'relative' }}>
          <IconBtn
            title="Export"
            active={state.menu === 'export'}
            onClick={() => dispatch({ type: 'TOGGLE_MENU', menu: 'export' })}
          >
            <Icon name="download" size={14} />
          </IconBtn>
          <Popover
            open={state.menu === 'export'}
            onClose={() => dispatch({ type: 'CLOSE_MENU' })}
            style={{ top: 34, right: 0, minWidth: 160 }}
          >
            <div style={{ padding: '4px 2px' }}>
              {(['Export CSV', 'Export PDF'] as const).map(label => (
                <button
                  key={label}
                  onClick={() => {
                    dispatch({ type: 'SHOW_TOAST', message: 'Export generated successfully.' });
                    dispatch({ type: 'CLOSE_MENU' });
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '7px 12px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    cursor: 'pointer',
                    textAlign: 'left',
                    borderRadius: 5,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </Popover>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pagination footer
// ---------------------------------------------------------------------------

const RPP_OPTIONS = [10, 15, 25, 50, 100, 'All'] as const;

function PageNavButton({
  label,
  icon,
  iconSide,
  disabled,
  onClick,
}: {
  label: string;
  icon: IconName;
  iconSide: 'left' | 'right';
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 9px',
        borderRadius: 6,
        border: '1px solid var(--border-subtle)',
        background: 'transparent',
        color: disabled ? 'var(--text-disabled)' : 'var(--text-primary)',
        fontSize: 12,
        fontWeight: 500,
        cursor: disabled ? 'default' : 'pointer',
      }}
      onMouseEnter={e => {
        if (!disabled) e.currentTarget.style.background = 'var(--interactive-hover)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {iconSide === 'left' && <Icon name={icon} size={13} stroke="currentColor" />}
      {label}
      {iconSide === 'right' && <Icon name={icon} size={13} stroke="currentColor" />}
    </button>
  );
}

function Pagination({
  total,
  start,
  end,
  currentPage,
  totalPages,
}: {
  total: number;
  start: number;
  end: number;
  currentPage: number;
  totalPages: number;
}) {
  const { state, dispatch } = useStore();
  const rppLabel = state.rpp >= 999 ? 'All' : state.rpp;

  const startNum = total === 0 ? 0 : start + 1;
  const endNum = Math.min(end, total);
  const rangeText =
    total === 0
      ? 'Showing 0 of 0 findings'
      : `Showing ${startNum}–${endNum} of ${total} findings`;
  const pageText = total === 0 ? 'Page 0 of 0' : `Page ${currentPage + 1} of ${totalPages}`;
  const prevDisabled = total === 0 || currentPage <= 0;
  const nextDisabled = total === 0 || currentPage >= totalPages - 1;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 14px',
        borderTop: '1px solid var(--border-subtle)',
        flexWrap: 'wrap',
        gap: 10,
      }}
    >
      {/* Left: item range */}
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{rangeText}</span>

      {/* Right: rows-per-page, page indicator, prev/next */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Rows per page</span>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => dispatch({ type: 'TOGGLE_MENU', menu: 'rpp' })}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid var(--border-subtle)',
                background: 'transparent',
                color: 'var(--text-primary)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {rppLabel}
              <Icon name="chevron-down" size={11} />
            </button>
            <Popover
              open={state.menu === 'rpp'}
              onClose={() => dispatch({ type: 'CLOSE_MENU' })}
              style={{ bottom: 34, right: 0, minWidth: 90 }}
            >
              <div style={{ padding: '4px 2px' }}>
                {RPP_OPTIONS.map(opt => {
                  const val = opt === 'All' ? 999 : opt;
                  const isActive = state.rpp === val;
                  return (
                    <button
                      key={opt}
                      onClick={() => {
                        dispatch({ type: 'SET_RPP', rpp: val });
                        dispatch({ type: 'CLOSE_MENU' });
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '5px 10px',
                        border: 'none',
                        background: isActive ? 'var(--interactive-hover)' : 'transparent',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontSize: 12,
                        cursor: 'pointer',
                        textAlign: 'left',
                        borderRadius: 4,
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </Popover>
          </div>
        </div>

        {/* Page indicator */}
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{pageText}</span>

        {/* Prev / Next */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <PageNavButton
            label="Previous"
            icon="chevron-left"
            iconSide="left"
            disabled={prevDisabled}
            onClick={() => dispatch({ type: 'SET_PAGE', page: currentPage - 1 })}
          />
          <PageNavButton
            label="Next"
            icon="chevron-right"
            iconSide="right"
            disabled={nextDisabled}
            onClick={() => dispatch({ type: 'SET_PAGE', page: currentPage + 1 })}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FindingsTable — main export
// ---------------------------------------------------------------------------

export function FindingsTable() {
  const { state, dispatch } = useStore();
  const { sensitivity } = state.settings;

  // Derivation
  const filtered = FINDINGS.filter(f =>
    rankFilter(f, state.filters, state.search, sensitivity),
  );
  const sorted = sortRows(filtered, state.sortKey, state.sortDir, sensitivity);
  const visCols = state.cols.filter(c => c.vis);

  // Pagination derivation. `rpp >= 999` is the "All" option (single page).
  const rpp = state.rpp;
  const total = filtered.length;
  const totalPages = rpp >= 999 ? (total > 0 ? 1 : 0) : Math.ceil(total / rpp);
  const safePage = Math.min(state.pageIdx, Math.max(0, totalPages - 1));
  const start = rpp >= 999 ? 0 : safePage * rpp;
  const end = rpp >= 999 ? total : start + rpp;
  const page = sorted.slice(start, end);

  // Current validation for a finding
  const curVal = (f: (typeof FINDINGS)[0]) =>
    state.validations[f.id] ?? f.validation;

  // Shared TD style
  const tdStyle: React.CSSProperties = {
    padding: '0 14px',
    height: 42,
    borderBottom: '1px solid var(--border-subtle)',
    fontSize: 13,
    color: 'var(--text-primary)',
    verticalAlign: 'middle',
    whiteSpace: 'nowrap',
  };


  // Sortable column header click
  function handleHeaderClick(colId: string) {
    const k = COL_SORT_MAP[colId];
    if (k) dispatch({ type: 'SET_SORT', key: k });
  }

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <TableToolbar filteredCount={filtered.length} totalCount={FINDINGS.length} />

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 32px',
            gap: 12,
            color: 'var(--text-tertiary)',
          }}
        >
          <Icon name="search" size={28} stroke="var(--text-tertiary)" />
          <span style={{ fontSize: 14 }}>No findings match your filters</span>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              tableLayout: 'auto',
            }}
          >
            {/* thead */}
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                {visCols.map(col => {
                  const sortable = !!COL_SORT_MAP[col.id];
                  const isActive = sortable && state.sortKey === COL_SORT_MAP[col.id];
                  return (
                    <th
                      key={col.id}
                      aria-label={col.id === 'actions' ? 'Row actions' : undefined}
                      onClick={sortable ? () => handleHeaderClick(col.id) : undefined}
                      style={{
                        padding: '0 14px',
                        height: 36,
                        width: COL_WIDTH[col.id],
                        textAlign: CENTERED_COLS.has(col.id) ? 'center' : 'left',
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: isActive
                          ? 'var(--text-primary)'
                          : 'var(--text-secondary)',
                        borderBottom: '1px solid var(--border-primary)',
                        whiteSpace: 'nowrap',
                        cursor: sortable ? 'pointer' : 'default',
                        userSelect: 'none',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {col.id !== 'actions' && col.label}
                        {HEADER_INFO[col.id] && (
                          <InfoTooltip
                            text={HEADER_INFO[col.id].text}
                            label={HEADER_INFO[col.id].label}
                          />
                        )}
                        {isActive && (
                          <Icon
                            name={state.sortDir === 'asc' ? 'chevron-up' : 'chevron-down'}
                            size={11}
                            stroke="var(--action-primary)"
                          />
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* tbody */}
            <tbody>
              {page.map(f => {
                const eff = effPriority(f, sensitivity);
                const currentVal = curVal(f);
                const vs = valStyle(currentVal);
                const isValidating = state.validatingId === f.id;
                const isSelected = state.selectedId === f.id;
                const restBg = isSelected ? 'var(--row-selected-bg)' : 'transparent';

                return (
                  <tr
                    key={f.id}
                    style={{
                      opacity: eff === 'suppressed' ? 0.55 : 1,
                      background: restBg,
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background =
                        'var(--interactive-hover)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = restBg;
                    }}
                  >
                    {visCols.map((col, colIdx) => {
                      const isFirstCol = colIdx === 0;
                      const baseTdStyle: React.CSSProperties = isFirstCol
                        ? {
                            ...tdStyle,
                            borderLeft: `3px solid ${priStyle(effPriority(f, sensitivity)).fg}`,
                            paddingLeft: 9,
                          }
                        : tdStyle;
                      // Chip/badge/icon columns are centered; text columns stay left.
                      const railTdStyle: React.CSSProperties = CENTERED_COLS.has(col.id)
                        ? { ...baseTdStyle, textAlign: 'center' }
                        : baseTdStyle;
                      switch (col.id) {
                        case 'priority':
                          return (
                            <td key={col.id} style={railTdStyle}>
                              <SeverityBadge priority={eff} />
                            </td>
                          );

                        case 'classification': {
                          const cs = categoryStyle(f.category);
                          return (
                            <td key={col.id} style={railTdStyle}>
                              <Chip
                                label={f.classification}
                                fg={cs.fg}
                                bg={cs.bg}
                                dot={false}
                              />
                            </td>
                          );
                        }

                        case 'secretType':
                          return (
                            <td key={col.id} style={railTdStyle}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 8,
                                }}
                              >
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 22,
                                    height: 22,
                                    borderRadius: 6,
                                    background: 'var(--uw-royal-purple-06)',
                                    flexShrink: 0,
                                  }}
                                >
                                  <Icon
                                    name="key"
                                    size={12}
                                    stroke="var(--uw-royal-purple-02)"
                                  />
                                </span>
                                <span
                                  style={{
                                    fontFamily: 'var(--font-mono-family, monospace)',
                                    fontSize: 12,
                                    color: 'var(--text-primary)',
                                  }}
                                >
                                  {f.detectedType}
                                </span>
                              </span>
                            </td>
                          );

                        case 'technology':
                          return (
                            <td key={col.id} style={railTdStyle}>
                              {techOf(f.detectedType)}
                            </td>
                          );

                        case 'file':
                          return (
                            <td key={col.id} style={railTdStyle}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <Icon
                                  name="file"
                                  size={14}
                                  stroke="var(--text-tertiary)"
                                />
                                <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                  <span style={{ fontSize: 12.5 }}>{f.file}</span>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      color: 'var(--text-tertiary)',
                                      fontFamily: 'var(--font-mono-family, monospace)',
                                      maxWidth: 150,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                    title={f.path}
                                  >
                                    {f.path}
                                  </span>
                                </span>
                              </span>
                            </td>
                          );

                        case 'owner':
                          return (
                            <td key={col.id} style={railTdStyle}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                                <Avatar name={f.owner} />
                                {f.owner}
                              </span>
                            </td>
                          );

                        case 'line':
                          return (
                            <td key={col.id} style={railTdStyle}>
                              {f.line}
                            </td>
                          );

                        case 'offset':
                          return (
                            <td key={col.id} style={railTdStyle}>
                              {f.offset}
                            </td>
                          );

                        case 'exposure':
                          return (
                            <td key={col.id} style={railTdStyle}>
                              {f.exposure}
                            </td>
                          );

                        case 'cloud':
                          return (
                            <td key={col.id} style={railTdStyle}>
                              <CloudBadge provider={f.cloud} />
                            </td>
                          );

                        case 'createdAt':
                          return (
                            <td key={col.id} style={railTdStyle}>
                              {f.createdAt}
                            </td>
                          );

                        case 'environment': {
                          const es = envStyle(f.environment);
                          return (
                            <td key={col.id} style={railTdStyle}>
                              <Chip label={f.environment} fg={es.fg} bg={es.bg} />
                            </td>
                          );
                        }

                        case 'risk': {
                          return (
                            <td key={col.id} style={{ ...railTdStyle, textAlign: 'center' }}>
                              <button
                                aria-label="Why this score?"
                                title="Why this score?"
                                onClick={e => {
                                  e.stopPropagation();
                                  dispatch({ type: 'OPEN_RISK', id: f.id });
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  padding: 0,
                                }}
                              >
                                <CircularScore score={f.risk} size={32} stroke={3.5} />
                              </button>
                            </td>
                          );
                        }

                        case 'validation': {
                          return (
                            <td
                              key={col.id}
                              style={railTdStyle}
                              onClick={e => e.stopPropagation()}
                            >
                              <span
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                              >
                                {isValidating ? (
                                  <span
                                    style={{
                                      fontSize: 11,
                                      color: 'var(--text-tertiary)',
                                      fontStyle: 'italic',
                                    }}
                                  >
                                    Checking…
                                  </span>
                                ) : (
                                  <Chip
                                    label={vs.label}
                                    fg={vs.fg}
                                    bg={vs.bg}
                                  />
                                )}
                              </span>
                            </td>
                          );
                        }

                        case 'explanation':
                          return (
                            <td key={col.id} style={railTdStyle}>
                              <span
                                style={{
                                  display: 'block',
                                  fontSize: 12.5,
                                  color: 'var(--text-secondary)',
                                  maxWidth: 280,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={f.explanation}
                              >
                                {f.explanation}
                              </span>
                            </td>
                          );

                        case 'actions':
                          return (
                            <td
                              key={col.id}
                              style={railTdStyle}
                              onClick={e => e.stopPropagation()}
                            >
                              <span style={{ display: 'inline-flex', gap: 4 }}>
                                <button
                                  aria-label="Open finding details"
                                  onClick={e => {
                                    e.stopPropagation();
                                    dispatch({ type: 'OPEN_DETAIL', id: f.id });
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    padding: 4,
                                    borderRadius: 4,
                                  }}
                                  title="View detail"
                                >
                                  <Icon name="eye" size={14} />
                                </button>
                                <button
                                  aria-label="Open finding actions"
                                  onClick={e => {
                                    e.stopPropagation();
                                    dispatch({ type: 'OPEN_ACTIONS', id: f.id });
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    padding: 4,
                                    borderRadius: 4,
                                  }}
                                  title="More actions"
                                >
                                  <Icon name="more-vertical" size={14} />
                                </button>
                              </span>
                            </td>
                          );

                        default:
                          return <td key={col.id} style={railTdStyle} />;
                      }
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination total={total} start={start} end={end} currentPage={safePage} totalPages={totalPages} />
    </div>
  );
}
