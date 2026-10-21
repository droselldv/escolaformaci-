import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import { INITIAL_LUMA_CSV } from '../src/data/initialData';
import { getSupabase, sanitizeTableAssignments } from './_db';

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
let memoryState: any = {
  csvText: INITIAL_LUMA_CSV,
  updatedAt: new Date().toISOString(),
  manualOverrides: { ...DEFAULT_OVERRIDES },
  tableAssignments: {},
  tableNames: {},
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

  const supabase = getSupabase();

  if (req.method === 'GET') {
    try {
      if (supabase) {
        const { data: row, error } = await supabase
          .from('event_state')
          .select('*')
          .eq('id', 'default')
          .single();

        if (!error && row) {
          memoryState = {
            csvText: row.csv_text || memoryState.csvText,
            updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : memoryState.updatedAt,
            manualOverrides: row.manual_overrides || memoryState.manualOverrides,
            tableNames: (row.manual_overrides && row.manual_overrides['__table_names__']) || memoryState.tableNames || {},
            tableAssignments: sanitizeTableAssignments(row.table_assignments || memoryState.tableAssignments),
            spreadsheetId: row.spreadsheet_id || memoryState.spreadsheetId,
            spreadsheetUrl: row.spreadsheet_url || memoryState.spreadsheetUrl,
            lastSyncedAt: row.last_synced_at || memoryState.lastSyncedAt,
          };
        }
      }
    } catch {
      // Graceful fallback to memory/cache
    }

    return res.status(200).json({
      success: true,
      data: memoryState,
      db: supabase ? 'Supabase (HTTPS REST)' : 'Serverless cache',
    });
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { csvText, manualOverrides, tableAssignments, tableNames, spreadsheetId, spreadsheetUrl, lastSyncedAt } = body;

      if (csvText !== undefined) memoryState.csvText = csvText;
      if (manualOverrides !== undefined) memoryState.manualOverrides = manualOverrides;
      if (tableNames !== undefined) {
        memoryState.tableNames = tableNames;
        if (!memoryState.manualOverrides) memoryState.manualOverrides = {};
        memoryState.manualOverrides['__table_names__'] = tableNames;
      }
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

      let dbSaved = false;
      if (supabase) {
        try {
          const { error } = await supabase.from('event_state').upsert({
            id: 'default',
            csv_text: memoryState.csvText,
            manual_overrides: memoryState.manualOverrides,
            table_assignments: memoryState.tableAssignments,
            spreadsheet_id: memoryState.spreadsheetId,
            spreadsheet_url: memoryState.spreadsheetUrl,
            last_synced_at: memoryState.lastSyncedAt,
            updated_at: memoryState.updatedAt,
          });
          if (!error) {
            dbSaved = true;
          } else {
            console.error('[API POST /api/data] Supabase upsert error:', error.message);
          }
        } catch (dbErr) {
          console.error('[API POST /api/data] DB save error:', dbErr);
        }
      }

      return res.status(200).json({
        success: true,
        updatedAt: memoryState.updatedAt,
        db: supabase ? (dbSaved ? 'Supabase' : 'Serverless memory (DB fallback)') : 'Serverless cache',
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
