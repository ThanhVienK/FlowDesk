// Vercel Serverless Function — single entry point for all /api/* routes.
// Vercel bundles this with esbuild (CJS output) and invokes the default export.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import pg from 'pg';

// ─── DB setup (inline — avoids module resolution issues on Vercel) ────────────

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/flowdesk';

function parseSchema(url: string): string {
  const match = url.match(/[?&]schema=([^&]+)/);
  return match?.[1] ?? 'flow_desk';
}

const SCHEMA = parseSchema(DATABASE_URL);

// Strip ?schema= (pg driver rejects it); inject search_path via options param
const cleanUrl = DATABASE_URL
  .replace(/([?&])schema=[^&]*(&|$)/, (_m, prefix: string, suffix: string) =>
    suffix === '&' ? prefix : prefix === '?' ? '' : ''
  )
  .replace(/[?&]$/, '');

const searchPathOption = encodeURIComponent(`-c search_path=${SCHEMA},public`);
const connectionString = cleanUrl.includes('?')
  ? `${cleanUrl}&options=${searchPathOption}`
  : `${cleanUrl}?options=${searchPathOption}`;

const { Pool } = pg;
const pool = new Pool({ connectionString, max: 3 }); // lower max for serverless

async function dbQuery<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
  const { rows } = await pool.query(sql, params);
  return rows as T[];
}

async function dbQueryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null> {
  const rows = await dbQuery<T>(sql, params);
  return rows[0] ?? null;
}

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL CHECK (char_length(name) > 0),
        owner_address TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS workspaces_owner ON workspaces (owner_address);

      CREATE TABLE IF NOT EXISTS budget_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#122d45',
        monthly_limit BIGINT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (workspace_id, name)
      );

      CREATE TABLE IF NOT EXISTS vendors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        category_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL,
        notes TEXT,
        approved BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (workspace_id, address)
      );

      CREATE TABLE IF NOT EXISTS proposals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        recipient TEXT NOT NULL,
        amount_usdc BIGINT NOT NULL CHECK (amount_usdc > 0),
        category_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL,
        proposer_address TEXT NOT NULL DEFAULT 'system',
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','approved','rejected','executed')),
        approvals JSONB NOT NULL DEFAULT '[]',
        rejection_reason TEXT,
        tx_hash TEXT,
        source TEXT NOT NULL DEFAULT 'manual'
          CHECK (source IN ('manual','schedule')),
        schedule_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS proposals_workspace
        ON proposals (workspace_id, status, created_at DESC);
      -- Migration: add source + schedule_id to existing proposals table
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'proposals' AND column_name = 'source'
        ) THEN
          ALTER TABLE proposals ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'proposals' AND column_name = 'schedule_id'
        ) THEN
          ALTER TABLE proposals ADD COLUMN schedule_id UUID;
        END IF;
      END $$;

      CREATE TABLE IF NOT EXISTS schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        recipient TEXT NOT NULL,
        amount_usdc BIGINT NOT NULL CHECK (amount_usdc > 0),
        frequency TEXT NOT NULL DEFAULT 'monthly',
        frequency_value INTEGER NOT NULL DEFAULT 1,
        frequency_unit TEXT NOT NULL DEFAULT 'month'
          CHECK (frequency_unit IN ('minute','hour','day','week','month')),
        category_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL,
        active BOOLEAN NOT NULL DEFAULT true,
        next_run_at TIMESTAMPTZ NOT NULL,
        last_run_at TIMESTAMPTZ,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS schedules_workspace
        ON schedules (workspace_id, active, next_run_at);
      -- Migration: add frequency_value / frequency_unit to existing tables
      -- (ALTER TABLE IF NOT EXISTS column is idempotent via DO block)
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'schedules'
            AND column_name = 'frequency_value'
        ) THEN
          ALTER TABLE schedules ADD COLUMN frequency_value INTEGER NOT NULL DEFAULT 1;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'schedules'
            AND column_name = 'frequency_unit'
        ) THEN
          ALTER TABLE schedules ADD COLUMN frequency_unit TEXT NOT NULL DEFAULT 'month';
        END IF;
        -- Drop old CHECK constraint on frequency if it still restricts values
        -- (safe no-op if constraint does not exist)
        ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_frequency_check;
        -- Back-fill unit/value from legacy frequency strings for existing rows
        UPDATE schedules SET frequency_value = 2, frequency_unit = 'week'
          WHERE frequency = 'biweekly' AND frequency_unit = 'month' AND frequency_value = 1;
        UPDATE schedules SET frequency_value = 1, frequency_unit = 'week'
          WHERE frequency = 'weekly' AND frequency_unit = 'month' AND frequency_value = 1;
      END $$;

      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        proposal_id UUID REFERENCES proposals(id) ON DELETE SET NULL,
        schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
        tx_hash TEXT NOT NULL,
        chain_id INTEGER NOT NULL DEFAULT 5042002,
        from_address TEXT NOT NULL,
        to_address TEXT NOT NULL,
        amount_usdc BIGINT NOT NULL,
        category_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL,
        memo TEXT,
        indexed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (tx_hash, chain_id)
      );
      CREATE INDEX IF NOT EXISTS transactions_workspace
        ON transactions (workspace_id, indexed_at DESC);

      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS notifications_workspace
        ON notifications (workspace_id, read, created_at DESC);
    `);
    console.log(`[db] schema "${SCHEMA}" ready`);
  } finally {
    client.release();
  }
}

// ─── Express app ─────────────────────────────────────────────────────────────

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// Health
app.get('/health', (_req, res) => { res.json({ ok: true }); });

// ── Workspaces ────────────────────────────────────────────────────────────────
app.get('/workspaces', async (req, res) => {
  try {
    const { owner } = req.query;
    if (!owner) return res.status(400).json({ error: 'owner required' });
    const rows = await dbQuery(
      `SELECT * FROM workspaces WHERE owner_address = $1 ORDER BY created_at ASC`,
      [String(owner).toLowerCase()]
    );
    return res.json(rows);
  } catch (e) { console.error(e); return res.status(500).json({ error: 'internal server error' }); }
});

app.post('/workspaces', async (req, res) => {
  try {
    const { name, owner_address } = req.body as { name?: string; owner_address?: string };
    if (!name || !owner_address) return res.status(400).json({ error: 'name and owner_address required' });
    const row = await dbQueryOne(
      `INSERT INTO workspaces (name, owner_address) VALUES ($1, $2) RETURNING *`,
      [name.trim(), String(owner_address).toLowerCase()]
    );
    return res.status(201).json(row);
  } catch (e) { console.error(e); return res.status(500).json({ error: 'internal server error' }); }
});

app.get('/workspaces/:id/summary', async (req, res) => {
  try {
    const { id } = req.params;
    const [proposals, schedules, categories, recentTransactions, unreadNotifications] = await Promise.all([
      dbQuery(`SELECT p.*, bc.name as category_name, bc.color as category_color
               FROM proposals p LEFT JOIN budget_categories bc ON bc.id = p.category_id
               WHERE p.workspace_id = $1 ORDER BY p.created_at DESC LIMIT 50`, [id]),
      dbQuery(`SELECT s.*, bc.name as category_name, bc.color as category_color
               FROM schedules s LEFT JOIN budget_categories bc ON bc.id = s.category_id
               WHERE s.workspace_id = $1 ORDER BY s.next_run_at ASC`, [id]),
      dbQuery(`SELECT bc.*, COALESCE(SUM(t.amount_usdc), 0)::bigint as spent_this_month
               FROM budget_categories bc
               LEFT JOIN transactions t ON t.category_id = bc.id
                 AND t.workspace_id = bc.workspace_id
                 AND date_trunc('month', t.indexed_at) = date_trunc('month', now())
               WHERE bc.workspace_id = $1 GROUP BY bc.id ORDER BY bc.name ASC`, [id]),
      dbQuery(`SELECT t.*, bc.name as category_name, bc.color as category_color
               FROM transactions t LEFT JOIN budget_categories bc ON bc.id = t.category_id
               WHERE t.workspace_id = $1 ORDER BY t.indexed_at DESC LIMIT 10`, [id]),
      dbQuery(`SELECT * FROM notifications WHERE workspace_id = $1 AND read = false
               ORDER BY created_at DESC LIMIT 20`, [id]),
    ]);
    const totalSpent = (proposals as Array<{ amount_usdc: number; status: string }>)
      .filter(p => p.status === 'executed')
      .reduce((s, p) => s + Number(p.amount_usdc), 0);
    return res.json({ proposals, schedules, categories, recentTransactions, totalSpentThisMonthUsdc: totalSpent, unreadNotifications });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'internal server error' }); }
});

// ── Proposals ─────────────────────────────────────────────────────────────────
app.get('/proposals', async (req, res) => {
  try {
    const { workspace_id, status } = req.query;
    if (!workspace_id) return res.status(400).json({ error: 'workspace_id required' });
    const params: unknown[] = [workspace_id];
    const statusFilter = status ? ` AND p.status = $2` : '';
    if (status) params.push(status);
    const rows = await dbQuery(
      `SELECT p.*, bc.name as category_name, bc.color as category_color
       FROM proposals p LEFT JOIN budget_categories bc ON bc.id = p.category_id
       WHERE p.workspace_id = $1${statusFilter} ORDER BY p.created_at DESC LIMIT 100`,
      params
    );
    return res.json(rows);
  } catch (e) { console.error(e); return res.status(500).json({ error: 'internal server error' }); }
});

app.post('/proposals', async (req, res) => {
  try {
    const { workspace_id, title, description, recipient, amount_usdc, category_id, proposer_address } =
      req.body as Record<string, unknown>;
    if (!workspace_id || !title || !recipient || !amount_usdc || !proposer_address)
      return res.status(400).json({ error: 'workspace_id, title, recipient, amount_usdc, proposer_address required' });
    if (!/^0x[0-9a-fA-F]{40}$/.test(String(recipient)))
      return res.status(400).json({ error: 'Invalid recipient address' });
    const row = await dbQueryOne(
      `INSERT INTO proposals (workspace_id,title,description,recipient,amount_usdc,category_id,proposer_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [workspace_id, String(title).trim(), description ?? null, String(recipient).toLowerCase(),
       Number(amount_usdc), category_id ?? null, String(proposer_address).toLowerCase()]
    );
    return res.status(201).json(row);
  } catch (e) { console.error(e); return res.status(500).json({ error: 'internal server error' }); }
});

app.patch('/proposals/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approver_address } = req.body as { approver_address?: string };
    if (!approver_address) return res.status(400).json({ error: 'approver_address required' });
    const row = await dbQueryOne(
      `UPDATE proposals SET status='approved', approvals = approvals || $2::jsonb, updated_at=now()
       WHERE id=$1 AND status='pending' RETURNING *`,
      [id, JSON.stringify([{ address: approver_address.toLowerCase(), at: new Date().toISOString() }])]
    );
    if (!row) return res.status(404).json({ error: 'Proposal not found or not pending' });
    return res.json(row);
  } catch (e) { console.error(e); return res.status(500).json({ error: 'internal server error' }); }
});

app.patch('/proposals/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { approver_address, reason } = req.body as { approver_address?: string; reason?: string };
    if (!approver_address) return res.status(400).json({ error: 'approver_address required' });
    const row = await dbQueryOne(
      `UPDATE proposals SET status='rejected', rejection_reason=$2, updated_at=now()
       WHERE id=$1 AND status IN ('pending','approved') RETURNING *`,
      [id, reason ?? null]
    );
    if (!row) return res.status(404).json({ error: 'Proposal not found' });
    return res.json(row);
  } catch (e) { console.error(e); return res.status(500).json({ error: 'internal server error' }); }
});

app.patch('/proposals/:id/record-execution', async (req, res) => {
  try {
    const { id } = req.params;
    const { tx_hash } = req.body as { tx_hash?: string };
    if (!tx_hash) return res.status(400).json({ error: 'tx_hash required' });
    const row = await dbQueryOne(
      `UPDATE proposals SET status='executed', tx_hash=$2, updated_at=now()
       WHERE id=$1 RETURNING *`,
      [id, tx_hash]
    );
    if (!row) return res.status(404).json({ error: 'Proposal not found' });
    return res.json(row);
  } catch (e) { console.error(e); return res.status(500).json({ error: 'internal server error' }); }
});

// ── Vendors ───────────────────────────────────────────────────────────────────
app.get('/vendors', async (req, res) => {
  try {
    const { workspace_id } = req.query;
    if (!workspace_id) return res.status(400).json({ error: 'workspace_id required' });
    const rows = await dbQuery(
      `SELECT v.*, bc.name as category_name FROM vendors v
       LEFT JOIN budget_categories bc ON bc.id = v.category_id
       WHERE v.workspace_id = $1 ORDER BY v.name ASC`,
      [workspace_id]
    );
    return res.json(rows);
  } catch (e) { console.error(e); return res.status(500).json({ error: 'internal server error' }); }
});

app.post('/vendors', async (req, res) => {
  try {
    const { workspace_id, name, address, category_id, notes } = req.body as Record<string, unknown>;
    if (!workspace_id || !name || !address) return res.status(400).json({ error: 'workspace_id, name, address required' });
    if (!/^0x[0-9a-fA-F]{40}$/.test(String(address)))
      return res.status(400).json({ error: 'Invalid address' });
    const row = await dbQueryOne(
      `INSERT INTO vendors (workspace_id,name,address,category_id,notes)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (workspace_id,address)
       DO UPDATE SET name=$2, category_id=$4, notes=$5 RETURNING *`,
      [workspace_id, String(name).trim(), String(address).toLowerCase(), category_id ?? null, notes ?? null]
    );
    return res.status(201).json(row);
  } catch (e) { console.error(e); return res.status(500).json({ error: 'internal server error' }); }
});

app.delete('/vendors/:id', async (req, res) => {
  try {
    await dbQuery(`DELETE FROM vendors WHERE id=$1`, [req.params.id]);
    return res.status(204).end();
  } catch (e) { console.error(e); return res.status(500).json({ error: 'internal server error' }); }
});

// ── Schedules ─────────────────────────────────────────────────────────────────
type FreqUnit = 'minute' | 'hour' | 'day' | 'week' | 'month';
const FREQ_UNIT_MAX: Record<FreqUnit, number> = {
  minute: 525600, hour: 8760, day: 3650, week: 520, month: 120,
};
function calcNextRun(value: number, unit: FreqUnit): Date {
  const d = new Date();
  if (unit === 'minute') d.setMinutes(d.getMinutes() + value);
  else if (unit === 'hour') d.setHours(d.getHours() + value);
  else if (unit === 'day') d.setDate(d.getDate() + value);
  else if (unit === 'week') d.setDate(d.getDate() + value * 7);
  else d.setMonth(d.getMonth() + value);
  return d;
}
function hydrateLegacySchedule(r: Record<string, unknown>): Record<string, unknown> {
  if (!r.frequency_unit || r.frequency_value == null) {
    const f = String(r.frequency ?? 'monthly');
    const fv = f === 'biweekly' ? 2 : 1;
    const fu: FreqUnit = f === 'weekly' || f === 'biweekly' ? 'week' : 'month';
    return { ...r, frequency_value: fv, frequency_unit: fu };
  }
  return r;
}

app.get('/schedules', async (req, res) => {
  try {
    const { workspace_id } = req.query;
    if (!workspace_id) return res.status(400).json({ error: 'workspace_id required' });
    const rows = await dbQuery(
      `SELECT s.*, bc.name as category_name, bc.color as category_color FROM schedules s
       LEFT JOIN budget_categories bc ON bc.id = s.category_id
       WHERE s.workspace_id = $1 ORDER BY s.active DESC, s.next_run_at ASC`,
      [workspace_id]
    );
    return res.json((rows as Record<string, unknown>[]).map(hydrateLegacySchedule));
  } catch (e) { console.error(e); return res.status(500).json({ error: 'internal server error' }); }
});

app.post('/schedules', async (req, res) => {
  try {
    const {
      workspace_id, name, recipient, amount_usdc,
      frequency_value, frequency_unit,
      category_id, notes, next_run_at,
    } = req.body as Record<string, unknown>;
    if (!workspace_id || !name || !recipient || !amount_usdc || !frequency_value || !frequency_unit)
      return res.status(400).json({ error: 'workspace_id, name, recipient, amount_usdc, frequency_value, frequency_unit required' });
    if (!/^0x[0-9a-fA-F]{40}$/.test(String(recipient)))
      return res.status(400).json({ error: 'Invalid recipient address' });
    const amtNum = Number(amount_usdc);
    if (!amtNum || amtNum <= 0) return res.status(400).json({ error: 'amount_usdc must be positive' });
    const valNum = parseInt(String(frequency_value), 10);
    const unit = String(frequency_unit) as FreqUnit;
    if (!Number.isInteger(valNum) || valNum <= 0)
      return res.status(400).json({ error: 'frequency_value must be a positive integer' });
    if (!FREQ_UNIT_MAX[unit])
      return res.status(400).json({ error: `Invalid frequency_unit: ${unit}` });
    if (valNum > FREQ_UNIT_MAX[unit])
      return res.status(400).json({ error: `frequency_value max for ${unit} is ${FREQ_UNIT_MAX[unit]}` });
    const nextRun = next_run_at ? new Date(String(next_run_at)) : calcNextRun(valNum, unit);
    const legacyFreq = unit === 'week' && valNum === 2 ? 'biweekly'
      : unit === 'week' && valNum === 1 ? 'weekly'
      : unit === 'month' && valNum === 1 ? 'monthly'
      : `every_${valNum}_${unit}`;
    const row = await dbQueryOne(
      `INSERT INTO schedules
         (workspace_id,name,recipient,amount_usdc,frequency,frequency_value,frequency_unit,
          category_id,notes,next_run_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [workspace_id, String(name).trim(), String(recipient).toLowerCase(),
       amtNum, legacyFreq, valNum, unit,
       category_id ?? null, notes ?? null, nextRun.toISOString()]
    );
    return res.status(201).json(hydrateLegacySchedule(row as Record<string, unknown>));
  } catch (e) { console.error(e); return res.status(500).json({ error: 'internal server error' }); }
});

app.patch('/schedules/:id/toggle', async (req, res) => {
  try {
    const row = await dbQueryOne(
      `UPDATE schedules SET active = NOT active WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'Schedule not found' });
    return res.json(hydrateLegacySchedule(row as Record<string, unknown>));
  } catch (e) { console.error(e); return res.status(500).json({ error: 'internal server error' }); }
});

app.delete('/schedules/:id', async (req, res) => {
  try {
    await dbQuery(`DELETE FROM schedules WHERE id=$1`, [req.params.id]);
    return res.status(204).end();
  } catch (e) { console.error(e); return res.status(500).json({ error: 'internal server error' }); }
});

// ── Categories ────────────────────────────────────────────────────────────────
app.get('/categories', async (req, res) => {
  try {
    const { workspace_id } = req.query;
    if (!workspace_id) return res.status(400).json({ error: 'workspace_id required' });
    const rows = await dbQuery(
      `SELECT bc.*, COALESCE(SUM(t.amount_usdc),0)::bigint as spent_this_month
       FROM budget_categories bc
       LEFT JOIN transactions t ON t.category_id=bc.id AND t.workspace_id=bc.workspace_id
         AND date_trunc('month',t.indexed_at) = date_trunc('month',now())
       WHERE bc.workspace_id=$1 GROUP BY bc.id ORDER BY bc.name ASC`,
      [workspace_id]
    );
    return res.json(rows);
  } catch (e) { console.error(e); return res.status(500).json({ error: 'internal server error' }); }
});

app.post('/categories', async (req, res) => {
  try {
    const { workspace_id, name, color, monthly_limit } = req.body as Record<string, unknown>;
    if (!workspace_id || !name) return res.status(400).json({ error: 'workspace_id and name required' });
    const row = await dbQueryOne(
      `INSERT INTO budget_categories (workspace_id,name,color,monthly_limit)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [workspace_id, String(name).trim(), color ?? '#122d45', monthly_limit ?? null]
    );
    return res.status(201).json(row);
  } catch (e) { console.error(e); return res.status(500).json({ error: 'internal server error' }); }
});

app.delete('/categories/:id', async (req, res) => {
  try {
    await dbQuery(`DELETE FROM budget_categories WHERE id=$1`, [req.params.id]);
    return res.status(204).end();
  } catch (e) { console.error(e); return res.status(500).json({ error: 'internal server error' }); }
});

// ── Transactions ──────────────────────────────────────────────────────────────
app.get('/transactions', async (req, res) => {
  try {
    const { workspace_id, limit = '20', offset = '0' } = req.query;
    if (!workspace_id) return res.status(400).json({ error: 'workspace_id required' });
    const rows = await dbQuery(
      `SELECT t.*, bc.name as category_name FROM transactions t
       LEFT JOIN budget_categories bc ON bc.id=t.category_id
       WHERE t.workspace_id=$1 ORDER BY t.indexed_at DESC
       LIMIT $2 OFFSET $3`,
      [workspace_id, Number(limit), Number(offset)]
    );
    return res.json(rows);
  } catch (e) { console.error(e); return res.status(500).json({ error: 'internal server error' }); }
});

// ── Notifications ─────────────────────────────────────────────────────────────
app.get('/notifications', async (req, res) => {
  try {
    const { workspace_id } = req.query;
    if (!workspace_id) return res.status(400).json({ error: 'workspace_id required' });
    const rows = await dbQuery(
      `SELECT * FROM notifications WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [workspace_id]
    );
    return res.json(rows);
  } catch (e) { console.error(e); return res.status(500).json({ error: 'internal server error' }); }
});

// mark-all-read MUST be before /:id/read — otherwise Express matches 'mark-all-read' as :id
app.patch('/notifications/mark-all-read', async (req, res) => {
  try {
    const { workspace_id } = req.body as { workspace_id?: string };
    if (!workspace_id) return res.status(400).json({ error: 'workspace_id required' });
    await dbQuery(`UPDATE notifications SET read=true WHERE workspace_id=$1`, [workspace_id]);
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'internal server error' }); }
});

// kept as alias for backward compat
app.patch('/notifications/read-all', async (req, res) => {
  try {
    const { workspace_id } = req.body as { workspace_id?: string };
    if (!workspace_id) return res.status(400).json({ error: 'workspace_id required' });
    await dbQuery(`UPDATE notifications SET read=true WHERE workspace_id=$1`, [workspace_id]);
    return res.json({ ok: true });
  } catch (e) { console.error(e); return res.status(500).json({ error: 'internal server error' }); }
});

app.patch('/notifications/:id/read', async (req, res) => {
  try {
    const row = await dbQueryOne(
      `UPDATE notifications SET read=true WHERE id=$1 RETURNING *`, [req.params.id]
    );
    return res.json(row);
  } catch (e) { console.error(e); return res.status(500).json({ error: 'internal server error' }); }
});

// ─── Vercel handler ───────────────────────────────────────────────────────────

let dbReady: Promise<void> | null = null;

// ── Cron: process due schedules ──────────────────────────────────────────────
// Called every minute by Vercel Cron (vercel.json → crons[]).
// Also callable manually: POST /api/cron/schedules (requires CRON_SECRET header).
app.post('/cron/schedules', async (req, res) => {
  // Auth: Vercel passes Authorization: Bearer <CRON_SECRET> on cron invocations.
  // Manual callers must send the same header.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.authorization ?? '';
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const client = await pool.connect();
  try {
    // Find all DUE active schedules
    const { rows: dueSchedules } = await client.query<{
      id: string; workspace_id: string; name: string; recipient: string;
      amount_usdc: number; frequency_value: number; frequency_unit: string;
      category_id: string | null;
    }>(
      `SELECT id, workspace_id, name, recipient, amount_usdc,
              frequency_value, frequency_unit, category_id
       FROM schedules
       WHERE active = true AND next_run_at <= NOW()`
    );

    if (dueSchedules.length === 0) {
      return res.json({ processed: 0, skipped: 0 });
    }

    let processed = 0;
    let skipped = 0;

    for (const schedule of dueSchedules) {
      // Deduplication guard: skip if a pending/approved proposal from this
      // schedule already exists (prevents double-firing if cron overlaps)
      const { rows: existing } = await client.query(
        `SELECT id FROM proposals
         WHERE schedule_id = $1
           AND status IN ('pending','approved')
         LIMIT 1`,
        [schedule.id]
      );
      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Atomic transaction: create proposal + notification + update schedule
      await client.query('BEGIN');
      try {
        const title = `${schedule.name} — auto`;

        // 1. Create proposal
        const { rows: [proposal] } = await client.query(
          `INSERT INTO proposals
             (workspace_id, title, recipient, amount_usdc, category_id,
              proposer_address, source, schedule_id, status)
           VALUES ($1,$2,$3,$4,$5,'system','schedule',$6,'pending')
           RETURNING id`,
          [
            schedule.workspace_id, title,
            schedule.recipient, schedule.amount_usdc,
            schedule.category_id ?? null,
            schedule.id,
          ]
        );

        // 2. Create notification
        await client.query(
          `INSERT INTO notifications (workspace_id, type, title, body)
           VALUES ($1,'schedule_due',$2,$3)`,
          [
            schedule.workspace_id,
            `Schedule due: ${schedule.name}`,
            `A recurring payment proposal has been created automatically. Proposal ID: ${proposal.id}`,
          ]
        );

        // 3. Advance next_run_at using PostgreSQL interval arithmetic
        //    next_run_at = last next_run_at + interval (not now(), avoids drift)
        await client.query(
          `UPDATE schedules
           SET last_run_at = NOW(),
               next_run_at = next_run_at + (frequency_value || ' ' || frequency_unit)::interval
           WHERE id = $1`,
          [schedule.id]
        );

        await client.query('COMMIT');
        processed++;
      } catch (innerErr) {
        await client.query('ROLLBACK');
        console.error(`[cron] failed to process schedule ${schedule.id}:`, innerErr);
      }
    }

    console.log(`[cron] processed=${processed} skipped=${skipped} total=${dueSchedules.length}`);
    return res.json({ processed, skipped, total: dueSchedules.length });
  } catch (err) {
    console.error('[cron] error:', err);
    return res.status(500).json({ error: 'internal server error' });
  } finally {
    client.release();
  }
});

function ensureDb() {
  if (!dbReady) dbReady = initDb().catch((err) => { dbReady = null; throw err; });
  return dbReady;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await ensureDb();
  } catch (err) {
    console.error('[db] init failed:', err);
    return res.status(500).json({ error: 'Database initialisation failed' });
  }

  // Strip /api prefix — Express routes are registered without it
  req.url = (req.url ?? '/').replace(/^\/api/, '') || '/';

  return new Promise<void>((resolve, reject) => {
    app(req as unknown as express.Request, res as unknown as express.Response, (err?: unknown) => {
      if (err) reject(err); else resolve();
    });
  });
}
