import { Router } from 'express';
import { query, queryOne } from '../db';

const router = Router();

// GET /api/vendors?workspace_id=...
router.get('/', async (req, res) => {
  try {
    const { workspace_id } = req.query;
    if (!workspace_id) return res.status(400).json({ error: 'workspace_id required' });

    const rows = await query(
      `SELECT v.*, bc.name as category_name, bc.color as category_color
       FROM vendors v
       LEFT JOIN budget_categories bc ON bc.id = v.category_id
       WHERE v.workspace_id = $1
       ORDER BY v.name ASC`,
      [workspace_id]
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: 'internal server error' });
  }
});

// POST /api/vendors
router.post('/', async (req, res) => {
  try {
    const { workspace_id, name, address, category_id, notes } = req.body;
    if (!workspace_id || !name || !address) {
      return res.status(400).json({ error: 'workspace_id, name, address required' });
    }
    // Validate address format
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return res.status(400).json({ error: 'invalid Ethereum address' });
    }
    const row = await queryOne(
      `INSERT INTO vendors (workspace_id, name, address, category_id, notes, approved)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (workspace_id, address) DO UPDATE SET name = EXCLUDED.name, notes = EXCLUDED.notes
       RETURNING *`,
      [workspace_id, name.trim(), address.toLowerCase(), category_id || null, notes || null]
    );
    return res.status(201).json(row);
  } catch {
    return res.status(500).json({ error: 'internal server error' });
  }
});

// DELETE /api/vendors/:id
router.delete('/:id', async (req, res) => {
  try {
    await query(`DELETE FROM vendors WHERE id = $1`, [req.params.id]);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
