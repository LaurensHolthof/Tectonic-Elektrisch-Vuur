import React, { useEffect, useState } from 'react';
import { SourceDocument } from '../types';
import {
  X,
  FileText,
  Calendar,
  MapPin,
  Folder,
  Scale,
  ExternalLink,
  Shield,
  Loader2
} from 'lucide-react';

interface DocumentViewerModalProps {
  sourceId: string | null;
  onClose: () => void;
  activeParagraphIndex?: number;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  sourceId,
  onClose,
  activeParagraphIndex
}) => {
  const [document, setDocument] = useState<SourceDocument | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sourceId) {
      setDocument(null);
      return;
    }

    const fetchDocument = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/documents/${encodeURIComponent(sourceId)}`);
        if (!res.ok) {
          throw new Error(`Failed to load document: ${res.statusText}`);
        }
        const data = await res.json();
        setDocument(data);
      } catch (err: any) {
        setError(err.message || 'Error loading document');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocument();
  }, [sourceId]);

  if (!sourceId) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm flex justify-end animate-fade-in">
      <div
        className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col transform transition-all duration-300 border-l border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-start justify-between bg-slate-50">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[11px] font-mono uppercase font-bold">
                {document?.fileFormat || 'DOC'}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {sourceId}
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 leading-snug">
              {document?.title || 'Loading document...'}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metadata Bar */}
        {document && (
          <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <Scale className="w-3.5 h-3.5 text-indigo-500" />
              <strong className="text-slate-700">Type:</strong> {document.sourceType.replace(/_/g, ' ')}
            </span>
            {document.jurisdiction && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                <strong className="text-slate-700">Jurisdiction:</strong> {document.jurisdiction}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-500" />
              <strong className="text-slate-700">Date:</strong> {document.date}
            </span>
            <span className="flex items-center gap-1">
              <Folder className="w-3.5 h-3.5 text-slate-500" />
              <strong className="text-slate-700">Topic:</strong> {document.topicFolder}
            </span>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm">Retrieving full document text...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
              {error}
            </div>
          )}

          {document && (
            <div className="space-y-4">
              <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold pb-1 border-b border-slate-100">
                Complete Document Paragraphs ({document.paragraphs.length})
              </div>

              {document.paragraphs.map((para, idx) => {
                const isActive = activeParagraphIndex !== undefined && activeParagraphIndex === idx;

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl text-sm leading-relaxed transition-all ${
                      isActive
                        ? 'bg-blue-50/70 border-2 border-blue-500 shadow-sm'
                        : 'bg-slate-50 border border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-mono">
                      <span>Paragraph {idx + 1}</span>
                      {isActive && (
                        <span className="text-blue-600 font-sans font-semibold text-xs flex items-center gap-1">
                          Matched Excerpt
                        </span>
                      )}
                    </div>
                    <p className="font-serif text-slate-800">{para}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span className="font-mono text-[11px] truncate max-w-sm">
            {document?.filePath}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-medium transition"
          >
            Close Document
          </button>
        </div>
      </div>
    </div>
  );
};
