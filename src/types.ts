export interface Workspace {
  id: string;
  name: string;
  owner_address: string;
  created_at: string;
}

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'executed';

export interface Proposal {
  id: string;
  workspace_id: string;
  title: string;
  description?: string;
  recipient: string;
  amount_usdc: number;
  category_id?: string;
  category_name?: string;
  category_color?: string;
  proposer_address: string;
  status: ProposalStatus;
  approvals: string[];
  rejection_reason?: string;
  tx_hash?: string;
  /** 'manual' = created by user · 'schedule' = auto-created by cron */
  source: 'manual' | 'schedule';
  schedule_id?: string;
  created_at: string;
  updated_at: string;
}

/** Granular frequency unit — smallest is 'minute' */
export type FrequencyUnit = 'minute' | 'hour' | 'day' | 'week' | 'month';

export interface Schedule {
  id: string;
  workspace_id: string;
  name: string;
  recipient: string;
  amount_usdc: number;
  /** Legacy field — kept for backward compat. New rows use frequency_unit+frequency_value. */
  frequency: string;
  /** Number of units between runs, e.g. 5 (for "every 5 minutes") */
  frequency_value: number;
  /** Time unit, e.g. 'minute' | 'hour' | 'day' | 'week' | 'month' */
  frequency_unit: FrequencyUnit;
  category_id?: string;
  category_name?: string;
  category_color?: string;
  active: boolean;
  next_run_at: string;
  last_run_at?: string;
  notes?: string;
  created_at: string;
}

export interface BudgetCategory {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  monthly_limit?: number;
  spent_this_month?: number;
  created_at: string;
}

export interface Vendor {
  id: string;
  workspace_id: string;
  name: string;
  address: string;
  category_id?: string;
  category_name?: string;
  category_color?: string;
  notes?: string;
  approved: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  workspace_id: string;
  proposal_id?: string;
  schedule_id?: string;
  tx_hash: string;
  chain_id: number;
  from_address: string;
  to_address: string;
  amount_usdc: number;
  category_id?: string;
  category_name?: string;
  category_color?: string;
  memo?: string;
  indexed_at: string;
  created_at: string;
}

export interface Notification {
  id: string;
  workspace_id: string;
  type: string;
  title: string;
  body?: string;
  read: boolean;
  created_at: string;
}

export interface WorkspaceSummary {
  proposals: Proposal[];
  schedules: Schedule[];
  categories: BudgetCategory[];
  recentTransactions: Transaction[];
  totalSpentThisMonthUsdc: number;
  unreadNotifications: Notification[];
}
