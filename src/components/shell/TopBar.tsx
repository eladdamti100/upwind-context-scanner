import type { CSSProperties } from 'react';
import { Icon } from '../common/Icon';
import { useStore } from '../../state/StoreContext';

/** Inline SVG: concentric broadcast arcs radiating from a center dot with a short downward stem */
function SignalGlyph() {
  return (
    <svg
      width={15}
      height={15}
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
        height: 52,
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        gap: 16,
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
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
            fontSize: 15,
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

      {/* Right cluster: settings + profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <button
          title="Settings"
          onClick={() => dispatch({ type: 'OPEN_SETTINGS' })}
          style={iconBtnStyle}
          aria-label="Settings"
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--interactive-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <Icon name="settings" size={19} />
        </button>

        {/* Profile chip */}
        <button
          type="button"
          aria-label="Account"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '4px 10px 4px 4px',
            borderRadius: 999,
            border: '1px solid var(--border-subtle)',
            background: 'transparent',
            cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--interactive-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'var(--uw-primary-02)',
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
            AM
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, textAlign: 'left' }}>
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-default-family)',
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}
            >
              Alex Morgan
            </span>
            <span
              style={{
                fontSize: 11.5,
                color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-default-family)',
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}
            >
              Security Engineer
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}
