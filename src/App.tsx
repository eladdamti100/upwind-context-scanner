import { useEffect } from 'react';
import { StoreProvider, useStore } from './state/StoreContext';
import { TopBar } from './components/shell/TopBar';
import { PageHeader } from './components/shell/PageHeader';
import { Tabs } from './components/shell/Tabs';
import { Toast } from './components/common/Toast';
import { OverviewView } from './components/overview/OverviewView';
import { FindingsView } from './components/findings/FindingsView';
import { DetailDrawer } from './components/findings/DetailDrawer';
import { RowActionsModal } from './components/findings/RowActionsModal';
import { RiskPopover } from './components/findings/RiskPopover';
import { ValidationModal } from './components/findings/ValidationModal';
import { LifecycleDialog } from './components/findings/LifecycleDialog';
import { SettingsModal } from './components/settings/SettingsModal';
import { AddRulesModal } from './components/rules/AddRulesModal';
import { ClassificationsView } from './components/classifications/ClassificationsView';
import { MapView } from './components/map/MapView';

// How long a toast stays on screen before it auto-dismisses.
const TOAST_DURATION_MS = 3000;

function AppShell() {
  const { state, dispatch } = useStore();

  // Auto-dismiss the toast ~3s after it appears. Keyed on toastNonce so that
  // re-triggering with the same message restarts the timer.
  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => dispatch({ type: 'HIDE_TOAST' }), TOAST_DURATION_MS);
    return () => clearTimeout(t);
  }, [state.toastNonce, state.toast, dispatch]);

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
        {state.tab === 'overview' && (
          <OverviewView />
        )}
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
      <RowActionsModal />
      <RiskPopover />
      <ValidationModal />
      <LifecycleDialog />
      <SettingsModal />
      <AddRulesModal />
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
