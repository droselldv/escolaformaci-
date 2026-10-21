import React, { useState } from 'react';
import { TableGroup } from '../types';
import { X, UserPlus, Utensils, MapPin, Mail, Phone, Check, Plus } from 'lucide-react';

interface AddGuestModalProps {
  isOpen: boolean;
  tables: TableGroup[];
  onClose: () => void;
  onAddGuest: (guestData: {
    name: string;
    staysForLunch: boolean;
    dish: string;
    tableNumber: number | null;
    seatNumber: number | null;
    municipi?: string;
    comarca?: string;
    phone?: string;
    email?: string;
  }) => void;
}

export const AddGuestModal: React.FC<AddGuestModalProps> = ({
  isOpen,
  tables,
  onClose,
  onAddGuest,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [municipi, setMunicipi] = useState('');
  const [comarca, setComarca] = useState('');
  const [staysForLunch, setStaysForLunch] = useState(true);
  const [dish, setDish] = useState('Carn - Cap de llom');
  
  // Find first table with available seats (< 10)
  const defaultAvailableTable = tables.find(t => t.guests.length < 10)?.tableNumber ?? null;
  const [selectedTable, setSelectedTable] = useState<number | null>(defaultAvailableTable);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);

  const maxTableNumber = tables.length > 0 ? Math.max(...tables.map(t => t.tableNumber)) : 0;
  const nextNewTableNum = maxTableNumber + 1;

  // Selected table object
  const currentTableObj = selectedTable ? tables.find(t => t.tableNumber === selectedTable) : null;
  const occupiedSeats = new Set(
    currentTableObj?.guests.map(g => g.seatNumber).filter((s): s is number => typeof s === 'number') || []
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Determine seat number if not manually set
    let finalSeat = selectedSeat;
    if (staysForLunch && selectedTable && !finalSeat) {
      for (let s = 1; s <= 10; s++) {
        if (!occupiedSeats.has(s)) {
          finalSeat = s;
          break;
        }
      }
      if (!finalSeat) finalSeat = 1;
    }

    onAddGuest({
      name: name.trim(),
      staysForLunch,
      dish: staysForLunch ? dish : 'No em quedo al dinar',
      tableNumber: staysForLunch ? selectedTable : null,
      seatNumber: staysForLunch ? finalSeat : null,
      municipi: municipi.trim(),
      comarca: comarca.trim(),
      phone: phone.trim(),
      email: email.trim(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden text-xs my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Afegir Nou Assistent</h3>
              <p className="text-[11px] text-slate-300">Introdueix les dades per afegir-lo al llistat oficial</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            aria-label="Tancar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Nom complet */}
          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              Nom complet <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Jordi Solà Martínez"
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-medium"
            />
          </div>

          {/* Dinar Toggle */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <span className="block font-semibold text-slate-800 mb-2">Assistència al dinar</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStaysForLunch(true)}
                className={`py-2 px-3 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                  staysForLunch
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>Formació + Dinar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStaysForLunch(false);
                  setSelectedTable(null);
                  setSelectedSeat(null);
                }}
                className={`py-2 px-3 rounded-lg font-medium text-xs flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                  !staysForLunch
                    ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>Només Formació</span>
              </button>
            </div>
          </div>

          {/* Si té dinar: Segon Plat i Taula */}
          {staysForLunch && (
            <div className="space-y-3 p-3.5 bg-blue-50/50 rounded-lg border border-blue-100">
              {/* Segon Plat */}
              <div>
                <label className="block font-semibold text-slate-800 mb-1.5">
                  Segon plat triat
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: 'Carn', full: 'Carn - Cap de llom' },
                    { label: 'Peix', full: 'Peix - Orada' },
                    { label: 'Vegà', full: 'Vegetarià / Vegà' },
                  ].map(p => (
                    <button
                      key={p.full}
                      type="button"
                      onClick={() => setDish(p.full)}
                      className={`py-1.5 px-2 rounded-md font-medium text-[11px] border transition cursor-pointer text-center ${
                        dish === p.full
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assignació de Taula */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Taula
                  </label>
                  <select
                    value={selectedTable ?? ''}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '') setSelectedTable(null);
                      else setSelectedTable(Number(val));
                      setSelectedSeat(null);
                    }}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sense taula (assignar més tard)</option>
                    {tables.map(t => {
                      const count = t.guests.length;
                      return (
                        <option key={t.tableNumber} value={t.tableNumber}>
                          Taula {t.tableNumber} ({count}/10 {count >= 10 ? 'plena' : 'places'})
                        </option>
                      );
                    })}
                    <option value={nextNewTableNum}>+ Nova Taula {nextNewTableNum}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1">
                    Seient (1-10)
                  </label>
                  <select
                    value={selectedSeat ?? ''}
                    disabled={!selectedTable}
                    onChange={e => setSelectedSeat(e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-slate-100"
                  >
                    <option value="">Automàtic (primer lliure)</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => {
                      const isOccupied = occupiedSeats.has(s);
                      return (
                        <option key={s} value={s}>
                          Seient {s} {isOccupied ? '(ocupat)' : '(lliure)'}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Dades de contacte i localitat (Opcionals) */}
          <div className="space-y-2.5 pt-1">
            <span className="block font-semibold text-slate-700 text-[11px] uppercase tracking-wider text-slate-400">
              Dades de contacte i localitat (opcional)
            </span>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-medium text-slate-700 mb-0.5 flex items-center gap-1">
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span>Telèfon</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="34600000000"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-0.5 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-slate-400" />
                  <span>Correu electrònic</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="correu@exemple.cat"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-medium text-slate-700 mb-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>Municipi</span>
                </label>
                <input
                  type="text"
                  value={municipi}
                  onChange={e => setMunicipi(e.target.value)}
                  placeholder="Ex: Mollerussa"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-0.5">
                  Comarca
                </label>
                <input
                  type="text"
                  value={comarca}
                  onChange={e => setComarca(e.target.value)}
                  placeholder="Ex: Pla d'Urgell"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
            >
              Cancel·lar
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:pointer-events-none rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Afegir Assistent</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
