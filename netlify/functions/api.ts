import { neon } from '@neondatabase/serverless';
import { INITIAL_LUMA_CSV } from '../../src/data/initialData';

// Resolve connection string from Netlify Database / Neon environment variables
const DEFAULT_NETLIFY_DB_URL =
  'postgresql://netlifydb_owner:npg_AiNxyslK68CZ@ep-green-tree-b4epczig.c-6.us-east-2.db.netlify.com/netlifydb?sslmode=require';

function normalizeDatabaseUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return DEFAULT_NETLIFY_DB_URL;
  }
  let trimmed = rawUrl.trim().replace(/^['"]+|['"]+$/g, '');
  if (!trimmed) {
    return DEFAULT_NETLIFY_DB_URL;
  }
  // Complete valid postgres url
  if (trimmed.startsWith('postgresql://') || trimmed.startsWith('postgres://')) {
    if (!trimmed.includes('sslmode=')) {
      trimmed += (trimmed.includes('?') ? '&' : '?') + 'sslmode=require';
    }
    return trimmed;
  }
  // User or Netlify provided only host or host/db without scheme or credentials
  if (trimmed.includes('ep-green-tree-b4epczig.c-6.us-east-2.db.netlify.com')) {
    return DEFAULT_NETLIFY_DB_URL;
  }
  // User provided username:password@host/dbname without scheme
  if (trimmed.includes('@')) {
    let withScheme = `postgresql://${trimmed}`;
    if (!withScheme.includes('sslmode=')) {
      withScheme += (withScheme.includes('?') ? '&' : '?') + 'sslmode=require';
    }
    return withScheme;
  }
  return DEFAULT_NETLIFY_DB_URL;
}

const RAW_DB_URL =
  process.env.NETLIFY_DB_URL ||
  process.env.NETLIFY_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.PG_CONNECTION_STRING ||
  '';

const DB_URL = normalizeDatabaseUrl(RAW_DB_URL);

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
};

// Fallback in-memory state for when DB_URL is not set or during local development
let fallbackMemoryState: any = {
  csvText: INITIAL_LUMA_CSV,
  updatedAt: new Date().toISOString(),
  manualOverrides: { ...DEFAULT_OVERRIDES },
  tableAssignments: {},
  spreadsheetId: null,
  spreadsheetUrl: null,
  lastSyncedAt: null,
};

let tableInitialized = false;

async function getDb() {
  if (!DB_URL) return null;
  try {
    return neon(DB_URL);
  } catch (err) {
    console.warn('Neon connection fallback to default URL:', err);
    try {
      return neon(DEFAULT_NETLIFY_DB_URL);
    } catch {
      return null;
    }
  }
}

async function ensureTable(sql: any) {
  if (tableInitialized) return;
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
  tableInitialized = true;
}

export const handler = async (event: any, _context: any) => {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true }),
    };
  }

  // Determine path / action
  const path = event.path || '';
  const isDownloadCsv = path.endsWith('/download-csv');
  const isReset = path.endsWith('/reset');
  const isServerInfo = path.endsWith('/server-info') || path.endsWith('/health');

  try {
    const sql = await getDb();

    if (isServerInfo) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'ok',
          usingNetlifyDb: Boolean(sql),
          provider: sql ? 'Netlify Database (PostgreSQL / Neon)' : 'Server Memory / Disk',
          timestamp: new Date().toISOString(),
        }),
      };
    }

    if (isReset && event.httpMethod === 'POST') {
      const resetState = {
        csvText: INITIAL_LUMA_CSV,
        updatedAt: new Date().toISOString(),
        manualOverrides: { ...DEFAULT_OVERRIDES },
        tableAssignments: {},
        spreadsheetId: null,
        spreadsheetUrl: null,
        lastSyncedAt: null,
      };

      if (sql) {
        await ensureTable(sql);
        await sql`
          INSERT INTO event_state (id, csv_text, manual_overrides, table_assignments, updated_at)
          VALUES ('default', ${resetState.csvText}, ${JSON.stringify(resetState.manualOverrides)}, ${JSON.stringify(resetState.tableAssignments)}, NOW())
          ON CONFLICT (id) DO UPDATE SET
            csv_text = EXCLUDED.csv_text,
            manual_overrides = EXCLUDED.manual_overrides,
            table_assignments = EXCLUDED.table_assignments,
            updated_at = NOW();
        `;
      } else {
        fallbackMemoryState = resetState;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: resetState,
          message: 'Llista restaurada correctament.',
        }),
      };
    }

    // GET /api/data or GET /api/data/download-csv
    if (event.httpMethod === 'GET') {
      let state = fallbackMemoryState;

      if (sql) {
        await ensureTable(sql);
        const rows = await sql`SELECT * FROM event_state WHERE id = 'default' LIMIT 1;`;
        if (rows && rows.length > 0) {
          const row = rows[0];
          state = {
            csvText: row.csv_text || INITIAL_LUMA_CSV,
            updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
            manualOverrides: row.manual_overrides || DEFAULT_OVERRIDES,
            tableAssignments: row.table_assignments || {},
            spreadsheetId: row.spreadsheet_id || null,
            spreadsheetUrl: row.spreadsheet_url || null,
            lastSyncedAt: row.last_synced_at || null,
          };
        } else {
          // Initialize row in DB
          await sql`
            INSERT INTO event_state (id, csv_text, manual_overrides, table_assignments, updated_at)
            VALUES ('default', ${INITIAL_LUMA_CSV}, ${JSON.stringify(DEFAULT_OVERRIDES)}, '{}', NOW())
            ON CONFLICT (id) DO NOTHING;
          `;
          state = {
            csvText: INITIAL_LUMA_CSV,
            updatedAt: new Date().toISOString(),
            manualOverrides: DEFAULT_OVERRIDES,
            tableAssignments: {},
          };
        }
      }

      if (isDownloadCsv) {
        return {
          statusCode: 200,
          headers: {
            ...headers,
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="llistat_assistents_servidor.csv"',
          },
          body: state.csvText || INITIAL_LUMA_CSV,
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          source: sql ? 'Netlify Database (PostgreSQL)' : 'Server Cache',
          data: state,
        }),
      };
    }

    // POST /api/data
    if (event.httpMethod === 'POST') {
      const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : event.body || {};
      const { csvText, manualOverrides, tableAssignments, spreadsheetId, spreadsheetUrl, lastSyncedAt } = body;

      const now = new Date().toISOString();

      if (sql) {
        await ensureTable(sql);

        // Fetch current to merge
        const rows = await sql`SELECT * FROM event_state WHERE id = 'default' LIMIT 1;`;
        const current = rows[0] || {};

        const finalCsv = csvText !== undefined ? csvText : (current.csv_text || INITIAL_LUMA_CSV);
        const finalOverrides = manualOverrides !== undefined ? manualOverrides : (current.manual_overrides || DEFAULT_OVERRIDES);
        const finalTables = tableAssignments !== undefined ? tableAssignments : (current.table_assignments || {});
        const finalSpreadsheetId = spreadsheetId !== undefined ? spreadsheetId : (current.spreadsheet_id || null);
        const finalSpreadsheetUrl = spreadsheetUrl !== undefined ? spreadsheetUrl : (current.spreadsheet_url || null);
        const finalLastSynced = lastSyncedAt !== undefined ? lastSyncedAt : (current.last_synced_at || null);

        await sql`
          INSERT INTO event_state (id, csv_text, manual_overrides, table_assignments, spreadsheet_id, spreadsheet_url, last_synced_at, updated_at)
          VALUES (
            'default',
            ${finalCsv},
            ${JSON.stringify(finalOverrides)},
            ${JSON.stringify(finalTables)},
            ${finalSpreadsheetId},
            ${finalSpreadsheetUrl},
            ${finalLastSynced},
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
      } else {
        if (csvText !== undefined) fallbackMemoryState.csvText = csvText;
        if (manualOverrides !== undefined) fallbackMemoryState.manualOverrides = manualOverrides;
        if (tableAssignments !== undefined) fallbackMemoryState.tableAssignments = tableAssignments;
        if (spreadsheetId !== undefined) fallbackMemoryState.spreadsheetId = spreadsheetId;
        if (spreadsheetUrl !== undefined) fallbackMemoryState.spreadsheetUrl = spreadsheetUrl;
        if (lastSyncedAt !== undefined) fallbackMemoryState.lastSyncedAt = lastSyncedAt;
        fallbackMemoryState.updatedAt = now;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          updatedAt: now,
          source: sql ? 'Netlify Database (PostgreSQL)' : 'Server Cache',
          message: 'Dades desades correctament a la base de dades.',
        }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  } catch (error: any) {
    console.error('Netlify function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Error processant petició a Netlify Database',
      }),
    };
  }
};
