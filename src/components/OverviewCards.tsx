import React from 'react';
import { EventAnalysis } from '../types';

interface OverviewCardsProps {
  analysis: EventAnalysis;
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({ analysis }) => {
  const carn = analysis.dishTotals.find(d => d.dish.includes('Carn')) || { count: 0, percentage: 0 };
  const peix = analysis.dishTotals.find(d => d.dish.includes('Peix')) || { count: 0, percentage: 0 };
  const vege = analysis.dishTotals.find(
    d => d.dish.toLowerCase().includes('vegetari') || d.dish.toLowerCase().includes('vegà')
  ) || { count: 0, percentage: 0 };

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
      label: 'Vegetarià / Vegà',
      value: vege.count,
      detail: `${vege.percentage}% dels dinars`,
      highlight: true,
    },
    {
      label: 'Taules de 10',
      value: analysis.totalTables,
      detail: 'Capacitat assignada',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
      {cards.map(c => (
        <div
          key={c.label}
          className={`bg-white rounded-lg p-2.5 sm:p-3.5 border shadow-2xs hover:border-slate-300 transition ${
            (c as any).highlight ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-200'
          }`}
        >
          <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-0.5 sm:mb-1 truncate" title={c.label}>
            {c.label}
          </div>
          <div className={`text-xl sm:text-2xl font-bold tracking-tight font-mono tabular-nums ${
            (c as any).highlight ? 'text-emerald-900' : 'text-slate-900'
          }`}>
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
