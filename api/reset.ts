import { getSupabase } from './_db';
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

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.from('event_state').upsert({
        id: 'default',
        csv_text: INITIAL_LUMA_CSV,
        manual_overrides: DEFAULT_OVERRIDES,
        table_assignments: {},
        updated_at: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Base de dades restablerta a l’estat inicial.',
    });
  } catch (err: any) {
    console.error('[API /api/reset] Error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Error restablint les dades',
    });
  }
}
