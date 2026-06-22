// SuggestedRulesPanel.tsx — mocked suggested rules panel for the classifications tab.

import { useStore } from '../../state/StoreContext';
import { Icon } from '../common/Icon';
import { SUGGESTED_RULES } from '../../data/placeholder';
import type { SuggestedRule } from '../../types';

const RULE_TYPE_LABELS: Record<SuggestedRule['ruleType'], string> = {
  'default': 'Default',
  'vertical-specific': 'Vertical',
  'customer-specific': 'Customer',
};

const RULE_TYPE_COLORS: Record<SuggestedRule['ruleType'], { bg: string; color: string }> = {
  'default': { bg: 'rgba(148,163,184,0.13)', color: 'var(--text-tertiary, #94a3b8)' },
  'vertical-specific': { bg: 'rgba(100,130,200,0.13)', color: 'var(--uw-metal-blue-02, #6482c8)' },
  'customer-specific': { bg: 'rgba(120,80,200,0.13)', color: 'var(--uw-royal-purple-02, #7850c8)' },
};

export function SuggestedRulesPanel() {
  const { state, dispatch } = useStore();

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>
          Suggested rules
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>
          Generated from recurring findings — review and apply.
        </div>
      </div>

      {SUGGESTED_RULES.map((r) => {
        const status = state.suggestedRuleStatus[r.id] ?? r.status;
        const chipStyle = RULE_TYPE_COLORS[r.ruleType];

        return (
          <div
            key={r.id}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: 14,
              marginBottom: 10,
            }}
          >
            {/* Top row: title + ruleType chip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>
                {r.title}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '2px 8px',
                  borderRadius: 99,
                  background: chipStyle.bg,
                  color: chipStyle.color,
                  whiteSpace: 'nowrap',
                }}
              >
                {RULE_TYPE_LABELS[r.ruleType]}
              </span>
            </div>

            {/* Description */}
            <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 6 }}>
              {r.description}
            </div>

            {/* Reason line */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 5,
                fontSize: 11,
                color: 'var(--text-tertiary)',
                marginBottom: 6,
              }}
            >
              <span style={{ flexShrink: 0, marginTop: 1 }}>
                <Icon name="info" size={12} />
              </span>
              <span>{r.reason}</span>
            </div>

            {/* Meta line: scope + findings count */}
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
                marginBottom: status === 'suggested' ? 10 : 0,
              }}
            >
              {r.scope}
              {' · '}
              {r.affectedFindingsCount.toLocaleString()} findings affected
            </div>

            {/* Actions or status chip */}
            {status === 'suggested' ? (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    dispatch({ type: 'SET_SUGGESTED_RULE_STATUS', id: r.id, status: 'approved' });
                    dispatch({ type: 'SHOW_TOAST', message: 'Rule approved' });
                  }}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    padding: '5px 14px',
                    borderRadius: 6,
                    border: 'none',
                    cursor: 'pointer',
                    background: 'var(--uw-primary, #5b6fd6)',
                    color: '#fff',
                  }}
                >
                  Approve
                </button>
                <button
                  onClick={() => {
                    dispatch({ type: 'SET_SUGGESTED_RULE_STATUS', id: r.id, status: 'dismissed' });
                    dispatch({ type: 'SHOW_TOAST', message: 'Suggestion dismissed' });
                  }}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    padding: '5px 14px',
                    borderRadius: 6,
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Dismiss
                </button>
              </div>
            ) : (
              <span
                style={{
                  display: 'inline-block',
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '2px 10px',
                  borderRadius: 99,
                  background:
                    status === 'approved'
                      ? 'rgba(34,197,94,0.13)'
                      : 'rgba(148,163,184,0.13)',
                  color:
                    status === 'approved'
                      ? 'var(--uw-green, #22c55e)'
                      : 'var(--text-tertiary, #94a3b8)',
                }}
              >
                {status === 'approved' ? 'Approved' : 'Dismissed'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
