import { useState, useEffect } from 'react';
import { Plus, Loader2, X, Trash2, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Vendor, Workspace, BudgetCategory } from '../types';
import { apiFetch, truncateAddress } from '../utils';
import { toast } from 'sonner';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  workspace: Workspace;
  categories: BudgetCategory[];
  onRefresh: () => void;
}

export function VendorsView({ workspace, categories, onRefresh }: Props) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Vendor[]>(`/vendors?workspace_id=${workspace.id}`);
      setVendors(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [workspace.id]); // eslint-disable-line

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) { setError('Invalid Ethereum address'); return; }
    setSaving(true); setError('');
    try {
      await apiFetch('/vendors', {
        method: 'POST',
        body: JSON.stringify({ workspace_id: workspace.id, name: name.trim(), address, category_id: categoryId || undefined, notes: notes.trim() || undefined }),
      });
      toast.success('Vendor added');
      setModalOpen(false);
      setName(''); setAddress(''); setCategoryId(''); setNotes('');
      load();
      onRefresh();
    } catch (err) {
      setError((err as Error).message ?? 'Failed to add vendor');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/vendors/${id}`, { method: 'DELETE' });
      setVendors(prev => prev.filter(v => v.id !== id));
      toast.success('Vendor removed');
      onRefresh();
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to remove');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="display font-semibold text-2xl text-[var(--ink)] mb-1">Vendor allowlist</h1>
          <p className="text-sm text-[var(--muted)]">{vendors.length} approved {vendors.length === 1 ? 'address' : 'addresses'}</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> Add vendor
        </button>
      </div>

      <div className="alert-warning rounded-xl">
        Addresses on this list are offered as autocomplete suggestions when creating proposals and schedules, reducing wrong-address errors.
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-[var(--subtle)]" /></div>
      ) : vendors.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-[var(--subtle)] text-sm">No vendors yet. Add contributors, contractors, and service providers.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {vendors.map(v => (
            <div key={v.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-5 py-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-xl bg-[var(--surface-muted)] flex items-center justify-center flex-shrink-0 font-bold text-sm text-[var(--ink)]">
                {v.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-sm text-[var(--ink)]">{v.name}</span>
                  <CheckCircle size={13} className="text-[var(--success)] flex-shrink-0" />
                  {v.category_name && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                      style={{ background: (v.category_color ?? '#122d45') + '22', color: v.category_color ?? '#122d45' }}>
                      {v.category_name}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--muted)] mono">{truncateAddress(v.address)}</p>
                {v.notes && <p className="text-xs text-[var(--subtle)] mt-0.5">{v.notes}</p>}
              </div>
              <button onClick={() => setDeleteTarget(v.id)} className="text-[var(--subtle)] hover:text-[var(--danger)] transition-colors flex-shrink-0" title="Remove vendor">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Remove vendor"
        message="This vendor will be removed from the allowlist. Existing proposals and schedules using this address will not be affected."
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => { const id = deleteTarget!; setDeleteTarget(null); void handleDelete(id); }}
        onCancel={() => setDeleteTarget(null)}
      />

      <AnimatePresence>
        {modalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'var(--overlay)' }} onClick={() => setModalOpen(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.2 }}
              className="bg-[var(--surface-strong)] rounded-2xl border border-[var(--border)] w-full max-w-sm p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="display font-semibold text-[var(--ink)] text-lg">Add vendor</h2>
                <button onClick={() => setModalOpen(false)} className="w-8 h-8 rounded-lg hover:bg-[var(--surface-muted)] flex items-center justify-center text-[var(--muted)] transition-colors"><X size={16} /></button>
              </div>
              <form onSubmit={(e) => { void handleCreate(e); }} className="space-y-4">
                <div><label className="label-base">Name *</label><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Alice, Acme Dev LLC" className="input-base" maxLength={80} /></div>
                <div><label className="label-base">Wallet address *</label><input value={address} onChange={e => setAddress(e.target.value)} placeholder="0x…" className="input-base mono" /></div>
                <div>
                  <label className="label-base">Category</label>
                  <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="input-base">
                    <option value="">None</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div><label className="label-base">Notes</label><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" className="input-base" maxLength={200} /></div>
                {error && <p className="alert-danger">{error}</p>}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setModalOpen(false)} className="flex-1 btn-secondary">Cancel</button>
                  <button type="submit" disabled={saving} className="flex-1 btn-primary flex items-center justify-center gap-2">
                    {saving && <Loader2 size={14} className="animate-spin" />} Add vendor
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
