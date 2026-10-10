import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { INITIAL_LUMA_CSV } from './src/data/initialData.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data directory & storage file
const DATA_DIR = path.resolve(__dirname, 'data');
const DATA_FILE = path.resolve(DATA_DIR, 'event_data.json');

// Ensure data folder exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not create data dir, fallback to memory/temp:', e);
}

// In-memory state cache
let stateCache = {
  csvText: INITIAL_LUMA_CSV,
  updatedAt: new Date().toISOString(),
  manualOverrides: {} as Record<string, any>,
  spreadsheetId: null as string | null,
  spreadsheetUrl: null as string | null,
  lastSyncedAt: null as string | null,
};

// Load saved data from disk if exists
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    stateCache = { ...stateCache, ...parsed };
    console.log('Loaded persisted event data from disk.');
  } else {
    // Write initial seed
    fs.writeFileSync(DATA_FILE, JSON.stringify(stateCache, null, 2), 'utf-8');
    console.log('Seeded event data file with initial Luma dataset.');
  }
} catch (err) {
  console.warn('Failed reading from data file, using memory cache:', err);
}

function persistState() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(stateCache, null, 2), 'utf-8');
  } catch (err) {
    // If running on read-only filesystem (e.g. standard serverless), try /tmp
    try {
      const tmpFile = path.resolve('/tmp', 'luma_event_data.json');
      fs.writeFileSync(tmpFile, JSON.stringify(stateCache, null, 2), 'utf-8');
    } catch {
      // Memory cache is still valid
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '20mb' }));

  // ==================== API ROUTES ====================

  // GET /api/data - Retrieve persisted attendees list and state
  app.get('/api/data', (_req, res) => {
    res.json({
      success: true,
      data: stateCache,
    });
  });

  // POST /api/data - Update attendees list or changes
  app.post('/api/data', (req, res) => {
    try {
      const { csvText, manualOverrides, spreadsheetId, spreadsheetUrl, lastSyncedAt } = req.body;

      if (csvText !== undefined) {
        stateCache.csvText = csvText;
      }
      if (manualOverrides !== undefined) {
        stateCache.manualOverrides = manualOverrides;
      }
      if (spreadsheetId !== undefined) {
        stateCache.spreadsheetId = spreadsheetId;
      }
      if (spreadsheetUrl !== undefined) {
        stateCache.spreadsheetUrl = spreadsheetUrl;
      }
      if (lastSyncedAt !== undefined) {
        stateCache.lastSyncedAt = lastSyncedAt;
      }

      stateCache.updatedAt = new Date().toISOString();
      persistState();

      res.json({
        success: true,
        updatedAt: stateCache.updatedAt,
        message: 'Dades desades correctament al servidor.',
      });
    } catch (error: any) {
      console.error('Error saving data to server:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error desant les dades al servidor.',
      });
    }
  });

  // POST /api/reset - Reset to initial attendees
  app.post('/api/reset', (_req, res) => {
    stateCache = {
      csvText: INITIAL_LUMA_CSV,
      updatedAt: new Date().toISOString(),
      manualOverrides: {},
      spreadsheetId: null,
      spreadsheetUrl: null,
      lastSyncedAt: null,
    };
    persistState();
    res.json({
      success: true,
      data: stateCache,
      message: 'Llista restaurada als 86 comensals inicials.',
    });
  });

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ==================== FRONTEND DEV & PROD ====================

  if (!isProd) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Luma Event Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
