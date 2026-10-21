import React, { useState } from 'react';
import { ProcessedGuest, TableGroup } from '../types';
import { formatFullNameSurnamesFirst } from '../lib/sorting';
import { X, ArrowRightLeft, MoveRight, UserPlus, Check, Search } from 'lucide-react';

export type AssignmentModalMode =
  | { type: 'move'; guest: ProcessedGuest }
  | { type: 'swap'; guest: ProcessedGuest }
  | { type: 'add_to_seat'; tableNumber: number; seatNumber: number }
  | { type: 'assign_unassigned'; guest: ProcessedGuest };

interface TableAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: AssignmentModalMode | null;
  tables: TableGroup[];
  allLunchGuests: ProcessedGuest[];
  unassignedGuests: ProcessedGuest[];
  onMoveGuest: (guest: ProcessedGuest, targetTableNumber: number, targetSeatNumber?: number) => void;
  onSwapGuests: (guestA: ProcessedGuest, guestB: ProcessedGuest) => void;
  onAssignToSeat: (guest: ProcessedGuest, tableNumber: number, seatNumber?: number) => void;
  onUnassignGuest: (guest: ProcessedGuest) => void;
}

export const TableAssignmentModal: React.FC<TableAssignmentModalProps> = ({
  isOpen,
  onClose,
  mode,
  tables,
  allLunchGuests,
  unassignedGuests,
  onMoveGuest,
  onSwapGuests,
  onAssignToSeat,
  onUnassignGuest,
}) => {
  const [targetTable, setTargetTable] = useState<number>(1);
  const [selectedTargetSeat, setSelectedTargetSeat] = useState<number | undefined>(undefined);
  const [selectedSwapGuestId, setSelectedSwapGuestId] = useState<string>('');
  const [selectedAddGuestId, setSelectedAddGuestId] = useState<string>('');
  const [guestSearchFilter, setGuestSearchFilter] = useState<string>('');

  // Automatically select a valid target table when modal opens
  React.useEffect(() => {
    if (!mode || !isOpen) return;
    setSelectedTargetSeat(undefined);
    setGuestSearchFilter('');
    setSelectedSwapGuestId('');
    setSelectedAddGuestId('');

    if (mode.type === 'move') {
      const current = mode.guest.tableNumber;
      // Prefer table that has free seats and isn't current
      const tableWithSpace = tables.find(t => t.tableNumber !== current && t.guests.length < t.capacity);
      const fallbackTable = tables.find(t => t.tableNumber !== current);
      setTargetTable(tableWithSpace ? tableWithSpace.tableNumber : fallbackTable ? fallbackTable.tableNumber : 1);
    } else if (mode.type === 'assign_unassigned') {
      const tableWithSpace = tables.find(t => t.guests.length < t.capacity);
      setTargetTable(tableWithSpace ? tableWithSpace.tableNumber : 1);
    }
  }, [mode, isOpen, tables]);

  if (!isOpen || !mode) return null;

  // Max table number existing
  const maxTableNum = tables.length > 0 ? Math.max(...tables.map(t => t.tableNumber)) : 0;
  const nextNewTableNum = maxTableNum + 1;

  // Handle Mode Actions
  const handleConfirmMove = () => {
    if (mode.type === 'move') {
      onMoveGuest(mode.guest, targetTable, selectedTargetSeat);
      onClose();
    }
  };

  const handleConfirmSwap = () => {
    if (mode.type === 'swap' && selectedSwapGuestId) {
      const guestB = allLunchGuests.find(g => g.guest_id === selectedSwapGuestId);
      if (guestB) {
        onSwapGuests(mode.guest, guestB);
        onClose();
      }
    }
  };

  const handleConfirmAddToSeat = () => {
    if (mode.type === 'add_to_seat' && selectedAddGuestId) {
      const guest = allLunchGuests.find(g => g.guest_id === selectedAddGuestId);
      if (guest) {
        onAssignToSeat(guest, mode.tableNumber, mode.seatNumber);
        onClose();
      }
    }
  };

  const handleConfirmAssignUnassigned = () => {
    if (mode.type === 'assign_unassigned') {
      onAssignToSeat(mode.guest, targetTable, selectedTargetSeat);
      onClose();
    }
  };

  // Filtered lists for swapping or adding
  const filteredSwapGuests = allLunchGuests.filter(g => {
    if (mode.type === 'swap' && g.guest_id === mode.guest.guest_id) return false;
    if (!guestSearchFilter.trim()) return true;
    const q = guestSearchFilter.toLowerCase();
    const nameStr = formatFullNameSurnamesFirst(g).toLowerCase();
    return nameStr.includes(q) || (g.municipi && g.municipi.toLowerCase().includes(q));
  });

  const availableGuestsToAdd = unassignedGuests.length > 0 ? unassignedGuests : allLunchGuests;
  const filteredAddGuests = availableGuestsToAdd.filter(g => {
    if (!guestSearchFilter.trim()) return true;
    const q = guestSearchFilter.toLowerCase();
    const nameStr = formatFullNameSurnamesFirst(g).toLowerCase();
    return nameStr.includes(q) || (g.municipi && g.municipi.toLowerCase().includes(q));
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col text-slate-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {mode.type === 'move' && <MoveRight className="w-4 h-4 text-slate-700" />}
            {mode.type === 'swap' && <ArrowRightLeft className="w-4 h-4 text-slate-700" />}
            {mode.type === 'add_to_seat' && <UserPlus className="w-4 h-4 text-slate-700" />}
            {mode.type === 'assign_unassigned' && <UserPlus className="w-4 h-4 text-slate-700" />}

            <h3 className="font-semibold text-sm text-slate-900">
              {mode.type === 'move' && 'Moure comensal a una altra taula'}
              {mode.type === 'swap' && 'Intercanviar persones de taula'}
              {mode.type === 'add_to_seat' && `Assignar comensal a Taula ${mode.tableNumber} (Seient #${mode.seatNumber})`}
              {mode.type === 'assign_unassigned' && 'Assignar comensal a una taula'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {/* MOVE GUEST */}
          {mode.type === 'move' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[11px] mb-0.5">Comensal a moure:</span>
                <span className="font-bold text-slate-900 text-sm block">
                  {formatFullNameSurnamesFirst(mode.guest)}
                </span>
                <span className="text-slate-500 text-[11px]">
                  {mode.guest.cleanDish} · Actualment a: {mode.guest.tableNumber ? `Taula ${mode.guest.tableNumber} (Seient #${mode.guest.seatNumber || '-'})` : 'Sense taula'}
                </span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">
                  Tria la taula de destinació:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-0.5">
                  {tables.map(t => {
                    const freeSeats = Math.max(0, t.capacity - t.guests.length);
                    const isCurrent = mode.guest.tableNumber === t.tableNumber;
                    const isSelected = targetTable === t.tableNumber;
                    return (
                      <button
                        key={t.tableNumber}
                        type="button"
                        onClick={() => setTargetTable(t.tableNumber)}
                        disabled={isCurrent}
                        className={`p-2.5 rounded-lg border text-left transition flex flex-col cursor-pointer ${
                          isCurrent
                            ? 'opacity-40 border-slate-200 bg-slate-100 cursor-not-allowed'
                            : isSelected
                            ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                            : 'border-slate-200 hover:border-slate-400 bg-white'
                        }`}
                      >
                        <span className="font-bold text-xs">Taula {t.tableNumber}{t.tableName ? ` (${t.tableName})` : ''}</span>
                        <span
                          className={`text-[10px] mt-0.5 ${
                            isSelected ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          {t.guests.length}/{t.capacity} ocupats ({freeSeats} lliures)
                        </span>
                      </button>
                    );
                  })}

                  {/* Create New Table option */}
                  <button
                    type="button"
                    onClick={() => setTargetTable(nextNewTableNum)}
                    className={`p-2.5 rounded-lg border text-left transition flex flex-col cursor-pointer ${
                      targetTable === nextNewTableNum
                        ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                        : 'border-dashed border-slate-300 hover:border-slate-600 bg-white text-slate-700'
                    }`}
                  >
                    <span className="font-bold text-xs">+ Nova Taula {nextNewTableNum}</span>
                    <span
                      className={`text-[10px] mt-0.5 ${
                        targetTable === nextNewTableNum ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      Obrir nova taula
                    </span>
                  </button>
                </div>

                {/* Optional Seat Selector in Move Mode */}
                {targetTable <= maxTableNum && (
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <label className="font-semibold text-slate-700 block mb-1 text-[11px]">
                      Seient a la Taula {targetTable}:
                    </label>
                    <select
                      value={selectedTargetSeat ?? ''}
                      onChange={e => setSelectedTargetSeat(e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium"
                    >
                      <option value="">Primer seient lliure disponible (Recomanat)</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => {
                        const targetTableObj = tables.find(t => t.tableNumber === targetTable);
                        const occ = targetTableObj?.guests.find(g => g.seatNumber === s);
                        return (
                          <option key={s} value={s}>
                            Seient #{s} {occ ? `(Ocupat per ${formatFullNameSurnamesFirst(occ)})` : '(Lliure)'}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onUnassignGuest(mode.guest);
                    onClose();
                  }}
                  className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-2 sm:py-1.5 rounded-lg text-xs font-medium transition cursor-pointer text-center min-h-[38px] sm:min-h-0"
                >
                  Treure de la taula (Deixar sense taula)
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 sm:flex-none px-3.5 py-2 sm:py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer min-h-[38px] sm:min-h-0 text-center"
                  >
                    Cancel·lar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmMove}
                    className="flex-1 sm:flex-none px-4 py-2 sm:py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold transition cursor-pointer min-h-[38px] sm:min-h-0 text-center shadow-2xs"
                  >
                    Moure a Taula {targetTable}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SWAP GUESTS */}
          {mode.type === 'swap' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 text-[11px] block">Primer comensal (Taula {mode.guest.tableNumber || '-'} · Seient #{mode.guest.seatNumber || '-'}):</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {formatFullNameSurnamesFirst(mode.guest)}
                  </span>
                  <span className="text-slate-500 text-[11px] block">
                    {mode.guest.cleanDish}
                  </span>
                </div>
                <ArrowRightLeft className="w-5 h-5 text-slate-400" />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Selecciona la segona persona amb qui intercanviar de seient:
                </label>
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={guestSearchFilter}
                    onChange={e => setGuestSearchFilter(e.target.value)}
                    placeholder="Filtrar per cognom, nom o municipi..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {filteredSwapGuests.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-xs italic">
                      No s'ha trobat cap comensal.
                    </div>
                  ) : (
                    filteredSwapGuests.map(g => {
                      const isSelected = selectedSwapGuestId === g.guest_id;
                      return (
                        <div
                          key={g.guest_id}
                          onClick={() => setSelectedSwapGuestId(g.guest_id)}
                          className={`px-3 py-2 flex items-center justify-between gap-3 cursor-pointer transition ${
                            isSelected ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="font-medium text-xs block truncate">
                              {formatFullNameSurnamesFirst(g)}
                            </span>
                            <span
                              className={`text-[10px] block truncate ${
                                isSelected ? 'text-slate-300' : 'text-slate-500'
                              }`}
                            >
                              {g.tableNumber ? `Taula ${g.tableNumber} (Seient #${g.seatNumber || '-'})` : 'Sense taula assignada'} · {g.cleanDish}
                            </span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 sm:py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer min-h-[38px] sm:min-h-0 text-center"
                >
                  Cancel·lar
                </button>
                <button
                  type="button"
                  disabled={!selectedSwapGuestId}
                  onClick={handleConfirmSwap}
                  className="px-4 py-2 sm:py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold transition cursor-pointer disabled:opacity-40 min-h-[38px] sm:min-h-0 text-center shadow-2xs"
                >
                  Intercanviar seients
                </button>
              </div>
            </div>
          )}

          {/* ADD GUEST TO SEAT */}
          {mode.type === 'add_to_seat' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 text-[11px] block">Seient a ocupar:</span>
                <span className="font-bold text-slate-900 text-sm">
                  Taula {mode.tableNumber} — Seient #{mode.seatNumber}
                </span>
                <span className="text-slate-500 text-[11px] block mt-0.5">
                  Tria el comensal que s'asseurà en aquesta plaça.
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700 block">
                    {unassignedGuests.length > 0
                      ? `Comensals sense taula (${unassignedGuests.length}):`
                      : 'Tots els comensals:'}
                  </label>
                  {unassignedGuests.length > 0 && (
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">
                      Prioritat: sense taula
                    </span>
                  )}
                </div>

                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={guestSearchFilter}
                    onChange={e => setGuestSearchFilter(e.target.value)}
                    placeholder="Filtrar per cognom o nom..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {filteredAddGuests.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-xs italic">
                      No hi ha cap comensal disponible.
                    </div>
                  ) : (
                    filteredAddGuests.map(g => {
                      const isSelected = selectedAddGuestId === g.guest_id;
                      return (
                        <div
                          key={g.guest_id}
                          onClick={() => setSelectedAddGuestId(g.guest_id)}
                          className={`px-3 py-2 flex items-center justify-between gap-3 cursor-pointer transition ${
                            isSelected ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="font-medium text-xs block truncate">
                              {formatFullNameSurnamesFirst(g)}
                            </span>
                            <span
                              className={`text-[10px] block truncate ${
                                isSelected ? 'text-slate-300' : 'text-slate-500'
                              }`}
                            >
                              {g.tableNumber ? `Actualment a Taula ${g.tableNumber}` : 'Sense taula'} · {g.cleanDish}
                            </span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 sm:py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer min-h-[38px] sm:min-h-0 text-center"
                >
                  Cancel·lar
                </button>
                <button
                  type="button"
                  disabled={!selectedAddGuestId}
                  onClick={handleConfirmAddToSeat}
                  className="px-4 py-2 sm:py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold transition cursor-pointer disabled:opacity-40 min-h-[38px] sm:min-h-0 text-center shadow-2xs"
                >
                  Assignar a Seient #{mode.seatNumber}
                </button>
              </div>
            </div>
          )}

          {/* ASSIGN UNASSIGNED GUEST */}
          {mode.type === 'assign_unassigned' && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200/80">
                <span className="text-amber-800 text-[11px] block font-medium">Comensal pendent d'assignar taula:</span>
                <span className="font-bold text-slate-900 text-sm block mt-0.5">
                  {formatFullNameSurnamesFirst(mode.guest)}
                </span>
                <span className="text-slate-600 text-[11px] block">
                  {mode.guest.cleanDish} {mode.guest.municipi ? `· ${mode.guest.municipi}` : ''}
                </span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">
                  Tria a quina taula vols asseure aquest comensal:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-0.5">
                  {tables.map(t => {
                    const freeSeats = Math.max(0, t.capacity - t.guests.length);
                    const isSelected = targetTable === t.tableNumber;
                    return (
                      <button
                        key={t.tableNumber}
                        type="button"
                        onClick={() => setTargetTable(t.tableNumber)}
                        className={`p-2.5 rounded-lg border text-left transition flex flex-col cursor-pointer ${
                          isSelected
                            ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                            : 'border-slate-200 hover:border-slate-400 bg-white'
                        }`}
                      >
                        <span className="font-bold text-xs">Taula {t.tableNumber}{t.tableName ? ` (${t.tableName})` : ''}</span>
                        <span
                          className={`text-[10px] mt-0.5 ${
                            isSelected ? 'text-slate-300' : freeSeats > 0 ? 'text-emerald-600 font-medium' : 'text-slate-500'
                          }`}
                        >
                          {t.guests.length}/{t.capacity} ({freeSeats} lliures)
                        </span>
                      </button>
                    );
                  })}

                  {/* Create New Table option */}
                  <button
                    type="button"
                    onClick={() => setTargetTable(nextNewTableNum)}
                    className={`p-2.5 rounded-lg border text-left transition flex flex-col cursor-pointer ${
                      targetTable === nextNewTableNum
                        ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                        : 'border-dashed border-slate-300 hover:border-slate-600 bg-white text-slate-700'
                    }`}
                  >
                    <span className="font-bold text-xs">+ Nova Taula {nextNewTableNum}</span>
                    <span
                      className={`text-[10px] mt-0.5 ${
                        targetTable === nextNewTableNum ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      Obrir nova taula
                    </span>
                  </button>
                </div>

                {/* Optional Seat Selector in Assign Mode */}
                {targetTable <= maxTableNum && (
                  <div className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-200/80">
                    <label className="font-semibold text-slate-700 block mb-1 text-[11px]">
                      Seient a la Taula {targetTable}:
                    </label>
                    <select
                      value={selectedTargetSeat ?? ''}
                      onChange={e => setSelectedTargetSeat(e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium"
                    >
                      <option value="">Primer seient lliure disponible (Recomanat)</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => {
                        const targetTableObj = tables.find(t => t.tableNumber === targetTable);
                        const occ = targetTableObj?.guests.find(g => g.seatNumber === s);
                        return (
                          <option key={s} value={s}>
                            Seient #{s} {occ ? `(Ocupat per ${formatFullNameSurnamesFirst(occ)})` : '(Lliure)'}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 sm:py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer min-h-[38px] sm:min-h-0 text-center"
                >
                  Cancel·lar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAssignUnassigned}
                  className="px-4 py-2 sm:py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold transition cursor-pointer min-h-[38px] sm:min-h-0 text-center shadow-2xs"
                >
                  Assignar a Taula {targetTable}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
