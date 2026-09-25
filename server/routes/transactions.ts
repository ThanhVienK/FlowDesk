import { Router } from 'express';
import { query } from '../db';

const router = Router();

// GET /transactions?workspace_id=...&limit=20&offset=0
router.get('/', async (req, res) => {
  try {
    const { workspace_id, limit = '20', offset = '0' } = req.query;
    if (!workspace_id) return res.status(400).json({ error: 'workspace_id required' });

    const safeLimit = Math.min(parseInt(String(limit), 10) || 20, 100);
    const safeOffset = Math.max(parseInt(String(offset), 10) || 0, 0);

    const rows = await query(
      `SELECT t.*, bc.name as category_name, bc.color as category_color
       FROM transactions t
       LEFT JOIN budget_categories bc ON bc.id = t.category_id
       WHERE t.workspace_id = $1
       ORDER BY t.indexed_at DESC
       LIMIT $2 OFFSET $3`,
      [workspace_id, safeLimit, safeOffset]
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
