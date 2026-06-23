// ClassificationsView.tsx — top-level view for the classifications tab.

import { useStore } from '../../state/StoreContext';
import { CLASSIFICATIONS, SUGGESTED_RULES } from '../../data';
import { Icon } from '../common/Icon';
import { ClassTable } from './ClassTable';
import { ClassDrawer } from './ClassDrawer';

export function ClassificationsView() {
  const { state, dispatch } = useStore();

  const activeCount = CLASSIFICATIONS.filter(c => state.classEnabled[c.id] ?? c.enabled).length;
  const suggestedCount = SUGGESTED_RULES.filter(r => (state.suggestedRuleStatus[r.id] ?? r.status) === 'suggested').length;

  return (
    <div data-testid="classifications-view" style={{ padding: '12px 24px 48px' }}>
      {/* Header row: summary + Add rules entry point */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 14,
          gap: 16,
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: 620 }}>
          <b style={{ color: 'var(--text-primary)' }}>{activeCount}</b> classifications are active. SignalLens uses
          context-aware rules to reduce noisy findings and prioritize real exposure.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
          <button
            onClick={() => dispatch({ type: 'OPEN_ADD_RULES' })}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--action-primary-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--action-primary)')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 500,
              padding: '8px 14px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              background: 'var(--action-primary)',
              color: '#fff',
            }}
          >
            <Icon name="plus" size={14} stroke="#fff" />
            Add rules
          </button>
          {suggestedCount > 0 && (
            <button
              onClick={() => dispatch({ type: 'OPEN_ADD_RULES' })}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-link)',
                fontSize: 11.5,
                fontWeight: 600,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {suggestedCount} suggested rules available
            </button>
          )}
        </div>
      </div>

      <ClassTable />
      <ClassDrawer />
    </div>
  );
}
