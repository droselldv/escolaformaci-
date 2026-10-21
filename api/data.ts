import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import { INITIAL_LUMA_CSV } from '../src/data/initialData';
import { getSql, sanitizeTableAssignments } from './_db';

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

// Global cache across serverless warm invocations
let memoryState = {
  csvText: INITIAL_LUMA_CSV,
  updatedAt: new Date().toISOString(),
  manualOverrides: { ...DEFAULT_OVERRIDES },
  tableAssignments: {},
  spreadsheetId: null,
  spreadsheetUrl: null,
  lastSyncedAt: null,
};

const TMP_FILE = path.resolve('/tmp', 'luma_event_data.json');

// Try loading from /tmp if available
try {
  if (fs.existsSync(TMP_FILE)) {
    const raw = fs.readFileSync(TMP_FILE, 'utf-8');
    memoryState = { ...memoryState, ...JSON.parse(raw) };
  }
} catch {
  // ignore
}

export default async function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const sql = getSql();

  if (req.method === 'GET') {
    try {
      if (sql) {
        const rows = await sql`SELECT * FROM event_state WHERE id = 'default' LIMIT 1;`;
        if (rows && rows.length > 0) {
          const row = rows[0];
          memoryState = {
            csvText: row.csv_text || memoryState.csvText,
            updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : memoryState.updatedAt,
            manualOverrides: row.manual_overrides || memoryState.manualOverrides,
            tableAssignments: sanitizeTableAssignments(row.table_assignments || memoryState.tableAssignments),
            spreadsheetId: row.spreadsheet_id || memoryState.spreadsheetId,
            spreadsheetUrl: row.spreadsheet_url || memoryState.spreadsheetUrl,
            lastSyncedAt: row.last_synced_at || memoryState.lastSyncedAt,
          };
        }
      }
    } catch (dbErr) {
      console.warn('[Vercel API GET /api/data] DB fetch warning:', dbErr);
    }

    return res.status(200).json({
      success: true,
      data: memoryState,
      db: sql ? 'Netlify Database (PostgreSQL)' : 'Serverless cache',
    });
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { csvText, manualOverrides, tableAssignments, spreadsheetId, spreadsheetUrl, lastSyncedAt } = body;

      if (csvText !== undefined) memoryState.csvText = csvText;
      if (manualOverrides !== undefined) memoryState.manualOverrides = manualOverrides;
      if (tableAssignments !== undefined) {
        memoryState.tableAssignments = sanitizeTableAssignments(tableAssignments);
      }
      if (spreadsheetId !== undefined) memoryState.spreadsheetId = spreadsheetId;
      if (spreadsheetUrl !== undefined) memoryState.spreadsheetUrl = spreadsheetUrl;
      if (lastSyncedAt !== undefined) memoryState.lastSyncedAt = lastSyncedAt;

      memoryState.updatedAt = new Date().toISOString();

      try {
        fs.writeFileSync(TMP_FILE, JSON.stringify(memoryState, null, 2), 'utf-8');
      } catch {
        // memory state preserved
      }

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
              ${memoryState.csvText},
              ${JSON.stringify(memoryState.manualOverrides)},
              ${JSON.stringify(memoryState.tableAssignments)},
              ${memoryState.spreadsheetId},
              ${memoryState.spreadsheetUrl},
              ${memoryState.lastSyncedAt},
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
        } catch (dbErr) {
          console.error('[Vercel API POST /api/data] DB save error:', dbErr);
        }
      }

      return res.status(200).json({
        success: true,
        updatedAt: memoryState.updatedAt,
        message: 'Dades desades correctament a la base de dades.',
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || 'Error processant la sol·licitud',
      });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
