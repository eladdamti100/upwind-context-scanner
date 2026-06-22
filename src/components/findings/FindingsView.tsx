import { SummaryCards } from './SummaryCards';
import { FilterToolbar } from './FilterToolbar';

export function FindingsView() {
  return (
    <div data-testid="findings-view" style={{ padding: '18px 32px 60px' }}>
      <SummaryCards />
      <FilterToolbar />
      <div data-testid="findings-table-placeholder" />
    </div>
  );
}
