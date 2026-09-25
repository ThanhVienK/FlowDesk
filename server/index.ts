import express from 'express';
import cors from 'cors';
import { initDb } from './db';
import workspacesRouter from './routes/workspaces';
import proposalsRouter from './routes/proposals';
import vendorsRouter from './routes/vendors';
import transactionsRouter from './routes/transactions';
import schedulesRouter from './routes/schedules';
import categoriesRouter from './routes/categories';
import notificationsRouter from './routes/notifications';
import cronRouter from './routes/cron';

const app = express();
const PORT = 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());

// Routes
app.use('/workspaces', workspacesRouter);
app.use('/proposals', proposalsRouter);
app.use('/vendors', vendorsRouter);
app.use('/transactions', transactionsRouter);
app.use('/schedules', schedulesRouter);
app.use('/categories', categoriesRouter);
app.use('/notifications', notificationsRouter);
app.use('/cron', cronRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

async function main() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`[server] FlowDesk API running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[server] Failed to start:', err);
    process.exit(1);
  }
}

main();
