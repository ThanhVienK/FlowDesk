import { Router } from 'express';
import { query } from '../db';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { workspace_id } = req.query;
    if (!workspace_id) return res.status(400).json({ error: 'workspace_id required' });
    const rows = await query(
      `SELECT * FROM notifications WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [workspace_id]
    );
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: 'internal server error' });
  }
});

// mark-all-read MUST be registered BEFORE /:id/read
// otherwise Express matches the literal string "mark-all-read" as the :id param
router.patch('/mark-all-read', async (req, res) => {
  try {
    const { workspace_id } = req.body as { workspace_id?: string };
    if (!workspace_id) return res.status(400).json({ error: 'workspace_id required' });
    await query(`UPDATE notifications SET read = true WHERE workspace_id = $1`, [workspace_id]);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'internal server error' });
  }
});

// alias kept for backward compat
router.patch('/read-all', async (req, res) => {
  try {
    const { workspace_id } = req.body as { workspace_id?: string };
    if (!workspace_id) return res.status(400).json({ error: 'workspace_id required' });
    await query(`UPDATE notifications SET read = true WHERE workspace_id = $1`, [workspace_id]);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'internal server error' });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    await query(`UPDATE notifications SET read = true WHERE id = $1`, [req.params.id]);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
