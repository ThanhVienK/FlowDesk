import { Router } from 'express';
import { query, queryOne } from '../db';

const router = Router();

// GET /workspaces?owner=<address>
router.get('/', async (req, res) => {
  try {
    const { owner } = req.query;
    if (!owner) return res.status(400).json({ error: 'owner required' });
    const rows = await query(
      `SELECT * FROM workspaces WHERE owner_address = $1 ORDER BY created_at ASC`,
      [String(owner).toLowerCase()]
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

// POST /workspaces
router.post('/', async (req, res) => {
  try {
    const { name, owner_address } = req.body;
    if (!name || !owner_address) return res.status(400).json({ error: 'name and owner_address required' });
    const row = await queryOne(
      `INSERT INTO workspaces (name, owner_address) VALUES ($1, $2) RETURNING *`,
      [name.trim(), String(owner_address).toLowerCase()]
    );
    return res.status(201).json(row);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

// GET /workspaces/:id/summary
router.get('/:id/summary', async (req, res) => {
  try {
    const { id } = req.params;

    const [proposals, schedules, categories, recentTransactions] = await Promise.all([
      query(
        `SELECT p.*, bc.name as category_name, bc.color as category_color
         FROM proposals p
         LEFT JOIN budget_categories bc ON bc.id = p.category_id
         WHERE p.workspace_id = $1
         ORDER BY p.created_at DESC LIMIT 50`,
        [id]
      ),
      query(
        `SELECT s.*, bc.name as category_name, bc.color as category_color
         FROM schedules s
         LEFT JOIN budget_categories bc ON bc.id = s.category_id
         WHERE s.workspace_id = $1
         ORDER BY s.next_run_at ASC`,
        [id]
      ),
      query(
        `SELECT bc.*, COALESCE(SUM(t.amount_usdc), 0)::bigint as spent_this_month
         FROM budget_categories bc
         LEFT JOIN transactions t ON t.category_id = bc.id
           AND t.workspace_id = bc.workspace_id
           AND date_trunc('month', t.indexed_at) = date_trunc('month', now())
         WHERE bc.workspace_id = $1
         GROUP BY bc.id
         ORDER BY bc.name ASC`,
        [id]
      ),
      query(
        `SELECT t.*, bc.name as category_name, bc.color as category_color
         FROM transactions t
         LEFT JOIN budget_categories bc ON bc.id = t.category_id
         WHERE t.workspace_id = $1
         ORDER BY t.indexed_at DESC LIMIT 10`,
        [id]
      ),
    ]);

    const totalSpentRow = await queryOne<{ total: string }>(
      `SELECT COALESCE(SUM(amount_usdc), 0)::text as total
       FROM transactions
       WHERE workspace_id = $1
         AND date_trunc('month', indexed_at) = date_trunc('month', now())`,
      [id]
    );

    const unreadNotifications = await query(
      `SELECT * FROM notifications WHERE workspace_id = $1 AND read = false ORDER BY created_at DESC LIMIT 10`,
      [id]
    );

    return res.json({
      proposals,
      schedules,
      categories,
      recentTransactions,
      totalSpentThisMonthUsdc: parseInt(totalSpentRow?.total ?? '0', 10),
      unreadNotifications,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
