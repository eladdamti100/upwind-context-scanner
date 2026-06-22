import { StoreProvider, useStore } from './state/StoreContext';
import { TopBar } from './components/shell/TopBar';
import { PageHeader } from './components/shell/PageHeader';
import { Tabs } from './components/shell/Tabs';
import { Toast } from './components/common/Toast';

function AppShell() {
  const { state } = useStore();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        fontFamily: 'var(--font-default-family)',
        background: 'var(--surface)',
        color: 'var(--text-primary)',
      }}
    >
      <TopBar />

      <div
        style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <PageHeader />
        <Tabs />

        {state.tab === 'findings' && (
          <div data-testid="findings-view" style={{ padding: '18px 32px 60px' }}>
            Findings view
          </div>
        )}
        {state.tab === 'classifications' && (
          <div data-testid="classifications-view" style={{ padding: '18px 32px 60px' }}>
            Classifications view
          </div>
        )}
        {state.tab === 'map' && (
          <div data-testid="map-view" style={{ padding: '18px 32px 60px' }}>
            Map view
          </div>
        )}
      </div>

      <Toast message={state.toast} />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppShell />
    </StoreProvider>
  );
}
