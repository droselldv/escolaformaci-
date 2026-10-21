import { createClient } from '@supabase/supabase-js';

const SUPABASE_REST_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://cunpmmsjenlytbfflbra.supabase.co';

const SUPABASE_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  'sb_publishable_XfVoRU7LafoZ8FqDKaB4sQ_mkekqazf';

let cachedSupabase: any = null;

export function getSupabase() {
  if (cachedSupabase) return cachedSupabase;
  try {
    cachedSupabase = createClient(SUPABASE_REST_URL, SUPABASE_KEY);
    return cachedSupabase;
  } catch (err) {
    console.error('Error inicialitzant Supabase client a API:', err);
    return null;
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
