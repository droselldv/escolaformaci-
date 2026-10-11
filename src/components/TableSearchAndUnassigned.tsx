import React, { useState } from 'react';
import { ProcessedGuest, TableGroup } from '../types';
import { formatFullNameSurnamesFirst } from '../lib/sorting';
import {
  Search,
  X,
  UserPlus,
  ArrowRightLeft,
  MoveRight,
  UserMinus,
  CheckCircle2,
  AlertCircle,
  Eye,
  Plus,
} from 'lucide-react';

interface TableSearchAndUnassignedProps {
  allLunchGuests: ProcessedGuest[];
  unassignedGuests: ProcessedGuest[];
  tables: TableGroup[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenMove: (guest: ProcessedGuest) => void;
  onOpenSwap: (guest: ProcessedGuest) => void;
  onUnassignGuest: (guest: ProcessedGuest) => void;
  onOpenAssignUnassigned: (guest: ProcessedGuest) => void;
  onCreateNewTable: () => void;
  onEditGuest?: (guest: ProcessedGuest) => void;
}

export const TableSearchAndUnassigned: React.FC<TableSearchAndUnassignedProps> = ({
  allLunchGuests,
  unassignedGuests,
  tables,
  searchQuery,
  onSearchChange,
  onOpenMove,
  onOpenSwap,
  onUnassignGuest,
  onOpenAssignUnassigned,
  onCreateNewTable,
  onEditGuest,
}) => {
  const [isUnassignedExpanded, setIsUnassignedExpanded] = useState(true);

  // Search Results
  const q = searchQuery.trim().toLowerCase();
  const searchResults =
    q.length > 0
      ? allLunchGuests.filter(g => {
          const name = formatFullNameSurnamesFirst(g).toLowerCase();
          const mun = (g.municipi || '').toLowerCase();
          const email = (g.email || '').toLowerCase();
          return name.includes(q) || mun.includes(q) || email.includes(q);
        })
      : [];

  const handleScrollToTable = (tableNumber?: number) => {
    if (!tableNumber) return;
    const el = document.getElementById(`table-card-${tableNumber}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-4', 'ring-blue-500');
      setTimeout(() => {
        el.classList.remove('ring-4', 'ring-blue-500');
      }, 1800);
    }
  };

  return (
    <div className="space-y-3">
      {/* Search Bar & Actions Bar */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        {/* Search Input */}
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Cercar comensal per nom, cognoms o municipi per trobar la seva taula..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-slate-900 transition"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status badges & Create Table button */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {unassignedGuests.length > 0 ? (
            <button
              type="button"
              onClick={() => setIsUnassignedExpanded(!isUnassignedExpanded)}
              className="px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-medium text-xs flex items-center gap-1.5 hover:bg-amber-100 transition cursor-pointer"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>{unassignedGuests.length} sense taula assignada</span>
            </button>
          ) : (
            <div className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-medium text-xs flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Tots amb taula assignada</span>
            </div>
          )}

          <button
            type="button"
            onClick={onCreateNewTable}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs flex items-center gap-1.5 transition cursor-pointer ml-auto"
            title="Afegir una nova taula buida de 10 places"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            <span>+ Nova Taula</span>
          </button>
        </div>
      </div>

      {/* SEARCH RESULTS PANEL (If search query active) */}
      {q.length > 0 && (
        <div className="bg-white p-3.5 rounded-lg border border-blue-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <span>Resultats de cerca per "{searchQuery}":</span>
              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[11px]">
                {searchResults.length} {searchResults.length === 1 ? 'coincident' : 'coincidents'}
              </span>
            </span>
            <button
              onClick={() => onSearchChange('')}
              className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
            >
              Netejar cerca
            </button>
          </div>

          {searchResults.length === 0 ? (
            <p className="text-slate-500 text-xs italic py-2">
              No s'ha trobat cap comensal amb el nom o municipi indicat.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {searchResults.map(g => (
                <div
                  key={g.guest_id}
                  className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 px-2 rounded-md transition text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onEditGuest?.(g)}
                        className="font-semibold text-slate-900 text-sm hover:text-blue-600 hover:underline cursor-pointer text-left"
                        title="Clic per editar assistent i canviar-li el nom"
                      >
                        {formatFullNameSurnamesFirst(g)}
                      </button>
                      <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium">
                        {g.cleanDish}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                      {g.tableNumber ? (
                        <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          Seu a: Taula {g.tableNumber} {g.seatNumber ? `(Seient #${g.seatNumber})` : ''}
                        </span>
                      ) : (
                        <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Sense taula assignada
                        </span>
                      )}
                      <span>·</span>
                      <span>{g.municipi ? `${g.municipi} (${g.comarca})` : g.comarca || '-'}</span>
                      {g.phone_number && (
                        <>
                          <span>·</span>
                          <span>Tel: {g.phone_number}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions for this search result */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    {g.tableNumber ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleScrollToTable(g.tableNumber)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                          title="Veure a la taula"
                        >
                          <Eye className="w-3 h-3 text-slate-500" />
                          <span>Veure taula</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenMove(g)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                          title="Moure a una altra taula"
                        >
                          <MoveRight className="w-3 h-3 text-slate-500" />
                          <span>Moure</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenSwap(g)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                          title="Intercanviar seient amb una altra persona"
                        >
                          <ArrowRightLeft className="w-3 h-3 text-slate-500" />
                          <span>Intercanviar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onUnassignGuest(g)}
                          className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded text-[11px] font-medium transition cursor-pointer"
                          title="Treure de la taula"
                        >
                          <UserMinus className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenAssignUnassigned(g)}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-medium flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <UserPlus className="w-3 h-3" />
                        <span>Assignar a taula</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* UNASSIGNED GUESTS PANEL (If there are unassigned guests) */}
      {unassignedGuests.length > 0 && isUnassignedExpanded && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3.5 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span className="font-bold text-slate-900">
                Comensals pendents d'assignar taula ({unassignedGuests.length}):
              </span>
            </div>
            <button
              onClick={() => setIsUnassignedExpanded(false)}
              className="text-amber-800 hover:text-amber-950 font-medium text-[11px] cursor-pointer"
            >
              Amagar panell
            </button>
          </div>

          <p className="text-[11px] text-slate-600">
            Aquests assistents tenen confirmat el dinar però no tenen cap taula o seient assignat. Fes clic a "Assignar" per col·locar-los a una taula amb llocs lliures.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto pt-1">
            {unassignedGuests.map(g => (
              <div
                key={g.guest_id}
                className="bg-white p-2.5 rounded-md border border-amber-200/80 flex items-center justify-between gap-2 shadow-2xs text-xs"
              >
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onEditGuest?.(g)}
                    className="font-semibold text-slate-900 block truncate hover:text-blue-600 hover:underline cursor-pointer text-left"
                    title="Clic per editar assistent i canviar-li el nom"
                  >
                    {formatFullNameSurnamesFirst(g)}
                  </button>
                  <span className="text-[10px] text-slate-500 block truncate">
                    {g.cleanDish} {g.municipi ? `· ${g.municipi}` : ''}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenAssignUnassigned(g)}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-medium shrink-0 flex items-center gap-1 transition cursor-pointer shadow-2xs"
                  title="Assignar a una taula amb llocs lliures"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>Assignar</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
