import React, { useState } from 'react';
import { AnnotatedParagraph, SourceType } from '../types';
import { HighlightedText } from './HighlightedText';
import { ScoreBreakdownTooltip } from './ScoreBreakdownTooltip';
import {
  AlertCircle,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  FileCheck,
  FileText,
  Mail,
  MessageSquare,
  Scale,
  UserRound
} from 'lucide-react';

interface ParagraphCardProps {
  paragraph: AnnotatedParagraph;
  onOpenSourceDoc: (sourceId: string, paragraphIndex?: number) => void;
}

const sourceLabels: Record<SourceType, { label: string; icon: React.ElementType }> = {
  statutory_statute: { label: 'Statutory law', icon: Scale },
  master_employment_contract: { label: 'Master contract', icon: FileCheck },
  internal_hr_policy: { label: 'HR policy', icon: BookOpen },
  employee_record: { label: 'Employee file', icon: UserRound },
  internal_memo: { label: 'Internal memo', icon: FileText },
  internal_email: { label: 'Internal email', icon: Mail },
  slack_communication: { label: 'Chat log', icon: MessageSquare }
};

export const ParagraphCard: React.FC<ParagraphCardProps> = ({ paragraph, onOpenSourceDoc }) => {
  const [showScoreTooltip, setShowScoreTooltip] = useState(false);
  const source = sourceLabels[paragraph.sourceType];
  const SourceIcon = source.icon;
  const conflictCount = paragraph.highlights.filter((highlight) => highlight.color === 'red').length;
  const verifiedCount = paragraph.highlights.filter((highlight) => highlight.color === 'yellow').length;
  const showJurisdiction =
    paragraph.sourceType !== 'employee_record' &&
    paragraph.documentJurisdiction &&
    paragraph.documentJurisdiction !== 'Global';

  return (
    <article className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <SourceIcon className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            <span>{source.label}</span>
          </div>
          <button
            type="button"
            onClick={() => onOpenSourceDoc(paragraph.sourceId)}
            className="block max-w-full text-left text-sm font-semibold text-slate-950 transition-colors hover:text-blue-700"
          >
            {paragraph.sourceTitle}
          </button>
          <p className="mt-1 truncate text-xs text-slate-400">
            {[showJurisdiction ? paragraph.documentJurisdiction : null, paragraph.documentDate, `Paragraph ${paragraph.paragraphIndex + 1}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        <div
          className="relative shrink-0"
          onMouseEnter={() => setShowScoreTooltip(true)}
          onMouseLeave={() => setShowScoreTooltip(false)}
          onFocus={() => setShowScoreTooltip(true)}
          onBlur={() => setShowScoreTooltip(false)}
        >
          <button
            type="button"
            className="rounded-md bg-slate-50 px-2 py-1 text-xs font-medium tabular-nums text-slate-600 outline-none hover:bg-slate-100 focus:ring-2 focus:ring-blue-500/30"
            aria-label={`${(paragraph.scoreMetrics.totalScore * 100).toFixed(0)} percent relevance. Show score breakdown.`}
          >
            {(paragraph.scoreMetrics.totalScore * 100).toFixed(0)}% match
          </button>
          {showScoreTooltip && <ScoreBreakdownTooltip metrics={paragraph.scoreMetrics} />}
        </div>
      </div>

      <div className="my-4 text-[15px] leading-7 text-slate-700">
        <HighlightedText
          text={paragraph.paragraphText}
          sourceTitle={paragraph.sourceTitle}
          highlights={paragraph.highlights}
          onOpenSourceDoc={onOpenSourceDoc}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-xs">
        {conflictCount > 0 && (
          <span className="inline-flex items-center gap-1.5 font-medium text-red-700">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {conflictCount} {conflictCount === 1 ? 'conflict' : 'conflicts'}
          </span>
        )}
        {verifiedCount > 0 && (
          <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            {verifiedCount} {verifiedCount === 1 ? 'source match' : 'source matches'}
          </span>
        )}
        <button
          type="button"
          onClick={() => onOpenSourceDoc(paragraph.sourceId)}
          className="ml-auto inline-flex items-center gap-1 font-medium text-slate-500 transition hover:text-blue-700"
        >
          Open source
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
};
