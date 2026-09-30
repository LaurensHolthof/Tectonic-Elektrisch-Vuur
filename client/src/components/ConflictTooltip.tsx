import React from 'react';
import { AlertTriangle, ArrowRight, BookOpen } from 'lucide-react';
import { ConflictSourceExcerpt } from '../types';

interface ConflictTooltipProps {
  reason: string;
  currentText: string;
  currentSourceTitle: string;
  conflictSourceIds?: string[];
  conflictSources?: ConflictSourceExcerpt[];
  onInspectSource?: (sourceId: string, paragraphIndex?: number) => void;
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
  currentText,
  currentSourceTitle,
  conflictSourceIds,
  conflictSources,
  onInspectSource
}) => {
  return (
    <div
      className="pointer-events-auto absolute bottom-full left-1/2 z-50 mb-2.5 w-[48rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl border border-red-500/40 bg-slate-900/95 p-4 text-xs text-white shadow-2xl backdrop-blur animate-fade-in"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="mb-2 flex items-center gap-2 border-b border-slate-800 pb-2 font-semibold text-red-400">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-400" />
        <span className="uppercase tracking-wider text-[11px] font-bold">Source conflict / risk</span>
      </div>

      <p className="text-sm font-normal leading-5 text-slate-200">
        {reason}
      </p>

      {conflictSources && conflictSources.length > 0 ? (
        <div className="mt-3 grid gap-2 border-t border-slate-800 pt-3 sm:grid-cols-2">
          <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-3">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-red-300">
              Current source
            </span>
            <p className="mb-2 line-clamp-2 text-[11px] font-medium text-slate-400">{currentSourceTitle}</p>
            <blockquote className="text-xs leading-5 text-slate-100">“{currentText}”</blockquote>
          </div>

          <div className="space-y-2">
            {conflictSources.map(source => (
              <button
                key={`${source.sourceId}-${source.paragraphIndex}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onInspectSource?.(source.sourceId, source.paragraphIndex);
                }}
                className="block w-full rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3 text-left transition hover:border-emerald-400/60 hover:bg-emerald-950/30"
              >
                <span className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                  Conflicting source
                  <ArrowRight className="h-3 w-3" />
                </span>
                <span className="mb-2 block line-clamp-2 text-[11px] font-medium text-slate-400">
                  {source.sourceTitle}
                </span>
                <span className="block text-xs leading-5 text-slate-100">“{source.paragraphText}”</span>
              </button>
            ))}
          </div>
        </div>
      ) : conflictSourceIds && conflictSourceIds.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-3">
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <BookOpen className="h-3.5 w-3.5" />
            <span>Conflicts with:</span>
          </div>
          {conflictSourceIds.map(sourceId => (
            <button
              key={sourceId}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onInspectSource?.(sourceId);
              }}
              className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-red-300 transition hover:bg-slate-700 hover:text-white"
            >
              {sourceId.split('__')[1] || sourceId}
              <ArrowRight className="h-2.5 w-2.5" />
            </button>
          ))}
        </div>
      ) : null}

      {/* Bottom Arrow Pointer */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
    </div>
  );
};
