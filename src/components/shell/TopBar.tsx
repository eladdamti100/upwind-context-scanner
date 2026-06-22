import { Icon } from '../common/Icon';
import { useStore } from '../../state/StoreContext';

export function TopBar() {
  const { dispatch } = useStore();

  return (
    <div
      style={{
        height: 58,
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        padding: '0 32px',
        gap: 18,
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: 'linear-gradient(135deg,#2C72DD,#553BF1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="shield" size={16} stroke="#ffffff" />
        </div>
        <span
          style={{
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-default-family)',
            whiteSpace: 'nowrap',
          }}
        >
          SignalLens
        </span>
      </div>

      {/* Divider after brand */}
      <div
        style={{
          width: 1,
          height: 24,
          background: 'var(--border-subtle)',
          flexShrink: 0,
        }}
      />

      {/* Global scope selector */}
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-default-family)',
          fontSize: 13,
          padding: '4px 6px',
          borderRadius: 6,
        }}
      >
        <Icon name="globe" size={15} />
        <span>Global scope</span>
        <Icon name="chevron-down" size={14} />
      </button>

      {/* Search box */}
      <div
        style={{
          width: 240,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          border: '1px solid var(--border-subtle)',
          borderRadius: 6,
          padding: '0 10px',
          background: 'var(--surface)',
          color: 'var(--text-secondary)',
          flexShrink: 0,
        }}
      >
        <Icon name="search" size={14} />
        <span
          style={{
            flex: 1,
            fontSize: 13,
            fontFamily: 'var(--font-default-family)',
            color: 'var(--text-tertiary)',
          }}
        >
          Search
        </span>
        <span
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono-family)',
            color: 'var(--text-tertiary)',
            background: 'var(--border-subtle)',
            borderRadius: 4,
            padding: '1px 5px',
          }}
        >
          ⌘K
        </span>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Icons row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 6,
            borderRadius: 6,
          }}
          aria-label="Notifications"
        >
          <Icon name="bell" size={17} />
        </button>
        <button
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 6,
            borderRadius: 6,
          }}
          aria-label="New"
        >
          <Icon name="plus" size={17} />
        </button>
        <button
          title="Settings"
          onClick={() => dispatch({ type: 'OPEN_SETTINGS' })}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 6,
            borderRadius: 6,
          }}
          aria-label="Settings"
        >
          <Icon name="settings" size={17} />
        </button>
      </div>

      {/* Org switcher chip */}
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: '1px solid var(--border-subtle)',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-default-family)',
          fontSize: 13,
          padding: '4px 10px',
          borderRadius: 6,
          whiteSpace: 'nowrap',
        }}
      >
        <span>Acme Cloud</span>
        <Icon name="chevron-down" size={13} />
      </button>

      {/* Avatar */}
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: '#0BC5C5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 600,
          color: '#ffffff',
          flexShrink: 0,
          userSelect: 'none',
        }}
      >
        E
      </div>
    </div>
  );
}
