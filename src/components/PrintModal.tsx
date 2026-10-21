import React, { useState } from 'react';
import { EventAnalysis, CustomExportOptions, AvailableColumnId } from '../types';
import { sortGuests, formatFullNameSurnamesFirst } from '../lib/sorting';
import { Printer, X, FileDown, Layers, ListOrdered, Users } from 'lucide-react';

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: EventAnalysis;
  options: CustomExportOptions;
}

function getPrintColumnHeader(colId: AvailableColumnId): string {
  switch (colId) {
    case 'name':
      return 'NOM';
    case 'table':
      return 'TAULA';
    case 'seat':
      return 'SEIENT';
    case 'dish':
      return 'PLAT';
    case 'municipi':
      return 'MUNICIPI';
    case 'comarca':
      return 'COMARCA';
    case 'phone':
      return 'TELÈFON';
    case 'email':
      return 'EMAIL';
    case 'ticket':
      return 'ENTRADA';
    case 'created_at':
      return 'DATA';
    default:
      return colId.toUpperCase();
  }
}

function getPrintColumnValue(
  g: any,
  colId: AvailableColumnId,
  sortBy?: string,
  tableNames?: Record<number, string>
): string {
  switch (colId) {
    case 'name': {
      if (sortBy === 'alpha_name') {
        const first = g.first_name || g.name.split(' ')[0] || '';
        const last = g.last_name || g.name.split(' ').slice(1).join(' ') || '';
        return `${first} ${last}`.trim() || g.name;
      }
      return formatFullNameSurnamesFirst(g);
    }
    case 'table': {
      if (!g.tableNumber) return 'Sense taula';
      const tName = tableNames?.[g.tableNumber];
      return tName ? `Taula ${g.tableNumber} (${tName})` : `Taula ${g.tableNumber}`;
    }
    case 'seat':
      return g.seatNumber ? `#${g.seatNumber}` : '-';
    case 'first_name':
      return g.first_name || g.name.split(' ')[0] || '-';
    case 'last_name':
      return g.last_name || g.name.split(' ').slice(1).join(' ') || '-';
    case 'dish':
      return g.cleanDish || '-';
    case 'phone':
      return g.phone_number || '-';
    case 'email':
      return g.email || '-';
    case 'municipi':
      return g.municipi || '-';
    case 'comarca':
      return g.comarca || '-';
    case 'created_at':
      return g.created_at ? new Date(g.created_at).toLocaleDateString('ca-ES') : '-';
    case 'ticket':
      return g.ticket_name || '-';
    case 'status':
      return g.approval_status || '-';
    default:
      return '-';
  }
}

export const PrintModal: React.FC<PrintModalProps> = ({
  isOpen,
  onClose,
  analysis,
  options,
}) => {
  if (!isOpen) return null;

  // Print section: 'all' (both on separate sheets), 'lunch' (only lunch), 'no_lunch' (only no lunch)
  const [printScope, setPrintScope] = useState<'all' | 'lunch' | 'no_lunch'>('all');
  const [groupByTables, setGroupByTables] = useState<boolean>(options.groupByTables);
  const [isExtraLargeText, setIsExtraLargeText] = useState<boolean>(false);

  // Sorting
  const sortedLunch = sortGuests(analysis.lunchGuests, options.sortBy, options.sortDirection);
  const sortedNoLunch = sortGuests(
    analysis.noLunchGuests,
    options.sortBy === 'table_seat' ? 'alpha_name' : options.sortBy,
    options.sortDirection
  );

  // Columns for lunch: guarantee 'name' is first
  const baseCols: AvailableColumnId[] =
    options.columns.length > 0 ? options.columns : ['name', 'table', 'municipi', 'comarca'];
  const activeCols: AvailableColumnId[] = baseCols.includes('name')
    ? (['name', ...baseCols.filter(c => c !== 'name')] as AvailableColumnId[])
    : (['name', ...baseCols] as AvailableColumnId[]);

  // Columns for no lunch: exclude table and seat
  const noLunchCols = activeCols.filter(c => c !== 'table' && c !== 'seat');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs print-modal-backdrop">
      <div className="bg-white rounded-xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[96vh] text-xs print-modal-wrapper">
        {/* Modal Controls Header (Hidden in Print) */}
        <div className="px-3.5 sm:px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 print:hidden">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Vista Prèvia d'Impressió / Guardar PDF</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Capçaleres netes · Ordre {options.sortBy === 'alpha_name' ? 'Nom + Cognoms' : 'Cognoms, Nom'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="sm:hidden p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition cursor-pointer"
              aria-label="Tancar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Scope Filter: Tots / Dinar / Sense Dinar */}
            <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg text-[11px] flex-1 sm:flex-none justify-center">
              <button
                type="button"
                onClick={() => setPrintScope('all')}
                className={`px-2.5 py-1.5 rounded-md font-medium transition cursor-pointer ${
                  printScope === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Imprimir comensals de dinar i en un full separat els que no es queden"
              >
                Tots ({analysis.totalRegistered})
              </button>
              <button
                type="button"
                onClick={() => setPrintScope('lunch')}
                className={`px-2.5 py-1.5 rounded-md font-medium transition cursor-pointer ${
                  printScope === 'lunch'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Només comensals de dinar"
              >
                Dinar ({analysis.totalLunch})
              </button>
              <button
                type="button"
                onClick={() => setPrintScope('no_lunch')}
                className={`px-2.5 py-1.5 rounded-md font-medium transition cursor-pointer ${
                  printScope === 'no_lunch'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Només assistents que no es queden a dinar"
              >
                Sense Dinar ({analysis.totalNoLunch})
              </button>
            </div>

            {/* Quick Layout Mode Switcher (only for lunch) */}
            {printScope !== 'no_lunch' && (
              <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg text-[11px] flex-1 sm:flex-none justify-center">
                <button
                  type="button"
                  onClick={() => setGroupByTables(false)}
                  className={`px-2.5 py-1.5 rounded-md font-medium transition cursor-pointer flex items-center justify-center gap-1 ${
                    !groupByTables
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Llistat continu alfabètic"
                >
                  <ListOrdered className="w-3 h-3" />
                  <span>Continu</span>
                </button>

                <button
                  type="button"
                  onClick={() => setGroupByTables(true)}
                  className={`px-2.5 py-1.5 rounded-md font-medium transition cursor-pointer flex items-center justify-center gap-1 ${
                    groupByTables
                      ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Agrupat per taules de 10"
                >
                  <Layers className="w-3 h-3" />
                  <span>Taules</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsExtraLargeText(!isExtraLargeText)}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition cursor-pointer ${
                isExtraLargeText
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="Canviar mida de la font"
            >
              {isExtraLargeText ? 'Text: XL' : 'Text: Normal'}
            </button>

            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-none px-4 py-2 sm:py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm min-h-[38px] sm:min-h-0"
              title="Obre el diàleg d'impressió del navegador (Tria 'Guardar com a PDF' com a impressora)"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Desar PDF / Imprimir</span>
            </button>

            <button
              onClick={onClose}
              className="hidden sm:block p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Paper Container (On screen preview) */}
        <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-200/50 flex justify-center print-modal-scroll">
          {/* Dedicated Printable Document Container (Completely stripped of unnecessary headers) */}
          <div
            id="luma-print-document"
            className="bg-white w-full max-w-[210mm] p-4 sm:p-6 shadow-sm rounded border border-slate-300 print-document-root"
          >
            {/* SECTION 1: LUNCH GUESTS */}
            {(printScope === 'all' || printScope === 'lunch') && (
              <div>
                {groupByTables ? (
                  /* Grouped by Tables of 10 */
                  <div className="space-y-4">
                    {analysis.tables.map(table => (
                      <div
                        key={table.tableNumber}
                        className="border border-slate-400 rounded-md overflow-hidden print-table-group-card mb-4"
                      >
                        <div className="bg-slate-100 px-3.5 py-1.5 font-bold text-sm sm:text-base flex justify-between items-center border-b border-slate-300 text-slate-900">
                          <span>
                            Taula {table.tableNumber}
                            {table.tableName ? ` — ${table.tableName}` : ''}{' '}
                            <span className="font-normal text-xs text-slate-600">
                              ({table.guests.length} / {table.capacity} comensals)
                            </span>
                          </span>
                        </div>

                        <table className={`print-table w-full text-left ${isExtraLargeText ? 'text-base' : 'text-sm'}`}>
                          <thead>
                            <tr className="border-b-2 border-slate-900 bg-slate-50 font-bold text-slate-800 uppercase tracking-wider text-xs">
                              {activeCols.map(colId => (
                                <th key={colId} className="py-2 px-3">
                                  {getPrintColumnHeader(colId)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {table.guests.map(g => (
                              <tr key={g.guest_id} className="hover:bg-slate-50/50">
                                {activeCols.map(colId => (
                                  <td
                                    key={colId}
                                    className={`py-2 px-3 ${
                                      colId === 'name'
                                        ? 'font-bold text-slate-950 text-sm sm:text-base'
                                        : 'text-slate-800'
                                    }`}
                                  >
                                    {getPrintColumnValue(g, colId, options.sortBy, analysis.tableNames)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}

                    {/* Unassigned Guests Table if any */}
                    {analysis.unassignedGuests.length > 0 && (
                      <div className="border border-amber-300 rounded-md overflow-hidden print-table-group-card mb-4">
                        <div className="bg-amber-50 px-3.5 py-1.5 font-bold text-sm sm:text-base flex justify-between items-center border-b border-amber-200 text-slate-900">
                          <span>Sense Taula Assignada ({analysis.unassignedGuests.length} comensals)</span>
                        </div>

                        <table className={`print-table w-full text-left ${isExtraLargeText ? 'text-base' : 'text-sm'}`}>
                          <thead>
                            <tr className="border-b-2 border-slate-900 bg-slate-50 font-bold text-slate-800 uppercase tracking-wider text-xs">
                              {activeCols.map(colId => (
                                <th key={colId} className="py-2 px-3">
                                  {getPrintColumnHeader(colId)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {analysis.unassignedGuests.map(g => (
                              <tr key={g.guest_id} className="hover:bg-slate-50/50">
                                {activeCols.map(colId => (
                                  <td
                                    key={colId}
                                    className={`py-2 px-3 ${
                                      colId === 'name'
                                        ? 'font-bold text-slate-950 text-sm sm:text-base'
                                        : 'text-slate-800'
                                    }`}
                                  >
                                    {getPrintColumnValue(g, colId, options.sortBy, analysis.tableNames)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Continuous Flat Table */
                  <div className="border border-slate-300 rounded-md overflow-hidden">
                    <table className={`print-table w-full text-left border-collapse ${isExtraLargeText ? 'text-base' : 'text-sm'}`}>
                      <thead>
                        <tr className="border-b-2 border-slate-900 bg-slate-100 font-bold uppercase tracking-wider text-slate-900 text-xs">
                          {activeCols.map(colId => (
                            <th key={colId} className="py-2 px-3">
                              {getPrintColumnHeader(colId)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {sortedLunch.map((g, idx) => (
                          <tr
                            key={g.guest_id}
                            className={idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}
                          >
                            {activeCols.map(colId => (
                              <td
                                key={colId}
                                className={`py-2 px-3 ${
                                  colId === 'name'
                                    ? 'font-bold text-slate-950 text-sm sm:text-base'
                                    : 'text-slate-800'
                                }`}
                              >
                                {getPrintColumnValue(g, colId, options.sortBy, analysis.tableNames)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* SECTION 2: NO LUNCH GUESTS (Printed on a separate sheet/page when both are selected) */}
            {(printScope === 'all' || printScope === 'no_lunch') && (
              <div
                className={printScope === 'all' ? 'print-page-break pt-4 mt-6' : ''}
                style={printScope === 'all' ? { pageBreakBefore: 'always', breakBefore: 'page' } : {}}
              >
                <div className="mb-2.5 font-bold text-sm uppercase text-slate-900 border-b-2 border-slate-900 pb-1 flex justify-between items-center">
                  <span>Sense Dinar ({sortedNoLunch.length} persones)</span>
                </div>

                <div className="border border-slate-300 rounded-md overflow-hidden">
                  <table className={`print-table w-full text-left border-collapse ${isExtraLargeText ? 'text-base' : 'text-sm'}`}>
                    <thead>
                      <tr className="border-b-2 border-slate-900 bg-slate-100 font-bold uppercase tracking-wider text-slate-900 text-xs">
                        {noLunchCols.map(colId => (
                          <th key={colId} className="py-2 px-3">
                            {getPrintColumnHeader(colId)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {sortedNoLunch.map((g, idx) => (
                        <tr
                          key={g.guest_id}
                          className={idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}
                        >
                          {noLunchCols.map(colId => (
                            <td
                              key={colId}
                              className={`py-2 px-3 ${
                                colId === 'name'
                                  ? 'font-bold text-slate-950 text-sm sm:text-base'
                                  : 'text-slate-800'
                              }`}
                            >
                              {getPrintColumnValue(g, colId, options.sortBy, analysis.tableNames)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Footer (Hidden in Print) */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between print:hidden text-xs text-slate-600">
          <span>Tria l'opció <strong>"Desar com a PDF"</strong> com a impressora per descarregar el document.</span>
          <button
            onClick={handlePrint}
            className="px-4 py-2 font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
