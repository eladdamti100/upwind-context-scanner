// ClassificationsView.tsx — top-level view for the classifications tab.

import { ClassTable } from './ClassTable';
import { ClassDrawer } from './ClassDrawer';
import { SuggestedRulesPanel } from '../rules/SuggestedRulesPanel';

export function ClassificationsView() {
  return (
    <div data-testid="classifications-view" style={{ padding: '18px 32px 60px' }}>
      <ClassTable />
      <SuggestedRulesPanel />
      <ClassDrawer />
    </div>
  );
}
