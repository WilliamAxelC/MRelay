import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, PlayCircle, Plus, Sparkles, X } from 'lucide-react';

interface MediaIngestionFormProps {
  onIngest: (urlOrItem: string | any, playNext?: boolean) => Promise<void>;
  disabled?: boolean;
}

interface SearchResult {
  videoId: string;
  title: string;
  duration: string;
  author: string;
}

export const MediaIngestionForm: React.FC<MediaIngestionFormProps> = React.memo(({ onIngest, disabled }) => {
  const [query, setQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const clientCacheRef = useRef<Map<string, SearchResult[]>>(new Map());
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const performSearch = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.match(/^https?:\/\//)) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const cacheKey = searchTerm.toLowerCase().trim();
    if (clientCacheRef.current.has(cacheKey)) {
      setSearchResults(clientCacheRef.current.get(cacheKey) || []);
      setShowDropdown(true);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsSearching(true);
    setShowDropdown(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchTerm)}`, {
        signal: abortControllerRef.current.signal
      });
      if (res.ok) {
        const data = await res.json();
        const results = data.results || [];
        clientCacheRef.current.set(cacheKey, results);
        setSearchResults(results);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[Search Error]', err);
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length >= 2 && !val.match(/^https?:\/\//)) {
      const cacheKey = val.toLowerCase().trim();
      if (clientCacheRef.current.has(cacheKey)) {
        setSearchResults(clientCacheRef.current.get(cacheKey) || []);
        setShowDropdown(true);
      } else {
        debounceRef.current = setTimeout(() => {
          performSearch(val.trim());
        }, 220);
      }
    } else {
      setSearchResults([]);
      setShowDropdown(false);
    }
  };

  const handleSelectTrack = async (item: SearchResult, mode: 'end' | 'next') => {
    setIsSubmitting(true);
    setShowDropdown(false);
    try {
      await onIngest({
        videoId: item.videoId,
        title: item.title,
        duration: item.duration,
        author: item.author
      }, mode === 'next');
      setQuery('');
      setSearchResults([]);
    } catch (err) {
      console.error('[Ingest Select Error]', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = query.trim();
    if (!input || isSubmitting || disabled) return;

    if (input.match(/^https?:\/\//) || input.length === 11) {
      setIsSubmitting(true);
      setShowDropdown(false);
      try {
        await onIngest(input, false);
        setQuery('');
        setSearchResults([]);
      } catch (err) {
        console.error('[Ingestion Form Error]', err);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      performSearch(input);
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 p-2 bg-zinc-900/90 rounded-2xl border border-zinc-800 focus-within:border-emerald-500/80 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all shadow-xl backdrop-blur-xl z-30 relative"
      >
        <div className="flex-1 flex items-center bg-transparent px-3 min-w-0">
          <Search className="w-4 h-4 text-zinc-500 mr-2.5 shrink-0" />
          <input
            type="text"
            placeholder="Search YouTube track or paste link / playlist..."
            value={query}
            onChange={handleInputChange}
            disabled={disabled || isSubmitting}
            className="flex-1 bg-transparent py-1.5 text-sm focus:outline-none placeholder:text-zinc-500 disabled:opacity-50 text-white truncate font-medium"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSearchResults([]);
                setShowDropdown(false);
              }}
              className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white shrink-0 ml-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={disabled || isSubmitting || !query.trim()}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-xs uppercase tracking-wider flex items-center gap-1.5 shrink-0 shadow-lg shadow-emerald-500/10"
        >
          {isSearching ? (
            <Loader2 className="w-4 h-4 animate-spin text-black" />
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Search</span>
            </>
          )}
        </button>
      </form>

      {showDropdown && searchResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-950/95 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden z-50 max-h-96 overflow-y-auto backdrop-blur-2xl divide-y divide-zinc-900 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-3 bg-zinc-900/60 flex items-center justify-between border-b border-zinc-800/80">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
              Search Results ({searchResults.length})
            </span>
            <span className="text-[10px] text-zinc-500">Select an action</span>
          </div>

          {searchResults.map((result) => (
            <div
              key={result.videoId}
              className="flex items-center justify-between gap-3 p-3 hover:bg-zinc-900/80 transition-colors group cursor-pointer"
              onClick={() => handleSelectTrack(result, 'end')}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-14 h-10 bg-zinc-900 rounded-xl overflow-hidden shrink-0 border border-zinc-800 shadow">
                  <img
                    src={`https://img.youtube.com/vi/${result.videoId}/mqdefault.jpg`}
                    alt={result.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                    {result.title}
                  </h4>
                  <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                    {result.author} {result.duration && `• ${result.duration}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleSelectTrack(result, 'next')}
                  className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-[10px] font-bold transition-all whitespace-nowrap active:scale-95 flex items-center gap-1"
                >
                  <PlayCircle className="w-3 h-3" />
                  <span>Play Next</span>
                </button>
                <button
                  onClick={() => handleSelectTrack(result, 'end')}
                  className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-[10px] font-bold transition-all whitespace-nowrap active:scale-95 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
