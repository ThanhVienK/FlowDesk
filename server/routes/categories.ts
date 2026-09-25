import { Router } from 'express';
import { query, queryOne } from '../db';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { workspace_id } = req.query;
    if (!workspace_id) return res.status(400).json({ error: 'workspace_id required' });
    const rows = await query(
      `SELECT * FROM budget_categories WHERE workspace_id = $1 ORDER BY name ASC`,
      [workspace_id]
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: 'internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { workspace_id, name, color, monthly_limit } = req.body;
    if (!workspace_id || !name) return res.status(400).json({ error: 'workspace_id and name required' });
    const row = await queryOne(
      `INSERT INTO budget_categories (workspace_id, name, color, monthly_limit)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (workspace_id, name) DO UPDATE SET color = EXCLUDED.color, monthly_limit = EXCLUDED.monthly_limit
       RETURNING *`,
      [workspace_id, name.trim(), color ?? '#122d45', monthly_limit ?? null]
    );
    return res.status(201).json(row);
  } catch {
    return res.status(500).json({ error: 'internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await query(`DELETE FROM budget_categories WHERE id = $1`, [req.params.id]);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
