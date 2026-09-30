import React, { useEffect, useState } from 'react';
import { SourceDocument } from '../types';
import { Calendar, FileText, Folder, Loader2, MapPin, X } from 'lucide-react';

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
        if (!res.ok) throw new Error(`Failed to load document: ${res.statusText}`);
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

  useEffect(() => {
    if (!sourceId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sourceId, onClose]);

  useEffect(() => {
    if (!document || activeParagraphIndex === undefined) return;
    requestAnimationFrame(() => {
      window.document
        .getElementById(`source-paragraph-${activeParagraphIndex}`)
        ?.scrollIntoView({ block: 'center' });
    });
  }, [document, activeParagraphIndex]);

  if (!sourceId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[2px] animate-fade-in"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-title"
        className="flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl animate-slide-in"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-1.5 flex items-center gap-2 text-xs text-slate-400">
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="uppercase">{document?.fileFormat || 'Document'}</span>
                <span>·</span>
                <span className="truncate">{sourceId}</span>
              </div>
              <h2 id="document-title" className="text-base font-semibold leading-6 text-slate-950">
                {document?.title || 'Loading document…'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close document"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {document && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
              {document.jurisdiction && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" /> {document.jurisdiction}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" /> {document.date}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Folder className="h-3.5 w-3.5 text-slate-400" /> {document.topicFolder}
              </span>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
          {isLoading && (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              Loading source…
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {document && (
            <div>
              <p className="mb-4 text-xs font-medium uppercase tracking-wider text-slate-400">
                Full source · {document.paragraphs.length} paragraphs
              </p>
              <div className="divide-y divide-slate-100 border-y border-slate-100">
                {document.paragraphs.map((paragraph, index) => {
                  const isActive = activeParagraphIndex === index;

                  return (
                    <div
                      id={`source-paragraph-${index}`}
                      key={index}
                      className={`grid grid-cols-[2rem_1fr] gap-3 px-2 py-4 transition-colors ${
                        isActive ? 'bg-blue-50' : ''
                      }`}
                    >
                      <span className={`pt-0.5 text-xs tabular-nums ${isActive ? 'font-semibold text-blue-600' : 'text-slate-300'}`}>
                        {index + 1}
                      </span>
                      <div>
                        {isActive && (
                          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-blue-600">
                            Matched excerpt
                          </span>
                        )}
                        <p className="text-[15px] leading-7 text-slate-700">{paragraph}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
