import React from 'react';
import { EventAnalysis, CustomExportOptions, ALL_COLUMNS, AvailableColumnId } from '../types';
import { sortGuests } from '../lib/sorting';
import { Printer, X, FileDown } from 'lucide-react';

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: EventAnalysis;
  options: CustomExportOptions;
}

function getPrintColumnValue(g: any, colId: AvailableColumnId): string {
  switch (colId) {
    case 'table':
      return g.tableNumber ? `Taula ${g.tableNumber}` : '-';
    case 'seat':
      return g.seatNumber ? `#${g.seatNumber}` : '-';
    case 'name':
      return g.name || '-';
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

  const sortedLunch = sortGuests(analysis.lunchGuests, options.sortBy, options.sortDirection);
  const colDefMap = new Map(ALL_COLUMNS.map(c => [c.id, c]));
  const activeCols: AvailableColumnId[] =
    options.columns.length > 0 ? options.columns : ['table', 'name', 'municipi', 'comarca'];

  const handlePrint = () => {
    window.print();
  };

  const carnCount = analysis.dishTotals.find(d => d.dish.includes('Carn'))?.count || 0;
  const peixCount = analysis.dishTotals.find(d => d.dish.includes('Peix'))?.count || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] text-xs">
        {/* Modal Controls Header (Hidden in Print) */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between print:hidden">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Vista Prèvia per a PDF / Impressió</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {options.groupByTables ? 'Agrupat per taules de 10' : 'Llistat continu alfabètic'} · {activeCols.length} columnes seleccionades
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Obre el diàleg d'impressió del navegador (pots triar 'Guardar como PDF')"
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
        <div className="p-6 sm:p-10 overflow-y-auto flex-1 bg-slate-100/60 flex justify-center">
          {/* Dedicated Printable Document Container */}
          <div
            id="luma-print-document"
            className="bg-white w-full max-w-[210mm] p-8 sm:p-12 shadow-sm rounded border border-slate-200 print:border-none print:shadow-none print:p-0 print:w-full"
          >
            {/* Header Document */}
            <div className="border-b-2 border-slate-900 pb-4 mb-6 flex flex-wrap justify-between items-end gap-4">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
                  Llistat d'Assistència — Dinars i Taules
                </h1>
                <p className="text-xs text-slate-600 mt-1">
                  Esdeveniment Luma · <strong>{analysis.totalLunch} comensals</strong> · {analysis.totalTables} taules de 10
                </p>
              </div>

              <div className="text-right text-[11px] text-slate-600 space-y-0.5">
                <p>
                  Cap de llom (Carn): <strong>{carnCount}</strong> · Orada (Peix): <strong>{peixCount}</strong>
                </p>
                <p className="text-slate-400">
                  Ordre: {options.sortBy === 'alpha_lastname' ? 'Alfabètic per cognom' : options.sortBy === 'alpha_name' ? 'Alfabètic per nom' : 'Per taula'}
                </p>
              </div>
            </div>

            {/* Document Table (NO # ID column, NO Checkbox column) */}
            {options.groupByTables ? (
              /* Grouped by Tables */
              <div className="space-y-6">
                {analysis.tables.map(table => {
                  const tableCarn = table.dishCounts['Carn - Cap de llom'] || 0;
                  const tablePeix = table.dishCounts['Peix - Orada'] || 0;

                  return (
                    <div
                      key={table.tableNumber}
                      className="border border-slate-300 rounded overflow-hidden break-inside-avoid mb-4"
                    >
                      <div className="bg-slate-100 px-3.5 py-1.5 font-bold text-xs flex justify-between items-center border-b border-slate-300 text-slate-900">
                        <span>Taula {table.tableNumber} ({table.guests.length} / 10 comensals)</span>
                        <span className="text-[11px] font-normal text-slate-600">
                          Carn: {tableCarn} · Peix: {tablePeix}
                        </span>
                      </div>

                      <table className="print-table w-full text-left text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600 uppercase text-[9px] tracking-wider">
                            {activeCols.map(colId => (
                              <th key={colId} className="py-1.5 px-3">
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
                                  className={`py-1.5 px-3 ${
                                    colId === 'name' ? 'font-semibold text-slate-900' : 'text-slate-700'
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
              /* Continuous Flat Table */
              <div className="border border-slate-300 rounded overflow-hidden">
                <table className="print-table w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-300 bg-slate-100 font-bold uppercase text-[9px] tracking-wider text-slate-700">
                      {activeCols.map(colId => (
                        <th key={colId} className="py-2 px-3">
                          {colDefMap.get(colId)?.label || colId}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {sortedLunch.map((g, idx) => (
                      <tr
                        key={g.guest_id}
                        className={idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}
                      >
                        {activeCols.map(colId => (
                          <td
                            key={colId}
                            className={`py-1.5 px-3 ${
                              colId === 'name' ? 'font-semibold text-slate-900' : 'text-slate-700'
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
            <div className="mt-6 pt-3 border-t border-slate-200 flex justify-between items-center text-[10px] text-slate-400">
              <span>Luma Dinars · Document oficial d'assistència</span>
              <span>Total comensals registrats: {analysis.totalLunch}</span>
            </div>
          </div>
        </div>

        {/* Modal Bottom Footer (Hidden in Print) */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between print:hidden text-xs text-slate-500">
          <span>Consell: al menú d'impressió del navegador, selecciona <strong>"Desar com a PDF"</strong> com a destí per descarregar el fitxer PDF.</span>
          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 font-medium text-white bg-slate-900 hover:bg-slate-800 rounded transition flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
