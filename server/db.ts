import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5433/flowdesk';

// Extract schema name from connection string (?schema=<name>) or default to 'flow_desk'
function parseSchema(url: string): string {
  try {
    const match = url.match(/[?&]schema=([^&]+)/);
    return match?.[1] ?? 'flow_desk';
  } catch {
    return 'flow_desk';
  }
}

const SCHEMA = parseSchema(DATABASE_URL);

// Strip ?schema= from the connection string — pg driver does not understand it.
const connectionString = DATABASE_URL.replace(/([?&])schema=[^&]*(&|$)/, (_m, prefix, suffix) =>
  suffix === '&' ? prefix : prefix === '?' ? '' : ''
).replace(/[?&]$/, '');

export const pool = new Pool({
  connectionString,
  max: 8,
  // search_path is set per-connection in initDb and per-query in query().
  // Do NOT use pool.on('connect') — it fires during pg handshake and causes
  // "query-during-query" deprecation in pg@9.
});

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path = "${SCHEMA}",public`);
    const { rows } = await client.query(sql, params);
    return rows as T[];
  } finally {
    client.release();
  }
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function initDb() {
  const client = await pool.connect();
  try {
    // 1. Ensure schema exists
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA}"`);

    // 2. Set search_path for this init session
    await client.query(`SET search_path = "${SCHEMA}",public`);

    // 3. Create all tables inside flow_desk schema
    await client.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name          TEXT        NOT NULL CHECK (char_length(name) > 0),
        owner_address TEXT        NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS workspaces_owner
        ON workspaces (owner_address);

      CREATE TABLE IF NOT EXISTS budget_categories (
        id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id  UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name          TEXT        NOT NULL,
        color         TEXT        NOT NULL DEFAULT '#122d45',
        monthly_limit BIGINT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (workspace_id, name)
      );

      CREATE TABLE IF NOT EXISTS vendors (
        id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id  UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name          TEXT        NOT NULL,
        address       TEXT        NOT NULL,
        category_id   UUID        REFERENCES budget_categories(id) ON DELETE SET NULL,
        notes         TEXT,
        approved      BOOLEAN     NOT NULL DEFAULT true,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (workspace_id, address)
      );

      CREATE TABLE IF NOT EXISTS proposals (
        id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id      UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        title             TEXT        NOT NULL,
        description       TEXT,
        recipient         TEXT        NOT NULL,
        amount_usdc       BIGINT      NOT NULL CHECK (amount_usdc > 0),
        category_id       UUID        REFERENCES budget_categories(id) ON DELETE SET NULL,
        proposer_address  TEXT        NOT NULL DEFAULT 'system',
        status            TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','rejected','executed')),
        approvals         JSONB       NOT NULL DEFAULT '[]',
        rejection_reason  TEXT,
        tx_hash           TEXT,
        source            TEXT        NOT NULL DEFAULT 'manual',
        schedule_id       UUID,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS proposals_workspace
        ON proposals (workspace_id, status, created_at DESC);

      CREATE TABLE IF NOT EXISTS schedules (
        id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id     UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name             TEXT        NOT NULL,
        recipient        TEXT        NOT NULL,
        amount_usdc      BIGINT      NOT NULL CHECK (amount_usdc > 0),
        frequency        TEXT        NOT NULL DEFAULT 'monthly',
        frequency_value  INTEGER     NOT NULL DEFAULT 1,
        frequency_unit   TEXT        NOT NULL DEFAULT 'month',
        category_id      UUID        REFERENCES budget_categories(id) ON DELETE SET NULL,
        active           BOOLEAN     NOT NULL DEFAULT true,
        next_run_at      TIMESTAMPTZ NOT NULL,
        last_run_at      TIMESTAMPTZ,
        notes            TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS schedules_workspace
        ON schedules (workspace_id, active, next_run_at);
    `);

    // Idempotent migrations — run separately so failures don't abort table creation
    await client.query(`
      DO $mig$
      BEGIN
        -- proposals: source column
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'proposals' AND column_name = 'source'
        ) THEN
          ALTER TABLE proposals ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
        END IF;
        -- proposals: schedule_id column
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'proposals' AND column_name = 'schedule_id'
        ) THEN
          ALTER TABLE proposals ADD COLUMN schedule_id UUID;
        END IF;
        -- schedules: frequency_value column
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'schedules' AND column_name = 'frequency_value'
        ) THEN
          ALTER TABLE schedules ADD COLUMN frequency_value INTEGER NOT NULL DEFAULT 1;
        END IF;
        -- schedules: frequency_unit column
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'schedules' AND column_name = 'frequency_unit'
        ) THEN
          ALTER TABLE schedules ADD COLUMN frequency_unit TEXT NOT NULL DEFAULT 'month';
        END IF;
        -- Drop old CHECK constraint on frequency string if still present
        ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_frequency_check;
        -- Back-fill legacy frequency strings
        UPDATE schedules SET frequency_value = 2, frequency_unit = 'week'
          WHERE frequency = 'biweekly' AND frequency_unit = 'month' AND frequency_value = 1;
        UPDATE schedules SET frequency_value = 1, frequency_unit = 'week'
          WHERE frequency = 'weekly' AND frequency_unit = 'month' AND frequency_value = 1;
      END
      $mig$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id  UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        proposal_id   UUID        REFERENCES proposals(id) ON DELETE SET NULL,
        schedule_id   UUID        REFERENCES schedules(id) ON DELETE SET NULL,
        tx_hash       TEXT        NOT NULL,
        chain_id      INTEGER     NOT NULL DEFAULT 5042002,
        from_address  TEXT        NOT NULL,
        to_address    TEXT        NOT NULL,
        amount_usdc   BIGINT      NOT NULL,
        category_id   UUID        REFERENCES budget_categories(id) ON DELETE SET NULL,
        memo          TEXT,
        indexed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (tx_hash, chain_id)
      );

      CREATE INDEX IF NOT EXISTS transactions_workspace
        ON transactions (workspace_id, indexed_at DESC);

      CREATE TABLE IF NOT EXISTS notifications (
        id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id  UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        type          TEXT        NOT NULL,
        title         TEXT        NOT NULL,
        body          TEXT,
        read          BOOLEAN     NOT NULL DEFAULT false,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS notifications_workspace
        ON notifications (workspace_id, read, created_at DESC);
    `);

    console.log(`[db] schema "${SCHEMA}" ready`);
  } finally {
    client.release();
  }
}
