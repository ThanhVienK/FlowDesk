import { ConnectKitButton } from 'connectkit';
import { Zap, ShieldCheck, Calendar, CheckCircle } from 'lucide-react';

export function LandingPage() {
  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg-gradient)' }}>
      {/* Nav */}
      <nav className="h-14 px-6 lg:px-12 flex items-center justify-between border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center">
            <Zap size={14} className="text-white fill-white" />
          </div>
          <span className="display font-semibold text-[var(--ink)] text-base">FlowDesk</span>
        </div>
        <ConnectKitButton label="Connect wallet" />
      </nav>

      {/* Hero */}
      <div className="max-w-2xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface-muted)] border border-[var(--border)] text-xs font-medium text-[var(--muted)] mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
          Live on Arc Testnet
        </div>

        <h1 className="display text-4xl lg:text-5xl font-semibold text-[var(--ink)] tracking-tight text-balance mb-5">
          Treasury spending,<br />without the chaos
        </h1>
        <p className="text-lg text-[var(--muted)] text-pretty max-w-lg mx-auto mb-10">
          Propose, approve, and execute USDC payments with an auditable onchain trail.
          Manage recurring disbursements, vendor allowlists, and budget categories in one workspace.
        </p>

        <ConnectKitButton label="Get started — connect wallet" />

        <p className="text-sm text-[var(--subtle)] mt-4">No account required. Your wallet is your login.</p>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-6 pb-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: CheckCircle, title: 'Approval workflows', body: 'Create proposals, get team approval, execute USDC payments with one click.' },
          { icon: Calendar, title: 'Recurring schedules', body: 'Set up weekly, biweekly, or monthly payment schedules for contributors and vendors.' },
          { icon: ShieldCheck, title: 'Vendor allowlist', body: 'Maintain a list of approved addresses with names and categories to catch wrong-address errors.' },
          { icon: Zap, title: 'Onchain receipts', body: 'Every payment records a verified transaction hash on Arc — the ledger is always rebuildable.' },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
            <div className="w-9 h-9 rounded-xl bg-[var(--surface-muted)] flex items-center justify-center mb-3">
              <Icon size={17} className="text-[var(--accent)]" />
            </div>
            <h3 className="font-semibold text-sm text-[var(--ink)] mb-1.5">{title}</h3>
            <p className="text-sm text-[var(--muted)] text-pretty leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
