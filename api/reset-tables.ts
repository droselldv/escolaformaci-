import { getSupabase } from './_db';
import { INITIAL_TABLE_ASSIGNMENTS } from '../src/data/initialData';

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
      await supabase
        .from('event_state')
        .update({
          table_assignments: INITIAL_TABLE_ASSIGNMENTS,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 'default');
    }

    return res.status(200).json({
      success: true,
      message: 'Assignacions de taules restablertes correctament a la base de dades.',
    });
  } catch (err: any) {
    console.error('[API /api/reset-tables] Error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Error restablint les taules',
    });
  }
}
