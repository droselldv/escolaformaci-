import React from 'react';
import { EventAnalysis } from '../types';

interface OverviewCardsProps {
  analysis: EventAnalysis;
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({ analysis }) => {
  const carn = analysis.dishTotals.find(d => d.dish.includes('Carn')) || { count: 0, percentage: 0 };
  const peix = analysis.dishTotals.find(d => d.dish.includes('Peix')) || { count: 0, percentage: 0 };

  const cards = [
    {
      label: 'Total Inscrits',
      value: analysis.totalRegistered,
      detail: 'Assistents totals',
    },
    {
      label: 'Assistents Dinar',
      value: analysis.totalLunch,
      detail: `${analysis.totalRegistered > 0 ? Math.round((analysis.totalLunch / analysis.totalRegistered) * 100) : 0}% del total`,
    },
    {
      label: 'Taules de 10',
      value: analysis.totalTables,
      detail: 'Capacitat assignada',
    },
    {
      label: 'Carn (Cap de llom)',
      value: carn.count,
      detail: `${carn.percentage}% dels dinars`,
    },
    {
      label: 'Peix (Orada)',
      value: peix.count,
      detail: `${peix.percentage}% dels dinars`,
    },
    {
      label: 'Sense Dinar',
      value: analysis.totalNoLunch,
      detail: 'Només formació',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
      {cards.map(c => (
        <div
          key={c.label}
          className="bg-white rounded-lg p-2.5 sm:p-3.5 border border-slate-200 shadow-2xs hover:border-slate-300 transition"
        >
          <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-0.5 sm:mb-1 truncate" title={c.label}>
            {c.label}
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight font-mono tabular-nums">
            {c.value}
          </div>
          <div className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate" title={c.detail}>
            {c.detail}
          </div>
        </div>
      ))}
    </div>
  );
};
