// ValidationModal.tsx — confirmation dialog for running a credential check.
// Uses only inline styles + CSS vars (no external CSS classes).
// INVARIANT: never logs or displays full secret values — only masked data.

import type { ReactNode } from 'react';
import { FINDINGS } from '../../data';
import {
  mockValidate,
  VALIDATION_DELAY_MS,
  credentialCheckTarget,
} from '../../lib/validation';
import { valStyle } from '../../lib/classify';
import { useStore } from '../../state/StoreContext';
import { Icon } from '../common/Icon';

// A single label/value row in the context block.
function ContextRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
      <span
        style={{
          flexShrink: 0,
          width: 96,
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--text-tertiary)',
        }}
      >
        {label}
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text-primary)' }}>
        {children}
      </span>
    </div>
  );
}

export function ValidationModal() {
  const { state, dispatch } = useStore();

  const f = FINDINGS.find(x => x.id === state.valModalId);
  if (!f) return null;

  const target = credentialCheckTarget(f.detectedType);
  const vs = valStyle(state.validations[f.id] ?? f.validation);

  function runValidation() {
    // f is guaranteed non-null here because the modal only renders when f exists.
    const id = f!.id;
    dispatch({ type: 'START_VALIDATION', id });
    setTimeout(() => {
      const status = mockValidate(f!.detectedType);
      dispatch({ type: 'FINISH_VALIDATION', id, status });
      dispatch({ type: 'SHOW_TOAST', message: 'Credential check complete' });
    }, VALIDATION_DELAY_MS);
  }

  return (
    // Full-screen backdrop
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Run credential check"
      onClick={() => dispatch({ type: 'CLOSE_VAL_MODAL' })}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 55,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      {/* Card */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-lg, 0 10px 30px rgba(0,0,0,0.5))',
          maxWidth: 460,
          width: '100%',
          padding: 22,
        }}
      >
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
          <Icon name="shield" size={18} stroke="var(--action-primary)" />
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
            Run credential check?
          </span>
        </div>

        {/* Body copy */}
        <p
          style={{
            margin: '0 0 16px',
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.55,
          }}
        >
          SignalLens can check whether this credential is still active using a safe
          verification call to the relevant external provider. The secret is not stored,
          and only the check result is saved.
        </p>

        {/* Context block */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 9,
            background: 'var(--bg-secondary)',
            borderRadius: 8,
            padding: '12px 14px',
            marginBottom: 16,
          }}
        >
          <ContextRow label="Type">{f.classification}</ContextRow>
          <ContextRow label="Checks against">{target}</ContextRow>
          <ContextRow label="File path">
            <span
              style={{
                display: 'block',
                fontFamily: 'var(--font-mono-family, monospace)',
                fontSize: 12,
                overflowX: 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              {f.path}
            </span>
          </ContextRow>
          <ContextRow label="Current status">
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 20,
                padding: '0 8px',
                borderRadius: 5,
                background: vs.bg,
                fontSize: 11,
                fontWeight: 600,
                color: vs.fg,
                lineHeight: 1,
              }}
            >
              {vs.label}
            </span>
          </ContextRow>
        </div>

        {/* Safety notes */}
        <ul
          style={{
            margin: '0 0 20px',
            padding: 0,
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {[
            'The credential is checked only for this request.',
            'The raw secret is not stored.',
            'Only the check result is saved.',
          ].map(note => (
            <li
              key={note}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                color: 'var(--text-secondary)',
              }}
            >
              <Icon name="check" size={13} stroke="var(--severity-safe)" />
              {note}
            </li>
          ))}
        </ul>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {/* Cancel ghost button */}
          <button
            onClick={() => dispatch({ type: 'CLOSE_VAL_MODAL' })}
            style={{
              padding: '7px 16px',
              borderRadius: 6,
              border: '1px solid var(--border-subtle)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Cancel
          </button>

          {/* Run check primary button */}
          <button
            onClick={runValidation}
            style={{
              padding: '7px 16px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--action-primary)',
              color: '#fff',
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Run check
          </button>
        </div>
      </div>
    </div>
  );
}
