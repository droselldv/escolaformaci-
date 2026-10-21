import { neon } from '@neondatabase/serverless';

export const DEFAULT_NETLIFY_DB_URL =
  'postgresql://netlifydb_owner:npg_AiNxyslK68CZ@ep-green-tree-b4epczig.c-6.us-east-2.db.netlify.com/netlifydb?sslmode=require';

export function getDatabaseUrl(): string {
  const raw =
    process.env.NETLIFY_DB_URL ||
    process.env.NETLIFY_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.PG_CONNECTION_STRING ||
    '';

  if (!raw || typeof raw !== 'string') {
    return DEFAULT_NETLIFY_DB_URL;
  }
  let trimmed = raw.trim().replace(/^['"]+|['"]+$/g, '');
  if (!trimmed) {
    return DEFAULT_NETLIFY_DB_URL;
  }
  if (!trimmed.includes('sslmode=')) {
    trimmed += (trimmed.includes('?') ? '&' : '?') + 'sslmode=require';
  }
  return trimmed;
}

export function getSql() {
  const url = getDatabaseUrl();
  try {
    return neon(url);
  } catch (err) {
    console.error('Error connectant a la base de dades:', err);
    try {
      return neon(DEFAULT_NETLIFY_DB_URL);
    } catch {
      return null;
    }
  }
}

export function sanitizeTableAssignments(raw: any): Record<string, { tableNumber: number | null; seatNumber?: number | null }> {
  if (!raw || typeof raw !== 'object') return {};
  const clean: Record<string, { tableNumber: number | null; seatNumber?: number | null }> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v && typeof v === 'object') {
      const a = v as any;
      if (a.tableNumber === null) {
        clean[k] = { tableNumber: null, seatNumber: null };
      } else if (typeof a.tableNumber === 'number' && a.tableNumber > 0 && a.tableNumber <= 30) {
        clean[k] = {
          tableNumber: Math.round(a.tableNumber),
          seatNumber: typeof a.seatNumber === 'number' && a.seatNumber > 0 ? Math.round(a.seatNumber) : null,
        };
      }
    }
  }
  return clean;
}
