
import { Router } from 'express';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import cronstrue from 'cronstrue';

const router = Router();

const CRON_JOBS_PATH = path.join(os.homedir(), '.openclaw', 'cron', 'jobs.json');

// GET /api/crons - Read cron jobs
router.get('/', async (req, res, next) => {
  try {
    const data = await fs.readFile(CRON_JOBS_PATH, 'utf-8');
    const cronConfig = JSON.parse(data);
    
    // Add human-readable schedule
    if (cronConfig.jobs && Array.isArray(cronConfig.jobs)) {
      cronConfig.jobs = cronConfig.jobs.map(job => ({
        ...job,
        schedule: {
          ...job.schedule,
          humanReadable: cronstrue.toString(job.schedule.expr, { use24HourTimeFormat: true }),
        }
      }));
    }

    res.json(cronConfig);
  } catch (error) {
    next(error);
  }
});

// POST /api/crons/:id/run - Run a cron job
router.post('/:id/run', (req, res, next) => {
  const { id } = req.params;
  try {
    // Basic validation for ID to prevent command injection
    if (!/^[a-zA-Z0-9-]+$/.test(id)) {
      return res.status(400).json({ error: 'Invalid cron ID format' });
    }
    const output = execSync(`openclaw cron run ${id}`, { timeout: 5000 });
    res.json({ success: true, output: output.toString() });
  } catch (error) {
    next(error);
  }
});

// POST /api/crons/:id/enable - Enable a cron job
router.post('/:id/enable', (req, res, next) => {
  const { id } = req.params;
  try {
    if (!/^[a-zA-Z0-9-]+$/.test(id)) {
      return res.status(400).json({ error: 'Invalid cron ID format' });
    }
    const output = execSync(`openclaw cron enable ${id}`);
    res.json({ success: true, output: output.toString() });
  } catch (error) {
    next(error);
  }
});

// POST /api/crons/:id/disable - Disable a cron job
router.post('/:id/disable', (req, res, next) => {
  const { id } = req.params;
  try {
    if (!/^[a-zA-Z0-9-]+$/.test(id)) {
      return res.status(400).json({ error: 'Invalid cron ID format' });
    }
    const output = execSync(`openclaw cron disable ${id}`);
    res.json({ success: true, output: output.toString() });
  } catch (error) {
    next(error);
  }
});

export default router;
