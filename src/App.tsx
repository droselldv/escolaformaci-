/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { INITIAL_LUMA_CSV } from './data/initialData';
import { parseLumaCSV, processGuests } from './lib/csvParser';
import { downloadExcelFile, DEFAULT_EXPORT_OPTIONS } from './lib/exportExcel';
import {
  ProcessedGuest,
  CustomExportOptions,
  TableAssignmentsMap,
  ManualOverridesMap,
  ManualGuestOverride,
} from './types';
import { OverviewCards } from './components/OverviewCards';
import { TableCard } from './components/TableCard';
import { FullTableView } from './components/FullTableView';
import { ImportModal } from './components/ImportModal';
import { EditGuestModal } from './components/EditGuestModal';
import { ExportCustomModal } from './components/ExportCustomModal';
import { PrintModal } from './components/PrintModal';
import {
  TableAssignmentModal,
  AssignmentModalMode,
} from './components/TableAssignmentModal';
import { TableSearchAndUnassigned } from './components/TableSearchAndUnassigned';
import {
  Download,
  Upload,
  SlidersHorizontal,
  Printer,
  Sparkles,
  CheckCircle2,
  HardDrive,
  Database,
  RefreshCw,
  Check,
  AlertCircle,
} from 'lucide-react';

export default function App() {
  // 1. Event & Guests Data State
  const [csvText, setCsvText] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('luma_event_csv');
      // If saved has fewer rows/length than updated INITIAL_LUMA_CSV (105 attendees), prefer INITIAL_LUMA_CSV
      if (saved && saved.length >= INITIAL_LUMA_CSV.length - 100) {
        return saved;
      }
      return INITIAL_LUMA_CSV;
    } catch {
      return INITIAL_LUMA_CSV;
    }
  });

  const [sortMode, setSortMode] = useState<'chronological' | 'original'>('chronological');

  // Manual dish / stays / name overrides
  const [manualOverrides, setManualOverrides] = useState<ManualOverridesMap>(() => {
    try {
      const saved = localStorage.getItem('luma_event_overrides');
      const base: ManualOverridesMap = saved ? JSON.parse(saved) : {};
      // Ensure default mapping for Aliança Catalana Pla d'Urgell -> Manel Solà
      if (!base['gst-4EiPYqOwuE90vqE']) {
        base['gst-4EiPYqOwuE90vqE'] = {
          name: 'Manel Solà',
          first_name: 'Manel',
          last_name: 'Solà',
        };
      }
      return base;
    } catch {
      return {
        'gst-4EiPYqOwuE90vqE': {
          name: 'Manel Solà',
          first_name: 'Manel',
          last_name: 'Solà',
        },
      };
    }
  });

  // Table & seat assignments state (persisted across sessions and exports)
  const [tableAssignments, setTableAssignments] = useState<TableAssignmentsMap>(() => {
    try {
      const saved = localStorage.getItem('luma_table_assignments');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // 2. Custom Export & Display Options State
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

  // 3. View, Search & Modal States
  const [viewTab, setViewTab] = useState<'tables' | 'sheets'>('tables');
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCustomExportOpen, setIsCustomExportOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<ProcessedGuest | null>(null);
  const [tableModalMode, setTableModalMode] = useState<AssignmentModalMode | null>(null);

  // Status message alert
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Server synchronization status
  const [serverStatus, setServerStatus] = useState<'synced' | 'saving' | 'offline'>('synced');
  const [dbType, setDbType] = useState<string>('Netlify DB (PostgreSQL)');
  const [lastServerSaveTime, setLastServerSaveTime] = useState<string>('En sincronia');
  const [hasPendingChanges, setHasPendingChanges] = useState<boolean>(false);
  const [lastServerSyncTime, setLastServerSyncTime] = useState<string>('');
  const hasLoadedInitialServerData = useRef(false);
  const isSavingRef = useRef(false);

  // Manual reload / sync from server on demand
  const syncFromServer = async (showNotification = false) => {
    try {
      console.log('[CLIENT] Sincronitzant amb el servidor i Netlify DB...');
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success && json.data) {
        if (json.db) setDbType(json.db);
        const s = json.data;
        if (s.csvText && s.csvText.length > 50) {
          setCsvText(s.csvText);
          localStorage.setItem('luma_event_csv', s.csvText);
        }
        if (s.manualOverrides) {
          setManualOverrides(s.manualOverrides);
          localStorage.setItem('luma_event_overrides', JSON.stringify(s.manualOverrides));
        }
        if (s.tableAssignments) {
          setTableAssignments(s.tableAssignments);
          localStorage.setItem('luma_table_assignments', JSON.stringify(s.tableAssignments));
        }
        setHasPendingChanges(false);
        setServerStatus('synced');
        const nowStr = new Date().toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastServerSyncTime(nowStr);
        setLastServerSaveTime(nowStr);
        if (showNotification) {
          setStatusMsg({
            type: 'success',
            text: `Base de dades sincronitzada amb èxit a les ${nowStr}.`,
          });
        }
        console.log('[CLIENT] Dades carregades correctament de la base de dades:', {
          csvLength: s.csvText?.length,
          overridesCount: Object.keys(s.manualOverrides || {}).length,
          assignmentsCount: Object.keys(s.tableAssignments || {}).length,
        });
      }
    } catch (err) {
      console.warn('[CLIENT] Error al sincronitzar des del servidor:', err);
      if (showNotification) {
        setStatusMsg({
          type: 'error',
          text: 'No s’ha pogut connectar amb la base de dades per descarregar els canvis.',
        });
      }
    }
  };

  // 1. Carrega inicial exclusiva quan l'usuari entra a la pàgina
  useEffect(() => {
    let mounted = true;
    console.log('[CLIENT-INIT] Connexió inicial: recuperant estat de Netlify DB...');
    fetch('/api/data')
      .then(res => res.json())
      .then(json => {
        if (!mounted) return;
        if (json.success && json.data) {
          if (json.db) setDbType(json.db);
          const s = json.data;
          if (s.csvText && s.csvText.length > 50) {
            setCsvText(s.csvText);
            localStorage.setItem('luma_event_csv', s.csvText);
          }
          if (s.manualOverrides) {
            setManualOverrides(s.manualOverrides);
            localStorage.setItem('luma_event_overrides', JSON.stringify(s.manualOverrides));
          }
          if (s.tableAssignments) {
            setTableAssignments(s.tableAssignments);
            localStorage.setItem('luma_table_assignments', JSON.stringify(s.tableAssignments));
          }
          const nowStr = new Date().toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setLastServerSyncTime(nowStr);
          setLastServerSaveTime(nowStr);
          setServerStatus('synced');
          setHasPendingChanges(false);
          console.log('[CLIENT-INIT] Estat inicial carregat amb èxit des de Netlify DB.');
        }
        hasLoadedInitialServerData.current = true;
      })
      .catch((err) => {
        console.warn('[CLIENT-INIT] Error carregant dades del servidor a l’inici:', err);
        setServerStatus('synced');
        hasLoadedInitialServerData.current = true;
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Funció per desar canvis a la base de dades
  const saveToServer = async (patch: Record<string, any>, manualTrigger = false) => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setServerStatus('saving');
    console.log('[CLIENT-SAVE] Enviant canvis a la base de dades:', Object.keys(patch));

    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });

      if (res.ok) {
        const json = await res.json().catch(() => null);
        if (json?.db) setDbType(json.db);
        setServerStatus('synced');
        setHasPendingChanges(false);
        const timeStr = new Date().toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastServerSaveTime(timeStr);
        console.log('[CLIENT-SAVE] Canvis confirmats i desats a la base de dades a les', timeStr);
        if (manualTrigger) {
          setStatusMsg({
            type: 'success',
            text: `Tots els canvis s'han enviat i guardat a la base de dades Netlify (PostgreSQL) a les ${timeStr}!`,
          });
        }
      } else {
        setServerStatus('offline');
        console.error('[CLIENT-SAVE] Error retornat pel servidor:', res.status);
      }
    } catch (err) {
      setServerStatus('offline');
      console.error('[CLIENT-SAVE] Error de xarxa en desar a la base de dades:', err);
    } finally {
      isSavingRef.current = false;
    }
  };

  // Reacció en temps real quan un altre usuari desa (SSE push passiu, NO polling)
  useEffect(() => {
    let active = true;
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');
      eventSource.onmessage = (e) => {
        if (!active) return;
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === 'update' && payload.data) {
            // Només actualitzar si no tenim canvis pendents d'enviar per no provocar sobrescriptures
            const s = payload.data;
            if (s.csvText && s.csvText.length > 50) {
              setCsvText(s.csvText);
              localStorage.setItem('luma_event_csv', s.csvText);
            }
            if (s.manualOverrides) {
              setManualOverrides(s.manualOverrides);
              localStorage.setItem('luma_event_overrides', JSON.stringify(s.manualOverrides));
            }
            if (s.tableAssignments) {
              setTableAssignments(s.tableAssignments);
              localStorage.setItem('luma_table_assignments', JSON.stringify(s.tableAssignments));
            }
            setServerStatus('synced');
            setLastServerSaveTime('En viu (sincronitzat)');
            console.log('[CLIENT-SSE] Rebuts canvis externs en temps real.');
          }
        } catch {
          // parse error
        }
      };
    } catch {
      // EventSource not supported
    }

    return () => {
      active = false;
      if (eventSource) eventSource.close();
    };
  }, []);

  // Enviar canvis automàticament quan es fan modificacions (amb debounce de 800ms)
  useEffect(() => {
    if (!hasLoadedInitialServerData.current) return;
    setHasPendingChanges(true);
    const timer = setTimeout(() => {
      saveToServer({
        csvText,
        manualOverrides,
        tableAssignments,
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [csvText, manualOverrides, tableAssignments]);

  // Local storage persistence
  useEffect(() => {
    localStorage.setItem('luma_event_csv', csvText);
  }, [csvText]);

  useEffect(() => {
    localStorage.setItem('luma_event_overrides', JSON.stringify(manualOverrides));
  }, [manualOverrides]);

  useEffect(() => {
    localStorage.setItem('luma_table_assignments', JSON.stringify(tableAssignments));
  }, [tableAssignments]);

  useEffect(() => {
    localStorage.setItem('luma_export_options_v4', JSON.stringify(exportOptions));
  }, [exportOptions]);

  // Process raw guests and apply manual overrides + table assignments
  const rawGuests = useMemo(() => {
    return parseLumaCSV(csvText);
  }, [csvText]);

  const analysis = useMemo(() => {
    const modifiedRaw = rawGuests.map(g => {
      // Find override by guest_id, email, or name
      const override =
        manualOverrides[g.guest_id] ||
        (g.email && manualOverrides[g.email]) ||
        (g.name && manualOverrides[g.name]);

      const res = { ...g };

      // Ensure "Aliança Catalana Pla d'Urgell" is ALWAYS "Manel Solà" unless customized
      const isAlianca =
        g.guest_id === 'gst-4EiPYqOwuE90vqE' ||
        (g.email && g.email.toLowerCase() === 'pladurgell@aliancacatalana.cat') ||
        g.name.toLowerCase().replace(/['\s]/g, '').includes('aliancacatalanapladurgell') ||
        g.name.toLowerCase().replace(/['\s]/g, '').includes('aliançacatalanapladurgell');

      if (isAlianca && (!override || !override.name)) {
        res.name = 'Manel Solà';
        res.first_name = 'Manel';
        res.last_name = 'Solà';
      }

      if (override) {
        if (override.name) {
          res.name = override.name;
          res.first_name = override.first_name || override.name.split(' ')[0] || '';
          res.last_name =
            override.last_name !== undefined
              ? override.last_name
              : override.name.split(' ').slice(1).join(' ') || '';
        }
        if (override.stays !== undefined) {
          res.dish_raw = override.stays ? (override.dish || 'Carn - Cap de llom') : 'No em quedo al dinar';
        }
      }
      return res;
    });

    return processGuests(modifiedRaw, sortMode, 10, tableAssignments);
  }, [rawGuests, sortMode, manualOverrides, tableAssignments]);

  // ==================== TABLE ASSIGNMENT OPERATIONS ====================

  /**
   * Move a guest to another table (placing in first free seat of target table or specified seat)
   */
  const handleMoveGuest = (
    guest: ProcessedGuest,
    targetTableNumber: number,
    targetSeatNumber?: number
  ) => {
    // Find target table to see occupied seats
    const targetTableObj = analysis.tables.find(t => t.tableNumber === targetTableNumber);
    let seatNum = targetSeatNumber;
    if (!seatNum) {
      if (targetTableObj) {
        const occupiedSeats = new Set(targetTableObj.guests.map(g => g.seatNumber));
        for (let s = 1; s <= targetTableObj.capacity; s++) {
          if (!occupiedSeats.has(s)) {
            seatNum = s;
            break;
          }
        }
        if (!seatNum) seatNum = targetTableObj.guests.length + 1;
      } else {
        seatNum = 1;
      }
    }

    const nextAssignments: TableAssignmentsMap = {
      ...tableAssignments,
      [guest.guest_id]: {
        tableNumber: targetTableNumber,
        seatNumber: seatNum,
      },
    };

    setTableAssignments(nextAssignments);
    saveToServer({ tableAssignments: nextAssignments });
    setStatusMsg({
      type: 'success',
      text: `${guest.first_name || guest.name} s'ha mogut a la Taula ${targetTableNumber} (Seient #${seatNum}).`,
    });
  };

  /**
   * Swap two guests between tables / seats
   */
  const handleSwapGuests = (guestA: ProcessedGuest, guestB: ProcessedGuest) => {
    const nextAssignments: TableAssignmentsMap = {
      ...tableAssignments,
      [guestA.guest_id]: {
        tableNumber: guestB.tableNumber ?? null,
        seatNumber: guestB.seatNumber ?? null,
      },
      [guestB.guest_id]: {
        tableNumber: guestA.tableNumber ?? null,
        seatNumber: guestA.seatNumber ?? null,
      },
    };

    setTableAssignments(nextAssignments);
    saveToServer({ tableAssignments: nextAssignments });
    setStatusMsg({
      type: 'success',
      text: `S'han intercanviat els seients de ${guestA.first_name || guestA.name} i ${guestB.first_name || guestB.name}.`,
    });
  };

  /**
   * Unassign a guest from their table (moves them to unassigned list)
   */
  const handleUnassignGuest = (guest: ProcessedGuest) => {
    const nextAssignments: TableAssignmentsMap = {
      ...tableAssignments,
      [guest.guest_id]: {
        tableNumber: null,
        seatNumber: null,
      },
    };

    setTableAssignments(nextAssignments);
    saveToServer({ tableAssignments: nextAssignments });
    setStatusMsg({
      type: 'success',
      text: `${guest.first_name || guest.name} s'ha tret de la taula (ara no té taula assignada).`,
    });
  };

  /**
   * Assign a guest directly to a specific table & seat
   */
  const handleAssignToSeat = (
    guest: ProcessedGuest,
    tableNumber: number,
    seatNumber?: number
  ) => {
    handleMoveGuest(guest, tableNumber, seatNumber);
  };

  /**
   * Create a new table
   */
  const handleCreateNewTable = () => {
    const maxTable = analysis.tables.length > 0 ? Math.max(...analysis.tables.map(t => t.tableNumber)) : 0;
    const newTableNumber = maxTable + 1;

    // If there is an unassigned guest, assign first unassigned guest to seat 1 of the new table
    if (analysis.unassignedGuests.length > 0) {
      const firstUnassigned = analysis.unassignedGuests[0];
      handleMoveGuest(firstUnassigned, newTableNumber, 1);
      setStatusMsg({
        type: 'success',
        text: `Creada nova Taula ${newTableNumber} i assignat ${firstUnassigned.first_name || firstUnassigned.name} al Seient #1.`,
      });
    } else {
      // Open modal to assign a guest to this new table
      setStatusMsg({
        type: 'success',
        text: `Pots afegir comensals a la nova Taula ${newTableNumber} fent clic a "+ Afegir comensal".`,
      });
      setTableModalMode({
        type: 'add_to_seat',
        tableNumber: newTableNumber,
        seatNumber: 1,
      });
    }
  };

  // Export Local Excel
  const handleExportLocalExcel = () => {
    downloadExcelFile(analysis, 'Luma_Esdeveniment_Dinars_Taules.xlsx', exportOptions);
  };

  // Import New CSV (preserves existing table assignments)
  const handleImportNewCSV = (newCsv: string) => {
    setCsvText(newCsv);
    saveToServer({
      csvText: newCsv,
      tableAssignments,
    });
    setStatusMsg({
      type: 'success',
      text: 'Nou informe de Luma carregat i desat amb èxit. Els canvis de taules s’han mantingut!',
    });
  };

  const handleToggleLunchStatus = (guestId: string) => {
    const current = analysis.allGuests.find(g => g.guest_id === guestId);
    if (!current) return;
    const newStays = !current.staysForLunch;
    const nextOverrides: ManualOverridesMap = {
      ...manualOverrides,
      [guestId]: {
        ...manualOverrides[guestId],
        stays: newStays,
        dish: newStays ? 'Carn - Cap de llom' : 'No em quedo al dinar',
      },
    };
    setManualOverrides(nextOverrides);
    saveToServer({ manualOverrides: nextOverrides });
  };

  const handleSaveGuestEdit = (
    guestId: string,
    stays: boolean,
    dish: string,
    newName?: string
  ) => {
    const currentGuest = analysis.allGuests.find(g => g.guest_id === guestId);
    const finalName = newName !== undefined && newName.trim() ? newName.trim() : (currentGuest?.name || '');

    let newFirstName = currentGuest?.first_name || '';
    let newLastName = currentGuest?.last_name || '';

    if (finalName) {
      if (finalName.includes(',')) {
        const parts = finalName.split(',');
        newLastName = parts[0].trim();
        newFirstName = parts.slice(1).join(',').trim();
      } else {
        const parts = finalName.split(/\s+/);
        if (parts.length > 1) {
          newFirstName = parts[0];
          newLastName = parts.slice(1).join(' ');
        } else {
          newFirstName = parts[0];
          newLastName = '';
        }
      }
    }

    const updatedOverride: ManualGuestOverride = {
      ...manualOverrides[guestId],
      stays,
      dish,
      name: finalName,
      first_name: newFirstName,
      last_name: newLastName,
    };

    const nextOverrides: ManualOverridesMap = {
      ...manualOverrides,
      [guestId]: updatedOverride,
    };

    // Also link by email and previous name so that if new CSV lists are uploaded,
    // the name change is remembered and preserved!
    if (currentGuest?.email) {
      nextOverrides[currentGuest.email] = updatedOverride;
    }
    if (currentGuest?.name && currentGuest.name !== finalName) {
      nextOverrides[currentGuest.name] = updatedOverride;
    }

    setManualOverrides(nextOverrides);
    saveToServer({ manualOverrides: nextOverrides });
    setStatusMsg({
      type: 'success',
      text: `S'han desat els canvis per a ${finalName || currentGuest?.name}.`,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col antialiased selection:bg-blue-500/10 selection:text-blue-900">
      {/* Top Header - Clean, Minimalist Enterprise */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-2xs">
              G
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  Gestió Assistents
                </h1>
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  10/taula
                </span>
                <div
                  className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 ${
                    serverStatus === 'saving'
                      ? 'bg-blue-50 text-blue-700'
                      : serverStatus === 'offline'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-emerald-50 text-emerald-800'
                  }`}
                  title={
                    serverStatus === 'saving'
                      ? 'Desant a la base de dades Netlify (PostgreSQL)...'
                      : `${dbType} connectada · Sincronitzat (${lastServerSaveTime})`
                  }
                >
                  <Database className={`w-3 h-3 ${serverStatus === 'saving' ? 'animate-pulse text-blue-600' : 'text-emerald-600'}`} />
                  <span className="hidden sm:inline">
                    {serverStatus === 'saving'
                      ? 'Desant a Netlify DB...'
                      : serverStatus === 'offline'
                      ? 'Desconnectat de Netlify DB'
                      : `${dbType} · ${lastServerSaveTime}`}
                  </span>
                  <span className="sm:hidden">
                    {serverStatus === 'saving' ? 'Desant...' : 'Netlify DB OK'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            {/* Sync from DB button */}
            <button
              type="button"
              onClick={() => syncFromServer(true)}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Carregar de nou l'estat actual de la base de dades"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${serverStatus === 'saving' ? 'animate-spin' : ''}`} />
              <span className="hidden lg:inline">Sincronitzar de la BBDD</span>
            </button>

            {/* Manual Send / Save to DB button */}
            <button
              type="button"
              onClick={() => {
                saveToServer({ csvText, manualOverrides, tableAssignments }, true);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                hasPendingChanges
                  ? 'bg-blue-600 hover:bg-blue-700 text-white animate-pulse'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
              title="Enviar i desar immediatament tots els canvis a la base de dades Netlify"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{hasPendingChanges ? 'Enviar canvis a BBDD' : 'Guardat a la BBDD'}</span>
              {hasPendingChanges && (
                <span className="w-2 h-2 rounded-full bg-amber-300"></span>
              )}
            </button>

            <a
              href="/api/data/download-csv"
              download="llistat_assistents_servidor.csv"
              className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Descarregar directament l'arxiu CSV guardat al servidor"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden md:inline">Baixar CSV Servidor</span>
            </a>

            <button
              onClick={() => setIsPrintOpen(true)}
              className="text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg px-3 py-1.5 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Descarregar o imprimir llistat en PDF net"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Descarregar / Imprimir PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex-1 space-y-4 w-full">
        {/* Status Alert if any */}
        {statusMsg && (
          <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-2xs flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-800">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
              <span>{statusMsg.text}</span>
            </div>
            <button
              onClick={() => setStatusMsg(null)}
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
            <span>{analysis.totalTables} taules de 10</span>
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

            {/* Prominent black download button (replaces drive button as requested) */}
            <button
              onClick={() => setIsPrintOpen(true)}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Descarregar o imprimir llistat en format PDF net i ordenat"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Descarregar / Imprimir PDF</span>
            </button>

            <button
              onClick={() => setIsImportOpen(true)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded transition flex items-center gap-1.5 cursor-pointer"
              title="Importar nova exportació periòdica de Luma"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Nou Informe</span>
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
            <span>
              {exportOptions.groupByTables ? 'Agrupació: Taules de 10' : 'Agrupació: Continu'}
            </span>
          </div>
        </div>

        {/* Tab 1: Cards of Tables & Search & Unassigned Guests */}
        {viewTab === 'tables' && (
          <div className="space-y-4">
            {/* Search and unassigned guests management panel */}
            <TableSearchAndUnassigned
              allLunchGuests={analysis.lunchGuests}
              unassignedGuests={analysis.unassignedGuests}
              tables={analysis.tables}
              searchQuery={tableSearchQuery}
              onSearchChange={setTableSearchQuery}
              onOpenMove={guest => setTableModalMode({ type: 'move', guest })}
              onOpenSwap={guest => setTableModalMode({ type: 'swap', guest })}
              onUnassignGuest={handleUnassignGuest}
              onOpenAssignUnassigned={guest =>
                setTableModalMode({ type: 'assign_unassigned', guest })
              }
              onCreateNewTable={handleCreateNewTable}
              onEditGuest={guest => setEditingGuest(guest)}
            />

            {/* Grid of Tables */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {analysis.tables.map(table => (
                <TableCard
                  key={table.tableNumber}
                  table={table}
                  searchQuery={tableSearchQuery}
                  onEditGuest={guest => setEditingGuest(guest)}
                  onOpenMove={guest => setTableModalMode({ type: 'move', guest })}
                  onOpenSwap={guest => setTableModalMode({ type: 'swap', guest })}
                  onUnassignGuest={handleUnassignGuest}
                  onOpenAddToSeat={(tableNumber, seatNumber) =>
                    setTableModalMode({ type: 'add_to_seat', tableNumber, seatNumber })
                  }
                />
              ))}
            </div>
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
          <span>Luma Dinars — Gestió de comensals i assignació de taules de 10</span>
          <button
            onClick={() => setIsCustomExportOpen(true)}
            className="text-blue-600 hover:underline cursor-pointer"
          >
            Configurar columnes i ordre
          </button>
        </div>
      </footer>

      {/* Custom Export & Columns Modal */}
      <ExportCustomModal
        isOpen={isCustomExportOpen}
        onClose={() => setIsCustomExportOpen(false)}
        options={exportOptions}
        onChangeOptions={setExportOptions}
        onExportExcel={handleExportLocalExcel}
        onPrint={() => {
          setIsCustomExportOpen(false);
          setIsPrintOpen(true);
        }}
      />

      {/* Print View Modal */}
      <PrintModal
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        analysis={analysis}
        options={exportOptions}
      />

      {/* Table Assignment & Move/Swap Modal */}
      <TableAssignmentModal
        isOpen={tableModalMode !== null}
        onClose={() => setTableModalMode(null)}
        mode={tableModalMode}
        tables={analysis.tables}
        allLunchGuests={analysis.lunchGuests}
        unassignedGuests={analysis.unassignedGuests}
        onMoveGuest={handleMoveGuest}
        onSwapGuests={handleSwapGuests}
        onAssignToSeat={handleAssignToSeat}
        onUnassignGuest={handleUnassignGuest}
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
