import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, X } from 'lucide-react';

// ── Generic confirm dialog ────────────────────────────────────────────────────
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm, onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => confirmRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  const iconEl = variant === 'danger'
    ? <Trash2 size={18} style={{ color: 'var(--danger)' }} />
    : <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />;

  const iconBg = variant === 'danger' ? 'var(--danger-bg)' : 'var(--warning-bg)';

  const confirmStyle = variant === 'danger'
    ? { background: 'var(--danger)', color: '#fff' }
    : variant === 'warning'
      ? { background: 'var(--warning)', color: '#fff' }
      : undefined;

  const confirmCls = variant === 'default'
    ? 'flex-1 btn-primary'
    : 'flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'var(--overlay)' }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="bg-[var(--surface-strong)] rounded-2xl border border-[var(--border)] w-full max-w-sm p-6 shadow-2xl"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: iconBg }}
              >
                {iconEl}
              </div>
              <div>
                <h2 id="confirm-title" className="font-semibold text-[var(--ink)] text-base leading-snug">{title}</h2>
                <p className="text-sm text-[var(--muted)] mt-1 leading-relaxed">{message}</p>
              </div>
            </div>

            <div className="flex gap-2.5 mt-5">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors focus:outline-none"
                style={{ background: 'var(--surface-muted)', color: 'var(--ink)', border: '1px solid var(--border)' }}
              >
                {cancelLabel}
              </button>
              <button
                ref={confirmRef}
                onClick={onConfirm}
                className={confirmCls}
                style={confirmStyle}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Reject with reason dialog ─────────────────────────────────────────────────
interface RejectDialogProps {
  open: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function RejectDialog({ open, onConfirm, onCancel }: RejectDialogProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const reasonRef = useRef('');

  useEffect(() => {
    if (open) {
      reasonRef.current = '';
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'var(--overlay)' }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.93, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="bg-[var(--surface-strong)] rounded-2xl border border-[var(--border)] w-full max-w-sm p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--danger-bg)' }}
                >
                  <X size={15} style={{ color: 'var(--danger)' }} />
                </div>
                <h2 id="reject-title" className="font-semibold text-[var(--ink)] text-base">Reject proposal</h2>
              </div>
              <button
                onClick={onCancel}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: 'var(--muted)' }}
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>

            <div className="mb-4">
              <label className="label-base mb-1.5 block">
                Reason for rejection{' '}
                <span style={{ color: 'var(--subtle)', fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                ref={textareaRef}
                defaultValue=""
                onChange={e => { reasonRef.current = e.target.value; }}
                placeholder="e.g. Amount exceeds budget, wrong recipient address…"
                className="input-base resize-none text-sm"
                rows={3}
                maxLength={300}
              />
              <p className="text-[11px] mt-1" style={{ color: 'var(--subtle)' }}>
                The rejection reason will be visible to the proposer.
              </p>
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                style={{ background: 'var(--surface-muted)', color: 'var(--ink)', border: '1px solid var(--border)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => onConfirm(reasonRef.current.trim())}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors focus:outline-none"
                style={{ background: 'var(--danger)' }}
              >
                Reject proposal
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
