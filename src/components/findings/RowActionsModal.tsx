// RowActionsModal.tsx — centered modal listing the actions for a single finding.
// Opened from the three-dot button in the findings table.
// Uses only inline styles + CSS vars (no external CSS classes).
// INVARIANT: never logs or displays full secret values — only masked data.

import React, { useEffect } from 'react';
import { FINDINGS } from '../../data';
import { valStyle } from '../../lib/classify';
import { supportsCredentialCheck } from '../../lib/validation';
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
  accent = 'var(--text-secondary)',
  accentBg = 'var(--bg-secondary)',
}: {
  icon: IconName;
  label: string;
  hint?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Icon color for this action's semantics. */
  accent?: string;
  /** Tinted icon-box background. */
  accentBg?: string;
}) {
  const iconColor = disabled ? 'var(--text-disabled)' : accent;
  const boxBg = disabled ? 'var(--bg-secondary)' : accentBg;
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
        gap: 12,
        width: '100%',
        textAlign: 'left',
        padding: '8px 10px',
        border: 'none',
        borderRadius: 9,
        background: 'transparent',
        color: disabled ? 'var(--text-disabled)' : 'var(--text-primary)',
        fontSize: 13.5,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background 0.12s',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: 8,
          background: boxBg,
          flexShrink: 0,
        }}
      >
        <Icon name={icon} size={15} stroke={iconColor} />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 500, color: disabled ? 'var(--text-disabled)' : 'var(--text-primary)' }}>
          {label}
        </span>
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
  // Availability is determined by the credential TYPE, not its current check
  // status — supported credentials can always be (re-)checked.
  const supportsCheck = supportsCredentialCheck(f.detectedType);
  const canValidate = supportsCheck && state.settings.validationEnabled && !isValidating;

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
        background: 'rgba(15,23,42,0.35)',
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
        {/* Header — defined bar, X lives in the top-left */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 18px',
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <button
            aria-label="Close finding actions"
            onClick={close}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--interactive-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 30,
              borderRadius: 8,
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'background 0.12s',
            }}
          >
            <Icon name="x" size={14} />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
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
            gap: 12,
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
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
                gap: 6,
                height: 22,
                padding: '0 9px',
                borderRadius: 6,
                background: vs.bg,
                fontSize: 11.5,
                fontWeight: 600,
                color: vs.fg,
                lineHeight: 1,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: isValidating ? 'var(--text-tertiary)' : vs.fg,
                  flexShrink: 0,
                }}
              />
              {isValidating ? 'Checking…' : vs.label}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
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
              title={f.path}
              style={{
                fontSize: 12.5,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono-family, monospace)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                padding: '6px 9px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
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
            accent="var(--action-primary)"
            accentBg="var(--uw-blue-06)"
            onClick={() => run(() => dispatch({ type: 'OPEN_DETAIL', id: f.id }))}
          />
          {canValidate ? (
            <ActionRow
              icon="shield"
              label="Run credential check"
              accent="var(--action-primary)"
              accentBg="var(--uw-blue-06)"
              onClick={() => run(() => dispatch({ type: 'OPEN_VAL_MODAL', id: f.id }))}
            />
          ) : (
            <ActionRow
              icon="shield"
              label="Run credential check"
              hint={
                isValidating
                  ? 'Check in progress'
                  : 'Credential check not supported for this type'
              }
              disabled
            />
          )}
          <ActionRow
            icon="clock"
            label="Change lifecycle status"
            accent="var(--uw-royal-purple-02)"
            accentBg="var(--uw-royal-purple-06)"
            onClick={() => run(() => dispatch({ type: 'OPEN_LIFECYCLE', id: f.id }))}
          />
          <ActionRow
            icon="snooze"
            label="Snooze finding"
            accent="var(--severity-medium)"
            accentBg="var(--severity-medium-bg)"
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
            accent="var(--severity-high)"
            accentBg="var(--severity-high-bg)"
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
