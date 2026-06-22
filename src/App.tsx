import { StoreProvider, useStore } from './state/StoreContext';
import { TopBar } from './components/shell/TopBar';
import { PageHeader } from './components/shell/PageHeader';
import { Tabs } from './components/shell/Tabs';
import { Toast } from './components/common/Toast';
import { FindingsView } from './components/findings/FindingsView';
import { DetailDrawer } from './components/findings/DetailDrawer';
import { RiskPopover } from './components/findings/RiskPopover';
import { ValidationModal } from './components/findings/ValidationModal';
import { LifecycleDialog } from './components/findings/LifecycleDialog';
import { SettingsModal } from './components/settings/SettingsModal';
import { ClassificationsView } from './components/classifications/ClassificationsView';
import { MapView } from './components/map/MapView';

function AppShell() {
  const { state } = useStore();

  return (
    <div
      data-testid="app-root"
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

      {/* Tabs row — compact, directly under the TopBar */}
      <div
        style={{
          padding: '12px 20px 0',
          flexShrink: 0,
        }}
      >
        <PageHeader />
        <Tabs />
      </div>

      {/* Active view */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px 20px 40px',
        }}
      >
        {state.tab === 'findings' && (
          <FindingsView />
        )}
        {state.tab === 'classifications' && (
          <ClassificationsView />
        )}
        {state.tab === 'map' && (
          <MapView />
        )}
      </div>

      <DetailDrawer />
      <RiskPopover />
      <ValidationModal />
      <LifecycleDialog />
      <SettingsModal />
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
