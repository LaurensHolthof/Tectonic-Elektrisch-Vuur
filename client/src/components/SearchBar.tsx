import React, { useState } from 'react';
import { Search, X, Loader2, Sparkles } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  initialQuery?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, isLoading, initialQuery = '' }) => {
  const [query, setQuery] = useState(initialQuery);

  const sampleQueries = [
    'Parental leave notice period Germany',
    'Severance redundancy calculation France',
    'Terminate senior engineers with 2 weeks notice',
    'Remote work abroad and permanent establishment tax',
    'Weekend hackathon code ownership and side projects',
    'German Nachweisgesetz contract signing wet-ink'
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
    <div className="w-full max-w-3xl mx-auto">
      {/* Google-Style Minimalist Search Input */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <div className="absolute left-4.5 text-slate-400 pointer-events-none">
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            ) : (
              <Search className="w-5 h-5 text-slate-400" />
            )}
          </div>

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a paralegal question (e.g. notice periods, parental leave, severance)..."
            className="w-full pl-12 pr-28 py-3.5 bg-white text-slate-900 rounded-full border border-slate-300 shadow-sm hover:shadow-md focus:shadow-lg focus:border-blue-500 focus:outline-none transition-all text-base placeholder:text-slate-400 font-sans"
          />

          <div className="absolute right-3 flex items-center gap-1.5">
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                title="Clear query"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-4 py-1.5 bg-slate-900 hover:bg-blue-600 disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-semibold rounded-full transition-all"
            >
              Search
            </button>
          </div>
        </div>
      </form>

      {/* Suggested Quick Queries */}
      <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 text-xs text-slate-500 no-scrollbar">
        <span className="flex items-center gap-1 text-slate-400 text-[11px] whitespace-nowrap pl-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Try:</span>
        </span>
        <div className="flex items-center gap-1.5 flex-nowrap">
          {sampleQueries.map((sample) => (
            <button
              key={sample}
              onClick={() => handleSampleClick(sample)}
              className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 whitespace-nowrap transition-colors border border-slate-200/80 text-[11px]"
            >
              {sample}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
