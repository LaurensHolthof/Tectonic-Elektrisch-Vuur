import React, { useState } from 'react';
import { SearchQuery, SearchResponse, AnnotatedParagraph } from './types';
import { SearchBar } from './components/SearchBar';
import { ParagraphCard } from './components/ParagraphCard';
import { EntityRoutingBanner } from './components/EntityRoutingBanner';
import { DocumentViewerModal } from './components/DocumentViewerModal';
import {
  Scale,
  ShieldAlert,
  ShieldCheck,
  FolderTree,
  SlidersHorizontal,
  Info,
  ExternalLink,
  BookOpen
} from 'lucide-react';

export const App: React.FC = () => {
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number | undefined>(undefined);
  const [filterMode, setFilterMode] = useState<'all' | 'conflicts' | 'verified'>('all');

  const handleSearch = async (queryText: string) => {
    setIsLoading(true);
    try {
      const payload: SearchQuery = { query: queryText };
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Search failed: ${res.statusText}`);
      }

      const data: SearchResponse = await res.json();
      setSearchResponse(data);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSourceDoc = (sourceId: string, paragraphIndex?: number) => {
    setSelectedSourceId(sourceId);
    setActiveParagraphIndex(paragraphIndex);
  };

  const filteredResults = (searchResponse?.results || []).filter((item) => {
    if (filterMode === 'conflicts') {
      return item.highlights.some(h => h.color === 'red');
    }
    if (filterMode === 'verified') {
      return item.highlights.some(h => h.color === 'yellow');
    }
    return true;
  });

  const conflictCount = (searchResponse?.results || []).filter(r =>
    r.highlights.some(h => h.color === 'red')
  ).length;

  const verifiedCount = (searchResponse?.results || []).filter(r =>
    r.highlights.some(h => h.color === 'yellow')
  ).length;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
      {/* Top Legal Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-md">
              <Scale className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 tracking-tight">
                  LexisHR Paralegal
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  MVP Engine
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Non-Conversational Grounded Search & Statutory Conflict Verifier
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
              <FolderTree className="w-3.5 h-3.5 text-slate-400" />
              <span>5 Topic Folders Active</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Google-Style Minimalist Search Section */}
        <section className="mb-6 text-center">
          <div className="mb-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              HR Paralegal Document Intelligence
            </h2>
            <p className="text-sm text-slate-500 mt-1 max-w-xl mx-auto">
              Extract exact source paragraphs with character-offset legal annotations, statutory hierarchy scoring, and conflict detection.
            </p>
          </div>

          <SearchBar
            onSearch={handleSearch}
            isLoading={isLoading}
            initialQuery={searchResponse?.query || ''}
          />
        </section>

        {/* Entity Scope Routing Feedback */}
        {searchResponse && (
          <EntityRoutingBanner routing={searchResponse.routing} />
        )}

        {/* Results Stream */}
        {searchResponse && (
          <section className="mt-8 space-y-4">
            {/* Filter and Metrics Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 text-xs text-slate-600">
              <div className="flex items-center gap-2 font-mono">
                <span className="font-semibold text-slate-900 text-sm">
                  {searchResponse.totalResults} Excerpts Found
                </span>
                <span className="text-slate-400">•</span>
                <span>{searchResponse.executionTimeMs}ms execution</span>
                <span className="text-slate-400">•</span>
                <span>Scanned {searchResponse.scannedCorpusCount} corpus documents</span>
              </div>

              {/* Conflict / Verified Filter Pills */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
                <button
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1 rounded-md transition font-medium ${
                    filterMode === 'all'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({searchResponse.results.length})
                </button>
                <button
                  onClick={() => setFilterMode('conflicts')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition font-medium ${
                    filterMode === 'conflicts'
                      ? 'bg-red-50 text-red-700 shadow-sm border border-red-200'
                      : 'text-slate-600 hover:text-red-700'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
                  <span>Conflicts ({conflictCount})</span>
                </button>
                <button
                  onClick={() => setFilterMode('verified')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition font-medium ${
                    filterMode === 'verified'
                      ? 'bg-yellow-50 text-amber-800 shadow-sm border border-amber-200'
                      : 'text-slate-600 hover:text-amber-800'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span>Verified ({verifiedCount})</span>
                </button>
              </div>
            </div>

            {/* Highlighting Rules Legend */}
            <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-yellow-200 border-b-2 border-yellow-500 inline-block" />
                  <span><strong>Yellow Highlight:</strong> Relevant facts supported by high-trust statutory/master sources</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-red-200 border-b-2 border-red-500 inline-block" />
                  <span><strong>Red Highlight:</strong> Conflicting, outdated, or legally void terms (hover for hazard reason)</span>
                </div>
              </div>

              <div className="flex items-center gap-1 text-slate-400 italic text-[11px]">
                <Info className="w-3.5 h-3.5" />
                <span>Hover over relevance score for 5-factor weight breakdown</span>
              </div>
            </div>

            {/* Paragraph Cards List */}
            {filteredResults.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8">
                <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-slate-700">No excerpts match filter "{filterMode}"</h3>
                <p className="text-xs text-slate-500 mt-1">Try switching filter back to "All" or refining search query.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredResults.map((paragraph) => (
                  <ParagraphCard
                    key={paragraph.paragraphId}
                    paragraph={paragraph}
                    onOpenSourceDoc={(srcId) => handleOpenSourceDoc(srcId, paragraph.paragraphIndex)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Initial Welcome Guide */}
        {!searchResponse && !isLoading && (
          <section className="mt-12 max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                  <Scale className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 mb-1">
                  1. Statutory Hierarchy Ranking
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Ranks black-letter statutes over corporate policies and internal emails with exponential recency decay and language formality weights.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 mb-1">
                  2. Autonomous Scope Injection
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Detects country and regional entities (Germany, France, UK) to automatically inject governing statutes into search scope.
                </p>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <div className="w-9 h-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center mb-3">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900 mb-1">
                  3. Offset-Based Conflict Engine
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Strict non-conversational API contract. Returns verbatim paragraphs with character-offset Yellow and Red highlights plus paralegal rationale.
                </p>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Full Document Viewer Modal */}
      <DocumentViewerModal
        sourceId={selectedSourceId}
        onClose={() => setSelectedSourceId(null)}
        activeParagraphIndex={activeParagraphIndex}
      />
    </div>
  );
};
