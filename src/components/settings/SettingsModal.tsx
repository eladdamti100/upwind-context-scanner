// SettingsModal.tsx — centered modal for scanner settings.
// Uses only inline styles + CSS vars (no external CSS classes).
// Dark Upwind console theme; z-index 55 matches other overlays.

import { VERTICALS, VERTICAL_LABELS } from '../../types';
import type { Sensitivity, Vertical } from '../../types';
import { useStore } from '../../state/StoreContext';
import { Icon } from '../common/Icon';

// ---- small helpers -------------------------------------------------------

const SENSITIVITY_OPTIONS: { value: Sensitivity; label: string }[] = [
  { value: 'strict', label: 'Strict' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'flexible', label: 'Flexible' },
];

const RULE_PACKS: { pack: 'default' | 'vertical' | 'customer'; label: string }[] = [
  { pack: 'default', label: 'Default rules' },
  { pack: 'vertical', label: 'Vertical-specific rules' },
  { pack: 'customer', label: 'Customer-specific rules' },
];

// ---- sub-components (inline, no separate files) --------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function Section({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        marginBottom: 22,
        paddingBottom: 22,
        borderBottom: '1px solid var(--border-subtle)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// A simple pill toggle (checkbox replacement)
function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        border: 'none',
        cursor: 'pointer',
        background: checked ? 'var(--action-primary)' : 'var(--border-subtle)',
        position: 'relative',
        flexShrink: 0,
        transition: 'background 0.15s',
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#ffffff',
          transition: 'left 0.15s',
        }}
      />
    </button>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 0',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

// ---- main export ---------------------------------------------------------

export function SettingsModal() {
  const { state, dispatch } = useStore();

  if (!state.settingsOpen) return null;

  const { settings } = state;

  return (
    // Full-screen backdrop — click closes modal
    <div
      onClick={() => dispatch({ type: 'CLOSE_SETTINGS' })}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 55,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Card — stop click propagation */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-lg, 0 10px 30px rgba(0,0,0,0.5))',
          width: 480,
          maxHeight: '86vh',
          overflowY: 'auto',
          padding: 22,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 22,
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            Settings
          </span>
          <button
            onClick={() => dispatch({ type: 'CLOSE_SETTINGS' })}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              borderRadius: 4,
            }}
            aria-label="Close settings"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Section: Scanner sensitivity */}
        <Section>
          <SectionLabel>Scanner sensitivity</SectionLabel>

          {/* Segmented control */}
          <div
            style={{
              display: 'flex',
              background: 'var(--border-subtle)',
              borderRadius: 8,
              padding: 3,
              gap: 2,
            }}
          >
            {SENSITIVITY_OPTIONS.map(opt => {
              const active = settings.sensitivity === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() =>
                    dispatch({ type: 'SET_SENSITIVITY', sensitivity: opt.value })
                  }
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    fontFamily: 'var(--font-default-family)',
                    background: active ? 'var(--surface)' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    boxShadow: active ? 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.3))' : 'none',
                    transition: 'background 0.12s, color 0.12s',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Helper text */}
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              color: 'var(--text-secondary)',
            }}
          >
            Strict surfaces more findings; Flexible reduces noise.
          </div>
        </Section>

        {/* Section: Customer vertical */}
        <Section>
          <SectionLabel>Customer vertical</SectionLabel>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(VERTICALS as readonly Vertical[]).map(v => {
              const selected = settings.vertical === v;
              return (
                <button
                  key={v}
                  onClick={() => dispatch({ type: 'SET_VERTICAL', vertical: v })}
                  style={{
                    padding: '5px 14px',
                    borderRadius: 20,
                    border: selected
                      ? '1px solid var(--action-primary)'
                      : '1px solid var(--border-subtle)',
                    background: 'transparent',
                    color: selected ? 'var(--uw-primary-01, var(--action-primary))' : 'var(--text-secondary)',
                    fontSize: 13,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-default-family)',
                    fontWeight: selected ? 600 : 400,
                    transition: 'border-color 0.12s, color 0.12s',
                  }}
                >
                  {VERTICAL_LABELS[v]}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Section: Rule packs */}
        <Section>
          <SectionLabel>Rule packs</SectionLabel>

          {RULE_PACKS.map(({ pack, label }) => (
            <ToggleRow
              key={pack}
              label={label}
              checked={settings.rulePacks[pack]}
              onChange={() => dispatch({ type: 'TOGGLE_RULE_PACK', pack })}
            />
          ))}
        </Section>

        {/* Section: Validation */}
        <Section style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 16 }}>
          <SectionLabel>Validation</SectionLabel>

          <ToggleRow
            label="Mocked validation enabled"
            checked={settings.validationEnabled}
            onChange={() =>
              dispatch({
                type: 'SET_VALIDATION_ENABLED',
                value: !settings.validationEnabled,
              })
            }
          />
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Validation is mocked for the demo.
          </div>
        </Section>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            paddingTop: 16,
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <button
            onClick={() => {
              dispatch({ type: 'CLOSE_SETTINGS' });
              dispatch({ type: 'SHOW_TOAST', message: 'Settings saved' });
            }}
            style={{
              padding: '7px 20px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--action-primary)',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-default-family)',
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
