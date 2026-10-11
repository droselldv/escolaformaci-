import React, { useState, useMemo } from 'react';
import {
  EventAnalysis,
  ProcessedGuest,
  CustomExportOptions,
  ALL_COLUMNS,
  AvailableColumnId,
  SortKey,
} from '../types';
import { sortGuests, formatFullNameSurnamesFirst } from '../lib/sorting';
import {
  Search,
  SlidersHorizontal,
  Layers,
  Phone,
} from 'lucide-react';

interface FullTableViewProps {
  analysis: EventAnalysis;
  options: CustomExportOptions;
  onChangeOptions: (opts: CustomExportOptions) => void;
  onOpenCustomModal: () => void;
  onToggleLunchStatus?: (guestId: string) => void;
  onEditGuest?: (guest: ProcessedGuest) => void;
}

function getColumnValue(
  g: ProcessedGuest,
  colId: AvailableColumnId,
  onEditGuest?: (g: ProcessedGuest) => void
): React.ReactNode {
  switch (colId) {
    case 'name':
      return (
        <button
          type="button"
          onClick={() => onEditGuest?.(g)}
          className="font-semibold text-slate-900 hover:text-blue-600 hover:underline cursor-pointer text-left"
          title="Clic per editar assistent i canviar-li el nom"
        >
          {formatFullNameSurnamesFirst(g)}
        </button>
      );
    case 'table':
      return (
        <span className="whitespace-nowrap">
          {g.tableNumber ? (
            <span className="font-medium text-slate-800">Taula {g.tableNumber}</span>
          ) : (
            <span className="text-amber-700 font-medium bg-amber-50 px-1.5 py-0.5 rounded text-[11px] border border-amber-200/60">
              Sense taula
            </span>
          )}
        </span>
      );
    case 'seat':
      return <span className="font-mono text-slate-500">{g.seatNumber ?? '-'}</span>;
    case 'first_name':
      return <span>{g.first_name || g.name.split(' ')[0]}</span>;
    case 'last_name':
      return <span>{g.last_name || g.name.split(' ').slice(1).join(' ')}</span>;
    case 'dish':
      return (
        <span className="text-slate-700 whitespace-nowrap">
          {g.cleanDish}
        </span>
      );
    case 'phone':
      return g.phone_number ? (
        <span className="font-mono text-slate-600 flex items-center gap-1 whitespace-nowrap">
          {g.phone_number}
        </span>
      ) : (
        <span className="text-slate-300">-</span>
      );
    case 'email':
      return g.email ? (
        <span className="text-slate-600 truncate max-w-[190px] block" title={g.email}>
          {g.email}
        </span>
      ) : (
        <span className="text-slate-300">-</span>
      );
    case 'municipi':
      return <span>{g.municipi || '-'}</span>;
    case 'comarca':
      return <span>{g.comarca || '-'}</span>;
    case 'created_at':
      return (
        <span className="font-mono text-slate-500 whitespace-nowrap">
          {g.created_at ? new Date(g.created_at).toLocaleDateString('ca-ES') : '-'}
        </span>
      );
    case 'ticket':
      return <span className="text-slate-500 whitespace-nowrap">{g.ticket_name}</span>;
    case 'status':
      return <span className="text-slate-500 uppercase text-[10px] whitespace-nowrap">{g.approval_status}</span>;
    default:
      return null;
  }
}

export const FullTableView: React.FC<FullTableViewProps> = ({
  analysis,
  options,
  onChangeOptions,
  onOpenCustomModal,
  onToggleLunchStatus,
  onEditGuest,
}) => {
  const [activeSheet, setActiveSheet] = useState<'sheet1' | 'sheet2' | 'sheet3'>('sheet1');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDish, setFilterDish] = useState<string>('all');
  const [filterTable, setFilterTable] = useState<string>('all');

  const colDefMap = useMemo(() => new Map(ALL_COLUMNS.map(c => [c.id, c])), []);

  // Filter & sort lunch guests
  const processedLunch = useMemo(() => {
    let list = analysis.lunchGuests.filter(g => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        g.name.toLowerCase().includes(q) ||
        g.email.toLowerCase().includes(q) ||
        g.phone_number.includes(q) ||
        g.municipi.toLowerCase().includes(q) ||
        g.comarca.toLowerCase().includes(q);

      const matchesDish =
        filterDish === 'all' || g.cleanDish.toLowerCase().includes(filterDish.toLowerCase());
      const matchesTable =
        filterTable === 'all' || (g.tableNumber && g.tableNumber.toString() === filterTable);

      return matchesSearch && matchesDish && matchesTable;
    });

    return sortGuests(list, options.sortBy, options.sortDirection);
  }, [analysis.lunchGuests, searchQuery, filterDish, filterTable, options.sortBy, options.sortDirection]);

  // Filter & sort no-lunch guests
  const processedNoLunch = useMemo(() => {
    let list = analysis.noLunchGuests.filter(g => {
      const q = searchQuery.toLowerCase();
      return (
        !q ||
        g.name.toLowerCase().includes(q) ||
        g.email.toLowerCase().includes(q) ||
        g.phone_number.includes(q) ||
        g.municipi.toLowerCase().includes(q) ||
        g.comarca.toLowerCase().includes(q)
      );
    });

    return sortGuests(list, options.sortBy === 'table_seat' ? 'alpha_name' : options.sortBy, options.sortDirection);
  }, [analysis.noLunchGuests, searchQuery, options.sortBy, options.sortDirection]);

  // Grouped lunch by tables if enabled
  const tablesGrouped = useMemo(() => {
    if (!options.groupByTables) return null;

    const map = new Map<number, ProcessedGuest[]>();
    processedLunch.forEach(g => {
      const tNum = g.tableNumber || 1;
      if (!map.has(tNum)) map.set(tNum, []);
      map.get(tNum)!.push(g);
    });

    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [processedLunch, options.groupByTables]);

  const visibleCols: AvailableColumnId[] = options.columns.includes('name')
    ? (['name', ...options.columns.filter(c => c !== 'name')] as AvailableColumnId[])
    : options.columns;

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col text-xs">
      {/* Tab Navigation */}
      <div className="border-b border-slate-200 bg-slate-50/50 px-4 pt-2.5 pb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveSheet('sheet1')}
            className={`pb-1 font-semibold transition border-b-2 cursor-pointer ${
              activeSheet === 'sheet1'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            1. Assistents Dinar ({analysis.totalLunch})
          </button>

          <button
            onClick={() => setActiveSheet('sheet2')}
            className={`pb-1 font-semibold transition border-b-2 cursor-pointer ${
              activeSheet === 'sheet2'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            2. Sense Dinar ({analysis.totalNoLunch})
          </button>

          <button
            onClick={() => setActiveSheet('sheet3')}
            className={`pb-1 font-semibold transition border-b-2 cursor-pointer ${
              activeSheet === 'sheet3'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            3. Resum Plats & Cuina
          </button>
        </div>

        {/* View & Column Controls */}
        <div className="flex items-center gap-2">
          {activeSheet !== 'sheet3' && (
            <>
              <button
                type="button"
                onClick={() => onChangeOptions({ ...options, groupByTables: !options.groupByTables })}
                className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span>{options.groupByTables ? 'Per taules' : 'Llistat continu'}</span>
              </button>

              <select
                value={options.sortBy}
                onChange={e => onChangeOptions({ ...options, sortBy: e.target.value as SortKey })}
                className="text-xs bg-white border border-slate-200 rounded px-2.5 py-1 text-slate-700 font-medium cursor-pointer focus:outline-none"
              >
                <option value="alpha_name">Alfabètic per nom</option>
                <option value="alpha_lastname">Alfabètic per cognom</option>
                <option value="table_seat">Per taula i seient</option>
                <option value="dish">Per plat</option>
                <option value="registration_date">Per data registre</option>
                <option value="municipi">Per municipi</option>
              </select>

              <button
                onClick={onOpenCustomModal}
                className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition flex items-center gap-1.5 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                <span>Columnes ({options.columns.length})</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      {activeSheet !== 'sheet3' && (
        <div className="p-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cercar assistent..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded focus:outline-none focus:bg-white focus:border-slate-400"
            />
          </div>

          <div className="flex items-center gap-2">
            {activeSheet === 'sheet1' && (
              <>
                <select
                  value={filterTable}
                  onChange={e => setFilterTable(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">Totes les taules</option>
                  {analysis.tables.map(t => (
                    <option key={t.tableNumber} value={t.tableNumber}>
                      Taula {t.tableNumber}
                    </option>
                  ))}
                </select>

                <select
                  value={filterDish}
                  onChange={e => setFilterDish(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">Tots els plats</option>
                  <option value="carn">Carn - Cap de llom</option>
                  <option value="peix">Peix - Orada</option>
                </select>
              </>
            )}

            <span className="text-[11px] text-slate-400 ml-1">
              {activeSheet === 'sheet1' ? processedLunch.length : processedNoLunch.length} registres
            </span>
          </div>
        </div>
      )}

      {/* Sheet 1: Assistents Dinar */}
      {activeSheet === 'sheet1' && (
        <div className="overflow-x-auto flex-1">
          {options.groupByTables && tablesGrouped ? (
            <div className="divide-y divide-slate-200">
              {tablesGrouped.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  Cap registre trobat.
                </div>
              ) : (
                tablesGrouped.map(([tNum, guests]) => {
                  const carnCount = guests.filter(g => g.cleanDish.includes('Carn')).length;
                  const peixCount = guests.filter(g => g.cleanDish.includes('Peix')).length;

                  return (
                    <div key={tNum} className="pb-1">
                      {/* Table Header */}
                      <div className="bg-slate-50 px-3.5 py-1.5 flex items-center justify-between border-b border-slate-200">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold text-slate-900">Taula {tNum}</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-500 font-medium">{guests.length}/10 assistents</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-500">Carn: {carnCount}</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-500">Peix: {peixCount}</span>
                        </div>
                      </div>

                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider border-b border-slate-100 bg-white">
                            {visibleCols.map(colId => (
                              <th key={colId} className="py-1 px-3">
                                {colDefMap.get(colId)?.shortLabel || colId}
                              </th>
                            ))}
                            <th className="py-1 px-3 text-right">Modificar</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {guests.map(g => (
                            <tr key={g.guest_id} className="hover:bg-slate-50/70 transition group">
                              {visibleCols.map(colId => (
                                <td key={colId} className="py-1.5 px-3 whitespace-nowrap">
                                  {getColumnValue(g, colId, onEditGuest)}
                                </td>
                              ))}
                              <td className="py-1.5 px-3 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => onEditGuest?.(g)}
                                  className="text-[11px] text-slate-500 hover:text-slate-900 underline cursor-pointer"
                                >
                                  Editar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                  {visibleCols.map(colId => (
                    <th key={colId} className="py-2 px-3 whitespace-nowrap">
                      {colDefMap.get(colId)?.label || colId}
                    </th>
                  ))}
                  <th className="py-2 px-3 text-right whitespace-nowrap">Modificar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {processedLunch.length === 0 ? (
                  <tr>
                    <td colSpan={visibleCols.length + 1} className="py-8 text-center text-slate-400">
                      Cap registre trobat.
                    </td>
                  </tr>
                ) : (
                  processedLunch.map(g => (
                    <tr key={g.guest_id} className="hover:bg-slate-50/70 transition group">
                      {visibleCols.map(colId => (
                        <td key={colId} className="py-2 px-3 whitespace-nowrap">
                          {getColumnValue(g, colId, onEditGuest)}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onEditGuest?.(g)}
                          className="text-[11px] text-slate-500 hover:text-slate-900 underline cursor-pointer"
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Sheet 2: Sense Dinar */}
      {activeSheet === 'sheet2' && (
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-2 px-3 w-10 text-center">#</th>
                <th className="py-2 px-3">Nom complet</th>
                <th className="py-2 px-3">Telèfon</th>
                <th className="py-2 px-3">Email</th>
                <th className="py-2 px-3">Municipi / Comarca</th>
                <th className="py-2 px-3">Entrada</th>
                <th className="py-2 px-3">Data</th>
                <th className="py-2 px-3 text-right">Acció</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processedNoLunch.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Cap registre trobat.
                  </td>
                </tr>
              ) : (
                processedNoLunch.map((g, idx) => (
                  <tr key={g.guest_id} className="hover:bg-slate-50 transition">
                    <td className="py-2 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-2 px-3">
                      <button
                        type="button"
                        onClick={() => onEditGuest?.(g)}
                        className="font-semibold text-slate-900 hover:text-blue-600 hover:underline cursor-pointer text-left"
                        title="Clic per editar assistent i canviar-li el nom"
                      >
                        {formatFullNameSurnamesFirst(g)}
                      </button>
                    </td>
                    <td className="py-2 px-3 text-slate-600 font-mono">{g.phone_number || '-'}</td>
                    <td className="py-2 px-3 text-slate-600">{g.email}</td>
                    <td className="py-2 px-3 text-slate-600">
                      {g.municipi ? `${g.municipi} (${g.comarca})` : g.comarca || '-'}
                    </td>
                    <td className="py-2 px-3 text-slate-500">{g.ticket_name}</td>
                    <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                      {g.created_at ? new Date(g.created_at).toLocaleDateString('ca-ES') : '-'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => onToggleLunchStatus?.(g.guest_id)}
                        className="text-[11px] font-medium text-slate-700 hover:underline cursor-pointer"
                      >
                        Passar a Dinar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Sheet 3: Resum Plats & Cuina */}
      {activeSheet === 'sheet3' && (
        <div className="p-4 space-y-5">
          <div>
            <h3 className="font-semibold text-slate-900 mb-2">
              Totals de Plats per a la Cuina
            </h3>
            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-semibold">
                    <th className="py-2 px-3">Plat</th>
                    <th className="py-2 px-3 text-center">Racions totals</th>
                    <th className="py-2 px-3 text-right">Percentatge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analysis.dishTotals.map(d => (
                    <tr key={d.dish}>
                      <td className="py-2 px-3 font-medium text-slate-900">{d.dish}</td>
                      <td className="py-2 px-3 text-center font-bold text-slate-900">{d.count}</td>
                      <td className="py-2 px-3 text-right text-slate-500">{d.percentage}%</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/50 font-bold border-t border-slate-200">
                    <td className="py-2 px-3 text-slate-900">Total Comensals</td>
                    <td className="py-2 px-3 text-center text-slate-900">{analysis.totalLunch}</td>
                    <td className="py-2 px-3 text-right text-slate-900">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 mb-2">
              Desglossament per Taules
            </h3>
            <div className="border border-slate-200 rounded overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-semibold">
                    <th className="py-2 px-3">Taula</th>
                    <th className="py-2 px-3 text-center">Comensals</th>
                    <th className="py-2 px-3">Carn (Cap de llom)</th>
                    <th className="py-2 px-3">Peix (Orada)</th>
                    <th className="py-2 px-3">Llista d'assistents</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analysis.tables.map(t => {
                    const carn = t.dishCounts['Carn - Cap de llom'] || 0;
                    const peix = t.dishCounts['Peix - Orada'] || 0;
                    return (
                      <tr key={t.tableNumber}>
                        <td className="py-2 px-3 font-semibold text-slate-900">Taula {t.tableNumber}</td>
                        <td className="py-2 px-3 text-center font-medium">{t.guests.length} / 10</td>
                        <td className="py-2 px-3 text-slate-800">{carn}</td>
                        <td className="py-2 px-3 text-slate-800">{peix}</td>
                        <td className="py-2 px-3 text-slate-500 truncate max-w-sm">
                          {t.guests.map(g => g.name).join(', ')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
