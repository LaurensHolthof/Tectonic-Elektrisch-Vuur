import React from 'react';
import { ScoreMetrics } from '../types';
import { Award, Clock, Sparkles, CheckCheck, FileCheck2, BarChart2 } from 'lucide-react';

interface ScoreBreakdownTooltipProps {
  metrics: ScoreMetrics;
}

/**
 * ScoreBreakdownTooltip
 * 
 * Displays an interactive breakdown bar-chart showing the exact rating weights
 * and individual metric components:
 * 1. Source reliability
 * 2. Recency (Exponential decay based on timestamp)
 * 3. Semantic Match (Relevance to query)
 * 4. Cross-source support
 * 5. Language Register (Formality)
 */
export const ScoreBreakdownTooltip: React.FC<ScoreBreakdownTooltipProps> = ({ metrics }) => {
  const { authority, recency, semantic, crossVerification, register, totalScore, weightsUsed } = metrics;
  const evidence = metrics.evidence || {
    documentAgeDays: null,
    matchedQueryTermCount: 0,
    queryTermCount: 0,
    corroboratingDocumentCount: 0,
    corroboratingSourceIds: []
  };
  const weightedQuality =
    authority * weightsUsed.authority +
    recency * weightsUsed.recency +
    semantic * weightsUsed.semantic +
    crossVerification * weightsUsed.crossVerification +
    register * weightsUsed.register;
  const relevanceGate = 0.2 + 0.8 * semantic;

  const rows = [
    {
      label: 'Source Reliability',
      icon: Award,
      score: authority,
      weight: weightsUsed.authority,
      color: 'bg-indigo-500',
      observedValue: `${authority.toFixed(2)} / 1`,
      description: 'Reliability value assigned to this source type'
    },
    {
      label: 'Semantic Match',
      icon: Sparkles,
      score: semantic,
      weight: weightsUsed.semantic,
      color: 'bg-blue-500',
      observedValue: `${evidence.matchedQueryTermCount} of ${evidence.queryTermCount} terms`,
      description: 'Distinct query terms matched in this document'
    },
    {
      label: 'Cross-Source Support',
      icon: CheckCheck,
      score: crossVerification,
      weight: weightsUsed.crossVerification,
      color: 'bg-emerald-500',
      observedValue: `${evidence.corroboratingDocumentCount} other ${evidence.corroboratingDocumentCount === 1 ? 'document' : 'documents'}`,
      description: 'Other source files containing the same core claim'
    },
    {
      label: 'Recency Decay',
      icon: Clock,
      score: recency,
      weight: weightsUsed.recency,
      color: 'bg-amber-500',
      observedValue: evidence.documentAgeDays === null
        ? 'Date unknown'
        : `${evidence.documentAgeDays} ${evidence.documentAgeDays === 1 ? 'day' : 'days'} old`,
      description: 'Age on the ranking reference date'
    },
    {
      label: 'Document Formality',
      icon: FileCheck2,
      score: register,
      weight: weightsUsed.register,
      color: 'bg-purple-500',
      observedValue: `${register.toFixed(2)} / 1`,
      description: 'Formality value assigned to this document register'
    }
  ];

  return (
    <div
      className="pointer-events-auto absolute bottom-full right-0 z-50 mb-2.5 w-80 rounded-xl border border-slate-700 bg-slate-900/95 p-3.5 text-xs text-white shadow-2xl backdrop-blur animate-fade-in sm:w-96"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2.5">
        <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
          <BarChart2 className="w-4 h-4 text-blue-400" />
          <span>Match Score Breakdown</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-[10px] text-slate-400">Total:</span>
          <span className="font-mono text-sm font-bold text-blue-400">
            {(totalScore * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Component Bars */}
      <div className="flex flex-col gap-2.5">
        {rows.map((row) => {
          const Icon = row.icon;
          const weightedContribution = row.score * row.weight;

          return (
            <div key={row.label} className="group/row">
              <div className="mb-1 flex items-center justify-between gap-3 text-[11px]">
                <div className="flex items-center gap-1 text-slate-300">
                  <Icon className="w-3.5 h-3.5 text-slate-400" />
                  <span>{row.label}</span>
                </div>
                <span className="text-right font-mono font-medium text-slate-100">{row.observedValue}</span>
              </div>

              {/* Progress Bar Container */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  className={`h-full ${row.color} transition-all duration-300`}
                  style={{ width: `${Math.max(0, row.score * 100)}%` }}
                />
              </div>

              <div className="mt-1 flex items-start justify-between gap-3 text-[10px] text-slate-400">
                <span>{row.description}</span>
                <span className="shrink-0 font-mono text-slate-500">
                  {(row.weight * 100).toFixed(0)}% weight · {(weightedContribution * 100).toFixed(1)} pts
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Formula Footer */}
      <div className="mt-3 border-t border-slate-800 pt-2 text-center text-[10px] text-slate-400">
        Weighted quality {(weightedQuality * 100).toFixed(0)}% × relevance gate {(relevanceGate * 100).toFixed(0)}%
        <span className="ml-1 font-mono text-slate-300">= {totalScore.toFixed(3)}</span>
      </div>

      {/* Arrow */}
      <div className="absolute top-full right-6 border-4 border-transparent border-t-slate-900" />
    </div>
  );
};
