import React from 'react';
import { CloudUpload, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  isExisting: boolean;
  totalGuests: number;
  lunchGuests: number;
  tableCount: number;
  spreadsheetTitle: string;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  isExisting,
  totalGuests,
  lunchGuests,
  tableCount,
  spreadsheetTitle,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-lg max-w-md w-full shadow-lg border border-slate-200 overflow-hidden text-xs">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CloudUpload className="w-4 h-4 text-slate-700" />
            <h3 className="font-semibold text-slate-900 text-sm">
              {isExisting ? 'Actualitzar Google Sheet al Drive' : 'Crear Google Sheet al Drive'}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-200/50 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3 text-slate-700">
          <p className="font-medium text-slate-900">
            {isExisting
              ? 'Es modificaran les dades del document existent a Google Drive:'
              : 'Es generarà un nou document al teu compte de Google Drive:'}
          </p>
          <p className="font-mono text-slate-800 bg-slate-100 p-2 rounded border border-slate-200">
            {spreadsheetTitle}
          </p>

          <ul className="text-[11px] text-slate-600 space-y-1 list-disc list-inside">
            <li><strong>Full 1 (Dinar):</strong> {lunchGuests} comensals en {tableCount} taules de 10.</li>
            <li><strong>Full 2 (Sense dinar):</strong> {totalGuests - lunchGuests} persones només per formació.</li>
            <li><strong>Full 3 (Cuina):</strong> Recompte de cap de llom, orada i desglossament.</li>
          </ul>

          <p className="text-[11px] text-slate-400 pt-1">
            Les dades s'escriuran directament utilitzant el permís concedit de Google Sheets.
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 rounded transition cursor-pointer"
          >
            Cancel·lar
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Sincronitzant...' : 'Confirmar Sincronització'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
