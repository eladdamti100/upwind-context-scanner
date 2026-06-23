import { useStore } from '../../state/StoreContext';
import type { TabKey } from '../../state/store';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';

const TAB_LABELS: { key: TabKey; label: string; icon: IconName }[] = [
  { key: 'overview', label: 'Overview', icon: 'grid' },
  { key: 'findings', label: 'Exposed Sensitive Data', icon: 'shield' },
  { key: 'classifications', label: 'Data classifications', icon: 'layers' },
  { key: 'map', label: 'Exposure map', icon: 'map' },
  { key: 'repository', label: 'Repository', icon: 'database' },
];

export function Tabs() {
  const { state, dispatch } = useStore();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: 6,
        alignItems: 'center',
      }}
    >
      {TAB_LABELS.map(({ key, label, icon }) => {
        const isActive = state.tab === key;
        return (
          <button
            key={key}
            onClick={() => dispatch({ type: 'SET_TAB', tab: key })}
            style={{
              background: isActive ? 'var(--surface-elevated)' : 'transparent',
              border: isActive ? '1px solid var(--border-primary)' : '1px solid transparent',
              boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
              cursor: 'pointer',
              height: 32,
              padding: '0 13px',
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-default-family)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              whiteSpace: 'nowrap',
              letterSpacing: '-0.01em',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--interactive-hover)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }
            }}
          >
            <Icon
              name={icon}
              size={13}
              stroke={isActive ? 'var(--action-primary)' : 'var(--text-tertiary)'}
            />
            {label}
          </button>
        );
      })}
    </div>
  );
}
