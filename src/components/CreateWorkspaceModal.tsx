import { useState } from 'react';
import { X, Loader2, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}

export function CreateWorkspaceModal({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    if (name.trim().length < 2) { setError('Name must be at least 2 characters'); return; }
    setLoading(true); setError('');
    try {
      await onCreate(name.trim());
      setName('');
    } catch (err) {
      setError((err as Error).message ?? 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  };

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
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="bg-[var(--surface-strong)] rounded-2xl border border-[var(--border)] w-full max-w-sm p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="w-10 h-10 rounded-xl bg-[var(--surface-muted)] flex items-center justify-center mb-0">
                <Building2 size={18} className="text-[var(--accent)]" />
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-[var(--surface-muted)] flex items-center justify-center text-[var(--muted)] transition-colors">
                <X size={16} />
              </button>
            </div>
            <h2 className="display font-semibold text-[var(--ink)] text-xl mt-3 mb-1">New workspace</h2>
            <p className="text-sm text-[var(--muted)] mb-5">A workspace holds your proposals, schedules, vendors, and payment history.</p>

            <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
              <div>
                <label className="label-base">Workspace name</label>
                <input
                  value={name}
                  onChange={e => { setName(e.target.value); setError(''); }}
                  placeholder="e.g. Protocol Foundation, Core Team"
                  className="input-base"
                  maxLength={80}
                  autoFocus
                />
              </div>
              {error && (
                <p className="text-sm text-[var(--danger)] bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={onClose} className="flex-1 btn-secondary">Cancel</button>
                <button type="submit" disabled={loading || !name.trim()} className="flex-1 btn-primary flex items-center justify-center gap-2">
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  {loading ? 'Creating…' : 'Create workspace'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
