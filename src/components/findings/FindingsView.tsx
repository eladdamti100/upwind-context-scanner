import { SummaryCards } from './SummaryCards';
import { FilterToolbar } from './FilterToolbar';
import { FindingsTable } from './FindingsTable';

export function FindingsView() {
  return (
    <div data-testid="findings-view" style={{ padding: '12px 24px 48px' }}>
      <SummaryCards />
      <FilterToolbar />
      <FindingsTable />
    </div>
  );
}
