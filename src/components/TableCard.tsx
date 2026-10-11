import React, { useState } from 'react';
import { TableGroup, ProcessedGuest } from '../types';
import { formatFullNameSurnamesFirst } from '../lib/sorting';
import {
  Copy,
  Check,
  UserPlus,
  ArrowRightLeft,
  MoveRight,
  UserMinus,
  Edit2,
  MoreVertical,
} from 'lucide-react';

interface TableCardProps {
  table: TableGroup;
  searchQuery?: string;
  onEditGuest?: (guest: ProcessedGuest) => void;
  onOpenMove?: (guest: ProcessedGuest) => void;
  onOpenSwap?: (guest: ProcessedGuest) => void;
  onUnassignGuest?: (guest: ProcessedGuest) => void;
  onOpenAddToSeat?: (tableNumber: number, seatNumber: number) => void;
}

export const TableCard: React.FC<TableCardProps> = ({
  table,
  searchQuery = '',
  onEditGuest,
  onOpenMove,
  onOpenSwap,
  onUnassignGuest,
  onOpenAddToSeat,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeMenuGuestId, setActiveMenuGuestId] = useState<string | null>(null);

  const carnCount = table.dishCounts['Carn - Cap de llom'] || 0;
  const peixCount = table.dishCounts['Peix - Orada'] || 0;

  const handleCopyList = () => {
    const text = [
      `Taula ${table.tableNumber} (${table.guests.length}/${table.capacity} comensals) - Carn: ${carnCount}, Peix: ${peixCount}`,
      ...table.guests.map(
        g =>
          `${g.seatNumber || '-'}. ${formatFullNameSurnamesFirst(g)} - ${g.cleanDish} (${
            g.municipi || g.comarca || '-'
          }, Tel: ${g.phone_number || '-'})`
      ),
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const freeSeatsCount = Math.max(0, table.capacity - table.guests.length);

  // Check if any guest matches search query
  const q = searchQuery.trim().toLowerCase();
  const hasMatchingGuest =
    q.length > 0 &&
    table.guests.some(g => {
      const name = formatFullNameSurnamesFirst(g).toLowerCase();
      const mun = (g.municipi || '').toLowerCase();
      return name.includes(q) || mun.includes(q);
    });

  // Map seats 1..capacity
  // Build an ordered array of seats where occupied seats have the guest, and empty seats have null
  const seatsArray: { seatNumber: number; guest: ProcessedGuest | null }[] = [];
  const assignedGuests = [...table.guests];

  for (let s = 1; s <= table.capacity; s++) {
    // Try to find guest with explicit seatNumber === s
    const foundIdx = assignedGuests.findIndex(g => g.seatNumber === s);
    if (foundIdx !== -1) {
      seatsArray.push({ seatNumber: s, guest: assignedGuests[foundIdx] });
      assignedGuests.splice(foundIdx, 1);
    } else {
      seatsArray.push({ seatNumber: s, guest: null });
    }
  }

  // Any leftover guests without matching seatNumber fill the first available null seats
  assignedGuests.forEach(g => {
    const freeIdx = seatsArray.findIndex(s => s.guest === null);
    if (freeIdx !== -1) {
      seatsArray[freeIdx].guest = g;
    } else {
      seatsArray.push({ seatNumber: seatsArray.length + 1, guest: g });
    }
  });

  return (
    <div
      id={`table-card-${table.tableNumber}`}
      className={`bg-white rounded-lg border transition duration-150 overflow-hidden flex flex-col text-xs shadow-2xs ${
        hasMatchingGuest
          ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Table Header */}
      <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900 text-sm">Taula {table.tableNumber}</span>
          <span className="text-slate-300">·</span>
          <span
            className={`font-semibold text-[11px] px-2 py-0.5 rounded-full ${
              freeSeatsCount === 0
                ? 'bg-slate-200/80 text-slate-700'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
            }`}
          >
            {table.guests.length}/{table.capacity} ocupats
            {freeSeatsCount > 0 ? ` (${freeSeatsCount} lliures)` : ' (completa)'}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5 hidden sm:flex">
            <span>C: <strong>{carnCount}</strong></span>
            <span>P: <strong>{peixCount}</strong></span>
          </div>

          <button
            onClick={handleCopyList}
            className="text-[11px] text-slate-500 hover:text-slate-900 p-1 rounded hover:bg-slate-100 transition flex items-center gap-1 cursor-pointer"
            title="Copiar comensals de la taula"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span className="hidden md:inline">{copied ? 'Copiat' : 'Copiar'}</span>
          </button>
        </div>
      </div>

      {/* Seats List: 1 to Capacity */}
      <div className="divide-y divide-slate-100 flex-1">
        {seatsArray.map(({ seatNumber, guest }) => {
          if (!guest) {
            // EMPTY SEAT
            return (
              <div
                key={`empty-seat-${seatNumber}`}
                className="px-3 py-1.5 bg-slate-50/40 hover:bg-slate-50 transition flex items-center justify-between gap-2 border-l-2 border-l-transparent hover:border-l-blue-400"
              >
                <div className="flex items-center gap-2.5 min-w-0 text-slate-400">
                  <span className="w-4 text-slate-300 font-mono text-[11px] text-right shrink-0">
                    {seatNumber}
                  </span>
                  <span className="text-[11px] italic text-slate-400">
                    Seient #{seatNumber} buit
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenAddToSeat?.(table.tableNumber, seatNumber)}
                  className="px-2 py-0.5 text-[10px] font-medium text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200/70 rounded transition flex items-center gap-1 cursor-pointer"
                  title={`Afegir comensal al seient #${seatNumber}`}
                >
                  <UserPlus className="w-3 h-3 text-blue-600" />
                  <span>+ Afegir</span>
                </button>
              </div>
            );
          }

          // OCCUPIED SEAT
          const isMatch =
            q.length > 0 &&
            (formatFullNameSurnamesFirst(guest).toLowerCase().includes(q) ||
              (guest.municipi && guest.municipi.toLowerCase().includes(q)));

          const isMenuOpen = activeMenuGuestId === guest.guest_id;

          return (
            <div
              key={guest.guest_id || seatNumber}
              className={`px-3 py-1.5 transition flex items-center justify-between gap-2 relative group ${
                isMatch ? 'bg-blue-50/80 font-medium' : 'hover:bg-slate-50/80'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="w-4 text-slate-400 font-mono text-[11px] text-right shrink-0">
                  {guest.seatNumber || seatNumber}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      onClick={() => onEditGuest?.(guest)}
                      className={`text-xs truncate block cursor-pointer transition ${
                        isMatch
                          ? 'font-bold text-blue-900 underline'
                          : 'font-medium text-slate-900 hover:text-blue-600'
                      }`}
                      title="Clic per editar dades del comensal"
                    >
                      {formatFullNameSurnamesFirst(guest)}
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-400 truncate block">
                    {guest.municipi ? `${guest.municipi} (${guest.comarca})` : guest.comarca || ''}
                    {guest.phone_number && ` · ${guest.phone_number}`}
                  </span>
                </div>
              </div>

          {/* Dish tag and quick actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] text-slate-600 font-medium whitespace-nowrap bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                  {guest.cleanDish.includes('Carn')
                    ? 'Carn'
                    : guest.cleanDish.includes('Peix')
                    ? 'Peix'
                    : guest.cleanDish}
                </span>

                {/* Desktop hover actions */}
                <div className="hidden sm:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                  <button
                    type="button"
                    onClick={() => onEditGuest?.(guest)}
                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-200/70 rounded transition cursor-pointer"
                    title="Editar dades i canviar el nom"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenMove?.(guest)}
                    className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 rounded transition cursor-pointer"
                    title="Moure a una altra taula"
                  >
                    <MoveRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenSwap?.(guest)}
                    className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 rounded transition cursor-pointer"
                    title="Intercanviar amb una altra persona"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onUnassignGuest?.(guest)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                    title="Treure de la taula (deixar sense assignar)"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Mobile Touch Action Button (Clean three dots to avoid clutter) */}
                <div className="relative sm:hidden">
                  <button
                    type="button"
                    onClick={() => setActiveMenuGuestId(isMenuOpen ? null : guest.guest_id)}
                    className={`min-w-[34px] min-h-[34px] flex items-center justify-center rounded-md transition cursor-pointer ${
                      isMenuOpen
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-500 hover:bg-slate-200/70'
                    }`}
                    title="Opcions del comensal"
                    aria-label="Opcions del comensal"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {/* Mobile Popover Menu */}
                  {isMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setActiveMenuGuestId(null)}
                      />
                      <div className="absolute right-0 top-full mt-1 z-40 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 min-w-[190px] text-xs animate-in fade-in zoom-in-95 duration-100">
                        <div className="px-3 py-1.5 border-b border-slate-100 font-semibold text-slate-800 text-[11px] truncate">
                          {formatFullNameSurnamesFirst(guest)}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuGuestId(null);
                            onEditGuest?.(guest);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer active:bg-slate-100"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                          <span>Editar nom i dades</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuGuestId(null);
                            onOpenMove?.(guest);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer active:bg-slate-100"
                        >
                          <MoveRight className="w-3.5 h-3.5 text-slate-500" />
                          <span>Moure a una altra taula</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuGuestId(null);
                            onOpenSwap?.(guest);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 text-slate-700 cursor-pointer active:bg-slate-100"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
                          <span>Intercanviar de lloc</span>
                        </button>
                        <div className="border-t border-slate-100 my-1" />
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuGuestId(null);
                            onUnassignGuest?.(guest);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-rose-50 flex items-center gap-2 text-rose-600 cursor-pointer active:bg-rose-100"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                          <span>Treure de la taula</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Card Footer if empty seats */}
      {freeSeatsCount > 0 && (
        <div className="px-3 py-1.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-[11px]">
          <span className="text-slate-500 font-medium">
            {freeSeatsCount} {freeSeatsCount === 1 ? 'seient disponible' : 'seients disponibles'}
          </span>
          <button
            type="button"
            onClick={() => {
              // Find first empty seat
              const firstEmpty = seatsArray.find(s => s.guest === null);
              onOpenAddToSeat?.(table.tableNumber, firstEmpty ? firstEmpty.seatNumber : table.guests.length + 1);
            }}
            className="text-blue-700 hover:text-blue-900 font-medium flex items-center gap-1 hover:underline cursor-pointer"
          >
            <UserPlus className="w-3 h-3" />
            <span>Afegir comensal</span>
          </button>
        </div>
      )}
    </div>
  );
};
