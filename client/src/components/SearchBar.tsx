import React, { useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  initialQuery?: string;
  showSuggestions?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  isLoading,
  initialQuery = '',
  showSuggestions = true
}) => {
  const [query, setQuery] = useState(initialQuery);

  const sampleQueries = [
    "Can I use my 2026 professional development allowance to pay for a €1,400 online data analytics course, and do I need my manager's approval before I enroll?",
    'How much is the 2026 learning allowance?',
    'Do online courses need manager approval?'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handleSampleClick = (sample: string) => {
    setQuery(sample);
    onSearch(sample);
  };

  const handleClear = () => {
    setQuery('');
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <form onSubmit={handleSubmit} className="relative" role="search">
        <div className="relative flex items-center rounded-xl border border-slate-300 bg-white shadow-sm transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 hover:border-slate-400">
          <div className="pointer-events-none absolute left-4 text-slate-400">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            ) : (
              <Search className="h-5 w-5" />
            )}
          </div>

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search policies, guidance, and workplace questions..."
            aria-label="Search workplace knowledge"
            className="w-full rounded-xl bg-transparent py-3.5 pl-12 pr-28 text-sm text-slate-900 outline-none placeholder:text-slate-400 sm:text-base"
          />

          <div className="absolute right-2.5 flex items-center gap-1">
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Clear query"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              {isLoading ? 'Searching' : 'Search'}
            </button>
          </div>
        </div>
      </form>

      {showSuggestions && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
          <span className="text-slate-400">Try</span>
          {sampleQueries.map((sample) => (
            <button
              type="button"
              key={sample}
              onClick={() => handleSampleClick(sample)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
            >
              {sample}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
