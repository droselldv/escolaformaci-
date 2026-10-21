import { getSql } from './_db';
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
    const sql = getSql();
    if (sql) {
      await sql`
        INSERT INTO event_state (id, csv_text, manual_overrides, table_assignments, updated_at)
        VALUES (
          'default',
          ${INITIAL_LUMA_CSV},
          ${JSON.stringify(DEFAULT_OVERRIDES)},
          '{}'::jsonb,
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          csv_text = EXCLUDED.csv_text,
          manual_overrides = EXCLUDED.manual_overrides,
          table_assignments = EXCLUDED.table_assignments,
          updated_at = NOW();
      `;
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
