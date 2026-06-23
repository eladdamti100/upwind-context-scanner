// SettingsModal.tsx — end-user product settings for the security console.
// Inline styles + CSS vars only; dark Upwind theme; z-index 55 matches overlays.
//
// Scope note: this modal intentionally does NOT expose internal/demo controls
// (customer vertical, rule packs, mocked-validation). Vertical-based
// personalization and validation still exist in the product — they are managed
// automatically / available inside finding actions, not configured here.
// The preferences below are user-facing and kept as local UI state for the MVP
// (the component stays mounted, so choices persist across open/close).

import { useState } from 'react';
import type { Sensitivity } from '../../types';
import { useStore } from '../../state/StoreContext';
import { Icon } from '../common/Icon';

// ---- small helpers -------------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 12,
      }}
    >
      {children}
    </div>
  );
}

function Section({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <div
      style={{
        marginBottom: last ? 0 : 24,
        paddingBottom: last ? 4 : 24,
        borderBottom: last ? 'none' : '1px solid var(--border-subtle)',
      }}
    >
      {children}
    </div>
  );
}

function Helper({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
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
        background: checked ? 'var(--action-primary)' : 'var(--border-primary)',
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

function PrefRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '9px 0',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{label}</div>
        {hint && <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{hint}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 7, padding: 3, gap: 2 }}>
      {options.map(o => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12.5,
              fontWeight: active ? 600 : 400,
              fontFamily: 'var(--font-default-family)',
              background: active ? 'var(--surface)' : 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: active ? 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.3))' : 'none',
              whiteSpace: 'nowrap',
              transition: 'background 0.12s, color 0.12s',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: T[];
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as T)}
      style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 6,
        padding: '6px 10px',
        fontSize: 13,
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-default-family)',
        cursor: 'pointer',
        minWidth: 190,
      }}
    >
      {options.map(o => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0' }}>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
      <span
        style={{
          fontSize: 12,
          color: 'var(--text-tertiary)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          border: '1px solid var(--border-subtle)',
          borderRadius: 999,
          padding: '2px 10px',
        }}
      >
        <Icon name="shield" size={11} stroke="var(--text-tertiary)" />
        {value}
      </span>
    </div>
  );
}

const SENSITIVITY_OPTIONS: { value: Sensitivity; label: string }[] = [
  { value: 'strict', label: 'Strict' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'flexible', label: 'Flexible' },
];

type LandingPage = 'Exposed Sensitive Data' | 'Data Classifications' | 'Exposure Map';
type FindingView = 'Side drawer' | 'Expanded panel';
type SortPref = 'Remediation Priority' | 'Confidence Level' | 'Validation Status';
type Density = 'Comfortable' | 'Compact';

// ---- main export ---------------------------------------------------------

export function SettingsModal() {
  const { state, dispatch } = useStore();

  // User-facing preferences — local UI state (persists while App is mounted).
  const [landing, setLanding] = useState<LandingPage>('Exposed Sensitive Data');
  const [findingView, setFindingView] = useState<FindingView>('Side drawer');
  const [defaultSort, setDefaultSort] = useState<SortPref>('Remediation Priority');
  const [density, setDensity] = useState<Density>('Comfortable');
  const [snippets, setSnippets] = useState(false);
  const [tooltips, setTooltips] = useState(true);
  const [notify, setNotify] = useState({
    critical: true,
    validatedActive: true,
    suggestedRules: true,
    snoozedReopen: false,
  });

  if (!state.settingsOpen) return null;

  const { settings } = state;

  return (
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
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-lg, 0 10px 30px rgba(0,0,0,0.5))',
          width: 560,
          maxWidth: '94vw',
          maxHeight: '88vh',
          overflowY: 'auto',
          padding: 26,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Settings</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>
              Personalize how SignalLens looks and behaves for you.
            </div>
          </div>
          <button
            onClick={() => dispatch({ type: 'CLOSE_SETTINGS' })}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, borderRadius: 4,
            }}
            aria-label="Close settings"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div style={{ height: 16 }} />

        {/* Detection sensitivity */}
        <Section>
          <SectionLabel>Detection sensitivity</SectionLabel>
          <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 7, padding: 3, gap: 2 }}>
            {SENSITIVITY_OPTIONS.map(opt => {
              const active = settings.sensitivity === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => dispatch({ type: 'SET_SENSITIVITY', sensitivity: opt.value })}
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
          <Helper>
            Controls how aggressively SignalLens surfaces lower-confidence findings. Strict shows more
            findings; Flexible reduces noise.
          </Helper>
        </Section>

        {/* User preferences */}
        <Section>
          <SectionLabel>User preferences</SectionLabel>
          <PrefRow label="Default landing page">
            <Select<LandingPage>
              value={landing}
              onChange={setLanding}
              options={['Exposed Sensitive Data', 'Data Classifications', 'Exposure Map']}
            />
          </PrefRow>
          <PrefRow label="Default finding view">
            <Segmented<FindingView>
              value={findingView}
              onChange={setFindingView}
              options={[
                { value: 'Side drawer', label: 'Side drawer' },
                { value: 'Expanded panel', label: 'Expanded panel' },
              ]}
            />
          </PrefRow>
          <PrefRow label="Default sort">
            <Select<SortPref>
              value={defaultSort}
              onChange={setDefaultSort}
              options={['Remediation Priority', 'Confidence Level', 'Validation Status']}
            />
          </PrefRow>
        </Section>

        {/* Display preferences */}
        <Section>
          <SectionLabel>Display preferences</SectionLabel>
          <PrefRow label="Table density">
            <Segmented<Density>
              value={density}
              onChange={setDensity}
              options={[
                { value: 'Comfortable', label: 'Comfortable' },
                { value: 'Compact', label: 'Compact' },
              ]}
            />
          </PrefRow>
          <PrefRow label="Show explanation snippets in table" hint="Adds a short reason next to each finding.">
            <Toggle checked={snippets} onChange={() => setSnippets(v => !v)} />
          </PrefRow>
          <PrefRow label="Show confidence tooltips">
            <Toggle checked={tooltips} onChange={() => setTooltips(v => !v)} />
          </PrefRow>
        </Section>

        {/* Notifications */}
        <Section>
          <SectionLabel>Notifications</SectionLabel>
          <PrefRow label="Notify on critical findings">
            <Toggle checked={notify.critical} onChange={() => setNotify(n => ({ ...n, critical: !n.critical }))} />
          </PrefRow>
          <PrefRow label="Notify on validated active secrets">
            <Toggle checked={notify.validatedActive} onChange={() => setNotify(n => ({ ...n, validatedActive: !n.validatedActive }))} />
          </PrefRow>
          <PrefRow label="Notify when suggested rules are available">
            <Toggle checked={notify.suggestedRules} onChange={() => setNotify(n => ({ ...n, suggestedRules: !n.suggestedRules }))} />
          </PrefRow>
          <PrefRow label="Notify before snoozed findings reopen">
            <Toggle checked={notify.snoozedReopen} onChange={() => setNotify(n => ({ ...n, snoozedReopen: !n.snoozedReopen }))} />
          </PrefRow>
        </Section>

        {/* Workspace context — read-only */}
        <Section last>
          <SectionLabel>Workspace context</SectionLabel>
          <ReadOnlyRow label="Customer profile" value="Auto-detected" />
          <ReadOnlyRow label="Rule profile" value="Managed automatically" />
          <ReadOnlyRow label="Cloud profile" value="Auto-detected" />
          <Helper>SignalLens adapts detection rules to your environment automatically.</Helper>
        </Section>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            paddingTop: 18,
            marginTop: 8,
            borderTop: '1px solid var(--border-subtle)',
          }}
        >
          <button
            onClick={() => {
              dispatch({ type: 'CLOSE_SETTINGS' });
              dispatch({ type: 'SHOW_TOAST', message: 'Settings saved' });
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--action-primary-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--action-primary)')}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--action-primary)',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 500,
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
