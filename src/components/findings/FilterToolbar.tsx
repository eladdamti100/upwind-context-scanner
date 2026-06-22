import { useStore } from '../../state/StoreContext';
import { Icon } from '../common/Icon';
import { Popover } from '../common/Popover';

interface FilterOption {
  label: string;
  filter: { key: string; val: string; label: string };
}

const FILTER_OPTIONS: FilterOption[] = [
  { label: 'Priority: Critical', filter: { key: 'priority', val: 'critical', label: 'Priority is Critical' } },
  { label: 'Priority: High', filter: { key: 'priority', val: 'high', label: 'Priority is High' } },
  { label: 'Environment: Production', filter: { key: 'env', val: 'Production', label: 'Environment is Production' } },
  { label: 'Cloud: AWS', filter: { key: 'cloud', val: 'AWS', label: 'Cloud is AWS' } },
  { label: 'Validation: Validated active', filter: { key: 'validation', val: 'validated-active', label: 'Validation is Validated active' } },
  { label: 'Exposure: Public', filter: { key: 'exposure', val: 'Public', label: 'Exposure is Public' } },
];

export function FilterToolbar() {
  const { state, dispatch } = useStore();

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        padding: '13px 14px',
        marginBottom: 14,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {/* Filter & search label */}
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          color: 'var(--text-secondary)',
          fontSize: 13,
          fontWeight: 500,
          flexShrink: 0,
        }}
      >
        <Icon name="chevron-down" size={14} />
        Filter &amp; search
      </span>

      {/* Search box */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          width: 230,
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: 2,
        }}
      >
        <Icon name="search" size={13} stroke="var(--text-secondary)" />
        <input
          type="text"
          placeholder="Search findings…"
          value={state.search}
          onChange={(e) => dispatch({ type: 'SET_SEARCH', search: e.target.value })}
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: 13.5,
            width: '100%',
          }}
        />
      </div>

      {/* Active filter chips */}
      {state.filters.map((f, i) => (
        <span
          key={i}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'var(--uw-primary-06)',
            border: '1px solid var(--uw-primary-04)',
            borderRadius: 50,
            padding: '2px 10px',
            fontSize: 12.5,
            color: 'var(--uw-primary-01)',
          }}
        >
          {f.label}
          <button
            onClick={() => dispatch({ type: 'REMOVE_FILTER', index: i })}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              lineHeight: 0,
              color: 'var(--uw-primary-01)',
              marginLeft: 2,
            }}
            aria-label={`Remove filter: ${f.label}`}
          >
            <Icon name="x" size={11} />
          </button>
        </span>
      ))}

      {/* Add filters button + Popover */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => dispatch({ type: 'TOGGLE_MENU', menu: 'addFilter' })}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: '1px dashed var(--border-subtle)',
            borderRadius: 6,
            padding: '3px 10px',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontSize: 12.5,
          }}
        >
          <Icon name="plus" size={12} />
          Add filters
        </button>
        <Popover
          open={state.menu === 'addFilter'}
          onClose={() => dispatch({ type: 'CLOSE_MENU' })}
          style={{ top: '100%', left: 0, minWidth: 220, marginTop: 4 }}
        >
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.filter.key + opt.filter.val}
              onClick={() => {
                dispatch({ type: 'ADD_FILTER', filter: opt.filter });
                dispatch({ type: 'CLOSE_MENU' });
              }}
              style={{
                display: 'block',
                width: '100%',
                background: 'none',
                border: 'none',
                textAlign: 'left',
                padding: '7px 10px',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--text-primary)',
                borderRadius: 4,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--interactive-hover)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'none';
              }}
            >
              {opt.label}
            </button>
          ))}
        </Popover>
      </div>

      {/* Clear link */}
      <button
        onClick={() => dispatch({ type: 'CLEAR_FILTERS' })}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 12.5,
          color: 'var(--text-secondary)',
          padding: 0,
        }}
      >
        Clear
      </button>

      {/* Save view link */}
      <button
        onClick={() => dispatch({ type: 'SHOW_TOAST', message: 'View saved' })}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 12.5,
          color: 'var(--text-secondary)',
          padding: 0,
        }}
      >
        Save view
      </button>
    </div>
  );
}
