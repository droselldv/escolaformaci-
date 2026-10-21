/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { INITIAL_LUMA_CSV, INITIAL_TABLE_ASSIGNMENTS } from './data/initialData';
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
import { TableAssignmentModal, AssignmentModalMode } from './components/TableAssignmentModal';
import { TableSearchAndUnassigned } from './components/TableSearchAndUnassigned';
import { AddGuestModal } from './components/AddGuestModal';
import { supabase } from './lib/supabase';
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
  LayoutGrid,
  FileText,
  UserPlus,
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
      return saved ? JSON.parse(saved) : INITIAL_TABLE_ASSIGNMENTS;
    } catch {
      return INITIAL_TABLE_ASSIGNMENTS;
    }
  });

  // Custom table names/labels state (e.g. { 1: "Presidència", 2: "Joves" })
  const [tableNames, setTableNames] = useState<Record<number, string>>(() => {
    try {
      const saved = localStorage.getItem('luma_table_names');
      if (saved) return JSON.parse(saved);
      const savedOverrides = localStorage.getItem('luma_event_overrides');
      if (savedOverrides) {
        const parsed = JSON.parse(savedOverrides);
        if (parsed['__table_names__']) return parsed['__table_names__'];
      }
    } catch {}
    return {};
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
  const [isAddGuestOpen, setIsAddGuestOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<ProcessedGuest | null>(null);
  const [tableModalMode, setTableModalMode] = useState<AssignmentModalMode | null>(null);

  // Status message alert
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Server synchronization status
  const [serverStatus, setServerStatus] = useState<'synced' | 'saving' | 'offline'>('synced');
  const [dbType, setDbType] = useState<string>('Supabase (PostgreSQL)');
  const [lastServerSaveTime, setLastServerSaveTime] = useState<string>('En sincronia');
  const [hasPendingChanges, setHasPendingChanges] = useState<boolean>(false);
  const [lastServerSyncTime, setLastServerSyncTime] = useState<string>('');
  const hasLoadedInitialServerData = useRef(false);
  const isSavingRef = useRef(false);
  const pendingSavePatchRef = useRef<Record<string, any> | null>(null);

  // Client ID to identify the current browser session and avoid SSE broadcast echo loops
  const clientIdRef = useRef<string>(
    typeof window !== 'undefined'
      ? (() => {
          try {
            const stored = sessionStorage.getItem('luma_client_id');
            if (stored) return stored;
            const newId = `cli-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
            sessionStorage.setItem('luma_client_id', newId);
            return newId;
          } catch {
            return `cli-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
          }
        })()
      : 'cli-default'
  );

  // Fingerprint tracker of the state currently saved on the server
  const computeFingerprint = (
    csv: string,
    overrides: Record<string, any>,
    assignments: Record<string, any>,
    tNames?: Record<number, string>
  ) => {
    try {
      return `${csv.length}::${JSON.stringify(overrides || {})}::${JSON.stringify(assignments || {})}::${JSON.stringify(tNames || {})}`;
    } catch {
      return '';
    }
  };
  const lastSavedFingerprintRef = useRef<string>('');

  // Manual reload / sync from server on demand
  const syncFromServer = async (showNotification = false) => {
    try {
      console.log('[CLIENT] Sincronitzant amb el servidor i Supabase...');
      let s: any = null;
      let dbSource = 'Supabase';

      try {
        const res = await fetch('/api/data');
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            s = json.data;
            if (json.db) dbSource = json.db;
          }
        }
      } catch {
        // Fallback directly to Supabase client
      }

      if (!s) {
        const { data: row, error } = await supabase
          .from('event_state')
          .select('*')
          .eq('id', 'default')
          .single();
        if (!error && row) {
          s = {
            csvText: row.csv_text,
            manualOverrides: row.manual_overrides,
            tableAssignments: row.table_assignments,
            updatedAt: row.updated_at,
          };
          dbSource = 'Supabase (Directe)';
        }
      }

      if (s) {
        setDbType(dbSource);
        if (s.csvText && s.csvText.length > 50) {
          setCsvText(s.csvText);
          localStorage.setItem('luma_event_csv', s.csvText);
        }
        if (s.manualOverrides) {
          if (s.manualOverrides['__table_names__']) {
            setTableNames(s.manualOverrides['__table_names__']);
            localStorage.setItem('luma_table_names', JSON.stringify(s.manualOverrides['__table_names__']));
          }
          setManualOverrides(s.manualOverrides);
          localStorage.setItem('luma_event_overrides', JSON.stringify(s.manualOverrides));
        } else if (s.tableNames) {
          setTableNames(s.tableNames);
          localStorage.setItem('luma_table_names', JSON.stringify(s.tableNames));
        }
        if (s.tableAssignments) {
          setTableAssignments(s.tableAssignments);
          localStorage.setItem('luma_table_assignments', JSON.stringify(s.tableAssignments));
        }
        lastSavedFingerprintRef.current = computeFingerprint(
          (s.csvText && s.csvText.length > 50) ? s.csvText : csvText,
          s.manualOverrides || manualOverrides,
          s.tableAssignments || tableAssignments,
          (s.manualOverrides && s.manualOverrides['__table_names__']) || s.tableNames || tableNames
        );
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
        console.log('[CLIENT] Dades carregades correctament de la base de dades.');
      } else {
        throw new Error('No s’han pogut obtenir dades de cap font');
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

  // 1. Càrrega inicial exclusiva quan l'usuari entra a la pàgina
  useEffect(() => {
    let mounted = true;
    console.log('[CLIENT-INIT] Connexió inicial: recuperant estat de Supabase...');

    const loadInitial = async () => {
      let s: any = null;
      let dbSource = 'Supabase';

      try {
        const res = await fetch('/api/data');
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            s = json.data;
            if (json.db) dbSource = json.db;
          }
        }
      } catch {
        // Fallback to Supabase direct
      }

      if (!s) {
        try {
          const { data: row, error } = await supabase
            .from('event_state')
            .select('*')
            .eq('id', 'default')
            .single();
          if (!error && row) {
            s = {
              csvText: row.csv_text,
              manualOverrides: row.manual_overrides,
              tableAssignments: row.table_assignments,
              updatedAt: row.updated_at,
            };
            dbSource = 'Supabase (Directe)';
          }
        } catch {
          // ignore
        }
      }

      if (!mounted) return;

      if (s) {
        setDbType(dbSource);
        let loadedCsv = csvText;
        let loadedOverrides = manualOverrides;
        let loadedAssignments = tableAssignments;

        // Comprovem si tenim assignacions locals prèvies que l'usuari no vol perdre
        const hasExistingLocalAssignments = Boolean(
          tableAssignments && Object.keys(tableAssignments).length > 0
        );

        if (s.csvText && s.csvText.length > 50) {
          loadedCsv = s.csvText;
          setCsvText(s.csvText);
          localStorage.setItem('luma_event_csv', s.csvText);
        }
        if (s.manualOverrides) {
          if (s.manualOverrides['__table_names__']) {
            setTableNames(s.manualOverrides['__table_names__']);
            localStorage.setItem('luma_table_names', JSON.stringify(s.manualOverrides['__table_names__']));
          }
          loadedOverrides = s.manualOverrides;
          setManualOverrides(s.manualOverrides);
          localStorage.setItem('luma_event_overrides', JSON.stringify(s.manualOverrides));
        } else if (s.tableNames) {
          setTableNames(s.tableNames);
          localStorage.setItem('luma_table_names', JSON.stringify(s.tableNames));
        }
        // Només carreguem assignacions si el servidor en té més o si l'usuari no en té de pendents
        if (s.tableAssignments && (!hasExistingLocalAssignments || Object.keys(s.tableAssignments).length >= Object.keys(tableAssignments).length)) {
          loadedAssignments = s.tableAssignments;
          setTableAssignments(s.tableAssignments);
          localStorage.setItem('luma_table_assignments', JSON.stringify(s.tableAssignments));
        }

        lastSavedFingerprintRef.current = computeFingerprint(
          loadedCsv,
          loadedOverrides,
          loadedAssignments,
          (s.manualOverrides && s.manualOverrides['__table_names__']) || s.tableNames || tableNames
        );
        const nowStr = new Date().toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastServerSyncTime(nowStr);
        setLastServerSaveTime(nowStr);
        setServerStatus('synced');
        setHasPendingChanges(false);
        console.log('[CLIENT-INIT] Estat inicial carregat amb èxit des de Supabase.');
      } else {
        setServerStatus('synced');
      }
      hasLoadedInitialServerData.current = true;
    };

    loadInitial();

    return () => {
      mounted = false;
    };
  }, []);

  // Pujar de forma segura tots els canvis locals a Supabase garantint que no es perdi res
  const uploadLocalChangesToDb = async () => {
    try {
      setServerStatus('saving');
      setStatusMsg({
        type: 'success',
        text: 'Pujant tots els canvis locals a Supabase...',
      });

      const finalOverrides = {
        ...manualOverrides,
        ['__table_names__']: tableNames,
      };

      // Primer provem Supabase directament (100% garantit per HTTPS)
      const { error: sbErr } = await supabase.from('event_state').upsert({
        id: 'default',
        csv_text: csvText,
        manual_overrides: finalOverrides,
        table_assignments: tableAssignments,
        updated_at: new Date().toISOString()
      });

      if (!sbErr) {
        setDbType('Supabase');
        setServerStatus('synced');
        setHasPendingChanges(false);
        const timeStr = new Date().toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastServerSaveTime(timeStr);
        lastSavedFingerprintRef.current = computeFingerprint(csvText, finalOverrides, tableAssignments, tableNames);
        setStatusMsg({
          type: 'success',
          text: `✅ Tots els canvis locals s'han pujat i guardat a la base de dades a les ${timeStr}!`,
        });

        // Opcionalment avisem el servidor Express local
        fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            csvText,
            manualOverrides: finalOverrides,
            tableAssignments,
            tableNames,
            clientId: clientIdRef.current,
          }),
        }).catch(() => {});
      } else {
        throw new Error(sbErr.message);
      }
    } catch (err: any) {
      console.warn('[UPLOAD-LOCAL] Error pujant directe a Supabase, intentant servidor:', err);
      saveToServer({ csvText, manualOverrides, tableAssignments, tableNames }, true);
    }
  };

  // Funció per desar canvis a la base de dades amb cua i prevenció de peticions innecessàries
  const saveToServer = async (patch: Record<string, any>, manualTrigger = false) => {
    const nextCsv = patch.csvText !== undefined ? patch.csvText : csvText;
    const baseOverrides = patch.manualOverrides !== undefined ? patch.manualOverrides : manualOverrides;
    const nextAssignments = patch.tableAssignments !== undefined ? patch.tableAssignments : tableAssignments;
    const nextTableNames = patch.tableNames !== undefined ? patch.tableNames : tableNames;
    const nextOverrides = {
      ...baseOverrides,
      ['__table_names__']: nextTableNames,
    };
    const nextFingerprint = computeFingerprint(nextCsv, nextOverrides, nextAssignments, nextTableNames);

    // Evitem desar si és idèntic al que ja està confirmat i guardat (tret que sigui un clic manual d'usuari)
    if (!manualTrigger && nextFingerprint === lastSavedFingerprintRef.current) {
      setHasPendingChanges(false);
      return;
    }

    lastSavedFingerprintRef.current = nextFingerprint;

    if (isSavingRef.current) {
      pendingSavePatchRef.current = { ...(pendingSavePatchRef.current || {}), ...patch };
      return;
    }
    isSavingRef.current = true;
    setServerStatus('saving');
    console.log('[CLIENT-SAVE] Enviant canvis a la base de dades:', Object.keys(patch));

    try {
      let savedSuccessfully = false;

      // Intentem primer mitjançant la ruta del servidor
      try {
        const clientId = clientIdRef.current;
        const res = await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...patch,
            clientId,
          }),
        });

        if (res.ok) {
          const json = await res.json().catch(() => null);
          if (json?.db) setDbType(json.db);
          savedSuccessfully = true;
        }
      } catch (fetchErr) {
        console.warn('[CLIENT-SAVE] Error servidor /api/data, provant Supabase directe...');
      }

      // Si el servidor ha fallat o retornat error, desem directament a Supabase
      if (!savedSuccessfully) {
        const { error: sbErr } = await supabase.from('event_state').upsert({
          id: 'default',
          csv_text: nextCsv,
          manual_overrides: nextOverrides,
          table_assignments: nextAssignments,
          updated_at: new Date().toISOString()
        });

        if (!sbErr) {
          setDbType('Supabase');
          savedSuccessfully = true;
        } else {
          console.error('[CLIENT-SAVE] Error Supabase:', sbErr.message);
        }
      }

      if (savedSuccessfully) {
        setServerStatus('synced');
        setHasPendingChanges(false);
        const timeStr = new Date().toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastServerSaveTime(timeStr);
        console.log('[CLIENT-SAVE] Canvis confirmats i desats a la base de dades a les', timeStr);
        if (manualTrigger) {
          setStatusMsg({
            type: 'success',
            text: `Tots els canvis s'han enviat i guardat a la base de dades a les ${timeStr}!`,
          });
        }
      } else {
        setServerStatus('offline');
        console.error('[CLIENT-SAVE] No s’han pogut desar els canvis a la base de dades.');
      }
    } catch (err) {
      setServerStatus('offline');
      console.error('[CLIENT-SAVE] Error de xarxa en desar a la base de dades:', err);
    } finally {
      isSavingRef.current = false;
      if (pendingSavePatchRef.current) {
        const nextPatch = pendingSavePatchRef.current;
        pendingSavePatchRef.current = null;
        saveToServer(nextPatch, false);
      }
    }
  };

  // Reacció en temps real quan un altre usuari desa (SSE push passiu, NO polling, sense auto-eco)
  useEffect(() => {
    let active = true;
    let eventSource: EventSource | null = null;
    try {
      const clientId = clientIdRef.current;
      eventSource = new EventSource(`/api/events?clientId=${encodeURIComponent(clientId)}`);
      
      eventSource.onmessage = (e) => {
        if (!active) return;
        try {
          const payload = JSON.parse(e.data);

          // Si el missatge prové d'aquesta mateixa pestanya/client, ignorem per evitar bucle
          if (payload.originClientId && payload.originClientId === clientId) {
            return;
          }

          if (payload.type === 'update' && payload.data) {
            const s = payload.data;
            let updatedCsv = csvText;
            let updatedOverrides = manualOverrides;
            let updatedAssignments = tableAssignments;

            if (s.csvText && s.csvText.length > 50) {
              updatedCsv = s.csvText;
              setCsvText(s.csvText);
              localStorage.setItem('luma_event_csv', s.csvText);
            }
            if (s.manualOverrides) {
              if (s.manualOverrides['__table_names__']) {
                setTableNames(s.manualOverrides['__table_names__']);
                localStorage.setItem('luma_table_names', JSON.stringify(s.manualOverrides['__table_names__']));
              }
              updatedOverrides = s.manualOverrides;
              setManualOverrides(s.manualOverrides);
              localStorage.setItem('luma_event_overrides', JSON.stringify(s.manualOverrides));
            } else if (s.tableNames) {
              setTableNames(s.tableNames);
              localStorage.setItem('luma_table_names', JSON.stringify(s.tableNames));
            }
            if (s.tableAssignments) {
              updatedAssignments = s.tableAssignments;
              setTableAssignments(s.tableAssignments);
              localStorage.setItem('luma_table_assignments', JSON.stringify(s.tableAssignments));
            }

            // Actualitzem l'empremta perquè l'auto-save no re-enviï el que acabem de rebre del servidor
            lastSavedFingerprintRef.current = computeFingerprint(
              updatedCsv,
              updatedOverrides,
              updatedAssignments,
              (s.manualOverrides && s.manualOverrides['__table_names__']) || s.tableNames || tableNames
            );
            setServerStatus('synced');
            setHasPendingChanges(false);
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

  // Enviar canvis automàticament quan es fan modificacions locals (amb debounce prudent de 1.2s i comprovació d'empremta)
  useEffect(() => {
    if (!hasLoadedInitialServerData.current) return;

    const currentFingerprint = computeFingerprint(csvText, manualOverrides, tableAssignments, tableNames);
    // Si l'estat actual és idèntic al que ja està guardat al servidor, no cal desar res
    if (currentFingerprint === lastSavedFingerprintRef.current) {
      setHasPendingChanges(false);
      return;
    }

    setHasPendingChanges(true);
    const timer = setTimeout(() => {
      saveToServer({
        csvText,
        manualOverrides,
        tableAssignments,
        tableNames,
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [csvText, manualOverrides, tableAssignments, tableNames]);

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
    localStorage.setItem('luma_table_names', JSON.stringify(tableNames));
  }, [tableNames]);

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
        if (override.stays === false) {
          res.dish_raw = 'No em quedo al dinar';
        } else if (override.dish && override.dish.trim()) {
          res.dish_raw = override.dish.trim();
        }
      }
      return res;
    });

    return processGuests(modifiedRaw, sortMode, 10, tableAssignments, tableNames);
  }, [rawGuests, sortMode, manualOverrides, tableAssignments, tableNames]);

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
    saveToServer({ csvText, manualOverrides, tableAssignments: nextAssignments });
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
    saveToServer({ csvText, manualOverrides, tableAssignments: nextAssignments });
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
    saveToServer({ csvText, manualOverrides, tableAssignments: nextAssignments });
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
   * Reset all tables back to initial chronological layout
   */
  const handleResetTables = async () => {
    if (!window.confirm("Vols restablir totes les taules a la distribució oficial per defecte?")) {
      return;
    }
    setTableAssignments(INITIAL_TABLE_ASSIGNMENTS);
    try {
      await fetch('/api/reset-tables', { method: 'POST' });
    } catch {
      // ignore
    }
    saveToServer({ csvText, manualOverrides, tableAssignments: INITIAL_TABLE_ASSIGNMENTS }, true);
    setStatusMsg({
      type: 'success',
      text: "Les taules s'han restablert a la distribució oficial de les 27 taules de 10 comensals.",
    });
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

  /**
   * Change custom name of a table
   */
  const handleRenameTable = (tableNumber: number, newName: string) => {
    const nextTableNames: Record<number, string> = { ...tableNames };
    const cleanName = newName.trim();
    if (!cleanName) {
      delete nextTableNames[tableNumber];
    } else {
      nextTableNames[tableNumber] = cleanName;
    }

    setTableNames(nextTableNames);
    localStorage.setItem('luma_table_names', JSON.stringify(nextTableNames));

    const nextOverrides: ManualOverridesMap = {
      ...manualOverrides,
      ['__table_names__']: nextTableNames as any,
    };
    setManualOverrides(nextOverrides);

    saveToServer(
      {
        csvText,
        manualOverrides: nextOverrides,
        tableAssignments,
        tableNames: nextTableNames,
      },
      true
    );

    setStatusMsg({
      type: 'success',
      text: cleanName
        ? `S'ha canviat el nom de la Taula ${tableNumber} a "${cleanName}".`
        : `S'ha suprimit el nom personalitzat de la Taula ${tableNumber}.`,
    });
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
      manualOverrides,
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
    saveToServer({ csvText, manualOverrides: nextOverrides, tableAssignments });
  };

  const handleSaveGuestEdit = (
    guestId: string,
    stays: boolean,
    dish: string,
    newName?: string,
    targetTableNumber?: number | null,
    targetSeatNumber?: number | null
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

    const nextAssignments: TableAssignmentsMap = { ...tableAssignments };
    if (targetTableNumber !== undefined) {
      if (targetTableNumber === null) {
        nextAssignments[guestId] = { tableNumber: null, seatNumber: null };
      } else if (typeof targetTableNumber === 'number' && targetTableNumber > 0) {
        nextAssignments[guestId] = {
          tableNumber: targetTableNumber,
          seatNumber: targetSeatNumber ?? null,
        };
      }
    }

    setManualOverrides(nextOverrides);
    setTableAssignments(nextAssignments);
    saveToServer({ csvText, manualOverrides: nextOverrides, tableAssignments: nextAssignments });
    setStatusMsg({
      type: 'success',
      text: `S'han desat els canvis per a ${finalName || currentGuest?.name}.`,
    });
  };

  /**
   * Helper to escape CSV cell
   */
  const escapeCsv = (val?: string | null): string => {
    if (val === null || val === undefined) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  /**
   * Add a brand new guest/diner manually
   */
  const handleAddGuest = (guestData: {
    name: string;
    staysForLunch: boolean;
    dish: string;
    tableNumber: number | null;
    seatNumber: number | null;
    municipi?: string;
    comarca?: string;
    phone?: string;
    email?: string;
  }) => {
    const rawName = guestData.name.trim();
    let firstName = '';
    let lastName = '';
    if (rawName.includes(',')) {
      const parts = rawName.split(',');
      lastName = parts[0].trim();
      firstName = parts.slice(1).join(',').trim();
    } else {
      const parts = rawName.split(/\s+/);
      if (parts.length > 1) {
        firstName = parts[0];
        lastName = parts.slice(1).join(' ');
      } else {
        firstName = parts[0];
        lastName = '';
      }
    }

    const uniqueId = `gst-manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const createdAt = new Date().toISOString();
    const ticketName = guestData.staysForLunch ? 'Formació + Dinar' : 'Formació';
    const dish = guestData.staysForLunch ? (guestData.dish || 'Carn - Cap de llom') : 'No em quedo al dinar';

    // 38 columns matching header
    const rowFields = [
      uniqueId,                                       // 0: guest_id
      rawName,                                        // 1: name
      firstName,                                      // 2: first_name
      lastName,                                       // 3: last_name
      guestData.email || '',                          // 4: email
      guestData.phone || '',                          // 5: phone_number
      createdAt,                                      // 6: created_at
      'approved',                                     // 7: approval_status
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', // 8-23
      guestData.staysForLunch ? '€38.00' : '€15.00',  // 24: amount
      '', '',                                         // 25-26
      'eur',                                          // 27: currency
      '', '', '', '', '', '',                         // 28-33
      ticketName,                                     // 34: ticket_name
      guestData.comarca || '',                        // 35: Comarca
      guestData.municipi || '',                       // 36: Municipi
      dish,                                           // 37: Dinar - Segon plat a escollir (si escau)
    ];

    const newRow = rowFields.map(escapeCsv).join(',');
    const nextCsv = csvText.trimEnd() + '\n' + newRow;

    // Table assignment
    const nextAssignments: TableAssignmentsMap = { ...tableAssignments };
    if (guestData.staysForLunch && guestData.tableNumber) {
      nextAssignments[uniqueId] = {
        tableNumber: guestData.tableNumber,
        seatNumber: guestData.seatNumber ?? null,
      };
    }

    // Manual override to ensure exact dish and name preservation
    const nextOverrides: ManualOverridesMap = {
      ...manualOverrides,
      [uniqueId]: {
        name: rawName,
        first_name: firstName,
        last_name: lastName,
        stays: guestData.staysForLunch,
        dish: dish,
      },
    };
    if (guestData.email) {
      nextOverrides[guestData.email] = nextOverrides[uniqueId];
    }

    setCsvText(nextCsv);
    setTableAssignments(nextAssignments);
    setManualOverrides(nextOverrides);

    // Persist to server & Supabase immediately
    saveToServer(
      {
        csvText: nextCsv,
        tableAssignments: nextAssignments,
        manualOverrides: nextOverrides,
      },
      true
    );

    setStatusMsg({
      type: 'success',
      text: `S'ha afegit correctament ${rawName}${
        guestData.staysForLunch && guestData.tableNumber
          ? ` a la Taula ${guestData.tableNumber}${guestData.seatNumber ? ` (Seient #${guestData.seatNumber})` : ''}`
          : ''
      }.`,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col antialiased selection:bg-blue-500/10 selection:text-blue-900">
      {/* Top Header - Clean, Minimalist Enterprise */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-7 h-7 sm:w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs sm:text-sm tracking-tight shadow-2xs shrink-0">
              G
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h1 className="text-xs sm:text-base font-bold text-slate-900 tracking-tight truncate">
                  Gestió Assistents
                </h1>
                <span className="hidden xs:inline-block text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">
                  10/taula
                </span>
                <div
                  className={`text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0 ${
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
                      ? 'Desconnectat'
                      : `${dbType} · ${lastServerSaveTime}`}
                  </span>
                  <span className="sm:hidden font-mono text-[10px]">
                    {serverStatus === 'saving' ? 'Desant...' : 'BBDD OK'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Sync from DB button */}
            <button
              type="button"
              onClick={() => syncFromServer(true)}
              className="p-2 sm:px-2.5 sm:py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs min-h-[36px] sm:min-h-0"
              title="Carregar de nou l'estat actual de la base de dades Netlify"
              aria-label="Sincronitzar de la BBDD"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${serverStatus === 'saving' ? 'animate-spin' : ''}`} />
              <span className="hidden lg:inline">Sincronitzar</span>
            </button>

            {/* Manual Send / Save to DB button */}
            <button
              type="button"
              onClick={uploadLocalChangesToDb}
              className={`px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs min-h-[36px] sm:min-h-0 ${
                hasPendingChanges
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
              title="Pujar i assegurar tots els teus canvis locals directament a Supabase"
            >
              <Database className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{hasPendingChanges ? 'Pujar canvis a Supabase' : 'Pujar canvis locals a BBDD'}</span>
              <span className="sm:hidden">Pujar BBDD</span>
              {hasPendingChanges && (
                <span className="w-2 h-2 rounded-full bg-amber-300 animate-ping"></span>
              )}
            </button>

            <a
              href="/api/data/download-csv"
              download="llistat_assistents_servidor.csv"
              className="hidden md:inline-flex px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Descarregar directament l'arxiu CSV guardat al servidor"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden lg:inline">Baixar CSV Servidor</span>
            </a>

            <button
              onClick={() => setIsPrintOpen(true)}
              className="hidden sm:inline-flex text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg px-3 py-1.5 transition items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Descarregar o imprimir llistat en PDF net"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Descarregar / Imprimir PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-5 flex-1 space-y-4 w-full pb-24 sm:pb-6">
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
        <div className="bg-white rounded-lg p-3 sm:p-3.5 border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs shadow-2xs">
          {/* Summary status text */}
          <div className="flex items-center gap-2 text-slate-600 flex-wrap">
            <span className="font-bold text-slate-900">
              {analysis.totalLunch} comensals
            </span>
            <span className="text-slate-300">·</span>
            <span className="font-medium text-slate-700">{analysis.totalTables} taules de 10</span>
            <span className="text-slate-300 hidden sm:inline">·</span>
            <span className="text-slate-500 hidden sm:inline">
              Ordre: {exportOptions.sortBy === 'alpha_name' ? 'Alfabètic per nom' : exportOptions.sortBy === 'alpha_lastname' ? 'Alfabètic per cognom' : 'Per taula'}
            </span>
          </div>

          {/* Action buttons responsive grid */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
            {/* Nou Assistent button */}
            <button
              onClick={() => setIsAddGuestOpen(true)}
              className="col-span-2 sm:col-span-1 px-3.5 py-2 sm:py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs min-h-[38px] sm:min-h-0"
              title="Afegir un nou assistent o comensal manualment"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Nou Assistent</span>
            </button>

            {/* Prominent black download button (Full width on mobile) */}
            <button
              onClick={() => setIsPrintOpen(true)}
              className="px-3.5 py-2 sm:py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs min-h-[38px] sm:min-h-0"
              title="Descarregar o imprimir llistat en format PDF net i ordenat"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>

            <button
              onClick={handleExportLocalExcel}
              className="px-3 py-2 sm:py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px] sm:min-h-0 shadow-2xs"
              title="Descarregar fitxer Excel amb els 3 fulls i columnes triades"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Excel</span>
            </button>

            <button
              onClick={() => setIsCustomExportOpen(true)}
              className="px-3 py-2 sm:py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px] sm:min-h-0 shadow-2xs"
              title="Personalitzar columnes, ordre alfabètic i agrupació"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Personalitzar</span>
            </button>

            <button
              onClick={() => setIsImportOpen(true)}
              className="col-span-2 sm:col-span-1 px-3 py-2 sm:py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 sm:border-transparent rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px] sm:min-h-0"
              title="Importar nova exportació periòdica de Luma"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>Nou Informe CSV</span>
            </button>
          </div>
        </div>

        {/* Minimalist Metrics Cards */}
        <OverviewCards analysis={analysis} />

        {/* View Mode Bar - Segmented Control for Mobile */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs pt-1">
          <div className="grid grid-cols-2 p-1 bg-slate-200/80 rounded-xl sm:flex sm:bg-transparent sm:p-0 sm:gap-4 sm:border-b sm:border-slate-200 w-full sm:w-auto text-center font-medium">
            <button
              onClick={() => setViewTab('tables')}
              className={`py-2 sm:py-1 px-3 rounded-lg sm:rounded-none font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                viewTab === 'tables'
                  ? 'bg-white sm:bg-transparent text-slate-900 sm:border-b-2 sm:border-slate-900 shadow-2xs sm:shadow-none'
                  : 'text-slate-600 hover:text-slate-900 border-transparent'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 sm:hidden" />
              <span>Taules ({analysis.totalTables})</span>
            </button>

            <button
              onClick={() => setViewTab('sheets')}
              className={`py-2 sm:py-1 px-3 rounded-lg sm:rounded-none font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                viewTab === 'sheets'
                  ? 'bg-white sm:bg-transparent text-slate-900 sm:border-b-2 sm:border-slate-900 shadow-2xs sm:shadow-none'
                  : 'text-slate-600 hover:text-slate-900 border-transparent'
              }`}
            >
              <FileText className="w-3.5 h-3.5 sm:hidden" />
              <span>Llistat d'Assistents</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-slate-500 text-[11px]">
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
              onOpenAddGuest={() => setIsAddGuestOpen(true)}
              onResetTables={handleResetTables}
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
                  onRenameTable={handleRenameTable}
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
            onOpenAddGuest={() => setIsAddGuestOpen(true)}
            onRenameTable={handleRenameTable}
          />
        )}
      </main>

      {/* Minimalist Footer (Desktop) */}
      <footer className="mt-auto py-4 border-t border-slate-200 bg-white text-center text-xs text-slate-400 hidden sm:block">
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

      {/* Mobile Fixed Bottom Navigation Bar (Pattern 1 Thumb Zone) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 py-1 px-3 flex items-center justify-around shadow-lg">
        <button
          type="button"
          onClick={() => setViewTab('tables')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition cursor-pointer min-w-[56px] min-h-[44px] ${
            viewTab === 'tables'
              ? 'text-slate-900 font-semibold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span className="text-[10px] tracking-tight mt-0.5">Taules</span>
        </button>

        <button
          type="button"
          onClick={() => setViewTab('sheets')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition cursor-pointer min-w-[56px] min-h-[44px] ${
            viewTab === 'sheets'
              ? 'text-slate-900 font-semibold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span className="text-[10px] tracking-tight mt-0.5">Llistat</span>
        </button>

        <button
          type="button"
          onClick={() => setIsPrintOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-lg text-slate-700 hover:text-slate-900 transition cursor-pointer min-w-[56px] min-h-[44px]"
        >
          <Printer className="w-4 h-4" />
          <span className="text-[10px] tracking-tight mt-0.5">PDF</span>
        </button>

        <button
          type="button"
          onClick={() => {
            saveToServer({ csvText, manualOverrides, tableAssignments }, true);
          }}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition cursor-pointer min-w-[56px] min-h-[44px] relative ${
            hasPendingChanges ? 'text-blue-600 font-semibold' : 'text-slate-700'
          }`}
        >
          <Database className="w-4 h-4" />
          <span className="text-[10px] tracking-tight mt-0.5">
            {hasPendingChanges ? 'Desar' : 'BBDD'}
          </span>
          {hasPendingChanges && (
            <span className="absolute top-1.5 right-4 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          )}
        </button>
      </nav>

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
        tables={analysis.tables}
        onClose={() => setEditingGuest(null)}
        onSave={handleSaveGuestEdit}
      />

      {/* Add Guest Modal */}
      <AddGuestModal
        isOpen={isAddGuestOpen}
        tables={analysis.tables}
        onClose={() => setIsAddGuestOpen(false)}
        onAddGuest={handleAddGuest}
      />
    </div>
  );
}
