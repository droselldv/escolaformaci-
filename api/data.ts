import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import { INITIAL_LUMA_CSV } from '../src/data/initialData';

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

// Try loading from /tmp
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

  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      data: memoryState,
    });
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const { csvText, manualOverrides, tableAssignments, spreadsheetId, spreadsheetUrl, lastSyncedAt } = body;

      if (csvText !== undefined) memoryState.csvText = csvText;
      if (manualOverrides !== undefined) memoryState.manualOverrides = manualOverrides;
      if (tableAssignments !== undefined) memoryState.tableAssignments = tableAssignments;
      if (spreadsheetId !== undefined) memoryState.spreadsheetId = spreadsheetId;
      if (spreadsheetUrl !== undefined) memoryState.spreadsheetUrl = spreadsheetUrl;
      if (lastSyncedAt !== undefined) memoryState.lastSyncedAt = lastSyncedAt;

      memoryState.updatedAt = new Date().toISOString();

      try {
        fs.writeFileSync(TMP_FILE, JSON.stringify(memoryState, null, 2), 'utf-8');
      } catch {
        // memory state preserved
      }

      return res.status(200).json({
        success: true,
        updatedAt: memoryState.updatedAt,
        message: 'Dades desades correctament al servidor.',
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
