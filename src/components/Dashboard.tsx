import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, ArrowUpRight, Clock, Calendar, TrendingUp, RefreshCw, type LucideIcon } from 'lucide-react';
import type { WorkspaceSummary, Workspace } from '../types';
import { formatUsdc, truncateAddress, relativeTime, frequencyLabel, STATUS_CONFIG } from '../utils';
import { buildTxExplorerUrl } from '@/onchain-facts';

const AUTO_REFRESH_MS = 30_000; // 30 seconds

interface Props {
  workspace: Workspace;
  summary: WorkspaceSummary | null;
  loading: boolean;
  onNewProposal: () => void;
  onViewChange: (v: string) => void;
  onRefresh: () => void;
}

const CHAIN_ID = 5042002;

export function Dashboard({ workspace, summary, loading, onNewProposal, onViewChange, onRefresh }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(AUTO_REFRESH_MS / 1000);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const doRefresh = (manual = false) => {
    if (manual) setRefreshing(true);
    onRefresh();
    setLastRefreshed(new Date());
    setCountdown(AUTO_REFRESH_MS / 1000);
    if (manual) setTimeout(() => setRefreshing(false), 600);
  };

  // Auto-refresh every 30s
  useEffect(() => {
    intervalRef.current = setInterval(() => { doRefresh(false); }, AUTO_REFRESH_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []); // eslint-disable-line

  // Countdown ticker (updates every second)
  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? AUTO_REFRESH_MS / 1000 : prev - 1));
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []); // eslint-disable-line

  if (loading || !summary) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-[var(--subtle)]" />
      </div>
    );
  }

  const pending = summary.proposals.filter(p => p.status === 'pending');
  const approved = summary.proposals.filter(p => p.status === 'approved');
  const activeSchedules = summary.schedules.filter(s => s.active);

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="display font-semibold text-2xl text-[var(--ink)] mb-1">{workspace.name}</h1>
          <p className="text-sm text-[var(--muted)]">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Refresh button + countdown */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => doRefresh(true)}
              disabled={refreshing}
              title={`Last refreshed ${relativeTime(lastRefreshed.toISOString())}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--muted)] bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] hover:text-[var(--ink)] transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              <span className="tabular-nums">Refresh</span>
            </button>
            <span className="text-[11px] text-[var(--subtle)] tabular-nums hidden sm:inline">
              {countdown}s
            </span>
          </div>
          <button onClick={onNewProposal} className="btn-primary flex items-center gap-2">
            <Plus size={15} />
            New proposal
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Spent this month" value={formatUsdc(summary.totalSpentThisMonthUsdc)} sub="USDC disbursed" icon={TrendingUp} />
        <StatCard label="Pending approval" value={String(pending.length)} sub={pending.length === 1 ? 'proposal' : 'proposals'} icon={Clock} />
        <StatCard label="Approved, ready" value={String(approved.length)} sub={approved.length === 1 ? 'proposal' : 'proposals'} icon={ArrowUpRight} accentValue />
        <StatCard label="Active schedules" value={String(activeSchedules.length)} sub="recurring payments" icon={Calendar} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent proposals */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--border)]">
            <h2 className="font-semibold text-sm text-[var(--ink)]">Recent proposals</h2>
            <button onClick={() => onViewChange('proposals')} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors">View all</button>
          </div>
          {summary.proposals.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-[var(--subtle)]">No proposals yet. Create one to get started.</div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {summary.proposals.slice(0, 5).map(p => {
                const sc = STATUS_CONFIG[p.status];
                return (
                  <div key={p.id} className="px-5 py-3.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--ink)] truncate">{p.title}</p>
                      <p className="text-xs text-[var(--muted)] mt-0.5">{truncateAddress(p.recipient)} · {relativeTime(p.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      <span className="text-sm font-semibold tabular-nums text-[var(--ink)]">{formatUsdc(p.amount_usdc)}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: sc.bgVar, color: sc.colorVar }}>{sc.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Budget categories */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--border)]">
            <h2 className="font-semibold text-sm text-[var(--ink)]">Budget this month</h2>
            <button onClick={() => onViewChange('settings')} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors">Manage</button>
          </div>
          {summary.categories.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-[var(--subtle)]">No budget categories. Add them in Settings.</div>
          ) : (
            <div className="p-5 space-y-3.5">
              {summary.categories.slice(0, 5).map(cat => {
                const spent = cat.spent_this_month ?? 0;
                const limit = cat.monthly_limit ?? 0;
                const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
                const overBudget = limit > 0 && spent > limit;
                return (
                  <div key={cat.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                        <span className="text-sm font-medium text-[var(--ink)]">{cat.name}</span>
                      </div>
                      <span className="text-xs text-[var(--muted)] tabular-nums">
                        {formatUsdc(spent)}{limit > 0 ? ` / ${formatUsdc(limit)}` : ''}
                      </span>
                    </div>
                    {limit > 0 && (
                      <div className="h-1.5 rounded-full bg-[var(--surface-muted)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: overBudget ? 'var(--danger)' : cat.color }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h2 className="font-semibold text-sm text-[var(--ink)]">Recent transactions</h2>
          </div>
          {summary.recentTransactions.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-[var(--subtle)]">No onchain transactions recorded yet.</div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {summary.recentTransactions.map(tx => (
                <div key={tx.id} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--ink)] truncate">{tx.memo ?? truncateAddress(tx.to_address)}</p>
                    <p className="text-xs text-[var(--muted)] mt-0.5">{relativeTime(tx.indexed_at)}</p>
                  </div>
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <span className="text-sm font-semibold tabular-nums text-[var(--ink)]">{formatUsdc(tx.amount_usdc)}</span>
                    <a
                      href={buildTxExplorerUrl(CHAIN_ID, tx.tx_hash)}
                      target="_blank" rel="noopener noreferrer"
                      className="text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                    >
                      <ArrowUpRight size={13} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming scheduled payments */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--border)]">
            <h2 className="font-semibold text-sm text-[var(--ink)]">Upcoming payments</h2>
            <button onClick={() => onViewChange('schedules')} className="text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors">View all</button>
          </div>
          {activeSchedules.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-[var(--subtle)]">No active schedules. Set up recurring payments.</div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {activeSchedules.slice(0, 5).map(s => (
                <div key={s.id} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--ink)] truncate">{s.name}</p>
                    <p className="text-xs text-[var(--muted)] mt-0.5">{frequencyLabel(s.frequency)} · {truncateAddress(s.recipient)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold tabular-nums text-[var(--ink)]">{formatUsdc(s.amount_usdc)}</p>
                    <p className="text-xs text-[var(--muted)] mt-0.5">
                      {new Date(s.next_run_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  icon: LucideIcon;
  accentValue?: boolean;
}

function StatCard({ label, value, sub, icon: Icon, accentValue }: StatCardProps) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider">{label}</span>
        <div className="w-7 h-7 rounded-lg bg-[var(--surface-muted)] flex items-center justify-center">
          <Icon size={13} className="text-[var(--accent)]" />
        </div>
      </div>
      <p className={`display text-2xl font-semibold tabular-nums ${accentValue ? 'text-[var(--accent)]' : 'text-[var(--ink)]'}`}>{value}</p>
      <p className="text-xs text-[var(--subtle)] mt-1">{sub}</p>
    </div>
  );
}
