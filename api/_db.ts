import postgres from 'postgres';

export const DEFAULT_SUPABASE_URL =
  'postgresql://postgres:Maxipichet2005!@db.cunpmmsjenlytbfflbra.supabase.co:5432/postgres';

export function getDatabaseUrl(): string {
  const raw =
    process.env.SUPABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NETLIFY_DB_URL ||
    process.env.PG_CONNECTION_STRING ||
    '';

  if (!raw || typeof raw !== 'string') {
    return DEFAULT_SUPABASE_URL;
  }
  let trimmed = raw.trim().replace(/^['"]+|['"]+$/g, '');
  if (!trimmed) {
    return DEFAULT_SUPABASE_URL;
  }
  return trimmed;
}

let cachedSql: any = null;

export function getSql() {
  if (cachedSql) return cachedSql;
  const url = getDatabaseUrl();
  try {
    cachedSql = postgres(url, {
      ssl: 'require',
      max: 1, // optimal for serverless lambdas
      idle_timeout: 20,
      connect_timeout: 10,
    });
    return cachedSql;
  } catch (err) {
    console.error('Error connectant a Supabase:', err);
    try {
      cachedSql = postgres(DEFAULT_SUPABASE_URL, {
        ssl: 'require',
        max: 1,
        idle_timeout: 20,
        connect_timeout: 10,
      });
      return cachedSql;
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
