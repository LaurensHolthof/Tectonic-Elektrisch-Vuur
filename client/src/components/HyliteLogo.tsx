import React from 'react';
import { Highlighter } from 'lucide-react';

interface HyliteLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showTagline?: boolean;
  className?: string;
}

export const HyliteLogo: React.FC<HyliteLogoProps> = ({
  size = 'sm',
  showIcon = true,
  showTagline = true,
  className = '',
}) => {
  const iconSizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  }[size];

  const markerIconSizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  }[size];

  const textSizeClasses = {
    sm: 'text-sm sm:text-base',
    md: 'text-lg sm:text-xl',
    lg: 'text-3xl sm:text-4xl',
  }[size];

  const liteHighlightClasses = {
    sm: 'pl-0.5 pr-1 py-0.5 rounded-[2px]',
    md: 'pl-0.5 pr-1.5 py-0.5 rounded-[3px]',
    lg: 'pl-1 pr-2 py-1 rounded-[4px]',
  }[size];

  const markerSymbolClasses = {
    sm: 'h-3.5 w-3.5 -ml-1 -mt-2',
    md: 'h-4.5 w-4.5 -ml-1.5 -mt-2.5',
    lg: 'h-7 w-7 -ml-2 -mt-4',
  }[size];

  return (
    <div className={`group/logo inline-flex items-center gap-2.5 select-none ${className}`}>
      {showIcon && (
        <div
          className={`flex ${iconSizeClasses} items-center justify-center rounded-lg bg-slate-900 text-yellow-300 shadow-sm ring-1 ring-slate-900/10 transition-transform group-hover/logo:scale-105`}
        >
          <Highlighter
            className={`${markerIconSizeClasses} text-yellow-300 fill-yellow-300/30 transition-transform group-hover/logo:-rotate-12`}
            aria-hidden="true"
          />
        </div>
      )}

      <div className="flex items-baseline gap-2">
        <span className={`${textSizeClasses} font-semibold tracking-tight text-slate-950 inline-flex items-center`}>
          {/* Hy: pure text, zero yellow highlight */}
          <span className="font-bold text-slate-950">Hy</span>

          {/* lite: yellow highlight strictly covers ONLY the word 'lite' */}
          <span
            className={`font-bold text-slate-950 bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-300 shadow-[0_1px_2px_rgba(234,179,8,0.25)] border border-yellow-400/50 ${liteHighlightClasses}`}
          >
            lite
          </span>

          {/* Marker symbol: at the top right of lite with a tiny bit of padding */}
          <span
            className={`inline-flex self-start items-center text-amber-700 transition-transform duration-200 group-hover/logo:-rotate-12 group-hover/logo:-translate-y-0.5 ${markerSymbolClasses}`}
            title="Marker"
            aria-hidden="true"
          >
            <Highlighter
              className="w-full h-full text-amber-700 fill-yellow-300 drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]"
              strokeWidth={2.2}
            />
          </span>
        </span>

        {showTagline && (
          <span className="hidden text-xs text-slate-400 sm:inline">
            Workplace knowledge
          </span>
        )}
      </div>
    </div>
  );
};
