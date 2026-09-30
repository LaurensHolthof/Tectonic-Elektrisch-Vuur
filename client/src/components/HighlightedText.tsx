import React, { useState } from 'react';
import { HighlightSpan } from '../types';
import { ConflictTooltip } from './ConflictTooltip';
import { ShieldCheck } from 'lucide-react';

interface HighlightedTextProps {
  text: string;
  highlights: HighlightSpan[];
  onOpenSourceDoc?: (sourceId: string) => void;
}

/**
 * HighlightedText
 * 
 * Safely slices verbatim paragraph text into [startIndex, endIndex] spans.
 * Renders Yellow (matching source sentences) and Red (conflicting/risky sentences).
 * Zero string mutation ensures exact alignment with underlying source records.
 */
export const HighlightedText: React.FC<HighlightedTextProps> = ({ text, highlights, onOpenSourceDoc }) => {
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);

  if (!highlights || highlights.length === 0) {
    return <span className="leading-relaxed text-slate-800">{text}</span>;
  }

  // Ensure highlights are sorted by startIndex
  const sorted = [...highlights].sort((a, b) => a.startIndex - b.startIndex);
  const elements: React.ReactNode[] = [];
  let currentIndex = 0;

  sorted.forEach((hl, i) => {
    // 1. Text segment before this highlight
    if (hl.startIndex > currentIndex) {
      elements.push(
        <span key={`plain-${i}-${currentIndex}`} className="text-slate-800">
          {text.slice(currentIndex, hl.startIndex)}
        </span>
      );
    }

    // 2. The highlighted segment
    const highlightedChunk = text.slice(hl.startIndex, hl.endIndex);
    const isRed = hl.color === 'red';

    elements.push(
      <span
        key={`hl-${i}`}
        className="relative inline"
        onMouseEnter={() => setActiveTooltip(i)}
        onMouseLeave={() => setActiveTooltip(null)}
      >
        <mark
          className={`cursor-pointer rounded-sm px-0.5 py-0.5 transition-colors ${
            isRed
              ? 'bg-red-100 text-red-950 underline decoration-red-400 decoration-2 underline-offset-2 hover:bg-red-200'
              : 'bg-amber-100 text-amber-950 underline decoration-amber-400 decoration-2 underline-offset-2 hover:bg-amber-200'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            if (hl.conflictSourceIds?.[0] && onOpenSourceDoc) {
              onOpenSourceDoc(hl.conflictSourceIds[0]);
            } else if (hl.supportedSourceIds?.[0] && onOpenSourceDoc) {
              onOpenSourceDoc(hl.supportedSourceIds[0]);
            }
          }}
        >
          {highlightedChunk}
        </mark>

        {/* Hover Tooltip */}
        {activeTooltip === i && (
          isRed ? (
            <ConflictTooltip
              reason={hl.hoverReason}
              conflictSourceIds={hl.conflictSourceIds}
              onInspectSource={onOpenSourceDoc}
            />
          ) : (
            <div className="pointer-events-auto absolute bottom-full left-1/2 z-50 mb-2 w-72 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs text-white shadow-xl animate-fade-in sm:w-80">
              <div className="mb-1 flex items-center gap-1.5 font-semibold text-white">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Matching source sentence</span>
              </div>
              <p className="text-slate-200 leading-snug">{hl.hoverReason}</p>
              {hl.supportedSourceIds && hl.supportedSourceIds.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Source:</span>
                  <span className="font-mono text-amber-300 truncate max-w-[150px]">
                    {hl.supportedSourceIds[0]}
                  </span>
                </div>
              )}
              {/* Arrow */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
            </div>
          )
        )}
      </span>
    );

    currentIndex = hl.endIndex;
  });

  // 3. Trailing text after the last highlight
  if (currentIndex < text.length) {
    elements.push(
      <span key={`plain-tail-${currentIndex}`} className="text-slate-800">
        {text.slice(currentIndex)}
      </span>
    );
  }

  return <span className="leading-relaxed text-slate-800">{elements}</span>;
};
