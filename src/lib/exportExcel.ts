import * as XLSX from 'xlsx';
import { EventAnalysis, ProcessedGuest, CustomExportOptions, AvailableColumnId, ALL_COLUMNS } from '../types';
import { sortGuests, formatFullNameSurnamesFirst } from './sorting';

export const DEFAULT_EXPORT_OPTIONS: CustomExportOptions = {
  columns: ['name', 'table', 'municipi', 'comarca'],
  sortBy: 'alpha_lastname',
  sortDirection: 'asc',
  groupByTables: false,
  includeNoLunchSheet: true,
  includeKitchenSummarySheet: true,
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

export function generateExcelWorkbook(
  analysis: EventAnalysis,
  options: CustomExportOptions = DEFAULT_EXPORT_OPTIONS
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Column headers based on user's selection (ensuring 'name' is first if included)
  const rawCols = options.columns.length > 0 ? options.columns : DEFAULT_EXPORT_OPTIONS.columns;
  const selectedCols: AvailableColumnId[] = rawCols.includes('name')
    ? (['name', ...rawCols.filter(c => c !== 'name')] as AvailableColumnId[])
    : rawCols;
  const colDefMap = new Map(ALL_COLUMNS.map(c => [c.id, c]));

  // 1. FULL 1: Assistents Dinar
  const sortedLunch = sortGuests(analysis.lunchGuests, options.sortBy, options.sortDirection);
  const sheet1Data: (string | number)[][] = [];

  // Header row
  const headers = selectedCols.map(id => colDefMap.get(id)?.label || id);
  sheet1Data.push(headers);

  if (options.groupByTables) {
    // Grouped by tables
    // Get unique tables in order
    const tableNumbers = Array.from(
      new Set(sortedLunch.map(g => g.tableNumber).filter((t): t is number => typeof t === 'number'))
    ).sort((a, b) => a - b);

    // If sorting was not table_seat, we still show table sections
    if (options.sortBy === 'table_seat') {
      tableNumbers.forEach(tNum => {
        const tableMembers = sortedLunch.filter(g => g.tableNumber === tNum);
        tableMembers.forEach(g => {
          sheet1Data.push(selectedCols.map(col => getGuestColumnValue(g, col)));
        });
      });
    } else {
      // Show sorted list with table indicators
      sortedLunch.forEach(g => {
        sheet1Data.push(selectedCols.map(col => getGuestColumnValue(g, col)));
      });
    }
  } else {
    // Continuous flat list (e.g. purely alphabetical for check-in desk)
    sortedLunch.forEach(g => {
      sheet1Data.push(selectedCols.map(col => getGuestColumnValue(g, col)));
    });
  }

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);

  // Auto column widths
  ws1['!cols'] = selectedCols.map(id => {
    switch (id) {
      case 'table': return { wch: 14 };
      case 'seat': return { wch: 10 };
      case 'name': return { wch: 30 };
      case 'first_name': return { wch: 18 };
      case 'last_name': return { wch: 24 };
      case 'dish': return { wch: 25 };
      case 'phone': return { wch: 16 };
      case 'email': return { wch: 32 };
      case 'comarca': return { wch: 20 };
      case 'municipi': return { wch: 24 };
      case 'created_at': return { wch: 22 };
      default: return { wch: 18 };
    }
  });

  const sheet1Title = options.groupByTables
    ? '1. Dinar (Per Taules)'
    : options.sortBy.startsWith('alpha')
    ? '1. Dinar (Ordre Alfabètic)'
    : '1. Assistents Dinar';

  XLSX.utils.book_append_sheet(wb, ws1, sheet1Title);

  // 2. FULL 2: Sense Dinar (opcional segons opcions)
  if (options.includeNoLunchSheet) {
    const sortedNoLunch = sortGuests(analysis.noLunchGuests, options.sortBy === 'table_seat' ? 'alpha_name' : options.sortBy, options.sortDirection);
    const noLunchCols: AvailableColumnId[] = selectedCols.filter(c => c !== 'table' && c !== 'seat');
    const sheet2Headers = ['Núm', ...noLunchCols.map(id => colDefMap.get(id)?.label || id)];
    const sheet2Data: (string | number)[][] = [sheet2Headers];

    sortedNoLunch.forEach((g, idx) => {
      const row = [idx + 1, ...noLunchCols.map(col => getGuestColumnValue(g, col))];
      sheet2Data.push(row);
    });

    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
    ws2['!cols'] = [{ wch: 8 }, ...noLunchCols.map(() => ({ wch: 24 }))];
    XLSX.utils.book_append_sheet(wb, ws2, '2. Sense Dinar');
  }

  // 3. FULL 3: Resum Plats & Cuina (opcional segons opcions)
  if (options.includeKitchenSummarySheet) {
    const sheet3Data: (string | number)[][] = [
      ['RESUM DE PLATS DEMANATS PER AL DINAR (TOTALS CUINA)'],
      ['Plat', 'Total Racions', '% sobre el total'],
    ];

    analysis.dishTotals.forEach(d => {
      sheet3Data.push([d.dish, d.count, `${d.percentage}%`]);
    });

    sheet3Data.push(['TOTAL COMENSALS DINAR', analysis.totalLunch, '100%']);
    sheet3Data.push([]);
    sheet3Data.push(['DESGLOSSAMENT PER TAULES (GRUPS DE 10)']);
    sheet3Data.push([
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

      sheet3Data.push([
        `Taula ${t.tableNumber}`,
        total,
        carn,
        peix,
        altres,
        guestNames,
      ]);
    });

    sheet3Data.push([]);
    sheet3Data.push(['ESTADÍSTIQUES GLOBALS DE L\'ESDEVENIMENT LUMA']);
    sheet3Data.push(['Total Inscrits Registrats', analysis.totalRegistered]);
    sheet3Data.push(['Total Assistents Dinar', analysis.totalLunch]);
    sheet3Data.push(['Total Assistents Sense Dinar', analysis.totalNoLunch]);
    sheet3Data.push(['Total Taules Necessàries (grups de 10)', analysis.totalTables]);

    const ws3 = XLSX.utils.aoa_to_sheet(sheet3Data);
    ws3['!cols'] = [
      { wch: 28 },
      { wch: 18 },
      { wch: 22 },
      { wch: 20 },
      { wch: 26 },
      { wch: 60 },
    ];
    XLSX.utils.book_append_sheet(wb, ws3, '3. Resum Plats i Cuina');
  }

  return wb;
}

export function downloadExcelFile(
  analysis: EventAnalysis,
  filename = 'Luma_Esdeveniment_Llistat.xlsx',
  options: CustomExportOptions = DEFAULT_EXPORT_OPTIONS
) {
  const wb = generateExcelWorkbook(analysis, options);
  XLSX.writeFile(wb, filename);
}
