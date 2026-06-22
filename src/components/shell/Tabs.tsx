import { useStore } from '../../state/StoreContext';
import type { TabKey } from '../../state/store';

const TAB_LABELS: { key: TabKey; label: string }[] = [
  { key: 'findings', label: 'Exposed Sensitive Data' },
  { key: 'classifications', label: 'Data classifications' },
  { key: 'map', label: 'Exposure map' },
];

export function Tabs() {
  const { state, dispatch } = useStore();

  return (
    <div
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        marginTop: 18,
        padding: '0 32px',
        display: 'flex',
        flexDirection: 'row',
        gap: 0,
      }}
    >
      {TAB_LABELS.map(({ key, label }) => {
        const isActive = state.tab === key;
        return (
          <button
            key={key}
            onClick={() => dispatch({ type: 'SET_TAB', tab: key })}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: isActive
                ? '2px solid var(--action-primary)'
                : '2px solid transparent',
              cursor: 'pointer',
              height: 42,
              padding: '0 16px',
              fontSize: 14,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--uw-primary-01)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-default-family)',
              marginBottom: -1,
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
