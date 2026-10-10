import { EventAnalysis, ProcessedGuest, CustomExportOptions, AvailableColumnId, ALL_COLUMNS } from '../types';
import { sortGuests, formatFullNameSurnamesFirst } from './sorting';
import { DEFAULT_EXPORT_OPTIONS } from './exportExcel';

export interface SyncResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  isNew: boolean;
  sheetsCreated: string[];
}

const SHEET_NAMES = {
  LUNCH: 'Assistents Dinar (Taules)',
  NO_LUNCH: 'Sense Dinar',
  SUMMARY: 'Resum Plats i Cuina',
};

function getGuestColumnValue(g: ProcessedGuest, col: AvailableColumnId): string | number {
  switch (col) {
    case 'table':
      return g.tableNumber ? `Taula ${g.tableNumber}` : '-';
    case 'seat':
      return g.seatNumber ?? '-';
    case 'name':
      return formatFullNameSurnamesFirst(g);
    case 'first_name':
      return g.first_name || g.name.split(' ')[0] || '';
    case 'last_name':
      return g.last_name || g.name.split(' ').slice(1).join(' ') || '';
    case 'dish':
      return g.cleanDish;
    case 'phone':
      return g.phone_number || '';
    case 'email':
      return g.email || '';
    case 'comarca':
      return g.comarca || '';
    case 'municipi':
      return g.municipi || '';
    case 'created_at':
      return g.created_at ? new Date(g.created_at).toLocaleString('ca-ES') : '';
    case 'ticket':
      return g.ticket_name || '';
    case 'status':
      return g.approval_status || '';
    default:
      return '';
  }
}

export async function createOrUpdateGoogleSheet(
  accessToken: string,
  existingSpreadsheetId: string | null,
  analysis: EventAnalysis,
  customTitle = 'Luma Event - Dinars, Taules i Plats',
  options: CustomExportOptions = DEFAULT_EXPORT_OPTIONS
): Promise<SyncResult> {
  let spreadsheetId = existingSpreadsheetId;
  let isNew = false;
  let spreadsheetUrl = '';

  const selectedCols = options.columns.length > 0 ? options.columns : DEFAULT_EXPORT_OPTIONS.columns;
  const colDefMap = new Map(ALL_COLUMNS.map(c => [c.id, c]));

  // 1. Prepare data for Sheet 1 (Assistents Dinar)
  const sortedLunch = sortGuests(analysis.lunchGuests, options.sortBy, options.sortDirection);
  const sheet1Headers = selectedCols.map(id => colDefMap.get(id)?.label || id);
  const sheet1Values: (string | number)[][] = [sheet1Headers];

  sortedLunch.forEach(g => {
    sheet1Values.push(selectedCols.map(col => getGuestColumnValue(g, col)));
  });

  // Sheet 2: Sense Dinar
  const noLunchCols = selectedCols.filter(c => c !== 'table' && c !== 'seat');
  const sheet2Headers = ['Núm', ...noLunchCols.map(id => colDefMap.get(id)?.label || id)];
  const sheet2Values: (string | number)[][] = [sheet2Headers];

  const sortedNoLunch = sortGuests(
    analysis.noLunchGuests,
    options.sortBy === 'table_seat' ? 'alpha_name' : options.sortBy,
    options.sortDirection
  );

  sortedNoLunch.forEach((g, idx) => {
    sheet2Values.push([idx + 1, ...noLunchCols.map(col => getGuestColumnValue(g, col))]);
  });

  // Sheet 3: Resum Plats & Cuina
  const sheet3Values: (string | number)[][] = [
    ['RESUM DE PLATS DEMANATS PER AL DINAR (TOTALS CUINA)', '', ''],
    ['Plat Escollit', 'Total Racions', '% sobre el Total'],
  ];

  analysis.dishTotals.forEach(d => {
    sheet3Values.push([d.dish, d.count, `${d.percentage}%`]);
  });

  sheet3Values.push(['TOTAL COMENSALS AL DINAR', analysis.totalLunch, '100%']);
  sheet3Values.push(['', '', '']);
  sheet3Values.push(['DESGLOSSAMENT PER TAULES (GRUPS DE 10 PERSONES)', '', '', '', '', '']);
  sheet3Values.push([
    'Taula',
    'Total Comensals',
    'Carn - Cap de llom',
    'Peix - Orada',
    'Altres / Sense especificar',
    'Llista de Comensals a la Taula',
  ]);

  analysis.tables.forEach(t => {
    const carn = t.dishCounts['Carn - Cap de llom'] || 0;
    const peix = t.dishCounts['Peix - Orada'] || 0;
    const total = t.guests.length;
    const altres = Math.max(0, total - (carn + peix));
    const guestNames = t.guests.map(g => `${g.name} (${g.cleanDish})`).join('; ');

    sheet3Values.push([
      `Taula ${t.tableNumber}`,
      total,
      carn,
      peix,
      altres,
      guestNames,
    ]);
  });

  sheet3Values.push(['', '', '', '', '', '']);
  sheet3Values.push(['ESTADÍSTIQUES GLOBALS DE L\'ESDEVENIMENT LUMA', '', '', '', '', '']);
  sheet3Values.push(['Total Inscrits Registrats', analysis.totalRegistered, '', '', '', '']);
  sheet3Values.push(['Total Assistents Dinar', analysis.totalLunch, '', '', '', '']);
  sheet3Values.push(['Total Assistents Sense Dinar', analysis.totalNoLunch, '', '', '', '']);
  sheet3Values.push(['Total Taules Necessàries (grups de 10)', analysis.totalTables, '', '', '', '']);

  // 2. If no existing spreadsheet, create one
  if (!spreadsheetId) {
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title: customTitle,
        },
        sheets: [
          { properties: { title: SHEET_NAMES.LUNCH } },
          { properties: { title: SHEET_NAMES.NO_LUNCH } },
          { properties: { title: SHEET_NAMES.SUMMARY } },
        ],
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(err.error?.message || "Error creant el Google Sheet a Google Drive");
    }

    const createdData = await createRes.json();
    spreadsheetId = createdData.spreadsheetId;
    spreadsheetUrl = createdData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    isNew = true;
  } else {
    // Check if the spreadsheet exists and verify tabs
    const getRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!getRes.ok) {
      // If not found or access denied, create a new one
      return createOrUpdateGoogleSheet(accessToken, null, analysis, customTitle, options);
    }

    const meta = await getRes.json();
    spreadsheetUrl = meta.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    const existingTitles = new Set(meta.sheets?.map((s: any) => s.properties?.title) || []);

    const requests: any[] = [];
    if (!existingTitles.has(SHEET_NAMES.LUNCH)) {
      requests.push({ addSheet: { properties: { title: SHEET_NAMES.LUNCH } } });
    }
    if (!existingTitles.has(SHEET_NAMES.NO_LUNCH)) {
      requests.push({ addSheet: { properties: { title: SHEET_NAMES.NO_LUNCH } } });
    }
    if (!existingTitles.has(SHEET_NAMES.SUMMARY)) {
      requests.push({ addSheet: { properties: { title: SHEET_NAMES.SUMMARY } } });
    }

    if (requests.length > 0) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      });
    }

    // Clear old contents
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ranges: [
          `'${SHEET_NAMES.LUNCH}'!A1:Z2500`,
          `'${SHEET_NAMES.NO_LUNCH}'!A1:Z2500`,
          `'${SHEET_NAMES.SUMMARY}'!A1:Z2500`,
        ],
      }),
    });
  }

  // 3. Write data to the 3 sheets using values:batchUpdate
  const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: [
        {
          range: `'${SHEET_NAMES.LUNCH}'!A1`,
          values: sheet1Values,
        },
        {
          range: `'${SHEET_NAMES.NO_LUNCH}'!A1`,
          values: sheet2Values,
        },
        {
          range: `'${SHEET_NAMES.SUMMARY}'!A1`,
          values: sheet3Values,
        },
      ],
    }),
  });

  if (!updateRes.ok) {
    const err = await updateRes.json();
    throw new Error(err.error?.message || "Error escrivint dades al Google Sheet");
  }

  // 4. Polish format (freeze header rows)
  try {
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const metaData = await metaRes.json();
    const sheetIds = metaData.sheets?.reduce((acc: Record<string, number>, s: any) => {
      acc[s.properties.title] = s.properties.sheetId;
      return acc;
    }, {}) || {};

    const formatRequests: any[] = [];

    if (sheetIds[SHEET_NAMES.LUNCH] !== undefined) {
      formatRequests.push({
        updateSheetProperties: {
          properties: {
            sheetId: sheetIds[SHEET_NAMES.LUNCH],
            gridProperties: { frozenRowCount: 1 },
          },
          fields: 'gridProperties.frozenRowCount',
        },
      });
    }

    if (sheetIds[SHEET_NAMES.NO_LUNCH] !== undefined) {
      formatRequests.push({
        updateSheetProperties: {
          properties: {
            sheetId: sheetIds[SHEET_NAMES.NO_LUNCH],
            gridProperties: { frozenRowCount: 1 },
          },
          fields: 'gridProperties.frozenRowCount',
        },
      });
    }

    if (formatRequests.length > 0) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests: formatRequests }),
      });
    }
  } catch (e) {
    console.warn('Optional formatting step skipped:', e);
  }

  return {
    spreadsheetId: spreadsheetId!,
    spreadsheetUrl,
    isNew,
    sheetsCreated: [SHEET_NAMES.LUNCH, SHEET_NAMES.NO_LUNCH, SHEET_NAMES.SUMMARY],
  };
}
