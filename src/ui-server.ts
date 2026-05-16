import express from 'express';
import cors from 'cors';
import { join } from 'path';
import { Storage } from './types.js';
import { FileStorage } from './storage/file-storage.js';
import crypto from 'crypto';
import portfinder from 'portfinder';
import { promises as fs } from 'fs';

interface DiscoveredProject {
  name: string;
  path: string;
}

/**
 * Scan root directories for folders containing .north-star/master-plan.json
 */
async function discoverProjects(scanRoots: string[]): Promise<DiscoveredProject[]> {
  const projects: DiscoveredProject[] = [];

  for (const root of scanRoots) {
    try {
      const entries = await fs.readdir(root, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const candidatePath = join(root, entry.name);
        const planPath = join(candidatePath, '.north-star', 'master-plan.json');
        try {
          await fs.access(planPath);
          projects.push({ name: entry.name, path: candidatePath });
        } catch {
          // No .north-star here, skip
        }

        // Also check one level deeper (e.g., Desktop/Agents/NeatRows)
        try {
          const subEntries = await fs.readdir(candidatePath, { withFileTypes: true });
          for (const sub of subEntries) {
            if (!sub.isDirectory()) continue;
            const subPath = join(candidatePath, sub.name);
            const subPlanPath = join(subPath, '.north-star', 'master-plan.json');
            try {
              await fs.access(subPlanPath);
              // Avoid duplicates
              if (!projects.find((p) => p.path === subPath)) {
                projects.push({ name: sub.name, path: subPath });
              }
            } catch {
              // skip
            }
          }
        } catch {
          // skip
        }
      }
    } catch (e) {
      console.error(`Failed to scan ${root}:`, e);
    }
  }

  return projects;
}

/**
 * Get or create a FileStorage instance for the given project path.
 */
function getStorageForProject(projectPath: string, cache: Map<string, FileStorage>): FileStorage {
  if (!cache.has(projectPath)) {
    cache.set(projectPath, new FileStorage(projectPath));
  }
  return cache.get(projectPath)!;
}

export async function startUIServer(
  defaultStorage: Storage,
  northStarDir: string,
  projectRoot: string,
  scanRoots: string[],
  defaultPort = 9889
) {
  const app = express();
  const storageCache = new Map<string, FileStorage>();

  app.use(cors());
  const publicPath = join(northStarDir, 'public');
  app.use(express.static(publicPath));

  app.get('/', (req, res) => {
    res.sendFile(join(publicPath, 'index.html'));
  });

  // Meta endpoint
  app.get('/api/meta', (req, res) => {
    res.json({ projectRoot });
  });

  // Discover all projects with .north-star directories
  app.get('/api/projects', async (req, res) => {
    try {
      const projects = await discoverProjects(scanRoots);
      res.json(projects);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // Remote shutdown endpoint
  app.post('/api/shutdown', (req, res) => {
    res.json({ message: 'Shutting down...' });
    process.kill(process.pid, 'SIGINT');
  });

  // Helper: resolve storage from ?project= query param or use default
  function resolveStorage(projectParam: string | undefined): Storage {
    if (projectParam && projectParam !== projectRoot) {
      return getStorageForProject(projectParam, storageCache);
    }
    return defaultStorage;
  }

  // REST endpoints — all accept optional ?project=<path>
  app.get('/api/plan', async (req, res) => {
    try {
      const storage = resolveStorage(req.query.project as string | undefined);
      const plan = await storage.getMasterPlan();
      res.json(plan || {});
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get('/api/rules', async (req, res) => {
    try {
      const storage = resolveStorage(req.query.project as string | undefined);
      const rules = await storage.getRules();
      res.json(rules);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get('/api/scratchpad', async (req, res) => {
    try {
      const storage = resolveStorage(req.query.project as string | undefined);
      const scratchpad = await storage.getScratchpad();
      res.json(scratchpad);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get('/api/handoff', async (req, res) => {
    try {
      const storage = resolveStorage(req.query.project as string | undefined);
      const handoff = await storage.getHandoff();
      res.json(handoff || {});
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get('/api/decisions', async (req, res) => {
    try {
      const storage = resolveStorage(req.query.project as string | undefined);
      const decisions = await storage.getDecisions();
      res.json(decisions || []);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // SSE endpoint — accepts optional ?project=<path>
  app.get('/api/stream', (req, res) => {
    const storage = resolveStorage(req.query.project as string | undefined);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    let lastHash = '';

    const intervalId = setInterval(async () => {
      try {
        const plan = await storage.getMasterPlan();
        const rules = await storage.getRules();
        const scratchpad = await storage.getScratchpad();
        const decisions = await storage.getDecisions();
        const handoff = await storage.getHandoff();

        const state = {
          plan: plan || {},
          rules: rules || [],
          scratchpad: scratchpad || [],
          decisions: decisions || [],
          handoff: handoff || null,
        };

        const currentHash = crypto.createHash('md5').update(JSON.stringify(state)).digest('hex');

        if (currentHash !== lastHash) {
          lastHash = currentHash;
          res.write(`data: ${JSON.stringify({ type: 'update', state })}\n\n`);
        }
      } catch (_err) {
        // Ignore internal read errors
      }
    }, 1000);

    req.on('close', () => {
      clearInterval(intervalId);
    });
  });

  try {
    const port = await portfinder.getPortPromise({ port: defaultPort });
    app.listen(port, () => {
      console.error(`🌐 UI Dashboard running at http://localhost:${port}`);
    });
    return port;
  } catch (err) {
    console.error('Failed to start UI server:', err);
    return defaultPort;
  }
}
