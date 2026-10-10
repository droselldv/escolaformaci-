import React, { useState } from 'react';
import { TableGroup, ProcessedGuest } from '../types';
import { formatFullNameSurnamesFirst } from '../lib/sorting';
import { Copy, Check } from 'lucide-react';

interface TableCardProps {
  table: TableGroup;
  onEditGuest?: (guest: ProcessedGuest) => void;
}

export const TableCard: React.FC<TableCardProps> = ({ table, onEditGuest }) => {
  const [copied, setCopied] = useState(false);

  const carnCount = table.dishCounts['Carn - Cap de llom'] || 0;
  const peixCount = table.dishCounts['Peix - Orada'] || 0;

  const handleCopyList = () => {
    const text = [
      `Taula ${table.tableNumber} (${table.guests.length}/10 comensals) - Carn: ${carnCount}, Peix: ${peixCount}`,
      ...table.guests.map(
        g => `${g.seatNumber}. ${formatFullNameSurnamesFirst(g)} - ${g.cleanDish} (${g.municipi || g.comarca || '-'}, Tel: ${g.phone_number || '-'})`
      ),
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col text-xs">
      {/* Table Header */}
      <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900">Taula {table.tableNumber}</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500 font-medium">
            {table.guests.length}/10 assistents
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <span>Carn: <strong>{carnCount}</strong></span>
            <span>Peix: <strong>{peixCount}</strong></span>
          </div>

          <button
            onClick={handleCopyList}
            className="text-[11px] text-slate-500 hover:text-slate-900 transition flex items-center gap-1 cursor-pointer"
            title="Copiar comensals"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
            <span>{copied ? 'Copiat' : 'Copiar'}</span>
          </button>
        </div>
      </div>

      {/* Seats List */}
      <div className="divide-y divide-slate-100 flex-1">
        {table.guests.map((guest, idx) => (
          <div
            key={guest.guest_id || idx}
            onClick={() => onEditGuest?.(guest)}
            className="px-3.5 py-1.5 hover:bg-slate-50 transition flex items-center justify-between gap-3 cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-4 text-slate-400 font-mono text-[11px] text-right shrink-0">
                {guest.seatNumber || idx + 1}
              </span>
              <div className="min-w-0">
                <span className="font-medium text-slate-900 text-xs truncate block group-hover:text-blue-600">
                  {formatFullNameSurnamesFirst(guest)}
                </span>
                <span className="text-[10px] text-slate-400 truncate block">
                  {guest.municipi ? `${guest.municipi} (${guest.comarca})` : guest.comarca || ''}
                  {guest.phone_number && ` · ${guest.phone_number}`}
                </span>
              </div>
            </div>

            {/* Plain text dish indicator */}
            <span className="shrink-0 text-[11px] text-slate-600 font-medium whitespace-nowrap">
              {guest.cleanDish.includes('Carn') ? 'Carn' : guest.cleanDish.includes('Peix') ? 'Peix' : guest.cleanDish}
            </span>
          </div>
        ))}

        {Array.from({ length: table.capacity - table.guests.length }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="px-3.5 py-1.5 text-slate-300 text-[11px] italic flex items-center gap-2.5"
          >
            <span className="w-4 text-slate-300 font-mono text-[11px] text-right shrink-0">
              {table.guests.length + i + 1}
            </span>
            <span>Lliure</span>
          </div>
        ))}
      </div>
    </div>
  );
};
