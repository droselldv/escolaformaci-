/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import {
  initAuth,
  googleSignIn,
  getAccessToken,
  logout,
} from './lib/firebase';
import { INITIAL_LUMA_CSV } from './data/initialData';
import { parseLumaCSV, processGuests } from './lib/csvParser';
import { downloadExcelFile, DEFAULT_EXPORT_OPTIONS } from './lib/exportExcel';
import { createOrUpdateGoogleSheet, SyncResult } from './lib/sheetsSync';
import { ProcessedGuest, CustomExportOptions } from './types';
import { OverviewCards } from './components/OverviewCards';
import { TableCard } from './components/TableCard';
import { FullTableView } from './components/FullTableView';
import { ConfirmationModal } from './components/ConfirmationModal';
import { ImportModal } from './components/ImportModal';
import { EditGuestModal } from './components/EditGuestModal';
import { ExportCustomModal } from './components/ExportCustomModal';
import { PrintModal } from './components/PrintModal';
import {
  CloudUpload,
  Download,
  Upload,
  ExternalLink,
  LayoutGrid,
  Sheet,
  CheckCircle2,
  AlertCircle,
  LogOut,
  SlidersHorizontal,
  Printer,
  Sparkles,
  ArrowUpDown,
} from 'lucide-react';

export default function App() {
  // 1. Google Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 2. Event & Guests Data State
  const [csvText, setCsvText] = useState<string>(() => {
    return localStorage.getItem('luma_event_csv') || INITIAL_LUMA_CSV;
  });

  const [sortMode, setSortMode] = useState<'chronological' | 'original'>('chronological');
  const [manualOverrides, setManualOverrides] = useState<
    Record<string, { stays: boolean; dish: string }>
  >(() => {
    try {
      const saved = localStorage.getItem('luma_event_overrides');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // 3. Custom Export & Display Options State
  const [exportOptions, setExportOptions] = useState<CustomExportOptions>(() => {
    try {
      const saved = localStorage.getItem('luma_export_options_v4');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.columns && parsed.columns.includes('name')) {
          parsed.columns = ['name', ...parsed.columns.filter((c: string) => c !== 'name')];
        }
        return parsed;
      }
      return DEFAULT_EXPORT_OPTIONS;
    } catch {
      return DEFAULT_EXPORT_OPTIONS;
    }
  });

  // 4. View & Modal States
  const [viewTab, setViewTab] = useState<'tables' | 'sheets'>('tables');
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCustomExportOpen, setIsCustomExportOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<ProcessedGuest | null>(null);

  // 5. Drive & Sheets sync State
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => {
    return localStorage.getItem('luma_drive_spreadsheet_id') || null;
  });
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(() => {
    return localStorage.getItem('luma_drive_spreadsheet_url') || null;
  });
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(() => {
    return localStorage.getItem('luma_drive_last_synced') || null;
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Server synchronization status
  const [serverStatus, setServerStatus] = useState<'synced' | 'saving' | 'offline'>('synced');

  // Load persisted state from server on mount
  useEffect(() => {
    let mounted = true;
    fetch('/api/data')
      .then(res => res.json())
      .then(json => {
        if (!mounted || !json.success || !json.data) return;
        const s = json.data;
        if (s.csvText && s.csvText.length > 50) setCsvText(s.csvText);
        if (s.manualOverrides) setManualOverrides(s.manualOverrides);
        if (s.spreadsheetId) setSpreadsheetId(s.spreadsheetId);
        if (s.spreadsheetUrl) setSpreadsheetUrl(s.spreadsheetUrl);
        if (s.lastSyncedAt) setLastSyncedAt(s.lastSyncedAt);
        setServerStatus('synced');
      })
      .catch(() => {
        // Fallback to local state if server offline or standalone preview
        setServerStatus('synced');
      });
    return () => {
      mounted = false;
    };
  }, []);

  const saveToServer = async (patch: Record<string, any>) => {
    setServerStatus('saving');
    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        setServerStatus('synced');
      } else {
        setServerStatus('offline');
      }
    } catch {
      setServerStatus('offline');
    }
  };

  // Persistence
  useEffect(() => {
    localStorage.setItem('luma_event_csv', csvText);
  }, [csvText]);

  useEffect(() => {
    localStorage.setItem('luma_event_overrides', JSON.stringify(manualOverrides));
  }, [manualOverrides]);

  useEffect(() => {
    localStorage.setItem('luma_export_options_v4', JSON.stringify(exportOptions));
  }, [exportOptions]);

  // Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
      },
      () => {
        // Not logged in
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
      }
    } catch (err: any) {
      console.error('Google Sign-in failed:', err);
      setSyncStatusMsg({
        type: 'error',
        text: err.message || "Error en iniciar sessió amb Google.",
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setToken(null);
  };

  // Process raw guests and apply any overrides
  const rawGuests = useMemo(() => {
    return parseLumaCSV(csvText);
  }, [csvText]);

  const analysis = useMemo(() => {
    const res = processGuests(rawGuests, sortMode, 10);

    if (Object.keys(manualOverrides).length > 0) {
      const modifiedRaw = rawGuests.map(g => {
        const override = manualOverrides[g.guest_id];
        if (override) {
          return {
            ...g,
            dish_raw: override.stays ? override.dish : 'No em quedo al dinar',
          };
        }
        return g;
      });
      return processGuests(modifiedRaw, sortMode, 10);
    }

    return res;
  }, [rawGuests, sortMode, manualOverrides]);

  // Handle Google Drive sync execution
  const handleTriggerSync = async () => {
    if (!token) {
      try {
        const res = await googleSignIn();
        if (res) {
          setUser(res.user);
          setToken(res.accessToken);
          setIsConfirmationOpen(true);
        }
      } catch {
        setSyncStatusMsg({
          type: 'error',
          text: "Cal iniciar sessió amb Google per poder sincronitzar amb Google Drive.",
        });
      }
      return;
    }
    setIsConfirmationOpen(true);
  };

  const handleExecuteDriveSync = async () => {
    const currentToken = token || (await getAccessToken());
    if (!currentToken) {
      setIsConfirmationOpen(false);
      handleLogin();
      return;
    }

    setIsSyncing(true);
    setSyncStatusMsg(null);

    try {
      const result: SyncResult = await createOrUpdateGoogleSheet(
        currentToken,
        spreadsheetId,
        analysis,
        'Luma Event - Dinars, Taules i Plats',
        exportOptions
      );

      setSpreadsheetId(result.spreadsheetId);
      setSpreadsheetUrl(result.spreadsheetUrl);
      const now = new Date().toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });
      setLastSyncedAt(now);

      localStorage.setItem('luma_drive_spreadsheet_id', result.spreadsheetId);
      localStorage.setItem('luma_drive_spreadsheet_url', result.spreadsheetUrl);
      localStorage.setItem('luma_drive_last_synced', now);

      saveToServer({
        spreadsheetId: result.spreadsheetId,
        spreadsheetUrl: result.spreadsheetUrl,
        lastSyncedAt: now,
      });

      setSyncStatusMsg({
        type: 'success',
        text: result.isNew
          ? 'Creat amb èxit el nou Google Sheet al teu Google Drive amb els 3 fulls i columnes triades!'
          : 'Sincronitzat i actualitzat amb èxit el Google Sheet al teu Google Drive!',
      });
      setIsConfirmationOpen(false);
    } catch (err: any) {
      console.error('Error syncing to Drive:', err);
      setSyncStatusMsg({
        type: 'error',
        text: err.message || "Error al sincronitzar amb Google Drive. Verifica els permisos.",
      });
      setIsConfirmationOpen(false);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportLocalExcel = () => {
    downloadExcelFile(analysis, 'Luma_Esdeveniment_Dinars_Taules.xlsx', exportOptions);
  };

  const handleImportNewCSV = (newCsv: string) => {
    setCsvText(newCsv);
    setManualOverrides({});
    saveToServer({
      csvText: newCsv,
      manualOverrides: {},
    });
    setSyncStatusMsg({
      type: 'success',
      text: 'Nou informe de Luma desat al servidor i taules recalculades amb èxit!',
    });
  };

  const handleToggleLunchStatus = (guestId: string) => {
    const current = analysis.allGuests.find(g => g.guest_id === guestId);
    if (!current) return;
    const newStays = !current.staysForLunch;
    const nextOverrides = {
      ...manualOverrides,
      [guestId]: {
        stays: newStays,
        dish: newStays ? 'Carn - Cap de llom' : 'No em quedo al dinar',
      },
    };
    setManualOverrides(nextOverrides);
    saveToServer({ manualOverrides: nextOverrides });
  };

  const handleSaveGuestEdit = (guestId: string, stays: boolean, dish: string) => {
    const nextOverrides = {
      ...manualOverrides,
      [guestId]: {
        stays,
        dish,
      },
    };
    setManualOverrides(nextOverrides);
    saveToServer({ manualOverrides: nextOverrides });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col antialiased selection:bg-blue-500/10 selection:text-blue-900">
      {/* Top Header - Minimalist & Polished */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-2xs">
              L
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  Luma Dinars & Taules
                </h1>
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  10/taula
                </span>
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full hidden sm:inline-flex items-center gap-1 ${
                    serverStatus === 'saving'
                      ? 'bg-blue-50 text-blue-700'
                      : serverStatus === 'offline'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-emerald-50 text-emerald-700'
                  }`}
                  title={serverStatus === 'saving' ? 'Desant canvis al servidor...' : 'Dades sincronitzades amb el servidor'}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      serverStatus === 'saving'
                        ? 'bg-blue-500 animate-pulse'
                        : serverStatus === 'offline'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                  />
                  <span>{serverStatus === 'saving' ? 'Desant...' : 'Servidor sincronitzat'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* User & Cloud State */}
          <div className="flex items-center gap-2.5">
            {spreadsheetUrl && (
              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60 px-2.5 py-1 rounded-lg transition"
              >
                <Sheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Google Sheet al Drive</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            )}

            {user ? (
              <div className="flex items-center gap-2 bg-slate-100/70 rounded-lg p-1 pr-2.5 border border-slate-200/60 text-xs">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Usuari'}
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-slate-800 text-white font-bold text-[10px] flex items-center justify-center">
                    {user.email?.[0].toUpperCase() || 'U'}
                  </div>
                )}
                <span className="font-medium text-slate-700 max-w-[120px] truncate hidden md:inline text-[11px]">
                  {user.displayName || user.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-slate-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                  title="Tancar sessió de Google"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <CloudUpload className="w-3.5 h-3.5 text-blue-600" />
                <span>{isLoggingIn ? 'Connectant...' : 'Connectar Drive'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex-1 space-y-4 w-full">
        {/* Status Alert if any */}
        {syncStatusMsg && (
          <div
            className="p-3 rounded-lg border border-slate-200 bg-white shadow-2xs flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2 text-slate-800">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
              <span>{syncStatusMsg.text}</span>
            </div>
            <button
              onClick={() => setSyncStatusMsg(null)}
              className="text-slate-400 hover:text-slate-600 font-bold px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Enterprise Toolbar */}
        <div className="bg-white rounded-lg p-3 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Summary status text */}
          <div className="flex items-center gap-2 text-slate-600">
            <span className="font-semibold text-slate-900">
              {analysis.totalLunch} comensals
            </span>
            <span className="text-slate-300">·</span>
            <span>
              {analysis.totalTables} taules de 10
            </span>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <span className="text-slate-500 hidden sm:inline">
              Ordre: {exportOptions.sortBy === 'alpha_name' ? 'Alfabètic per nom' : exportOptions.sortBy === 'alpha_lastname' ? 'Alfabètic per cognom' : 'Per taula'}
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap ml-auto">
            <button
              onClick={() => setIsCustomExportOpen(true)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded transition flex items-center gap-1.5 cursor-pointer"
              title="Personalitzar columnes, ordre alfabètic i agrupació"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Personalitzar Exportació</span>
            </button>

            <button
              onClick={handleExportLocalExcel}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded transition flex items-center gap-1.5 cursor-pointer"
              title="Descarregar fitxer Excel amb els 3 fulls i columnes triades"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Descarregar Excel</span>
            </button>

            <button
              onClick={handleTriggerSync}
              disabled={isSyncing}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Sincronitzar directament al Google Drive"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              <span>{spreadsheetId ? 'Actualitzar al Drive' : 'Sincronitzar a Drive'}</span>
            </button>

            <button
              onClick={() => setIsImportOpen(true)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded transition flex items-center gap-1.5 cursor-pointer"
              title="Importar nova exportació periòdica de Luma"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Nou Informe</span>
            </button>

            <button
              onClick={() => setIsPrintOpen(true)}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition cursor-pointer"
              title="Imprimir / Vista PDF"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Minimalist Metrics Cards */}
        <OverviewCards analysis={analysis} />

        {/* View Mode Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
          <div className="flex items-center gap-4 border-b border-slate-200 w-full sm:w-auto pb-1">
            <button
              onClick={() => setViewTab('tables')}
              className={`pb-1 font-semibold transition border-b-2 cursor-pointer ${
                viewTab === 'tables'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Taules ({analysis.totalTables})
            </button>

            <button
              onClick={() => setViewTab('sheets')}
              className={`pb-1 font-semibold transition border-b-2 cursor-pointer ${
                viewTab === 'sheets'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Llistat d'Assistents (3 Fulls)
            </button>
          </div>

          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            {lastSyncedAt && (
              <span>Drive: {lastSyncedAt}</span>
            )}
            <span className="text-slate-300">·</span>
            <span>{exportOptions.groupByTables ? 'Agrupació: Taules de 10' : 'Agrupació: Continu'}</span>
          </div>
        </div>

        {/* Tab 1: Cards of Tables */}
        {viewTab === 'tables' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {analysis.tables.map(table => (
              <TableCard
                key={table.tableNumber}
                table={table}
                onEditGuest={guest => setEditingGuest(guest)}
              />
            ))}
          </div>
        )}

        {/* Tab 2: Custom List Table View */}
        {viewTab === 'sheets' && (
          <FullTableView
            analysis={analysis}
            options={exportOptions}
            onChangeOptions={setExportOptions}
            onOpenCustomModal={() => setIsCustomExportOpen(true)}
            onToggleLunchStatus={handleToggleLunchStatus}
            onEditGuest={guest => setEditingGuest(guest)}
          />
        )}
      </main>

      {/* Minimalist Footer */}
      <footer className="mt-auto py-4 border-t border-slate-200 bg-white text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between">
          <span>Luma Dinars — Agrupació en taules de 10 i integració Google Drive</span>
          <button
            onClick={() => setIsCustomExportOpen(true)}
            className="text-blue-600 hover:underline cursor-pointer"
          >
            Configurar columnes i ordre
          </button>
        </div>
      </footer>

      {/* Confirmation Modal (MANDATORY for Drive Mutation) */}
      <ConfirmationModal
        isOpen={isConfirmationOpen}
        onClose={() => setIsConfirmationOpen(false)}
        onConfirm={handleExecuteDriveSync}
        isLoading={isSyncing}
        isExisting={!!spreadsheetId}
        totalGuests={analysis.totalRegistered}
        lunchGuests={analysis.totalLunch}
        tableCount={analysis.totalTables}
        spreadsheetTitle="Luma Event - Dinars, Taules i Plats"
      />

      {/* Custom Export & Columns Modal */}
      <ExportCustomModal
        isOpen={isCustomExportOpen}
        onClose={() => setIsCustomExportOpen(false)}
        options={exportOptions}
        onChangeOptions={setExportOptions}
        onExportExcel={handleExportLocalExcel}
        onSyncDrive={handleTriggerSync}
        onPrint={() => {
          setIsCustomExportOpen(false);
          setIsPrintOpen(true);
        }}
        isDriveSyncing={isSyncing}
      />

      {/* Print View Modal */}
      <PrintModal
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        analysis={analysis}
        options={exportOptions}
      />

      {/* Import CSV Modal */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImportNewCSV}
      />

      {/* Edit Guest Modal */}
      <EditGuestModal
        guest={editingGuest}
        onClose={() => setEditingGuest(null)}
        onSave={handleSaveGuestEdit}
      />
    </div>
  );
}
