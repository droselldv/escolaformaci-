import React from 'react';
import { EventAnalysis, CustomExportOptions } from '../types';
import { sortGuests } from '../lib/sorting';
import { Printer, X } from 'lucide-react';

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysis: EventAnalysis;
  options: CustomExportOptions;
}

export const PrintModal: React.FC<PrintModalProps> = ({
  isOpen,
  onClose,
  analysis,
  options,
}) => {
  if (!isOpen) return null;

  const sortedLunch = sortGuests(analysis.lunchGuests, options.sortBy, options.sortDirection);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-lg max-w-4xl w-full shadow-lg border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] text-xs">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between print:hidden">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Vista d'Impressió / Check-in</h3>
            <p className="text-[11px] text-slate-500">
              {options.groupByTables
                ? `Agrupat per ${analysis.totalTables} taules de 10 comensals`
                : `Ordre ${options.sortBy === 'alpha_name' ? 'Alfabètic per nom' : options.sortBy}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / Guardar PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-200/50 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Paper Area */}
        <div className="p-8 overflow-y-auto flex-1 font-sans text-slate-900 bg-white print:p-0 print:overflow-visible">
          {/* Document Title Header */}
          <div className="border-b-2 border-slate-900 pb-3 mb-6 flex justify-between items-end">
            <div>
              <h1 className="text-lg font-bold uppercase tracking-tight text-slate-900">
                Llistat d'Assistència — Dinars i Taules
              </h1>
              <p className="text-xs text-slate-600">
                Esdeveniment Luma · {analysis.totalLunch} comensals · {analysis.totalTables} taules de 10
              </p>
            </div>
            <div className="text-right text-[11px] text-slate-600">
              <p>Cap de llom (Carn): <strong>{analysis.dishTotals.find(d => d.dish.includes('Carn'))?.count || 0}</strong></p>
              <p>Orada (Peix): <strong>{analysis.dishTotals.find(d => d.dish.includes('Peix'))?.count || 0}</strong></p>
            </div>
          </div>

          {/* Table / List */}
          {options.groupByTables ? (
            <div className="space-y-5">
              {analysis.tables.map(table => {
                const carn = table.dishCounts['Carn - Cap de llom'] || 0;
                const peix = table.dishCounts['Peix - Orada'] || 0;

                return (
                  <div key={table.tableNumber} className="border border-slate-300 rounded overflow-hidden break-inside-avoid text-xs">
                    <div className="bg-slate-100 px-3 py-1.5 font-semibold flex justify-between items-center border-b border-slate-300">
                      <span>Taula {table.tableNumber} ({table.guests.length}/10 assistents)</span>
                      <span className="text-[11px] font-normal text-slate-600">
                        Carn: {carn} · Peix: {peix}
                      </span>
                    </div>
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 uppercase text-[9px] bg-slate-50">
                          <th className="py-1 px-3 w-8">#</th>
                          <th className="py-1 px-3 w-8">Check</th>
                          <th className="py-1 px-3">Nom i Cognoms</th>
                          <th className="py-1 px-3">Plat</th>
                          <th className="py-1 px-3">Telèfon</th>
                          <th className="py-1 px-3">Municipi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {table.guests.map((g, idx) => (
                          <tr key={g.guest_id}>
                            <td className="py-1 px-3 font-mono text-slate-400">{idx + 1}</td>
                            <td className="py-1 px-3">
                              <div className="w-3 h-3 border border-slate-400 rounded-xs" />
                            </td>
                            <td className="py-1 px-3 font-medium text-slate-900">{g.name}</td>
                            <td className="py-1 px-3 text-slate-700">
                              {g.cleanDish}
                            </td>
                            <td className="py-1 px-3 font-mono text-slate-600">{g.phone_number || '-'}</td>
                            <td className="py-1 px-3 text-slate-600">{g.municipi || g.comarca || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          ) : (
            <table className="w-full text-left text-[11px] border border-slate-300">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-100 font-semibold uppercase text-[9px]">
                  <th className="py-1 px-3 w-8">#</th>
                  <th className="py-1 px-3 w-8">Check</th>
                  <th className="py-1 px-3">Nom i Cognoms</th>
                  <th className="py-1 px-3">Taula</th>
                  <th className="py-1 px-3">Seient</th>
                  <th className="py-1 px-3">Plat</th>
                  <th className="py-1 px-3">Telèfon</th>
                  <th className="py-1 px-3">Municipi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedLunch.map((g, idx) => (
                  <tr key={g.guest_id}>
                    <td className="py-1 px-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-1 px-3">
                      <div className="w-3 h-3 border border-slate-400 rounded-xs" />
                    </td>
                    <td className="py-1 px-3 font-medium text-slate-900">{g.name}</td>
                    <td className="py-1 px-3 font-medium">Taula {g.tableNumber || '-'}</td>
                    <td className="py-1 px-3 font-mono text-slate-500">#{g.seatNumber || '-'}</td>
                    <td className="py-1 px-3 text-slate-700">
                      {g.cleanDish}
                    </td>
                    <td className="py-1 px-3 font-mono text-slate-600">{g.phone_number || '-'}</td>
                    <td className="py-1 px-3 text-slate-600">{g.municipi || g.comarca || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
