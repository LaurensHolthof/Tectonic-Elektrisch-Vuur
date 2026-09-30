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
 * 1. Source Type Authority (Statute > Contract > Email)
 * 2. Recency (Exponential decay based on timestamp)
 * 3. Semantic Match (Relevance to query)
 * 4. Cross-Verification (Consensus across documents)
 * 5. Language Register (Formality)
 */
export const ScoreBreakdownTooltip: React.FC<ScoreBreakdownTooltipProps> = ({ metrics }) => {
  const { authority, recency, semantic, crossVerification, register, totalScore, weightsUsed } = metrics;
  const weightedQuality =
    authority * weightsUsed.authority +
    recency * weightsUsed.recency +
    semantic * weightsUsed.semantic +
    crossVerification * weightsUsed.crossVerification +
    register * weightsUsed.register;
  const relevanceGate = 0.2 + 0.8 * semantic;

  const rows = [
    {
      label: 'Authority (Source Type)',
      icon: Award,
      score: authority,
      weight: weightsUsed.authority,
      color: 'bg-indigo-500',
      description: 'Statute = 1.0 > Contract = 0.88 > Policy = 0.70 > Email = 0.22'
    },
    {
      label: 'Semantic Match',
      icon: Sparkles,
      score: semantic,
      weight: weightsUsed.semantic,
      color: 'bg-blue-500',
      description: 'Dense vector / literal alignment with query proposition'
    },
    {
      label: 'Cross-Verification',
      icon: CheckCheck,
      score: crossVerification,
      weight: weightsUsed.crossVerification,
      color: 'bg-emerald-500',
      description: 'Consensus across multiple independent source files'
    },
    {
      label: 'Recency Decay',
      icon: Clock,
      score: recency,
      weight: weightsUsed.recency,
      color: 'bg-amber-500',
      description: 'Exponential half-life decay (newer > 2 years ago)'
    },
    {
      label: 'Language Register',
      icon: FileCheck2,
      score: register,
      weight: weightsUsed.register,
      color: 'bg-purple-500',
      description: 'Statutory/Contractual = 1.0 > Informal/Internal = 0.25'
    }
  ];

  return (
    <div
      className="absolute right-0 bottom-full mb-2.5 z-50 w-80 p-3.5 bg-slate-900/95 backdrop-blur text-white rounded-xl shadow-2xl border border-slate-700 text-xs animate-fade-in pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2.5">
        <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
          <BarChart2 className="w-4 h-4 text-blue-400" />
          <span>Ranking Weights Breakdown</span>
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
              <div className="flex items-center justify-between text-[11px] mb-1">
                <div className="flex items-center gap-1 text-slate-300">
                  <Icon className="w-3.5 h-3.5 text-slate-400" />
                  <span>{row.label}</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[11px]">
                  <span className="text-slate-400">×{(row.weight * 100).toFixed(0)}% =</span>
                  <span className="font-medium text-slate-100">{(row.score * 100).toFixed(0)}%</span>
                </div>
              </div>

              {/* Progress Bar Container */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  className={`h-full ${row.color} transition-all duration-300`}
                  style={{ width: `${Math.max(5, row.score * 100)}%` }}
                />
              </div>

              <div className="hidden group-hover/row:block text-[10px] text-slate-400 mt-0.5 italic">
                {row.description}
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
