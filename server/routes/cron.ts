import { Router } from 'express';
import { pool } from '../db';

const router = Router();

type FreqUnit = 'minute' | 'hour' | 'day' | 'week' | 'month';

// POST /cron/schedules
// Finds all DUE active schedules and creates proposals + notifications atomically.
// Protected by CRON_SECRET env var (optional on local dev).
router.post('/schedules', async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.authorization ?? '';
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const client = await pool.connect();
  await client.query(`SET search_path = "flow_desk",public`);
  try {
    const { rows: dueSchedules } = await client.query<{
      id: string; workspace_id: string; name: string; recipient: string;
      amount_usdc: number; frequency_value: number; frequency_unit: FreqUnit;
      category_id: string | null;
    }>(
      `SELECT id, workspace_id, name, recipient, amount_usdc,
              frequency_value, frequency_unit, category_id
       FROM schedules
       WHERE active = true AND next_run_at <= NOW()`
    );

    if (dueSchedules.length === 0) {
      return res.json({ processed: 0, skipped: 0, total: 0 });
    }

    let processed = 0;
    let skipped = 0;

    for (const schedule of dueSchedules) {
      // Deduplication guard
      const { rows: existing } = await client.query(
        `SELECT id FROM proposals
         WHERE schedule_id = $1 AND status IN ('pending','approved')
         LIMIT 1`,
        [schedule.id]
      );
      if (existing.length > 0) { skipped++; continue; }

      await client.query('BEGIN');
      try {
        // 1. Create proposal
        const { rows: [proposal] } = await client.query(
          `INSERT INTO proposals
             (workspace_id, title, recipient, amount_usdc, category_id,
              proposer_address, source, schedule_id, status)
           VALUES ($1,$2,$3,$4,$5,'system','schedule',$6,'pending')
           RETURNING id`,
          [
            schedule.workspace_id,
            `${schedule.name} — auto`,
            schedule.recipient,
            schedule.amount_usdc,
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
            `Proposal created automatically. ID: ${proposal.id}`,
          ]
        );

        // 3. Advance next_run_at (no clock drift — add to existing next_run_at)
        await client.query(
          `UPDATE schedules
           SET last_run_at = NOW(),
               next_run_at = next_run_at + (frequency_value || ' ' || frequency_unit)::interval
           WHERE id = $1`,
          [schedule.id]
        );

        await client.query('COMMIT');
        processed++;
        console.log(`[cron] processed schedule "${schedule.name}" (${schedule.id})`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[cron] failed schedule ${schedule.id}:`, err);
      }
    }

    console.log(`[cron] done — processed=${processed} skipped=${skipped} total=${dueSchedules.length}`);
    return res.json({ processed, skipped, total: dueSchedules.length });
  } catch (err) {
    console.error('[cron] error:', err);
    return res.status(500).json({ error: 'internal server error' });
  } finally {
    client.release();
  }
});

export default router;
