import { Router } from 'express';
import { query, queryOne } from '../db';

const router = Router();

type FrequencyUnit = 'minute' | 'hour' | 'day' | 'week' | 'month';

const UNIT_MAX: Record<FrequencyUnit, number> = {
  minute: 525600,
  hour:   8760,
  day:    3650,
  week:   520,
  month:  120,
};

/**
 * Calculate next_run_at from now + value * unit.
 * Works for any granularity from 1 minute to 120 months.
 */
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

/**
 * Map legacy frequency strings to new unit+value pairs.
 * Used for backward compatibility on old rows.
 */
function legacyToUnitValue(frequency: string): { value: number; unit: FrequencyUnit } {
  if (frequency === 'biweekly') return { value: 2, unit: 'week' };
  if (frequency === 'weekly')   return { value: 1, unit: 'week' };
  return { value: 1, unit: 'month' }; // monthly + unknown
}

// GET /schedules?workspace_id=
router.get('/', async (req, res) => {
  try {
    const { workspace_id } = req.query;
    if (!workspace_id) return res.status(400).json({ error: 'workspace_id required' });
    const rows = await query(
      `SELECT s.*, bc.name as category_name, bc.color as category_color
       FROM schedules s
       LEFT JOIN budget_categories bc ON bc.id = s.category_id
       WHERE s.workspace_id = $1
       ORDER BY s.active DESC, s.next_run_at ASC`,
      [workspace_id]
    );
    // Hydrate legacy rows that lack frequency_unit/frequency_value
    const hydrated = (rows as Record<string, unknown>[]).map(r => {
      if (!r.frequency_unit || r.frequency_value == null) {
        const { value, unit } = legacyToUnitValue(String(r.frequency ?? 'monthly'));
        return { ...r, frequency_value: value, frequency_unit: unit };
      }
      return r;
    });
    return res.json(hydrated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

// POST /schedules
router.post('/', async (req, res) => {
  try {
    const {
      workspace_id, name, recipient, amount_usdc,
      frequency_value, frequency_unit,
      category_id, notes, next_run_at,
    } = req.body as Record<string, unknown>;

    // Required fields
    if (!workspace_id || !name || !recipient || !amount_usdc || !frequency_value || !frequency_unit) {
      return res.status(400).json({
        error: 'workspace_id, name, recipient, amount_usdc, frequency_value, frequency_unit required',
      });
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(String(recipient))) {
      return res.status(400).json({ error: 'Invalid recipient address' });
    }

    const amtNum = Number(amount_usdc);
    if (!amtNum || amtNum <= 0) return res.status(400).json({ error: 'amount_usdc must be positive' });

    const valNum = parseInt(String(frequency_value), 10);
    const unit = String(frequency_unit) as FrequencyUnit;
    if (!Number.isInteger(valNum) || valNum <= 0) {
      return res.status(400).json({ error: 'frequency_value must be a positive integer' });
    }
    if (!UNIT_MAX[unit]) {
      return res.status(400).json({ error: `Invalid frequency_unit: ${unit}` });
    }
    if (valNum > UNIT_MAX[unit]) {
      return res.status(400).json({ error: `frequency_value max for ${unit} is ${UNIT_MAX[unit]}` });
    }

    // Accept client-provided next_run_at or calculate server-side
    const nextRun = next_run_at ? new Date(String(next_run_at)) : calcNextRun(valNum, unit);

    // Legacy frequency string for backward compat display
    const legacyFreq = unit === 'week' && valNum === 2 ? 'biweekly'
      : unit === 'week' && valNum === 1 ? 'weekly'
      : unit === 'month' && valNum === 1 ? 'monthly'
      : `every_${valNum}_${unit}`;

    const row = await queryOne(
      `INSERT INTO schedules
         (workspace_id, name, recipient, amount_usdc, frequency,
          frequency_value, frequency_unit, category_id, notes, next_run_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        workspace_id, String(name).trim(), String(recipient).toLowerCase(),
        amtNum, legacyFreq, valNum, unit,
        category_id ?? null, notes ?? null,
        nextRun.toISOString(),
      ]
    );
    return res.status(201).json(row);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

// PATCH /schedules/:id/toggle
router.patch('/:id/toggle', async (req, res) => {
  try {
    const row = await queryOne(
      `UPDATE schedules SET active = NOT active WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'Schedule not found' });
    // Hydrate legacy row
    const r = row as Record<string, unknown>;
    if (!r.frequency_unit || r.frequency_value == null) {
      const { value, unit } = legacyToUnitValue(String(r.frequency ?? 'monthly'));
      return res.json({ ...r, frequency_value: value, frequency_unit: unit });
    }
    return res.json(row);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

// DELETE /schedules/:id
router.delete('/:id', async (req, res) => {
  try {
    await query(`DELETE FROM schedules WHERE id = $1`, [req.params.id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
