import React, { useState } from 'react';
import { AnnotatedParagraph, SourceType } from '../types';
import { HighlightedText } from './HighlightedText';
import { ScoreBreakdownTooltip } from './ScoreBreakdownTooltip';
import {
  Scale,
  FileCheck,
  BookOpen,
  FileText,
  Mail,
  MessageSquare,
  Calendar,
  MapPin,
  ExternalLink,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

interface ParagraphCardProps {
  paragraph: AnnotatedParagraph;
  onOpenSourceDoc: (sourceId: string) => void;
}

export const ParagraphCard: React.FC<ParagraphCardProps> = ({ paragraph, onOpenSourceDoc }) => {
  const [showScoreTooltip, setShowScoreTooltip] = useState(false);

  const getSourceTypeBadge = (type: SourceType) => {
    switch (type) {
      case 'statutory_statute':
        return {
          label: 'Statutory Law',
          icon: Scale,
          className: 'bg-indigo-50 text-indigo-700 border-indigo-200'
        };
      case 'master_employment_contract':
        return {
          label: 'Master Contract',
          icon: FileCheck,
          className: 'bg-blue-50 text-blue-700 border-blue-200'
        };
      case 'internal_hr_policy':
        return {
          label: 'HR Policy Handbook',
          icon: BookOpen,
          className: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        };
      case 'internal_memo':
        return {
          label: 'Internal Memo',
          icon: FileText,
          className: 'bg-amber-50 text-amber-800 border-amber-200'
        };
      case 'internal_email':
        return {
          label: 'Internal Email',
          icon: Mail,
          className: 'bg-rose-50 text-rose-700 border-rose-200'
        };
      case 'slack_communication':
        return {
          label: 'Slack / Chat Log',
          icon: MessageSquare,
          className: 'bg-slate-100 text-slate-700 border-slate-300'
        };
    }
  };

  const badge = getSourceTypeBadge(paragraph.sourceType);
  const BadgeIcon = badge.icon;
  const redHighlightsCount = paragraph.highlights.filter(h => h.color === 'red').length;
  const yellowHighlightsCount = paragraph.highlights.filter(h => h.color === 'yellow').length;

  return (
    <div
      onClick={() => onOpenSourceDoc(paragraph.sourceId)}
      className="group relative bg-white rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-lg transition-all duration-200 p-5 cursor-pointer"
    >
      {/* Top Meta Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          {/* Source Type Pill */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${badge.className}`}>
            <BadgeIcon className="w-3.5 h-3.5" />
            <span>{badge.label}</span>
          </span>

          {/* Jurisdiction Pill */}
          {paragraph.documentJurisdiction && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-slate-500 bg-slate-100">
              <MapPin className="w-3 h-3 text-slate-400" />
              <span>{paragraph.documentJurisdiction}</span>
            </span>
          )}

          {/* Date */}
          <span className="inline-flex items-center gap-1 text-xs text-slate-500">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>{paragraph.documentDate}</span>
          </span>
        </div>

        {/* Total Relevance Score Pill with Hover Breakdown */}
        <div
          className="relative"
          onMouseEnter={() => setShowScoreTooltip(true)}
          onMouseLeave={() => setShowScoreTooltip(false)}
        >
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 group-hover:bg-blue-50 text-slate-700 group-hover:text-blue-700 text-xs font-semibold border border-slate-200 transition-colors">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-normal">Relevance:</span>
            <span className="font-mono">{(paragraph.scoreMetrics.totalScore * 100).toFixed(0)}%</span>
          </div>

          {showScoreTooltip && (
            <ScoreBreakdownTooltip metrics={paragraph.scoreMetrics} />
          )}
        </div>
      </div>

      {/* Source Title */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
          <span>{paragraph.sourceTitle}</span>
          <span className="text-xs text-slate-400 font-normal">¶{paragraph.paragraphIndex + 1}</span>
        </h3>
        <span className="text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          <span>View in source</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </span>
      </div>

      {/* Verbatim Paragraph Text with Safe Offset Highlighting */}
      <div className="text-sm text-slate-700 leading-relaxed font-serif bg-slate-50/50 p-3.5 rounded-lg border border-slate-100">
        <HighlightedText
          text={paragraph.paragraphText}
          highlights={paragraph.highlights}
          onOpenSourceDoc={onOpenSourceDoc}
        />
      </div>

      {/* Footer Annotation Badges */}
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2">
          {redHighlightsCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-medium">
              <AlertCircle className="w-3 h-3 text-red-500" />
              <span>{redHighlightsCount} Legal Conflict{redHighlightsCount > 1 ? 's' : ''}</span>
            </span>
          )}
          {yellowHighlightsCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-50 text-amber-800 border border-yellow-200 font-medium">
              <CheckCircle2 className="w-3 h-3 text-amber-600" />
              <span>{yellowHighlightsCount} Verified Clause{yellowHighlightsCount > 1 ? 's' : ''}</span>
            </span>
          )}
        </div>

        <span className="text-[11px] text-slate-400 italic">
          Verbatim source excerpt • No conversational LLM generation
        </span>
      </div>
    </div>
  );
};
