import React, { useState } from 'react';
import { EventAnalysis, CustomExportOptions, ALL_COLUMNS, AvailableColumnId } from '../types';
import { sortGuests, formatFullNameSurnamesFirst } from '../lib/sorting';
import { Printer, X, FileDown, Layers, ListOrdered } from 'lucide-react';

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: EventAnalysis;
  options: CustomExportOptions;
}

function getPrintColumnValue(g: any, colId: AvailableColumnId): string {
  switch (colId) {
    case 'name':
      return formatFullNameSurnamesFirst(g);
    case 'table':
      return g.tableNumber ? `Taula ${g.tableNumber}` : '-';
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

  // Local toggle inside print preview so user can test both modes immediately
  const [groupByTables, setGroupByTables] = useState<boolean>(options.groupByTables);
  const [isExtraLargeText, setIsExtraLargeText] = useState<boolean>(false);

  // Sorting
  const sortedLunch = sortGuests(analysis.lunchGuests, options.sortBy, options.sortDirection);
  const colDefMap = new Map(ALL_COLUMNS.map(c => [c.id, c]));

  // ALWAYS guarantee 'name' (Nom complet: Cognoms, Nom) is the VERY FIRST column
  const baseCols: AvailableColumnId[] =
    options.columns.length > 0 ? options.columns : ['name', 'table', 'municipi', 'comarca'];
  const activeCols: AvailableColumnId[] = baseCols.includes('name')
    ? (['name', ...baseCols.filter(c => c !== 'name')] as AvailableColumnId[])
    : (['name', ...baseCols] as AvailableColumnId[]);

  const handlePrint = () => {
    window.print();
  };

  const carnCount = analysis.dishTotals.find(d => d.dish.includes('Carn'))?.count || 0;
  const peixCount = analysis.dishTotals.find(d => d.dish.includes('Peix'))?.count || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs print-modal-backdrop">
      <div className="bg-white rounded-xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[96vh] text-xs print-modal-wrapper">
        {/* Modal Controls Header (Hidden in Print) */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Vista Prèvia d'Impressió / Guardar PDF</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              1a columna: <strong>Nom complet (Cognoms, Nom)</strong> · Sense ID ni caselles de verificació
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Quick Layout Mode Switcher */}
            <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg text-[11px]">
              <button
                type="button"
                onClick={() => setGroupByTables(false)}
                className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1 ${
                  !groupByTables
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Llistat continu alfabètic"
              >
                <ListOrdered className="w-3 h-3" />
                <span>Continu Alfabètic</span>
              </button>

              <button
                type="button"
                onClick={() => setGroupByTables(true)}
                className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1 ${
                  groupByTables
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Agrupat per taules de 10"
              >
                <Layers className="w-3 h-3" />
                <span>Taules de 10</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsExtraLargeText(!isExtraLargeText)}
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition cursor-pointer ${
                isExtraLargeText
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="Augmentar encara més la mida de la font per llegir de lluny"
            >
              {isExtraLargeText ? 'Text: Extra Gran' : 'Text: Gran'}
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm ml-1"
              title="Obre el diàleg d'impressió del navegador (Tria 'Guardar como PDF' com a impressora)"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Desar com a PDF / Imprimir</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Paper Container (On screen preview) */}
        <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-200/50 flex justify-center print-modal-scroll">
          {/* Dedicated Printable Document Container */}
          <div
            id="luma-print-document"
            className="bg-white w-full max-w-[210mm] p-6 sm:p-10 shadow-sm rounded border border-slate-300 print-document-root"
          >
            {/* Header Document */}
            <div className="border-b-2 border-slate-900 pb-4 mb-6 flex flex-wrap justify-between items-end gap-4 print-doc-header">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 uppercase">
                  Llistat d'Assistència — Dinars i Taules
                </h1>
                <p className="text-sm font-medium text-slate-700 mt-1">
                  Esdeveniment Luma · <strong className="text-slate-900">{analysis.totalLunch} comensals</strong> · {analysis.totalTables} taules de 10
                </p>
              </div>

              <div className="text-right text-xs text-slate-700 space-y-1">
                <p className="font-semibold text-slate-900">
                  Cap de llom (Carn): <span className="underline">{carnCount}</span> · Orada (Peix): <span className="underline">{peixCount}</span>
                </p>
                <p className="text-slate-500 font-medium">
                  {groupByTables
                    ? 'Format: Taules de 10 persones'
                    : options.sortBy === 'alpha_lastname'
                    ? 'Ordre: Alfabètic per cognoms (A-Z)'
                    : options.sortBy === 'alpha_name'
                    ? 'Ordre: Alfabètic per nom'
                    : 'Ordre: Per taula i registre'}
                </p>
              </div>
            </div>

            {/* Document Table (NO # ID column, NO Checkbox column) */}
            {groupByTables ? (
              /* Grouped by Tables of 10 */
              <div className="space-y-6">
                {analysis.tables.map(table => {
                  const tableCarn = table.dishCounts['Carn - Cap de llom'] || 0;
                  const tablePeix = table.dishCounts['Peix - Orada'] || 0;

                  return (
                    <div
                      key={table.tableNumber}
                      className="border border-slate-400 rounded-md overflow-hidden print-table-group-card mb-5"
                    >
                      <div className="bg-slate-100 px-4 py-2 font-bold text-sm sm:text-base flex justify-between items-center border-b border-slate-300 text-slate-900">
                        <span>Taula {table.tableNumber} ({table.guests.length} / 10 comensals)</span>
                        <span className="text-xs font-semibold text-slate-700">
                          Carn: {tableCarn} · Peix: {tablePeix}
                        </span>
                      </div>

                      <table className={`print-table w-full text-left ${isExtraLargeText ? 'text-base' : 'text-sm'}`}>
                        <thead>
                          <tr className="border-b-2 border-slate-900 bg-slate-50 font-bold text-slate-800 uppercase tracking-wider text-xs">
                            {activeCols.map(colId => (
                              <th key={colId} className="py-2.5 px-3.5">
                                {colDefMap.get(colId)?.label || colId}
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
                                  className={`py-2 px-3.5 ${
                                    colId === 'name'
                                      ? 'font-bold text-slate-950 text-sm sm:text-base'
                                      : 'text-slate-800'
                                  }`}
                                >
                                  {getPrintColumnValue(g, colId)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Continuous Flat Table (Paginated naturally across pages 2, 3...) */
              <div className="border border-slate-300 rounded-md overflow-hidden">
                <table className={`print-table w-full text-left border-collapse ${isExtraLargeText ? 'text-base' : 'text-sm'}`}>
                  <thead>
                    <tr className="border-b-2 border-slate-900 bg-slate-100 font-bold uppercase tracking-wider text-slate-900 text-xs">
                      {activeCols.map(colId => (
                        <th key={colId} className="py-2.5 px-3.5">
                          {colDefMap.get(colId)?.label || colId}
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
                            className={`py-2.5 px-3.5 ${
                              colId === 'name'
                                ? 'font-bold text-slate-950 text-sm sm:text-base'
                                : 'text-slate-800'
                            }`}
                          >
                            {getPrintColumnValue(g, colId)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Document Footer */}
            <div className="mt-8 pt-4 border-t-2 border-slate-200 flex justify-between items-center text-xs text-slate-600 print-doc-footer">
              <span className="font-medium">Luma Dinars · Document oficial d'assistència</span>
              <span className="font-semibold text-slate-900">Total comensals registrats: {analysis.totalLunch}</span>
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer (Hidden in Print) */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between print:hidden text-xs text-slate-600">
          <span>Consell: al menú d'impressió del navegador, tria l'opció <strong>"Desar com a PDF"</strong> per generar un fitxer PDF d'alta qualitat.</span>
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
