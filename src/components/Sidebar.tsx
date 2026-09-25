import { LayoutDashboard, FileText, Calendar, Users, Bell, Settings, ChevronDown, Plus } from 'lucide-react';
import { FlowDeskWordmark } from './FlowDeskLogo';
import { useState } from 'react';
import type { Workspace } from '../types';

interface Props {
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  onSelectWorkspace: (ws: Workspace) => void;
  onNewWorkspace: () => void;
  activeView: string;
  onViewChange: (v: string) => void;
  unreadCount: number;
}

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'proposals', label: 'Proposals', icon: FileText },
  { key: 'schedules', label: 'Schedules', icon: Calendar },
  { key: 'vendors', label: 'Vendors', icon: Users },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ workspaces, activeWorkspace, onSelectWorkspace, onNewWorkspace, activeView, onViewChange, unreadCount }: Props) {
  const [wsOpen, setWsOpen] = useState(false);

  return (
    <aside className="w-56 flex-shrink-0 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col overflow-hidden">
      {/* Logo */}
      <div className="h-14 px-4 flex items-center border-b border-[var(--border)] flex-shrink-0">
        <FlowDeskWordmark markSize={26} />
      </div>

      {/* Workspace switcher */}
      <div className="px-3 pt-3 pb-1 flex-shrink-0">
        <button
          onClick={() => setWsOpen(p => !p)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-[var(--surface-muted)] text-left transition-colors group"
        >
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
            style={{ background: 'var(--accent)' }}
          >
            {activeWorkspace.name[0].toUpperCase()}
          </div>
          <span className="flex-1 text-sm font-medium text-[var(--ink)] truncate min-w-0">{activeWorkspace.name}</span>
          <ChevronDown size={12} className={`text-[var(--muted)] transition-transform flex-shrink-0 ${wsOpen ? 'rotate-180' : ''}`} />
        </button>

        {wsOpen && (
          <div className="mt-1 space-y-0.5">
            {workspaces.map(ws => (
              <button
                key={ws.id}
                onClick={() => { onSelectWorkspace(ws); setWsOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${ws.id === activeWorkspace.id ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--surface-muted)] text-[var(--ink-2)]'}`}
              >
                {ws.name}
              </button>
            ))}
            <button
              onClick={() => { setWsOpen(false); onNewWorkspace(); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--muted)] hover:bg-[var(--surface-muted)] transition-colors"
            >
              <Plus size={13} /> New workspace
            </button>
          </div>
        )}
      </div>

      <div className="h-px bg-[var(--border)] mx-3 my-1 flex-shrink-0" />

      {/* Nav */}
      <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const active = activeView === key;
          return (
            <button
              key={key}
              onClick={() => onViewChange(key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--ink-2)] hover:bg-[var(--surface-muted)]'
              }`}
            >
              <Icon size={15} className="flex-shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              {key === 'notifications' && unreadCount > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold tabular-nums ${active ? 'bg-white/20 text-white' : 'bg-[var(--danger)] text-white'}`}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom info */}
      <div className="px-4 py-3 border-t border-[var(--border)] flex-shrink-0">
        <p className="text-[10px] text-[var(--subtle)] uppercase tracking-wider font-medium">Arc Testnet</p>
      </div>
    </aside>
  );
}
