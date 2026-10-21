import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import postgres from 'postgres';
import { INITIAL_LUMA_CSV } from './src/data/initialData.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_SUPABASE_URL =
  'postgresql://postgres:Maxipichet2005!@db.cunpmmsjenlytbfflbra.supabase.co:5432/postgres';

function normalizeDatabaseUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return DEFAULT_SUPABASE_URL;
  }
  let trimmed = rawUrl.trim().replace(/^['"]+|['"]+$/g, '');
  if (!trimmed) {
    return DEFAULT_SUPABASE_URL;
  }
  return trimmed;
}

// Check if Supabase / Postgres is configured via environment variable
const RAW_DB_URL =
  process.env.SUPABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.NETLIFY_DB_URL ||
  process.env.PG_CONNECTION_STRING ||
  '';

const DB_URL = normalizeDatabaseUrl(RAW_DB_URL);

let sql: any = null;
try {
  sql = postgres(DB_URL, {
    ssl: 'require',
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  console.log('Connected to Supabase (PostgreSQL)!');
} catch (dbErr) {
  console.warn('Database initialization with DB_URL failed, falling back to default:', dbErr);
  try {
    sql = postgres(DEFAULT_SUPABASE_URL, {
      ssl: 'require',
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  } catch (err2) {
    console.error('Fatal Database initialization error:', err2);
    sql = null;
  }
}

// Data directory & storage file
const DATA_DIR = path.resolve(__dirname, 'data');
const DATA_FILE = path.resolve(DATA_DIR, 'event_data.json');
const CSV_FILE = path.resolve(DATA_DIR, 'llistat_assistents.csv');

// Ensure data folder exists
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not create data dir, fallback to memory/temp:', e);
}

const DEFAULT_OVERRIDES = {
  'gst-4EiPYqOwuE90vqE': {
    name: 'Manel Solà',
    first_name: 'Manel',
    last_name: 'Solà',
  },
  'pladurgell@aliancacatalana.cat': {
    name: 'Manel Solà',
    first_name: 'Manel',
    last_name: 'Solà',
  },
  'Aliança Catalana Pla d\'Urgell': {
    name: 'Manel Solà',
    first_name: 'Manel',
    last_name: 'Solà',
  },
};

// In-memory state cache
let stateCache = {
  csvText: INITIAL_LUMA_CSV,
  updatedAt: new Date().toISOString(),
  manualOverrides: { ...DEFAULT_OVERRIDES } as Record<string, any>,
  tableAssignments: {} as Record<string, { tableNumber: number | null; seatNumber?: number | null }>,
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
    if (!stateCache.csvText || stateCache.csvText.length < INITIAL_LUMA_CSV.length) {
      stateCache.csvText = INITIAL_LUMA_CSV;
    }
    stateCache.manualOverrides = {
      ...DEFAULT_OVERRIDES,
      ...(stateCache.manualOverrides || {}),
    };
    console.log('[DISK-INIT] Loaded persisted event data from disk.');
  } else {
    fs.writeFileSync(DATA_FILE, JSON.stringify(stateCache, null, 2), 'utf-8');
    fs.writeFileSync(CSV_FILE, stateCache.csvText, 'utf-8');
    console.log('[DISK-INIT] Seeded event data file with initial dataset.');
  }
} catch (err) {
  console.warn('[DISK-INIT] Failed reading from data file, using memory cache:', err);
}

function sanitizeTableAssignments(raw: any): Record<string, { tableNumber: number | null; seatNumber?: number | null }> {
  if (!raw || typeof raw !== 'object') return {};
  const clean: Record<string, { tableNumber: number | null; seatNumber?: number | null }> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v && typeof v === 'object') {
      const assignment = v as any;
      if (assignment.tableNumber === null) {
        clean[k] = { tableNumber: null, seatNumber: null };
      } else if (
        typeof assignment.tableNumber === 'number' &&
        assignment.tableNumber > 0 &&
        assignment.tableNumber <= 30
      ) {
        clean[k] = {
          tableNumber: assignment.tableNumber,
          seatNumber: typeof assignment.seatNumber === 'number' ? assignment.seatNumber : null,
        };
      }
    }
  }
  return clean;
}

// Load initial state from Supabase on startup if available
async function loadFromDbOnInit() {
  if (!sql) return;
  try {
    console.log('[DB-INIT] Checking existing event state in Supabase...');
    await sql`
      CREATE TABLE IF NOT EXISTS event_state (
        id TEXT PRIMARY KEY,
        csv_text TEXT,
        manual_overrides JSONB,
        table_assignments JSONB,
        spreadsheet_id TEXT,
        spreadsheet_url TEXT,
        last_synced_at TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    const rows = await sql`SELECT * FROM event_state WHERE id = 'default' LIMIT 1;`;
    if (rows && rows.length > 0) {
      const row = rows[0];
      const dbCsvLen = (row.csv_text || '').length;
      console.log(`[DB-INIT] Found existing row in Supabase (CSV length: ${dbCsvLen}, updated_at: ${row.updated_at})`);
      const sanitizedAssignments = sanitizeTableAssignments(row.table_assignments);
      stateCache = {
        csvText: row.csv_text && row.csv_text.length > 50 ? row.csv_text : stateCache.csvText,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : stateCache.updatedAt,
        manualOverrides: row.manual_overrides || stateCache.manualOverrides,
        tableAssignments: sanitizedAssignments,
        spreadsheetId: row.spreadsheet_id || stateCache.spreadsheetId,
        spreadsheetUrl: row.spreadsheet_url || stateCache.spreadsheetUrl,
        lastSyncedAt: row.last_synced_at || stateCache.lastSyncedAt,
      };
      persistState();
    } else {
      console.log('[DB-INIT] No event_state row found in Netlify DB. Seeding initial row...');
      await sql`
        INSERT INTO event_state (id, csv_text, manual_overrides, table_assignments, updated_at)
        VALUES ('default', ${stateCache.csvText}, ${JSON.stringify(stateCache.manualOverrides)}, ${JSON.stringify(stateCache.tableAssignments)}, NOW())
        ON CONFLICT (id) DO NOTHING;
      `;
    }
  } catch (err) {
    console.warn('[DB-INIT] Error during initial DB load/creation:', err);
  }
}

loadFromDbOnInit();

function persistState() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(stateCache, null, 2), 'utf-8');
    if (stateCache.csvText) {
      fs.writeFileSync(CSV_FILE, stateCache.csvText, 'utf-8');
    }
  } catch (err) {
    // If running on read-only filesystem (e.g. standard serverless), try /tmp
    try {
      const tmpFile = path.resolve('/tmp', 'event_data.json');
      fs.writeFileSync(tmpFile, JSON.stringify(stateCache, null, 2), 'utf-8');
      const tmpCsv = path.resolve('/tmp', 'llistat_assistents.csv');
      fs.writeFileSync(tmpCsv, stateCache.csvText || '', 'utf-8');
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

  // Clients connected to SSE for real-time live synchronization across all users
  interface SseClient {
    res: express.Response;
    clientId?: string;
  }
  const sseClients: SseClient[] = [];

  const notifyAllClients = (updatedData: any, originClientId?: string) => {
    const payload = `data: ${JSON.stringify(updatedData)}\n\n`;
    for (let i = sseClients.length - 1; i >= 0; i--) {
      const client = sseClients[i];
      if (originClientId && client.clientId && client.clientId === originClientId) {
        continue; // Skip echo back to originating client
      }
      try {
        client.res.write(payload);
      } catch {
        sseClients.splice(i, 1);
      }
    }
  };

  // SSE endpoint for live updates
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Send initial connected state
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

    const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : undefined;
    const clientEntry: SseClient = { res, clientId };
    sseClients.push(clientEntry);

    req.on('close', () => {
      const idx = sseClients.indexOf(clientEntry);
      if (idx !== -1) sseClients.splice(idx, 1);
    });
  });

  // GET /api/data - Retrieve persisted attendees list and state
  app.get('/api/data', async (_req, res) => {
    try {
      console.log('[API GET /api/data] Sol·licitud rebuda de sincronització inicial.');
      if (sql) {
        // Query Netlify Database
        const rows = await sql`SELECT * FROM event_state WHERE id = 'default' LIMIT 1;`;
        if (rows && rows.length > 0) {
          const row = rows[0];
          console.log(`[API GET /api/data] S'han recuperat dades de Netlify DB (updated_at: ${row.updated_at}, len: ${(row.csv_text || '').length})`);
          stateCache = {
            csvText: row.csv_text || stateCache.csvText,
            updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : stateCache.updatedAt,
            manualOverrides: row.manual_overrides || stateCache.manualOverrides,
            tableAssignments: row.table_assignments || stateCache.tableAssignments,
            spreadsheetId: row.spreadsheet_id || stateCache.spreadsheetId,
            spreadsheetUrl: row.spreadsheet_url || stateCache.spreadsheetUrl,
            lastSyncedAt: row.last_synced_at || stateCache.lastSyncedAt,
          };
        } else {
          console.log('[API GET /api/data] No hi ha files a Netlify DB, retornant memòria/disc.');
        }
      }
      res.json({
        success: true,
        data: stateCache,
        db: sql ? 'Supabase (PostgreSQL)' : 'Server disk',
      });
    } catch (e: any) {
      console.error('[API GET /api/data] Error consultant la base de dades:', e);
      res.json({
        success: true,
        data: stateCache,
        db: 'Server disk (DB error fallback)',
      });
    }
  });

  // POST /api/data - Update attendees list or changes
  app.post('/api/data', async (req, res) => {
    try {
      const { csvText, manualOverrides, tableAssignments, spreadsheetId, spreadsheetUrl, lastSyncedAt, clientId } = req.body;
      const changesList: string[] = [];
      if (csvText !== undefined) changesList.push(`csvText (${csvText.length} caràcters)`);
      if (manualOverrides !== undefined) changesList.push(`manualOverrides (${Object.keys(manualOverrides).length} canvis)`);
      if (tableAssignments !== undefined) changesList.push(`tableAssignments (${Object.keys(tableAssignments).length} assignacions)`);
      if (spreadsheetId !== undefined) changesList.push('spreadsheetId');
      
      console.log(`[API POST /api/data] Desant canvis al servidor: ${changesList.join(', ') || 'sense camps nous'}`);

      if (csvText !== undefined) {
        stateCache.csvText = csvText;
      }
      if (manualOverrides !== undefined) {
        stateCache.manualOverrides = manualOverrides;
      }
      if (tableAssignments !== undefined) {
        stateCache.tableAssignments = sanitizeTableAssignments(tableAssignments);
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

      let dbSaveSuccess = false;
      if (sql) {
        try {
          await sql`
            CREATE TABLE IF NOT EXISTS event_state (
              id TEXT PRIMARY KEY,
              csv_text TEXT,
              manual_overrides JSONB,
              table_assignments JSONB,
              spreadsheet_id TEXT,
              spreadsheet_url TEXT,
              last_synced_at TEXT,
              updated_at TIMESTAMPTZ DEFAULT NOW()
            );
          `;
          await sql`
            INSERT INTO event_state (id, csv_text, manual_overrides, table_assignments, spreadsheet_id, spreadsheet_url, last_synced_at, updated_at)
            VALUES (
              'default',
              ${stateCache.csvText},
              ${JSON.stringify(stateCache.manualOverrides)},
              ${JSON.stringify(stateCache.tableAssignments)},
              ${stateCache.spreadsheetId},
              ${stateCache.spreadsheetUrl},
              ${stateCache.lastSyncedAt},
              NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              csv_text = EXCLUDED.csv_text,
              manual_overrides = EXCLUDED.manual_overrides,
              table_assignments = EXCLUDED.table_assignments,
              spreadsheet_id = EXCLUDED.spreadsheet_id,
              spreadsheet_url = EXCLUDED.spreadsheet_url,
              last_synced_at = EXCLUDED.last_synced_at,
              updated_at = NOW();
          `;
          dbSaveSuccess = true;
          console.log('[API POST /api/data] Desat amb èxit a Supabase (PostgreSQL)!');
        } catch (dbErr) {
          console.error('[API POST /api/data] Error escrivint a Supabase:', dbErr);
        }
      }

      // Broadcast changes to all open browser sessions in real-time (excluding the sender)
      notifyAllClients({
        type: 'update',
        originClientId: clientId || null,
        updatedAt: stateCache.updatedAt,
        data: stateCache,
      }, clientId);

      res.json({
        success: true,
        updatedAt: stateCache.updatedAt,
        db: sql ? (dbSaveSuccess ? 'Supabase' : 'Server disk (DB write failed)') : 'Server disk',
        message: 'Dades desades correctament.',
      });
    } catch (error: any) {
      console.error('[API POST /api/data] Error desant les dades:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error desant les dades al servidor.',
      });
    }
  });

  // Download current CSV file from server disk
  app.get('/api/data/download-csv', (_req, res) => {
    try {
      if (fs.existsSync(CSV_FILE)) {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="llistat_assistents_servidor.csv"');
        res.sendFile(CSV_FILE);
      } else {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="llistat_assistents_servidor.csv"');
        res.send(stateCache.csvText);
      }
    } catch (err: any) {
      res.status(500).send('Error descarregant fitxer CSV');
    }
  });

  // Download complete server state JSON
  app.get('/api/data/download-json', (_req, res) => {
    try {
      if (fs.existsSync(DATA_FILE)) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="dades_esdeveniment_servidor.json"');
        res.sendFile(DATA_FILE);
      } else {
        res.json(stateCache);
      }
    } catch (err: any) {
      res.status(500).send('Error descarregant fitxer JSON');
    }
  });

  // Server file info
  app.get('/api/server-info', (_req, res) => {
    try {
      const jsonStats = fs.existsSync(DATA_FILE) ? fs.statSync(DATA_FILE) : null;
      const csvStats = fs.existsSync(CSV_FILE) ? fs.statSync(CSV_FILE) : null;
      res.json({
        success: true,
        dataDir: DATA_DIR,
        dataFile: DATA_FILE,
        csvFile: CSV_FILE,
        jsonExists: Boolean(jsonStats),
        csvExists: Boolean(csvStats),
        jsonSizeBytes: jsonStats ? jsonStats.size : 0,
        csvSizeBytes: csvStats ? csvStats.size : (stateCache.csvText ? Buffer.byteLength(stateCache.csvText) : 0),
        lastModified: jsonStats ? jsonStats.mtime.toISOString() : stateCache.updatedAt,
      });
    } catch (e: any) {
      res.json({ success: false, error: e.message });
    }
  });

  // POST /api/reset-tables - Reset only table assignments back to default chronological tables
  app.post('/api/reset-tables', async (_req, res) => {
    try {
      console.log('[API POST /api/reset-tables] Restablint taules per defecte.');
      stateCache.tableAssignments = {};
      stateCache.updatedAt = new Date().toISOString();
      persistState();
      if (sql) {
        try {
          await sql`
            UPDATE event_state SET table_assignments = '{}'::jsonb, updated_at = NOW() WHERE id = 'default';
          `;
        } catch (dbErr) {
          console.warn('[API reset-tables] Error actualitzant Netlify DB:', dbErr);
        }
      }
      notifyAllClients({
        type: 'update',
        updatedAt: stateCache.updatedAt,
        data: stateCache,
      });
      res.json({
        success: true,
        data: stateCache,
        message: 'Assignacions de taules restablertes a l’ordre original correctament.',
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // POST /api/reset - Reset to initial attendees
  app.post('/api/reset', (_req, res) => {
    stateCache = {
      csvText: INITIAL_LUMA_CSV,
      updatedAt: new Date().toISOString(),
      manualOverrides: { ...DEFAULT_OVERRIDES },
      tableAssignments: {},
      spreadsheetId: null,
      spreadsheetUrl: null,
      lastSyncedAt: null,
    };
    persistState();
    notifyAllClients({
      type: 'update',
      updatedAt: stateCache.updatedAt,
      data: stateCache,
    });
    res.json({
      success: true,
      data: stateCache,
      message: 'Llista restaurada als comensals inicials.',
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
