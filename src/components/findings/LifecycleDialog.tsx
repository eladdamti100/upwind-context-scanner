// LifecycleDialog.tsx — modal for managing finding lifecycle / triage status.
// Uses only inline styles + CSS vars (no external CSS classes).
// INVARIANT: never logs or displays full secret values — only masked data.

import { useState } from 'react';
import { FINDINGS } from '../../data';
import { useStore } from '../../state/StoreContext';
import { Icon } from '../common/Icon';
import type { FindingStatus } from '../../types';

// Statuses available in the "Set status" button list (snoozed is handled separately)
const STATUS_OPTIONS: { status: FindingStatus; label: string }[] = [
  { status: 'open',           label: 'Open' },
  { status: 'in-review',      label: 'In review' },
  { status: 'accepted-risk',  label: 'Accepted risk' },
  { status: 'resolved',       label: 'Resolved' },
  { status: 'false-positive', label: 'False positive' },
];

const SNOOZE_DAYS = [7, 30, 90] as const;

export function LifecycleDialog() {
  const { state, dispatch } = useStore();

  const f = FINDINGS.find(x => x.id === state.lifecycleId);

  // Local snooze state — always call hooks unconditionally
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozeDays, setSnoozeDays] = useState<7 | 30 | 90>(7);
  const [snoozeReason, setSnoozeReason] = useState('');
  const [applyToSimilar, setApplyToSimilar] = useState(false);

  if (!f) return null;

  const currentStatus: FindingStatus = state.lifecycle[f.id]?.status ?? 'open';

  function handleSetStatus(status: FindingStatus) {
    dispatch({ type: 'SET_LIFECYCLE_STATUS', id: f!.id, status });
    dispatch({ type: 'SHOW_TOAST', message: 'Status updated' });
  }

  function handleSnooze() {
    const until = new Date(Date.now() + snoozeDays * 86400000).toISOString().slice(0, 10);
    dispatch({
      type: 'SNOOZE',
      id: f!.id,
      snooze: { until, reason: snoozeReason, applyToSimilar },
    });
    dispatch({ type: 'SHOW_TOAST', message: 'Finding snoozed until ' + until });
  }

  return (
    // Full-screen backdrop
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Manage finding"
      onClick={() => dispatch({ type: 'CLOSE_LIFECYCLE' })}
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
          width: 420,
          maxWidth: '95vw',
          padding: 20,
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 4,
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
            Manage finding
          </span>
          <button
            aria-label="Close lifecycle dialog"
            onClick={() => dispatch({ type: 'CLOSE_LIFECYCLE' })}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 6,
              border: '1px solid var(--border-subtle)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <Icon name="x" size={13} />
          </button>
        </div>

        {/* Classification subtext */}
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-tertiary)',
            marginBottom: 14,
          }}
        >
          {f.classification}
        </div>

        {/* Current status chip */}
        <div style={{ marginBottom: 14 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              height: 22,
              padding: '0 9px',
              borderRadius: 5,
              background: 'var(--bg-secondary, rgba(255,255,255,0.06))',
              border: '1px solid var(--border-subtle)',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              letterSpacing: '0.02em',
            }}
          >
            {currentStatus}
          </span>
        </div>

        {/* Set status label */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-tertiary)',
            marginBottom: 8,
          }}
        >
          Set status
        </div>

        {/* Status buttons */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            marginBottom: 16,
          }}
        >
          {STATUS_OPTIONS.map(({ status, label }) => (
            <button
              key={status}
              onClick={() => handleSetStatus(status)}
              style={{
                padding: '6px 13px',
                borderRadius: 6,
                border: currentStatus === status
                  ? '1px solid var(--action-primary)'
                  : '1px solid var(--border-subtle)',
                background: currentStatus === status
                  ? 'var(--action-primary)'
                  : 'transparent',
                color: currentStatus === status ? '#fff' : 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Snooze section */}
        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: 14,
            marginBottom: 14,
          }}
        >
          <button
            onClick={() => setSnoozeOpen(prev => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--text-primary)',
              fontSize: 13,
              fontWeight: 500,
              marginBottom: snoozeOpen ? 12 : 0,
            }}
          >
            <Icon name="snooze" size={14} />
            Snooze
            <Icon name={snoozeOpen ? 'chevron-up' : 'chevron-down'} size={13} />
          </button>

          {snoozeOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Duration select */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label
                  style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 60 }}
                >
                  Duration
                </label>
                <select
                  value={snoozeDays}
                  onChange={e => setSnoozeDays(Number(e.target.value) as 7 | 30 | 90)}
                  style={{
                    padding: '5px 8px',
                    borderRadius: 6,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--surface)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {SNOOZE_DAYS.map(d => (
                    <option key={d} value={d}>{d} days</option>
                  ))}
                </select>
              </div>

              {/* Reason input */}
              <input
                type="text"
                value={snoozeReason}
                onChange={e => setSnoozeReason(e.target.value)}
                placeholder="Reason"
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  outline: 'none',
                }}
              />

              {/* Apply to similar checkbox */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={applyToSimilar}
                  onChange={e => setApplyToSimilar(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                Apply to similar findings
              </label>

              {/* Snooze finding button */}
              <button
                onClick={handleSnooze}
                style={{
                  alignSelf: 'flex-start',
                  padding: '7px 16px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'var(--action-primary)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Snooze finding
              </button>
            </div>
          )}
        </div>

        {/* Footer note */}
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-tertiary)',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: 10,
          }}
        >
          Lifecycle is separate from model feedback.
        </div>
      </div>
    </div>
  );
}
