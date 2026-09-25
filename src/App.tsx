import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { ConnectKitButton } from 'connectkit';
import { LandingPage } from './components/LandingPage';
import { CreateWorkspaceModal } from './components/CreateWorkspaceModal';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ProposalsView } from './components/ProposalsView';
import { SchedulesView } from './components/SchedulesView';
import { VendorsView } from './components/VendorsView';
import { NotificationsView } from './components/NotificationsView';
import { SettingsView } from './components/SettingsView';
import { ProposalModal } from './components/ProposalModal';
import { ThemeToggle } from './components/ThemeToggle';
import { useWorkspace } from './hooks/useWorkspace';
import { useTheme } from './hooks/useTheme';
import { apiFetch } from './utils';
import type { Vendor, BudgetCategory } from './types';
import { Loader2 } from 'lucide-react';

type View = 'dashboard' | 'proposals' | 'schedules' | 'vendors' | 'notifications' | 'settings';

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { isConnected, address } = useAccount();
  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    summary,
    loading,
    summaryLoading,
    createWorkspace,
    refreshSummary,
  } = useWorkspace();

  const [view, setView] = useState<View>('dashboard');
  const [createWsOpen, setCreateWsOpen] = useState(false);
  const [newProposalOpen, setNewProposalOpen] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);

  // Show create workspace prompt once user connects and has no workspaces
  useEffect(() => {
    if (isConnected && !loading && workspaces.length === 0) {
      setCreateWsOpen(true);
    }
  }, [isConnected, loading, workspaces.length]);

  // Load vendors and categories whenever workspace changes
  const loadShared = useCallback(async () => {
    if (!activeWorkspace) return;
    try {
      const [vs, cs] = await Promise.all([
        apiFetch<Vendor[]>(`/vendors?workspace_id=${activeWorkspace.id}`),
        apiFetch<BudgetCategory[]>(`/categories?workspace_id=${activeWorkspace.id}`),
      ]);
      setVendors(vs);
      setCategories(cs);
    } catch (err) {
      console.error('Failed to load shared data:', err);
    }
  }, [activeWorkspace?.id]); // eslint-disable-line

  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { void loadShared(); }, [loadShared]);

  // Not connected: show landing
  if (!isConnected) return <LandingPage />;

  // Connected, loading workspaces: show spinner
  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--bg-gradient)' }}>
        <Loader2 size={28} className="animate-spin text-[var(--muted)]" />
      </div>
    );
  }

  // Connected, no workspace yet
  if (workspaces.length === 0) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--bg-gradient)' }}>
        <div className="text-center space-y-4">
          <p className="text-[var(--ink)] font-medium">
            Connected as <span className="mono text-sm">{address?.slice(0, 8)}…</span>
          </p>
          <p className="text-sm text-[var(--muted)]">Create your first workspace to get started.</p>
          <button onClick={() => setCreateWsOpen(true)} className="btn-primary">Create workspace</button>
        </div>
        <CreateWorkspaceModal
          open={createWsOpen}
          onClose={() => setCreateWsOpen(false)}
          onCreate={async (name) => { await createWorkspace(name); setCreateWsOpen(false); }}
        />
      </div>
    );
  }

  const unreadCount = summary?.unreadNotifications.length ?? 0;

  // Refresh only data — never reloads the workspace list, never unmounts views.
  // refreshSummary  → reloads dashboard stats (proposals, schedules, budget, tx)
  // loadShared      → reloads vendors + categories in-place
  const refreshData = () => {
    refreshSummary();
    void loadShared();
  };

  return (
    <div className="min-h-dvh flex" style={{ background: 'var(--bg-gradient)' }}>
      {activeWorkspace && (
        <Sidebar
          workspaces={workspaces}
          activeWorkspace={activeWorkspace}
          onSelectWorkspace={(ws) => { setActiveWorkspace(ws); setView('dashboard'); }}
          onNewWorkspace={() => setCreateWsOpen(true)}
          activeView={view}
          onViewChange={(v) => setView(v as View)}
          unreadCount={unreadCount}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 px-6 flex items-center justify-end border-b border-[var(--border)] bg-[var(--surface)] gap-3 flex-shrink-0">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <ConnectKitButton />
        </header>

        <main className="flex-1 flex overflow-hidden">
          {activeWorkspace && (
            <>
              {view === 'dashboard' && (
                <Dashboard
                  workspace={activeWorkspace}
                  summary={summary}
                  loading={summaryLoading}
                  onNewProposal={() => setNewProposalOpen(true)}
                  onViewChange={(v) => setView(v as View)}
                  onRefresh={refreshData}
                />
              )}
              {view === 'proposals' && (
                <ProposalsView
                  workspace={activeWorkspace}
                  categories={categories}
                  vendors={vendors}
                  onRefresh={refreshData}
                />
              )}
              {view === 'schedules' && (
                <SchedulesView
                  workspace={activeWorkspace}
                  categories={categories}
                  vendors={vendors}
                  onRefresh={refreshData}
                />
              )}
              {view === 'vendors' && (
                <VendorsView
                  workspace={activeWorkspace}
                  categories={categories}
                  onRefresh={refreshData}
                />
              )}
              {view === 'notifications' && (
                <NotificationsView
                  workspace={activeWorkspace}
                  onRead={refreshData}
                />
              )}
              {view === 'settings' && (
                <SettingsView
                  workspace={activeWorkspace}
                  categories={categories}
                  onRefresh={refreshData}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Global modals */}
      <CreateWorkspaceModal
        open={createWsOpen}
        onClose={() => setCreateWsOpen(false)}
        onCreate={async (name) => { await createWorkspace(name); setCreateWsOpen(false); }}
      />

      {activeWorkspace && (
        <ProposalModal
          open={newProposalOpen}
          onClose={() => setNewProposalOpen(false)}
          workspaceId={activeWorkspace.id}
          categories={categories}
          vendors={vendors}
          onSuccess={() => { setNewProposalOpen(false); refreshData(); }}
        />
      )}
    </div>
  );
}
