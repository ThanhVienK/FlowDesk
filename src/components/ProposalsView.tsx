import { useState, useEffect } from 'react';
import { Plus, Loader2, Search, ExternalLink, RefreshCw } from 'lucide-react';
import type { Proposal, Workspace, BudgetCategory, Vendor } from '../types';
import { apiFetch, formatUsdc, truncateAddress, relativeTime, STATUS_CONFIG } from '../utils';
import { buildTxExplorerUrl } from '@/onchain-facts';
import { ProposalModal } from './ProposalModal';

interface Props {
  workspace: Workspace;
  categories: BudgetCategory[];
  vendors: Vendor[];
  onRefresh: () => void;
}

const CHAIN_ID = 5042002;
type Filter = 'all' | 'pending' | 'approved' | 'executed' | 'rejected';

export function ProposalsView({ workspace, categories, vendors, onRefresh }: Props) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Proposal | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Proposal[]>(`/proposals?workspace_id=${workspace.id}`);
      setProposals(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [workspace.id]); // eslint-disable-line

  const filtered = proposals.filter(p => {
    const matchFilter = filter === 'all' || p.status === filter;
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.recipient.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="display font-semibold text-2xl text-[var(--ink)] mb-1">Proposals</h1>
          <p className="text-sm text-[var(--muted)]">{proposals.length} total · {proposals.filter(p => p.status === 'pending').length} pending</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { void load(); }} className="btn-secondary flex items-center gap-1.5 text-sm" title="Refresh">
            <RefreshCw size={13} />
          </button>
          <button onClick={() => { setSelected(null); setModalOpen(true); }} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> New proposal
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-0 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--subtle)]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search proposals…" className="input-base pl-8 py-2 text-sm" />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'pending', 'approved', 'executed', 'rejected'] as Filter[]).map(f => {
            const sc = STATUS_CONFIG[f];
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={filter === f
                  ? { background: 'var(--accent)', color: '#fff' }
                  : { background: sc.bgVar, color: sc.colorVar, opacity: 0.85 }
                }
              >
                {sc.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-[var(--subtle)]" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-[var(--subtle)] text-sm">{search || filter !== 'all' ? 'No matching proposals.' : 'No proposals yet. Create your first one.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => {
            const sc = STATUS_CONFIG[p.status];
            return (
              <button
                key={p.id}
                onClick={() => { setSelected(p); setModalOpen(true); }}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-5 py-4 flex items-center gap-4 hover:border-[var(--border-strong)] transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-sm text-[var(--ink)] truncate">{p.title}</span>
                    {p.source === 'schedule' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-violet-100 text-violet-700 flex-shrink-0">
                        auto
                      </span>
                    )}
                    {p.category_name && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                        style={{ background: (p.category_color ?? '#122d45') + '22', color: p.category_color ?? '#122d45' }}>
                        {p.category_name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    To: <span className="mono">{truncateAddress(p.recipient)}</span> · {relativeTime(p.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-sm font-semibold tabular-nums text-[var(--ink)]">{formatUsdc(p.amount_usdc)}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: sc.bgVar, color: sc.colorVar }}>{sc.label}</span>
                  {p.tx_hash && (
                    <a href={buildTxExplorerUrl(CHAIN_ID, p.tx_hash)} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-[var(--muted)] hover:text-[var(--accent)] transition-colors">
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <ProposalModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelected(null); }}
        workspaceId={workspace.id}
        categories={categories}
        vendors={vendors}
        proposal={selected}
        onSuccess={() => { void load(); onRefresh(); }}
      />
    </div>
  );
}
