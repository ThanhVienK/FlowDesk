import { Router } from 'express';
import { query, queryOne } from '../db';

const router = Router();

// GET /proposals?workspace_id=...
router.get('/', async (req, res) => {
  try {
    const { workspace_id } = req.query;
    if (!workspace_id) return res.status(400).json({ error: 'workspace_id required' });
    const rows = await query(
      `SELECT p.*, bc.name as category_name, bc.color as category_color
       FROM proposals p
       LEFT JOIN budget_categories bc ON bc.id = p.category_id
       WHERE p.workspace_id = $1
       ORDER BY p.created_at DESC`,
      [workspace_id]
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

// POST /proposals
router.post('/', async (req, res) => {
  try {
    const { workspace_id, title, description, recipient, amount_usdc, category_id, proposer_address } = req.body;
    if (!workspace_id || !title || !recipient || !amount_usdc || !proposer_address) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
      return res.status(400).json({ error: 'Invalid recipient address' });
    }
    if (typeof amount_usdc !== 'number' || amount_usdc <= 0) {
      return res.status(400).json({ error: 'amount_usdc must be a positive number' });
    }

    const row = await queryOne(
      `INSERT INTO proposals (workspace_id, title, description, recipient, amount_usdc, category_id, proposer_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [workspace_id, title.trim(), description ?? null, recipient.toLowerCase(), amount_usdc, category_id ?? null, proposer_address.toLowerCase()]
    );

    // Notify
    await query(
      `INSERT INTO notifications (workspace_id, type, title, body) VALUES ($1, 'proposal_created', $2, $3)`,
      [workspace_id, `New proposal: ${title}`, `Amount: $${(amount_usdc / 1_000_000).toFixed(2)} USDC`]
    );

    return res.status(201).json(row);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

// PATCH /proposals/:id/approve
router.patch('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approver_address } = req.body;
    if (!approver_address) return res.status(400).json({ error: 'approver_address required' });

    const proposal = await queryOne<{ workspace_id: string; status: string; title: string; approvals: unknown[] }>(
      `SELECT workspace_id, status, title, approvals FROM proposals WHERE id = $1`,
      [id]
    );
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (proposal.status !== 'pending') return res.status(400).json({ error: 'Only pending proposals can be approved' });

    const approvals = Array.isArray(proposal.approvals) ? proposal.approvals : [];
    if (!approvals.includes(approver_address.toLowerCase())) {
      approvals.push(approver_address.toLowerCase());
    }

    const row = await queryOne(
      `UPDATE proposals SET status = 'approved', approvals = $2::jsonb, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, JSON.stringify(approvals)]
    );

    await query(
      `INSERT INTO notifications (workspace_id, type, title, body) VALUES ($1, 'proposal_approved', $2, $3)`,
      [proposal.workspace_id, `Proposal approved: ${proposal.title}`, `Approved by ${approver_address.slice(0, 8)}…`]
    );

    return res.json(row);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

// PATCH /proposals/:id/reject
router.patch('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const proposal = await queryOne<{ workspace_id: string; status: string; title: string }>(
      `SELECT workspace_id, status, title FROM proposals WHERE id = $1`, [id]
    );
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (proposal.status !== 'pending') return res.status(400).json({ error: 'Only pending proposals can be rejected' });

    const row = await queryOne(
      `UPDATE proposals SET status = 'rejected', rejection_reason = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, reason ?? null]
    );

    await query(
      `INSERT INTO notifications (workspace_id, type, title, body) VALUES ($1, 'proposal_rejected', $2, $3)`,
      [proposal.workspace_id, `Proposal rejected: ${proposal.title}`, reason ?? '']
    );

    return res.json(row);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

// PATCH /proposals/:id/record-execution — called after onchain tx confirmed
router.patch('/:id/record-execution', async (req, res) => {
  try {
    const { id } = req.params;
    const { tx_hash } = req.body;
    if (!tx_hash) return res.status(400).json({ error: 'tx_hash required' });

    const proposal = await queryOne<{ workspace_id: string; status: string; title: string; recipient: string; amount_usdc: number; category_id: string | null; proposer_address: string }>(
      `SELECT workspace_id, status, title, recipient, amount_usdc, category_id, proposer_address FROM proposals WHERE id = $1`, [id]
    );
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    if (proposal.status !== 'approved') return res.status(400).json({ error: 'Only approved proposals can be executed' });

    // Mark proposal executed
    await queryOne(
      `UPDATE proposals SET status = 'executed', tx_hash = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, tx_hash]
    );

    // Record transaction (idempotent on tx_hash + chain_id)
    await query(
      `INSERT INTO transactions (workspace_id, proposal_id, tx_hash, chain_id, from_address, to_address, amount_usdc, category_id, memo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (tx_hash, chain_id) DO NOTHING`,
      [proposal.workspace_id, id, tx_hash, 5042002, proposal.proposer_address, proposal.recipient, proposal.amount_usdc, proposal.category_id ?? null, proposal.title]
    );

    await query(
      `INSERT INTO notifications (workspace_id, type, title, body) VALUES ($1, 'proposal_executed', $2, $3)`,
      [proposal.workspace_id, `Payment executed: ${proposal.title}`, `$${(proposal.amount_usdc / 1_000_000).toFixed(2)} sent · tx ${tx_hash.slice(0, 10)}…`]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
