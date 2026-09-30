import React from 'react';
import { AlertTriangle, ArrowRight, BookOpen } from 'lucide-react';

interface ConflictTooltipProps {
  reason: string;
  conflictSourceIds?: string[];
  onInspectSource?: (sourceId: string) => void;
}

/**
 * ConflictTooltip
 * 
 * Rendered when hovering over a RED highlight.
 * Explains why a sentence conflicts with stronger or more current guidance
 * and links to the contradictory source.
 */
export const ConflictTooltip: React.FC<ConflictTooltipProps> = ({
  reason,
  conflictSourceIds,
  onInspectSource
}) => {
  return (
    <div
      className="pointer-events-auto absolute bottom-full left-1/2 z-50 mb-2.5 w-[32rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl border border-red-500/40 bg-slate-900/95 p-4 text-xs text-white shadow-2xl backdrop-blur animate-fade-in"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="mb-2 flex items-center gap-2 border-b border-slate-800 pb-2 font-semibold text-red-400">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-400" />
        <span className="uppercase tracking-wider text-[11px] font-bold">Source conflict / risk</span>
      </div>

      {/* Rationale */}
      <p className="text-sm font-normal leading-6 text-slate-200">
        {reason}
      </p>

      {/* Conflicting Source Citing */}
      {conflictSourceIds && conflictSourceIds.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            <span>Conflicts with:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {conflictSourceIds.map(srcId => (
              <button
                key={srcId}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onInspectSource) onInspectSource(srcId);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-red-300 hover:text-white text-[11px] font-mono transition border border-slate-700"
              >
                <span>{srcId.split('__')[1] || srcId}</span>
                <ArrowRight className="w-2.5 h-2.5" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Arrow Pointer */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
    </div>
  );
};
