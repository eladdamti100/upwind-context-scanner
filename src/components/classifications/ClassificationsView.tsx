// ClassificationsView.tsx — top-level view for the classifications tab.

import { useStore } from '../../state/StoreContext';
import { Icon } from '../common/Icon';
import { ClassTable } from './ClassTable';
import { ClassDrawer } from './ClassDrawer';

export function ClassificationsView() {
  const { dispatch } = useStore();

  return (
    <div data-testid="classifications-view" style={{ padding: '18px 32px 60px' }}>
      {/* Header row: title + Add rules entry point */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
          gap: 12,
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Data classifications and detection coverage.
        </div>
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
            flexShrink: 0,
          }}
        >
          <Icon name="plus" size={14} stroke="#fff" />
          Add rules
        </button>
      </div>

      <ClassTable />
      <ClassDrawer />
    </div>
  );
}
