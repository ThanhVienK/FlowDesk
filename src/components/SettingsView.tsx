import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { apiFetch } from '../utils';
import type { Workspace, BudgetCategory } from '../types';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  workspace: Workspace;
  categories: BudgetCategory[];
  onRefresh: () => void;
}

const PALETTE = ['#122d45', '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function SettingsView({ workspace, categories: initialCats, onRefresh }: Props) {
  const [categories, setCategories] = useState<BudgetCategory[]>(initialCats);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BudgetCategory | null>(null);

  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { setCategories(initialCats); }, [initialCats]);

  const reload = useCallback(async () => {
    try {
      const data = await apiFetch<BudgetCategory[]>(`/categories?workspace_id=${workspace.id}`);
      setCategories(data);
    } catch { toast.error('Failed to reload'); }
  }, [workspace.id]);

  const deleteCat = async (c: BudgetCategory) => {
    setDeleteLoading(c.id);
    try {
      await apiFetch(`/categories/${c.id}`, { method: 'DELETE' });
      toast.success('Category deleted');
      await reload(); onRefresh();
    } catch { toast.error('Failed to delete'); }
    finally { setDeleteLoading(null); }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8">
      <h1 className="display text-2xl font-semibold text-[var(--ink)] tracking-tight mb-6">Settings</h1>

      {/* Workspace info */}
      <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 mb-5">
        <h2 className="text-sm font-semibold text-[var(--ink)] mb-3">Workspace</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Name</span>
            <span className="font-medium text-[var(--ink)]">{workspace.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted)]">Created</span>
            <span className="text-[var(--ink)]">{new Date(workspace.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <div className="flex justify-between items-start">
            <span className="text-[var(--muted)]">Owner</span>
            <span className="font-mono text-xs text-[var(--ink)]">{workspace.owner_address}</span>
          </div>
        </div>
      </section>

      {/* Budget categories */}
      <section className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[var(--ink)]">Budget categories</h2>
          <button onClick={() => setNewCatOpen(true)} className="btn-secondary flex items-center gap-1.5 text-sm py-1.5 px-3">
            <Plus size={13} /> Add category
          </button>
        </div>
        {categories.length === 0 ? (
          <p className="text-sm text-[var(--muted)] py-2">No categories. Add one to track spending by type.</p>
        ) : (
          <div className="space-y-2">
            {categories.map(c => (
              <div key={c.id} className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-0">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.color }} />
                <span className="text-sm font-medium text-[var(--ink)] flex-1">{c.name}</span>
                {c.monthly_limit && (
                  <span className="text-xs text-[var(--muted)] tabular-nums">
                    Limit: ${(c.monthly_limit / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 0 })}/mo
                  </span>
                )}
                <button
                  onClick={() => setDeleteTarget(c)}
                  disabled={deleteLoading === c.id}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--muted)] hover:text-[var(--danger)] hover:bg-red-50 transition-colors"
                >
                  {deleteLoading === c.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete "${deleteTarget?.name ?? ''}"`}
        message="Proposals and schedules using this category will become uncategorised. This action cannot be undone."
        confirmLabel="Delete category"
        variant="danger"
        onConfirm={() => { const c = deleteTarget!; setDeleteTarget(null); void deleteCat(c); }}
        onCancel={() => setDeleteTarget(null)}
      />

      <NewCategoryModal
        open={newCatOpen}
        workspace={workspace}
        onClose={() => setNewCatOpen(false)}
        onSuccess={() => { setNewCatOpen(false); void reload(); onRefresh(); }}
      />
    </div>
  );
}

function NewCategoryModal({ open, workspace, onClose, onSuccess }: { open: boolean; workspace: Workspace; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0]);
  const [limit, setLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name required'); return; }
    const limitMicro = limit ? Math.round(parseFloat(limit) * 1_000_000) : null;
    setSaving(true); setError('');
    try {
      await apiFetch('/categories', {
        method: 'POST',
        body: JSON.stringify({ workspace_id: workspace.id, name: name.trim(), color, monthly_limit: limitMicro }),
      });
      toast.success('Category created');
      setName(''); setColor(PALETTE[0]); setLimit('');
      onSuccess();
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'var(--overlay)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.18 }}
            className="bg-[var(--surface-strong)] rounded-2xl border border-[var(--border)] w-full max-w-sm p-6 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="display font-semibold text-[var(--ink)] text-lg">New category</h2>
              <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[var(--surface-muted)] flex items-center justify-center text-[var(--muted)]"><X size={16} /></button>
            </div>
            <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
              <div>
                <label className="label-base">Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Engineering, Marketing" className="input-base" maxLength={60} />
              </div>
              <div>
                <label className="label-base">Color</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {PALETTE.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-[var(--accent)] scale-110' : ''}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="label-base">Monthly budget limit (optional)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)] text-sm">$</span>
                  <input value={limit} onChange={e => setLimit(e.target.value)} placeholder="0.00" type="number" min="0" step="1" className="input-base pl-7 tabular-nums" />
                </div>
              </div>
              {error && <p className="text-sm text-[var(--danger)] bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="flex-1 btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 btn-primary">
                  {saving ? <><Loader2 size={14} className="animate-spin inline mr-1.5" />Saving...</> : 'Create category'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
