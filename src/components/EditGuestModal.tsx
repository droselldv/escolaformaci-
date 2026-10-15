import React, { useState } from 'react';
import { ProcessedGuest } from '../types';
import { X, Check, MapPin, Mail, Phone, Calendar } from 'lucide-react';

interface EditGuestModalProps {
  guest: ProcessedGuest | null;
  tables?: { tableNumber: number; capacity: number; guests: ProcessedGuest[] }[];
  onClose: () => void;
  onSave: (
    guestId: string,
    staysForLunch: boolean,
    dish: string,
    name?: string,
    tableNumber?: number | null,
    seatNumber?: number | null
  ) => void;
}

export const EditGuestModal: React.FC<EditGuestModalProps> = ({ guest, tables = [], onClose, onSave }) => {
  if (!guest) return null;

  const [name, setName] = useState(guest.name);
  const [stays, setStays] = useState(guest.staysForLunch);
  const [dish, setDish] = useState(guest.cleanDish);
  const [tableNum, setTableNum] = useState<number | null>(guest.tableNumber ?? null);
  const [seatNum, setSeatNum] = useState<number | null>(guest.seatNumber ?? null);

  const maxTableNum = tables.length > 0 ? Math.max(...tables.map(t => t.tableNumber)) : 0;
  const nextNewTableNum = maxTableNum + 1;

  const handleSave = () => {
    onSave(guest.guest_id, stays, dish, name.trim(), stays ? tableNum : null, stays ? seatNum : null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-lg max-w-md w-full shadow-lg border border-slate-200 overflow-hidden text-xs">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">{name.trim() || guest.name}</h3>
            <p className="text-[11px] text-slate-500 font-mono">{guest.guest_id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-200/50 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Editable Name Field */}
          <div>
            <label className="font-semibold text-slate-800 flex items-center justify-between mb-1">
              <span>Nom complet de l'assistent</span>
              {name.trim() !== guest.name && (
                <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  Modificat
                </span>
              )}
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nom i cognoms (ex: Manel Solà)"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition font-medium min-h-[42px] sm:min-h-0"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Pots modificar el nom i es desarà permanentment encara que pengis nous llistats.
            </p>
          </div>
          <div className="space-y-1.5 p-3 bg-slate-50 rounded border border-slate-200 text-slate-600">
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>{guest.email || 'Sense email'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span>{guest.phone_number || 'Sense telèfon'}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {guest.municipi ? `${guest.municipi} (${guest.comarca})` : guest.comarca || 'Sense municipi'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Inscrit: {guest.created_at ? new Date(guest.created_at).toLocaleString('ca-ES') : '-'}
              </span>
            </div>
          </div>

          <div>
            <label className="font-medium text-slate-800 block mb-1">
              Assistència al Dinar
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setStays(true);
                  if (dish === 'No em quedo al dinar') setDish('Carn - Cap de llom');
                }}
                className={`py-2 px-3 rounded border font-medium cursor-pointer transition ${
                  stays
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Es queda al dinar
              </button>

              <button
                type="button"
                onClick={() => {
                  setStays(false);
                  setDish('No em quedo al dinar');
                }}
                className={`py-2 px-3 rounded border font-medium cursor-pointer transition ${
                  !stays
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Sense dinar
              </button>
            </div>
          </div>

          {stays && (
            <div>
              <label className="font-medium text-slate-800 block mb-1">
                Segon Plat Escollit
              </label>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2.5 p-2 rounded border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="radio"
                    name="dish"
                    value="Carn - Cap de llom"
                    checked={dish === 'Carn - Cap de llom'}
                    onChange={() => setDish('Carn - Cap de llom')}
                    className="text-slate-900 focus:ring-slate-500"
                  />
                  <span className="font-medium text-slate-900">Carn - Cap de llom</span>
                </label>

                <label className="flex items-center gap-2.5 p-2 rounded border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="radio"
                    name="dish"
                    value="Peix - Orada"
                    checked={dish === 'Peix - Orada'}
                    onChange={() => setDish('Peix - Orada')}
                    className="text-slate-900 focus:ring-slate-500"
                  />
                  <span className="font-medium text-slate-900">Peix - Orada</span>
                </label>

                <label className="flex items-center gap-2.5 p-2 rounded border border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50 cursor-pointer">
                  <input
                    type="radio"
                    name="dish"
                    value="Vegetarià / Vegà"
                    checked={dish === 'Vegetarià / Vegà'}
                    onChange={() => setDish('Vegetarià / Vegà')}
                    className="text-emerald-700 focus:ring-emerald-500"
                  />
                  <span className="font-medium text-emerald-900 flex items-center gap-1.5">
                    <span>Vegetarià / Vegà</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-semibold">Verd</span>
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Table & Seat Assignment */}
          {stays && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="font-semibold text-slate-800 block">
                Assignació de Taula i Seient
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">
                    Taula
                  </label>
                  <select
                    value={tableNum === null ? 'none' : tableNum}
                    onChange={e => {
                      if (e.target.value === 'none') {
                        setTableNum(null);
                        setSeatNum(null);
                      } else {
                        setTableNum(Number(e.target.value));
                      }
                    }}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white"
                  >
                    <option value="none">Sense taula (pendent d'assignar)</option>
                    {tables.map(t => (
                      <option key={t.tableNumber} value={t.tableNumber}>
                        Taula {t.tableNumber} ({t.guests.length}/{t.capacity} ocupats)
                      </option>
                    ))}
                    <option value={nextNewTableNum}>+ Nova Taula {nextNewTableNum}</option>
                  </select>
                </div>

                {tableNum !== null && (
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-1">
                      Seient a la Taula {tableNum}
                    </label>
                    <select
                      value={seatNum ?? ''}
                      onChange={e => setSeatNum(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:bg-white"
                    >
                      <option value="">Automàtic (primer lliure)</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => {
                        const targetT = tables.find(t => t.tableNumber === tableNum);
                        const occ = targetT?.guests.find(g => g.seatNumber === s && g.guest_id !== guest.guest_id);
                        return (
                          <option key={s} value={s}>
                            Seient #{s} {occ ? `(Ocupat: ${occ.name.split(' ')[0]})` : '(Lliure)'}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-2 sm:py-1.5 text-xs text-slate-600 hover:text-slate-900 rounded-lg transition cursor-pointer min-h-[38px] sm:min-h-0 text-center"
          >
            Cancel·lar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 sm:py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px] sm:min-h-0 shadow-2xs"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Desar Canvis</span>
          </button>
        </div>
      </div>
    </div>
  );
};
