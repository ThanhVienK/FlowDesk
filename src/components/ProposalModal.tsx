import { useState, useEffect } from 'react';
import { X, Loader2, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi';
import { erc20Abi } from 'viem';
import { getUsdc, buildTxExplorerUrl } from '@/onchain-facts';
import { parseAmount } from '@/onchain-money';
import { toast } from 'sonner';
import type { BudgetCategory, Vendor, Proposal } from '../types';
import { apiFetch, parseUsdcInput, truncateAddress } from '../utils';
import { RejectDialog } from './ConfirmDialog';

const CHAIN_ID = 5042002;
const usdcFact = getUsdc(CHAIN_ID)!;

interface Props {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  categories: BudgetCategory[];
  vendors: Vendor[];
  proposal?: Proposal | null;   // if set, review/execute mode
  onSuccess: () => void;
}

export function ProposalModal({ open, onClose, workspaceId, categories, vendors, proposal, onSuccess }: Props) {
  const { address, chainId } = useAccount();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const {
    writeContract,
    data: txHash,
    isPending: isWalletPending,
    isError: isWriteError,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Form state (create mode)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Execute tracking
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);

  const isExecuteMode = !!proposal;
  const isWrongChain = chainId !== CHAIN_ID;

  // Reset write state when modal opens
  useEffect(() => {
    if (open) resetWrite();
  }, [open]); // eslint-disable-line

  // After tx confirmed, record execution in DB
  useEffect(() => {
    if (isTxSuccess && txHash && proposal && executingId === proposal.id) {
      apiFetch(`/proposals/${proposal.id}/record-execution`, {
        method: 'PATCH',
        body: JSON.stringify({ tx_hash: txHash }),
      })
        .then(() => {
          toast.success('Payment executed', { description: `Tx: ${txHash.slice(0, 12)}…` });
          setExecutingId(null);
          onSuccess();
          onClose();
        })
        .catch(err => {
          console.error('record-execution failed:', err);
          toast.error('Payment went through but could not record in database');
        });
    }
  }, [isTxSuccess, txHash]); // eslint-disable-line

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) { setFormError('Wallet not connected'); return; }
    const amtMicro = parseUsdcInput(amountInput);
    if (!title.trim()) { setFormError('Title is required'); return; }
    if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) { setFormError('Invalid recipient address (must be 0x…)'); return; }
    if (amtMicro <= 0) { setFormError('Amount must be greater than 0'); return; }

    setSubmitting(true); setFormError('');
    try {
      await apiFetch('/proposals', {
        method: 'POST',
        body: JSON.stringify({
          workspace_id: workspaceId,
          title: title.trim(),
          description: description.trim() || undefined,
          recipient,
          amount_usdc: amtMicro,
          category_id: categoryId || undefined,
          proposer_address: address.toLowerCase(),
        }),
      });
      toast.success('Proposal created');
      onSuccess();
      onClose();
      setTitle(''); setDescription(''); setRecipient(''); setAmountInput(''); setCategoryId('');
    } catch (err) {
      setFormError((err as Error).message ?? 'Failed to create proposal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecute = () => {
    if (!proposal || !address) return;
    if (isWrongChain) {
      switchChain({ chainId: CHAIN_ID });
      return;
    }
    setExecutingId(proposal.id);
    try {
      const parsedAmount = parseAmount(CHAIN_ID, (proposal.amount_usdc / 1_000_000).toFixed(6));
      writeContract({
        address: usdcFact.address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [proposal.recipient as `0x${string}`, parsedAmount.raw],
        chainId: CHAIN_ID,
      });
    } catch (err) {
      setExecutingId(null);
      toast.error((err as Error).message ?? 'Failed to submit transaction');
    }
  };

  const handleApprove = async () => {
    if (!proposal || !address) return;
    try {
      await apiFetch(`/proposals/${proposal.id}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({ approver_address: address.toLowerCase() }),
      });
      toast.success('Proposal approved');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to approve');
    }
  };

  const handleReject = async (reason: string) => {
    if (!proposal || !address) return;
    setRejectDialogOpen(false);
    try {
      await apiFetch(`/proposals/${proposal.id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ approver_address: address.toLowerCase(), reason: reason || undefined }),
      });
      toast.success('Proposal rejected');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error((err as Error).message ?? 'Failed to reject');
    }
  };

  const txBusy = isWalletPending || isConfirming;

  return (
    <>
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          style={{ background: 'var(--overlay)' }}
          onClick={onClose}
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
              <h2 className="display font-semibold text-[var(--ink)] text-lg">
                {isExecuteMode ? 'Review & execute' : 'New proposal'}
              </h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-[var(--surface-muted)] flex items-center justify-center text-[var(--muted)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* EXECUTE / REVIEW MODE */}
            {isExecuteMode && proposal && (
              <div className="space-y-4">
                <div className="bg-[var(--surface-muted)] rounded-xl p-4 space-y-2.5">
                  <Row label="Title" value={proposal.title} />
                  <Row label="Recipient" value={truncateAddress(proposal.recipient)} mono />
                  <Row
                    label="Amount"
                    value={`${(proposal.amount_usdc / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })} USDC`}
                  />
                  {proposal.description && <Row label="Note" value={proposal.description} />}
                  <Row label="Status" value={proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)} />
                </div>

                {proposal.status === 'pending' && (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setRejectDialogOpen(true)}
                      className="btn-secondary !text-[color:var(--danger)] !border-[color:var(--danger-border)] hover:!bg-[color:var(--danger-bg)]"
                    >
                      Reject
                    </button>
                    <button onClick={() => { void handleApprove(); }} className="btn-primary">Approve</button>
                  </div>
                )}

                {proposal.status === 'approved' && (
                  <div className="space-y-3">
                    {isWrongChain && (
                      <p className="alert-warning">
                        Switch to Arc Testnet to execute this payment.
                      </p>
                    )}
                    {isWalletPending && (
                      <p className="text-sm text-[var(--muted)] bg-[var(--surface-muted)] rounded-lg px-3 py-2.5">
                        Waiting for wallet confirmation…
                      </p>
                    )}
                    {isConfirming && (
                      <p className="text-sm text-[var(--muted)] bg-[var(--surface-muted)] rounded-lg px-3 py-2.5">
                        Waiting for block confirmation on Arc Testnet…
                      </p>
                    )}
                    {isTxSuccess && txHash && (
                      <div className="alert-success">
                        Payment confirmed.{' '}
                        <a
                          href={buildTxExplorerUrl(CHAIN_ID, txHash)}
                          target="_blank" rel="noopener noreferrer"
                          className="underline font-medium"
                        >
                          View on explorer
                        </a>
                      </div>
                    )}
                    {isWriteError && !isTxSuccess && (
                      <p className="alert-danger">
                        {writeError?.message?.includes('user rejected')
                          ? 'Transaction cancelled in wallet.'
                          : writeError?.message ?? 'Transaction failed.'}
                      </p>
                    )}

                    <button
                      onClick={isWrongChain
                        ? () => switchChain({ chainId: CHAIN_ID })
                        : handleExecute}
                      disabled={txBusy || isSwitching}
                      className="w-full btn-primary flex items-center justify-center gap-2"
                    >
                      {txBusy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      {isSwitching
                        ? 'Switching network…'
                        : isWrongChain
                          ? 'Switch to Arc Testnet'
                          : isWalletPending
                            ? 'Confirm in wallet…'
                            : isConfirming
                              ? 'Confirming on chain…'
                              : 'Execute USDC transfer'}
                    </button>
                  </div>
                )}

                {proposal.status === 'executed' && proposal.tx_hash && (
                  <div className="alert-success">
                    Executed.{' '}
                    <a
                      href={buildTxExplorerUrl(CHAIN_ID, proposal.tx_hash)}
                      target="_blank" rel="noopener noreferrer"
                      className="underline font-medium"
                    >
                      View on explorer
                    </a>
                  </div>
                )}

                {proposal.status === 'rejected' && (
                  <div className="alert-danger">
                    Rejected{proposal.rejection_reason ? `: ${proposal.rejection_reason}` : '.'}
                  </div>
                )}
              </div>
            )}

            {/* CREATE MODE */}
            {!isExecuteMode && (
              <form onSubmit={(e) => { void handleCreate(e); }} className="space-y-4">
                <div>
                  <label className="label-base">Title *</label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Developer grant Q4, Server invoice"
                    className="input-base"
                    maxLength={120}
                  />
                </div>
                <div>
                  <label className="label-base">Recipient address *</label>
                  <input
                    value={recipient}
                    onChange={e => setRecipient(e.target.value)}
                    placeholder="0x…"
                    className="input-base mono"
                    list="vendor-addresses"
                  />
                  <datalist id="vendor-addresses">
                    {vendors.map(v => <option key={v.id} value={v.address} label={v.name} />)}
                  </datalist>
                </div>
                <div>
                  <label className="label-base">Amount (USDC) *</label>
                  <input
                    value={amountInput}
                    onChange={e => setAmountInput(e.target.value)}
                    placeholder="100.00"
                    className="input-base tabular-nums"
                    type="number"
                    step="0.000001"
                    min="0.000001"
                  />
                </div>
                <div>
                  <label className="label-base">Category</label>
                  <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="input-base">
                    <option value="">No category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-base">Description / note</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Optional context for approvers"
                    className="input-base resize-none"
                    rows={2}
                    maxLength={300}
                  />
                </div>

                {formError && (
                  <p className="alert-danger">{formError}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={onClose} className="flex-1 btn-secondary">Cancel</button>
                  <button type="submit" disabled={submitting} className="flex-1 btn-primary flex items-center justify-center gap-2">
                    {submitting && <Loader2 size={14} className="animate-spin" />}
                    {submitting ? 'Submitting…' : 'Submit proposal'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    <RejectDialog
      open={rejectDialogOpen}
      onConfirm={(reason) => { void handleReject(reason); }}
      onCancel={() => setRejectDialogOpen(false)}
    />
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between text-sm gap-3">
      <span className="text-[var(--muted)] flex-shrink-0">{label}</span>
      <span className={`font-medium text-[var(--ink)] text-right ${mono ? 'mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}
