import type { CSSProperties } from 'react';
import { Icon } from '../common/Icon';
import { useStore } from '../../state/StoreContext';

/** Inline SVG: concentric broadcast arcs radiating from a center dot with a short downward stem */
function SignalGlyph() {
  return (
    <svg
      width={17}
      height={17}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ffffff"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Center dot */}
      <circle cx="12" cy="10" r="1.5" fill="#ffffff" stroke="none" />
      {/* Inner arc */}
      <path d="M9 7.5a4.24 4.24 0 0 1 6 0" />
      {/* Outer arc */}
      <path d="M6 4.5a8.49 8.49 0 0 1 12 0" />
      {/* Downward stem */}
      <line x1="12" y1="11.5" x2="12" y2="16" />
    </svg>
  );
}

/** Small circle ring for the org chip */
function OrgRing() {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const iconBtnStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-tertiary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 6,
  borderRadius: 6,
};

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
            borderRadius: 9,
            background: 'linear-gradient(135deg,#2C72DD,#553BF1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <SignalGlyph />
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
        <span>Global Scope</span>
        <Icon name="chevron-down" size={14} />
      </button>

      {/* Search box */}
      <div
        style={{
          width: 260,
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

      {/* Icons row — ~16px gap */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <button style={iconBtnStyle} aria-label="Notifications">
          <Icon name="bell" size={16} />
        </button>
        <button style={iconBtnStyle} aria-label="New">
          <Icon name="plus" size={16} />
        </button>
        <button
          title="Settings"
          onClick={() => dispatch({ type: 'OPEN_SETTINGS' })}
          style={iconBtnStyle}
          aria-label="Settings"
        >
          <Icon name="settings" size={16} />
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
        <OrgRing />
        <span>Acme Cloud</span>
        <Icon name="chevron-down" size={13} />
      </button>

      {/* Avatar */}
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: 'var(--uw-cyan-02)',
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
