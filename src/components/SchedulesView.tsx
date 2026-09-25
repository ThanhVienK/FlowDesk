import { useState, useEffect, useMemo } from 'react';
import { Plus, Loader2, X, ToggleLeft, ToggleRight, Trash2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfirmDialog } from './ConfirmDialog';
import type { Schedule, Workspace, BudgetCategory, Vendor, FrequencyUnit } from '../types';
import { apiFetch, formatUsdc, truncateAddress, frequencyLabel, nextRunLabel, parseUsdcInput } from '../utils';
import { toast } from 'sonner';

interface Props {
  workspace: Workspace;
  categories: BudgetCategory[];
  vendors: Vendor[];
  onRefresh: () => void;
}

interface ScheduleForm {
  name: string;
  recipient: string;
  amount: string;
  frequencyValue: string;
  frequencyUnit: FrequencyUnit;
  categoryId: string;
  notes: string;
}

const UNIT_OPTIONS: { value: FrequencyUnit; label: string; max: number }[] = [
  { value: 'minute', label: 'Minutes', max: 525600 },
  { value: 'hour',   label: 'Hours',   max: 8760 },
  { value: 'day',    label: 'Days',    max: 3650 },
  { value: 'week',   label: 'Weeks',   max: 520 },
  { value: 'month',  label: 'Months',  max: 120 },
];

const EMPTY_FORM: ScheduleForm = {
  name: '', recipient: '', amount: '',
  frequencyValue: '1', frequencyUnit: 'month',
  categoryId: '', notes: '',
};

/** Calculate next_run_at from now + value + unit */
function calcNextRun(value: number, unit: FrequencyUnit): Date {
  const d = new Date();
  switch (unit) {
    case 'minute': d.setMinutes(d.getMinutes() + value); break;
    case 'hour':   d.setHours(d.getHours() + value); break;
    case 'day':    d.setDate(d.getDate() + value); break;
    case 'week':   d.setDate(d.getDate() + value * 7); break;
    case 'month':  d.setMonth(d.getMonth() + value); break;
  }
  return d;
}

/** Status badge for a schedule row */
function statusBadge(s: Schedule) {
  if (!s.active) return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">PAUSED</span>;
  const due = new Date(s.next_run_at) <= new Date();
  if (due) return <span className="badge-due">DUE</span>;
  return <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">ACTIVE</span>;
}

export function SchedulesView({ workspace, categories, vendors, onRefresh }: Props) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ScheduleForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Schedule[]>(`/schedules?workspace_id=${workspace.id}`);
      setSchedules(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [workspace.id]); // eslint-disable-line

  // Live preview of next run time as user adjusts frequency
  const nextRunPreview = useMemo(() => {
    const v = parseInt(form.frequencyValue, 10);
    if (!v || v <= 0) return null;
    const d = calcNextRun(v, form.frequencyUnit);
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  }, [form.frequencyValue, form.frequencyUnit]);

  // Validation bounds for current unit
  const currentUnitMax = UNIT_OPTIONS.find(u => u.value === form.frequencyUnit)?.max ?? 9999;

  const validateForm = (): string | null => {
    if (!form.name.trim()) return 'Name is required';
    if (!/^0x[0-9a-fA-F]{40}$/.test(form.recipient)) return 'Invalid recipient address (must be 0x…)';
    if (parseUsdcInput(form.amount) <= 0) return 'Amount must be greater than 0';
    const v = parseInt(form.frequencyValue, 10);
    if (!Number.isInteger(v) || v <= 0) return 'Frequency value must be a positive integer';
    if (v > currentUnitMax) return `Max for ${form.frequencyUnit}s is ${currentUnitMax.toLocaleString()}`;
    return null;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateForm();
    if (err) { setFormError(err); return; }
    const v = parseInt(form.frequencyValue, 10);
    const nextRun = calcNextRun(v, form.frequencyUnit);
    setSaving(true); setFormError('');
    try {
      await apiFetch('/schedules', {
        method: 'POST',
        body: JSON.stringify({
          workspace_id: workspace.id,
          name: form.name.trim(),
          recipient: form.recipient,
          amount_usdc: parseUsdcInput(form.amount),
          frequency_value: v,
          frequency_unit: form.frequencyUnit,
          category_id: form.categoryId || undefined,
          notes: form.notes.trim() || undefined,
          next_run_at: nextRun.toISOString(),
        }),
      });
      toast.success('Schedule created');
      setModalOpen(false);
      setForm(EMPTY_FORM);
      void load();
      onRefresh();
    } catch (err) {
      setFormError((err as Error).message ?? 'Failed to create schedule');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const updated = await apiFetch<Schedule>(`/schedules/${id}/toggle`, { method: 'PATCH' });
      setSchedules(prev => prev.map(s => s.id === id ? updated : s));
      toast.success(updated.active ? 'Schedule activated' : 'Schedule paused');
      onRefresh();
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to toggle');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/schedules/${id}`, { method: 'DELETE' });
      setSchedules(prev => prev.filter(s => s.id !== id));
      toast.success('Schedule deleted');
      onRefresh();
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to delete');
    }
  };

  const active = schedules.filter(s => s.active);
  const paused = schedules.filter(s => !s.active);

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="display font-semibold text-2xl text-[var(--ink)] mb-1">Schedules</h1>
          <p className="text-sm text-[var(--muted)]">{active.length} active · {paused.length} paused</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
          <Plus size={15} /> New schedule
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={22} className="animate-spin text-[var(--subtle)]" />
        </div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-[var(--subtle)] text-sm">No schedules yet. Set up recurring payments to contributors or vendors.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {schedules.map(s => {
            const freqText = frequencyLabel(s.frequency, s.frequency_value, s.frequency_unit);
            const nextText = nextRunLabel(s.next_run_at, s.frequency_unit);
            return (
              <div
                key={s.id}
                className={`bg-[var(--surface)] border border-[var(--border)] rounded-2xl px-5 py-4 flex items-center gap-4 ${!s.active ? 'opacity-60' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-sm text-[var(--ink)] truncate">{s.name}</span>
                    {statusBadge(s)}
                    {s.category_name && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                        style={{ background: (s.category_color ?? '#122d45') + '22', color: s.category_color ?? '#122d45' }}
                      >
                        {s.category_name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted)] flex items-center gap-1.5 flex-wrap">
                    <span className="mono">{truncateAddress(s.recipient)}</span>
                    <span className="text-[var(--border)]">·</span>
                    <span>{freqText}</span>
                    <span className="text-[var(--border)]">·</span>
                    <Clock size={10} className="inline-block text-[var(--subtle)]" />
                    <span>Next: {nextText}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-sm font-semibold tabular-nums text-[var(--ink)]">
                    {formatUsdc(s.amount_usdc)}
                  </span>
                  <button
                    onClick={() => { void handleToggle(s.id); }}
                    className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                    title={s.active ? 'Pause schedule' : 'Activate schedule'}
                  >
                    {s.active
                      ? <ToggleRight size={20} className="text-[var(--success)]" />
                      : <ToggleLeft size={20} />}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(s.id)}
                    className="text-[var(--subtle)] hover:text-[var(--danger)] transition-colors"
                    title="Delete schedule"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirm dialog */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete schedule"
        message="This schedule and all its configuration will be permanently deleted. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { const id = deleteTarget!; setDeleteTarget(null); void handleDelete(id); }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Create schedule modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
            style={{ background: 'var(--overlay)' }}
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="bg-[var(--surface-strong)] rounded-2xl border border-[var(--border)] w-full max-w-md my-auto p-6 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="display font-semibold text-[var(--ink)] text-lg">New schedule</h2>
                <button
                  onClick={() => { setModalOpen(false); setForm(EMPTY_FORM); }}
                  className="w-8 h-8 rounded-lg hover:bg-[var(--surface-muted)] flex items-center justify-center text-[var(--muted)] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="label-base">Schedule name *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Monthly dev retainer"
                    className="input-base"
                    maxLength={80}
                  />
                </div>

                {/* Recipient */}
                <div>
                  <label className="label-base">Recipient address *</label>
                  <input
                    value={form.recipient}
                    onChange={e => setForm(p => ({ ...p, recipient: e.target.value }))}
                    placeholder="0x…"
                    className="input-base mono"
                    list="sched-vendors"
                  />
                  <datalist id="sched-vendors">
                    {vendors.map(v => <option key={v.id} value={v.address} label={v.name} />)}
                  </datalist>
                </div>

                {/* Amount */}
                <div>
                  <label className="label-base">Amount (USDC) *</label>
                  <input
                    value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                    placeholder="500.00"
                    className="input-base tabular-nums"
                    type="number"
                    step="0.000001"
                    min="0.000001"
                  />
                </div>

                {/* Frequency — Every [N] [Unit] */}
                <div>
                  <label className="label-base">Frequency *</label>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1.5 flex-1 input-base !px-0 !py-0 overflow-hidden">
                      <span className="pl-3 text-sm text-[var(--muted)] flex-shrink-0">Every</span>
                      <input
                        type="number"
                        min={1}
                        max={currentUnitMax}
                        step={1}
                        value={form.frequencyValue}
                        onChange={e => setForm(p => ({ ...p, frequencyValue: e.target.value }))}
                        className="w-16 text-center bg-transparent text-sm font-semibold text-[var(--ink)] focus:outline-none py-2.5 border-x border-[var(--border)]"
                      />
                    </div>
                    <select
                      value={form.frequencyUnit}
                      onChange={e => setForm(p => ({ ...p, frequencyUnit: e.target.value as FrequencyUnit }))}
                      className="input-base flex-1"
                    >
                      {UNIT_OPTIONS.map(u => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Live next-run preview */}
                  {nextRunPreview && (
                    <p className="mt-1.5 text-xs text-[var(--muted)] flex items-center gap-1">
                      <Clock size={11} />
                      First run: <span className="font-medium text-[var(--ink)]">{nextRunPreview}</span>
                    </p>
                  )}
                </div>

                {/* Category */}
                <div>
                  <label className="label-base">Category</label>
                  <select
                    value={form.categoryId}
                    onChange={e => setForm(p => ({ ...p, categoryId: e.target.value }))}
                    className="input-base"
                  >
                    <option value="">No category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

                {formError && (
                  <p className="text-sm text-[var(--danger)] bg-red-50 rounded-lg px-3 py-2">{formError}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => { setModalOpen(false); setForm(EMPTY_FORM); }}
                    className="flex-1 btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 btn-primary flex items-center justify-center gap-2"
                  >
                    {saving && <Loader2 size={14} className="animate-spin" />}
                    {saving ? 'Saving…' : 'Create schedule'}
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
