import React, { useState } from 'react';
import { FileText, CheckCircle2, AlertCircle, X, RefreshCw } from 'lucide-react';
import { parseLumaCSV, processGuests } from '../lib/csvParser';
import { INITIAL_LUMA_CSV } from '../data/initialData';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (csvText: string) => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [csvInput, setCsvInput] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      setCsvInput(content);
      setPreviewError(null);
    };
    reader.onerror = () => {
      setPreviewError("No s'ha pogut llegir el fitxer.");
    };
    reader.readAsText(file);
  };

  let previewStats = null;
  if (csvInput.trim().length > 50) {
    try {
      const raw = parseLumaCSV(csvInput);
      if (raw.length > 0) {
        const analysis = processGuests(raw);
        previewStats = {
          total: analysis.totalRegistered,
          lunch: analysis.totalLunch,
          noLunch: analysis.totalNoLunch,
          tables: analysis.totalTables,
          carn: analysis.dishTotals.find(d => d.dish.includes('Carn'))?.count || 0,
          peix: analysis.dishTotals.find(d => d.dish.includes('Peix'))?.count || 0,
        };
      }
    } catch {
      // ignore
    }
  }

  const handleApply = () => {
    if (!csvInput.trim()) {
      setPreviewError('Enganxa el contingut del CSV o selecciona un fitxer.');
      return;
    }
    const raw = parseLumaCSV(csvInput);
    if (raw.length === 0) {
      setPreviewError('No hem detectat cap registre vàlid al CSV.');
      return;
    }
    onImport(csvInput);
    onClose();
  };

  const handleLoadInitialData = () => {
    setCsvInput(INITIAL_LUMA_CSV);
    setFileName('informe_luma_inicial.csv');
    setPreviewError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-lg max-w-2xl w-full shadow-lg border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] text-xs">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">Importar Informe Luma (CSV)</h3>
            <p className="text-[11px] text-slate-500">Càrrega del fitxer d'inscrits per actualitzar taules i plats</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-200/50 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* File picker */}
          <div className="flex items-center gap-3">
            <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 rounded cursor-pointer transition text-slate-700 font-medium">
              <FileText className="w-4 h-4 text-slate-500" />
              <span>{fileName ? `Fitxer seleccionat: ${fileName}` : 'Seleccionar fitxer CSV de Luma (.csv)'}</span>
              <input type="file" accept=".csv,text/csv" onChange={handleFileUpload} className="hidden" />
            </label>

            <button
              onClick={handleLoadInitialData}
              type="button"
              className="px-3 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded flex items-center gap-1.5 transition shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Carregar llista inicial (86)</span>
            </button>
          </div>

          {/* Paste area */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-medium text-slate-700">
                O enganxa el contingut CSV directament:
              </label>
              {csvInput.length > 0 && (
                <button
                  onClick={() => {
                    setCsvInput('');
                    setFileName(null);
                  }}
                  className="text-[11px] text-slate-500 hover:text-slate-900 underline cursor-pointer"
                >
                  Netejar
                </button>
              )}
            </div>
            <textarea
              rows={6}
              value={csvInput}
              onChange={e => {
                setCsvInput(e.target.value);
                setPreviewError(null);
              }}
              placeholder="guest_id,name,email,created_at,ticket_name,Comarca,Municipi,Dinar - Segon plat a escollir...&#10;gst-...,Ramon Abad,...,Formació + Dinar,...,Carn - Cap de llom"
              className="w-full font-mono text-[11px] bg-slate-50 border border-slate-200 rounded p-2.5 focus:outline-none focus:bg-white focus:border-slate-400 text-slate-800"
            />
          </div>

          {/* Instant preview */}
          {previewStats && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-700">
              <div className="flex items-center gap-1.5 text-slate-900 font-semibold mb-2">
                <CheckCircle2 className="w-4 h-4 text-slate-700" />
                <span>Format vàlid: {previewStats.total} inscrits detectats</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase">Al Dinar</span>
                  <strong className="text-slate-900">{previewStats.lunch} persones</strong>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase">Taules de 10</span>
                  <strong className="text-slate-900">{previewStats.tables} taules</strong>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase">Cap de llom</span>
                  <strong className="text-slate-900">{previewStats.carn} racions</strong>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase">Orada</span>
                  <strong className="text-slate-900">{previewStats.peix} racions</strong>
                </div>
              </div>
            </div>
          )}

          {previewError && (
            <div className="p-2.5 bg-slate-100 border border-slate-300 rounded flex items-center gap-2 text-slate-800 text-[11px]">
              <AlertCircle className="w-4 h-4 text-slate-600 shrink-0" />
              <span>{previewError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 rounded transition cursor-pointer"
          >
            Cancel·lar
          </button>
          <button
            onClick={handleApply}
            disabled={!csvInput.trim()}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded transition cursor-pointer disabled:opacity-50"
          >
            Actualitzar i Desar al Servidor
          </button>
        </div>
      </div>
    </div>
  );
};
