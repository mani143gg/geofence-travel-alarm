/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, X, Loader2, Clock, Map } from 'lucide-react';

interface SearchResult {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
  importance: number;
  address?: {
    road?: string;
    suburb?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

interface SearchPanelProps {
  onSelectLocation: (lat: number, lon: number, name: string) => void;
  currentDestinationName?: string;
  onClearDestination?: () => void;
}

export default function SearchPanel({ 
  onSelectLocation, 
  currentDestinationName,
  onClearDestination 
}: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentSearches, setRecentSearches] = useState<Array<{ name: string; lat: number; lon: number }>>([]);
  const dropDownRef = useRef<HTMLDivElement>(null);

  // Load recent searches on mount
  useEffect(() => {
    const raw = localStorage.getItem('geofence_recent_searches');
    if (raw) {
      try {
        setRecentSearches(JSON.parse(raw));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Keyboard and outside click dismiss
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropDownRef.current && !dropDownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Save a search to recents
  const saveToRecents = (name: string, lat: number, lon: number) => {
    const fresh = { name, lat, lon };
    const filtered = recentSearches.filter(item => item.name !== name);
    const updated = [fresh, ...filtered].slice(0, 5); // limit to 5
    setRecentSearches(updated);
    localStorage.setItem('geofence_recent_searches', JSON.stringify(updated));
  };

  // Perform search call to proxied Nominatim wrapper
  const triggerSearch = async (val: string) => {
    if (!val || val.trim().length < 3) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/search?q=${encodeURIComponent(val)}`);
      if (!resp.ok) {
        throw new Error("Search server returned an error.");
      }
      const data = await resp.json();
      if (Array.isArray(data)) {
        setResults(data);
      } else {
        setResults([]);
      }
      setShowDropdown(true);
    } catch (e: any) {
      console.error(e);
      setError("Unable to find address. Direct tap the map if search fails!");
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced typing search helper
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (query.trim().length >= 3) {
        triggerSearch(query);
      } else {
        setResults([]);
      }
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [query]);

  const handleSelectResult = (item: SearchResult) => {
    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    
    // Shorten visual label slightly for aesthetics
    const displayNameLong = item.display_name;
    const parts = displayNameLong.split(',');
    const shortenedName = parts.length > 2 
      ? `${parts[0].trim()}, ${parts[1].trim()} (${parts[parts.length - 1].trim()})` 
      : displayNameLong;

    onSelectLocation(lat, lon, shortenedName);
    saveToRecents(shortenedName, lat, lon);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
  };

  const handleSelectRecent = (recent: { name: string; lat: number; lon: number }) => {
    onSelectLocation(recent.lat, recent.lon, recent.name);
    setShowDropdown(false);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    if (onClearDestination) {
      onClearDestination();
    }
  };

  return (
    <div className="relative w-full z-30" ref={dropDownRef}>
      <div className="flex items-center gap-2 rounded-2xl bg-slate-50 border border-slate-100 dark:bg-slate-900/90 dark:border-slate-800 transition-all p-2">
        {/* Search Input Container */}
        <div className="relative flex-1 flex items-center">
          <Search className="absolute left-3.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder={currentDestinationName || "Search stops, cities, train stations..."}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            className={`w-full bg-white dark:bg-slate-950 pl-10 pr-10 py-2.5 rounded-xl text-sm font-medium placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500/50 dark:focus:ring-sky-500/40 text-slate-800 dark:text-slate-100 transition-all border border-slate-100 dark:border-slate-800/85 ${
              currentDestinationName && !query ? "border-emerald-500/40 dark:border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-semibold" : ""
            }`}
          />
          {(query || currentDestinationName) && (
            <button
              onClick={handleClear}
              className="absolute right-3 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-850 transition-all"
              title="Clear selected destination"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Quick Help Status Button */}
        {isLoading && (
          <div className="px-1">
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          </div>
        )}
      </div>

      {/* Autocomplete Dropdown List */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 max-h-80 overflow-y-auto rounded-3xl bg-white/95 shadow-2xl border border-slate-200/60 dark:bg-slate-950/95 dark:border-slate-850 backdrop-blur-xl divide-y divide-slate-100 dark:divide-slate-900 z-50">
          
          {/* Autocomplete Results */}
          {results.length > 0 && (
            <div className="p-1">
              <div className="px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                Search Results
              </div>
              {results.map((item) => (
                <button
                  key={item.place_id}
                  onClick={() => handleSelectResult(item)}
                  className="w-full flex items-start gap-3 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl transition-all"
                >
                  <MapPin className="h-4 w-4 mt-0.5 text-slate-400 flex-shrink-0" />
                  <div className="truncate">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {item.display_name.split(',')[0]}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                      {item.display_name}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3 text-xs text-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-center font-medium">
              {error}
            </div>
          )}

          {/* Recent Searches */}
          {recentSearches.length > 0 && !query && (
            <div className="p-1">
              <div className="px-3 py-1.5 flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Recent Commutes
                </span>
                <button
                  onClick={() => {
                    localStorage.removeItem('geofence_recent_searches');
                    setRecentSearches([]);
                  }}
                  className="text-[9px] font-medium text-rose-400 hover:text-rose-600 transition-colors"
                >
                  Clear Recents
                </button>
              </div>
              {recentSearches.map((recent, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectRecent(recent)}
                  className="w-full flex items-start gap-3 px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg transition-all"
                >
                  <MapPin className="h-3.5 w-3.5 mt-0.5 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                  <div className="truncate">
                    <p className="font-medium text-slate-700 dark:text-slate-200 truncate">
                      {recent.name}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                      {recent.lat.toFixed(4)}°, {recent.lon.toFixed(4)}°
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Empty Prompt */}
          {query.trim().length >= 3 && results.length === 0 && !isLoading && !error && (
            <div className="p-6 text-center text-sm text-slate-400 dark:text-slate-500">
              No stops found. Drag/click anywhere on the map to manually lock-in a stopping destination!
            </div>
          )}

          {/* Tip Area */}
          {!query && recentSearches.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500">
              <p className="font-semibold text-slate-500 dark:text-slate-400 mb-1">🌍 Quick Destination Mode</p>
              Type to search or tap directly anywhere on the map grid to lock your commute's target radius target.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
