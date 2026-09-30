import React, { useState } from 'react';
import { SearchQuery, SearchResponse } from './types';
import { SearchBar } from './components/SearchBar';
import { ParagraphCard } from './components/ParagraphCard';
import { EntityRoutingBanner } from './components/EntityRoutingBanner';
import { DocumentViewerModal } from './components/DocumentViewerModal';
import { BookOpen, ShieldAlert, ShieldCheck } from 'lucide-react';

type FilterMode = 'all' | 'conflicts' | 'verified';
const RESULTS_PAGE_SIZE = 8;

export const App: React.FC = () => {
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number | undefined>(undefined);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [visibleResultCount, setVisibleResultCount] = useState(RESULTS_PAGE_SIZE);

  const handleSearch = async (queryText: string) => {
    setIsLoading(true);
    setSearchError(null);
    setFilterMode('all');
    setVisibleResultCount(RESULTS_PAGE_SIZE);

    try {
      const payload: SearchQuery = { query: queryText };
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`Search failed: ${res.statusText}`);

      const data: SearchResponse = await res.json();
      setSearchResponse(data);
    } catch (err) {
      console.error('Search error:', err);
      setSearchError('We could not search the source library. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSourceDoc = (sourceId: string, paragraphIndex?: number) => {
    setSelectedSourceId(sourceId);
    setActiveParagraphIndex(paragraphIndex);
  };

  const allResults = searchResponse?.results || [];
  const filteredResults = allResults.filter((item) => {
    if (filterMode === 'conflicts') return item.highlights.some((highlight) => highlight.color === 'red');
    if (filterMode === 'verified') return item.highlights.some((highlight) => highlight.color === 'yellow');
    return true;
  });
  const conflictCount = allResults.filter((result) =>
    result.highlights.some((highlight) => highlight.color === 'red')
  ).length;
  const verifiedCount = allResults.filter((result) =>
    result.highlights.some((highlight) => highlight.color === 'yellow')
  ).length;
  const visibleResults = filteredResults.slice(0, visibleResultCount);

  const handleFilterChange = (mode: FilterMode) => {
    setFilterMode(mode);
    setVisibleResultCount(RESULTS_PAGE_SIZE);
  };

  const filters: Array<{ mode: FilterMode; label: string; count: number }> = [
    { mode: 'all', label: 'All', count: allResults.length },
    { mode: 'conflicts', label: 'Conflicts', count: conflictCount },
    { mode: 'verified', label: 'Supported', count: verifiedCount }
  ];

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-slate-800">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <a
            href="/"
            aria-label="LexisHR home"
            className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold tracking-tight text-slate-950">LexisHR</span>
              <span className="hidden text-xs text-slate-400 sm:inline">Workplace knowledge</span>
            </div>
          </a>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Source library ready
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
        <section className={searchResponse ? 'mb-5' : 'mx-auto max-w-3xl pb-12 pt-12 text-center sm:pt-20'}>
          {!searchResponse && (
            <div className="mb-7">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                HR knowledge search
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Find the source, not a summary.
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
                Search policies, handbooks, agreements, and employment guidance. Every result links to its source.
              </p>
            </div>
          )}

          {searchResponse && (
            <h1 className="mb-3 text-lg font-semibold tracking-tight text-slate-950">Search workplace knowledge</h1>
          )}

          <SearchBar
            onSearch={handleSearch}
            isLoading={isLoading}
            initialQuery={searchResponse?.query || ''}
            showSuggestions={!searchResponse}
          />

          {searchError && (
            <p role="alert" className="mx-auto mt-3 max-w-3xl rounded-lg bg-red-50 px-3 py-2 text-left text-sm text-red-700">
              {searchError}
            </p>
          )}
        </section>

        {searchResponse && <EntityRoutingBanner routing={searchResponse.routing} />}

        {searchResponse && (
          <section className="mt-6">
            <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  {searchResponse.totalResults} {searchResponse.totalResults === 1 ? 'result' : 'results'}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {searchResponse.scannedCorpusCount} sources scanned in {searchResponse.executionTimeMs} ms
                </p>
              </div>

              <div className="inline-flex w-fit items-center rounded-lg bg-slate-100 p-1" aria-label="Filter results">
                {filters.map((filter) => (
                  <button
                    key={filter.mode}
                    type="button"
                    onClick={() => handleFilterChange(filter.mode)}
                    aria-pressed={filterMode === filter.mode}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      filterMode === filter.mode
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {filter.label} <span className="ml-1 text-slate-400">{filter.count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                Yellow marks matching source sentences
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
                Red marks conflicting or risky guidance
              </span>
            </div>

            {filteredResults.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                <BookOpen className="mx-auto mb-3 h-7 w-7 text-slate-300" aria-hidden="true" />
                <h3 className="text-sm font-medium text-slate-800">
                  {filterMode === 'all'
                    ? 'No relevant sources found'
                    : filterMode === 'conflicts'
                      ? 'No conflicts found'
                      : 'No supported matches'}
                </h3>
                {filterMode === 'all' ? (
                  <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">
                    Try a more specific workplace topic, policy name, team, or region.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleFilterChange('all')}
                    className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Show all results
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {visibleResults.map((paragraph) => (
                  <ParagraphCard
                    key={paragraph.paragraphId}
                    paragraph={paragraph}
                    onOpenSourceDoc={(sourceId) => handleOpenSourceDoc(sourceId, paragraph.paragraphIndex)}
                  />
                ))}
                {visibleResults.length < filteredResults.length && (
                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => setVisibleResultCount((count) => count + RESULTS_PAGE_SIZE)}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    >
                      Show {Math.min(RESULTS_PAGE_SIZE, filteredResults.length - visibleResults.length)} more
                    </button>
                    <p className="mt-2 text-[11px] text-slate-400">
                      Showing {visibleResults.length} of {filteredResults.length}
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {!searchResponse && !isLoading && (
          <section className="mx-auto max-w-3xl border-t border-slate-200 pt-5">
            <div className="flex flex-col gap-3 text-left text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <span>Direct excerpts from your workplace source library.</span>
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-400" /> Source citations
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-slate-400" /> Conflict checks
                </span>
              </div>
            </div>
          </section>
        )}
      </main>

      <DocumentViewerModal
        sourceId={selectedSourceId}
        onClose={() => setSelectedSourceId(null)}
        activeParagraphIndex={activeParagraphIndex}
      />
    </div>
  );
};
