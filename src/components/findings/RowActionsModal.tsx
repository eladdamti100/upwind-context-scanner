// RowActionsModal.tsx — centered modal listing the actions for a single finding.
// Opened from the three-dot button in the findings table.
// Uses only inline styles + CSS vars (no external CSS classes).
// INVARIANT: never logs or displays full secret values — only masked data.

import React, { useEffect } from 'react';
import { FINDINGS } from '../../data';
import { valStyle } from '../../lib/classify';
import { useStore } from '../../state/StoreContext';
import { Icon } from '../common/Icon';
import type { IconName } from '../common/Icon';

// ---------------------------------------------------------------------------
// One action row inside the modal
// ---------------------------------------------------------------------------

function ActionRow({
  icon,
  label,
  hint,
  onClick,
  disabled,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={e => {
        if (!disabled) e.currentTarget.style.background = 'var(--interactive-hover)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        width: '100%',
        textAlign: 'left',
        padding: '10px 12px',
        border: 'none',
        borderRadius: 8,
        background: 'transparent',
        color: disabled ? 'var(--text-disabled)' : 'var(--text-primary)',
        fontSize: 13.5,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: 7,
          background: 'var(--bg-secondary)',
          flexShrink: 0,
        }}
      >
        <Icon
          name={icon}
          size={14}
          stroke={disabled ? 'var(--text-disabled)' : 'var(--text-secondary)'}
        />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 500 }}>{label}</span>
        {hint && (
          <span style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{hint}</span>
        )}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function RowActionsModal() {
  const { state, dispatch } = useStore();

  const f = FINDINGS.find(x => x.id === state.actionsId);

  const close = React.useCallback(() => dispatch({ type: 'CLOSE_ACTIONS' }), [dispatch]);

  // Escape-to-close.
  useEffect(() => {
    if (!f) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [f, close]);

  if (!f) return null;

  const vs = valStyle(state.validations[f.id] ?? f.validation);
  const isValidating = state.validatingId === f.id;
  const canValidate = vs.canValidate && state.settings.validationEnabled && !isValidating;

  function run(action: () => void) {
    action();
    close();
  }

  return (
    // Full-screen backdrop
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Finding actions"
      onClick={close}
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
          borderRadius: 14,
          boxShadow: 'var(--shadow-lg, 0 10px 30px rgba(0,0,0,0.5))',
          maxWidth: 480,
          width: '100%',
          maxHeight: '88vh',
          overflowY: 'auto',
        }}
      >
        {/* Header — X lives in the top-left */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '16px 18px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <button
            aria-label="Close finding actions"
            onClick={close}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 7,
              border: '1px solid var(--border-subtle)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <Icon name="x" size={13} />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              Finding actions
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: 'var(--text-secondary)',
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {f.classification}
            </div>
          </div>
        </div>

        {/* Meta — credential check status + file path */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-tertiary)',
              }}
            >
              Credential check
            </span>
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
              {isValidating ? 'Checking…' : vs.label}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-tertiary)',
              }}
            >
              File path
            </span>
            <span
              style={{
                fontSize: 12.5,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono-family, monospace)',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              {f.path}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '8px 8px 12px' }}>
          <ActionRow
            icon="eye"
            label="Open details"
            onClick={() => run(() => dispatch({ type: 'OPEN_DETAIL', id: f.id }))}
          />
          {canValidate ? (
            <ActionRow
              icon="shield"
              label="Run credential check"
              onClick={() => run(() => dispatch({ type: 'OPEN_VAL_MODAL', id: f.id }))}
            />
          ) : (
            <ActionRow
              icon="shield"
              label="Run credential check"
              hint={isValidating ? 'Check in progress' : 'Not available for this finding'}
              disabled
            />
          )}
          <ActionRow
            icon="clock"
            label="Change lifecycle status"
            onClick={() => run(() => dispatch({ type: 'OPEN_LIFECYCLE', id: f.id }))}
          />
          <ActionRow
            icon="snooze"
            label="Snooze finding"
            onClick={() => run(() => dispatch({ type: 'OPEN_LIFECYCLE', id: f.id }))}
          />
          <ActionRow
            icon="key"
            label="Assign owner"
            onClick={() =>
              run(() =>
                dispatch({ type: 'SHOW_TOAST', message: 'Owner assignment is mocked in this demo' }),
              )
            }
          />
          <ActionRow
            icon="file"
            label="Copy file path"
            onClick={() =>
              run(() => {
                try {
                  navigator.clipboard?.writeText?.(f.path);
                } catch {
                  /* clipboard unavailable */
                }
                dispatch({ type: 'SHOW_TOAST', message: 'File path copied' });
              })
            }
          />
          <ActionRow
            icon="x"
            label="Mark as false positive"
            onClick={() =>
              run(() => {
                dispatch({ type: 'SET_LIFECYCLE_STATUS', id: f.id, status: 'false-positive' });
                dispatch({ type: 'SHOW_TOAST', message: 'Marked as false positive' });
              })
            }
          />
          <ActionRow
            icon="check"
            label="Accept risk"
            onClick={() =>
              run(() => {
                dispatch({ type: 'SET_LIFECYCLE_STATUS', id: f.id, status: 'accepted-risk' });
                dispatch({ type: 'SHOW_TOAST', message: 'Risk accepted' });
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
