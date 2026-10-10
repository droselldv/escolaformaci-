import React from 'react';
import {
  CustomExportOptions,
  ALL_COLUMNS,
  AvailableColumnId,
  SortKey,
  ColumnDefinition,
} from '../types';
import {
  X,
  FileSpreadsheet,
  CloudUpload,
  Printer,
  Check,
} from 'lucide-react';

interface ExportCustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: CustomExportOptions;
  onChangeOptions: (newOpts: CustomExportOptions) => void;
  onExportExcel: () => void;
  onSyncDrive: () => void;
  onPrint: () => void;
  isDriveSyncing: boolean;
}

export const ExportCustomModal: React.FC<ExportCustomModalProps> = ({
  isOpen,
  onClose,
  options,
  onChangeOptions,
  onExportExcel,
  onSyncDrive,
  onPrint,
  isDriveSyncing,
}) => {
  if (!isOpen) return null;

  const toggleColumn = (colId: AvailableColumnId) => {
    const exists = options.columns.includes(colId);
    let nextCols: AvailableColumnId[];
    if (exists) {
      if (options.columns.length <= 1) return;
      nextCols = options.columns.filter(c => c !== colId);
    } else {
      nextCols = [...options.columns, colId];
    }
    onChangeOptions({ ...options, columns: nextCols });
  };

  const handleSelectAllColumns = () => {
    onChangeOptions({ ...options, columns: ALL_COLUMNS.map(c => c.id) });
  };

  const handleSelectEssentialColumns = () => {
    onChangeOptions({
      ...options,
      columns: ['table', 'seat', 'name', 'dish', 'phone', 'municipi'],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-lg max-w-2xl w-full shadow-lg border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] text-xs">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Configuració d'Exportació i Llistat</h3>
            <p className="text-[11px] text-slate-500">Paràmetres d'ordre, columnes i format d'agrupació</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-200/50 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* 1. Sort Order */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
                1. Criteri d'Ordenació
              </label>
              <button
                type="button"
                onClick={() =>
                  onChangeOptions({
                    ...options,
                    sortDirection: options.sortDirection === 'asc' ? 'desc' : 'asc',
                  })
                }
                className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium cursor-pointer"
              >
                {options.sortDirection === 'asc' ? 'Ascendent (A-Z / 1-9)' : 'Descendent (Z-A / 9-1)'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { key: 'alpha_name', label: 'Alfabètic per nom', desc: 'A-Z nom complet' },
                { key: 'alpha_lastname', label: 'Alfabètic per cognom', desc: 'A-Z cognoms' },
                { key: 'table_seat', label: 'Per taula i seient', desc: 'Taula 1, 2, 3... 1-10' },
                { key: 'dish', label: 'Per plat', desc: 'Carns i Peixos' },
                { key: 'registration_date', label: 'Data d\'inscripció', desc: 'Ordre de registre' },
                { key: 'municipi', label: 'Per municipi', desc: 'Població alfabètica' },
              ].map(item => {
                const isSelected = options.sortBy === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onChangeOptions({ ...options, sortBy: item.key as SortKey })}
                    className={`p-2.5 rounded border text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <p className="font-medium text-xs">{item.label}</p>
                    <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                      {item.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Grouping Option */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <label className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
              2. Agrupació de dades
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChangeOptions({ ...options, groupByTables: true })}
                className={`p-3 rounded border text-left transition cursor-pointer ${
                  options.groupByTables
                    ? 'border-slate-900 bg-slate-50 text-slate-900'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${options.groupByTables ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300'}`}>
                    {options.groupByTables && <Check className="w-2.5 h-2.5" />}
                  </div>
                  <span className="font-semibold text-xs">Agrupat per taules de 10</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 pl-5.5">
                  Divideix el llistat per cada taula assignada amb els seus 10 comensals.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onChangeOptions({ ...options, groupByTables: false })}
                className={`p-3 rounded border text-left transition cursor-pointer ${
                  !options.groupByTables
                    ? 'border-slate-900 bg-slate-50 text-slate-900'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${!options.groupByTables ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300'}`}>
                    {!options.groupByTables && <Check className="w-2.5 h-2.5" />}
                  </div>
                  <span className="font-semibold text-xs">Llistat continu (taula plana)</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 pl-5.5">
                  Una sola taula contínua ordenada alfabèticament per consultar a l'entrada.
                </p>
              </button>
            </div>
          </div>

          {/* 3. Column Selection */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-900 text-xs uppercase tracking-wider">
                3. Columnes a incloure ({options.columns.length}/{ALL_COLUMNS.length})
              </label>

              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={handleSelectEssentialColumns}
                  className="text-slate-600 hover:text-slate-900 underline cursor-pointer"
                >
                  Bàsiques
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={handleSelectAllColumns}
                  className="text-slate-600 hover:text-slate-900 underline cursor-pointer"
                >
                  Totes
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALL_COLUMNS.map((col: ColumnDefinition) => {
                const isChecked = options.columns.includes(col.id);
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => toggleColumn(col.id)}
                    className={`px-3 py-1.5 rounded border text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                      isChecked
                        ? 'bg-slate-50 border-slate-400 text-slate-900 font-medium'
                        : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">{col.label}</span>
                    <div
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                        isChecked ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Fulls adicionals */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-4 items-center text-slate-700">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.includeNoLunchSheet}
                onChange={e =>
                  onChangeOptions({ ...options, includeNoLunchSheet: e.target.checked })
                }
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
              />
              <span>Incloure Full 2 (Sense Dinar)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.includeKitchenSummarySheet}
                onChange={e =>
                  onChangeOptions({ ...options, includeKitchenSummarySheet: e.target.checked })
                }
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-500"
              />
              <span>Incloure Full 3 (Resum Cuina & Plats)</span>
            </label>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={onPrint}
            type="button"
            className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Imprimir / PDF</span>
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              type="button"
              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 rounded transition cursor-pointer"
            >
              Tancar
            </button>

            <button
              onClick={() => {
                onExportExcel();
                onClose();
              }}
              type="button"
              className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded transition flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
              <span>Descarregar Excel</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onSyncDrive();
              }}
              disabled={isDriveSyncing}
              type="button"
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              <span>Sincronitzar a Drive</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
