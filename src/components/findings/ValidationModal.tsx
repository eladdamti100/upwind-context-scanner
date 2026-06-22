// ValidationModal.tsx — centered modal confirming credential validation.
// Uses only inline styles + CSS vars (no external CSS classes).
// INVARIANT: never logs or displays full secret values — only masked data.

import { FINDINGS } from '../../data';
import { mockValidate, VALIDATION_DELAY_MS } from '../../lib/validation';
import { useStore } from '../../state/StoreContext';
import { Icon } from '../common/Icon';

export function ValidationModal() {
  const { state, dispatch } = useStore();

  const f = FINDINGS.find(x => x.id === state.valModalId);
  if (!f) return null;

  function runValidation() {
    // f is guaranteed non-null here because the modal only renders when f exists.
    const id = f!.id;
    dispatch({ type: 'START_VALIDATION', id });
    setTimeout(() => {
      const status = mockValidate(f!.detectedType);
      dispatch({ type: 'FINISH_VALIDATION', id, status });
      dispatch({ type: 'SHOW_TOAST', message: 'Validation complete' });
    }, VALIDATION_DELAY_MS);
  }

  return (
    // Full-screen backdrop
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Validate credential"
      onClick={() => dispatch({ type: 'CLOSE_VAL_MODAL' })}
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
      {/* Card */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-lg, 0 10px 30px rgba(0,0,0,0.5))',
          maxWidth: 420,
          width: '100%',
          padding: 20,
        }}
      >
        {/* Title row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <Icon
            name="alert-triangle"
            size={18}
            stroke="var(--severity-medium)"
          />
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            Validate credential
          </span>
        </div>

        {/* Body copy */}
        <p
          style={{
            margin: '0 0 20px',
            fontSize: 13,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}
        >
          This will perform a real check against the provider API. Validation
          runs only inside your environment — the result is stored, but the
          secret itself is never sent or logged. The credential stays masked
          throughout this process.
        </p>

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

          {/* Run validation primary button */}
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
            Run validation
          </button>
        </div>
      </div>
    </div>
  );
}
