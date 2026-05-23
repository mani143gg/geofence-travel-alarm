/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { History, Trash2, RotateCcw, AlertTriangle, CheckCircle, Ban, X, Calendar, MapPin } from 'lucide-react';
import { TripHistoryItem } from '../types';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onReuseDestination: (lat: number, lon: number, name: string, radius: number) => void;
}

export default function HistoryDrawer({ isOpen, onClose, onReuseDestination }: HistoryDrawerProps) {
  const [historyList, setHistoryList] = useState<TripHistoryItem[]>([]);

  // Reload history when drawer is opened
  useEffect(() => {
    if (isOpen) {
      const raw = localStorage.getItem('geofence_trip_history');
      if (raw) {
        try {
          const parsed: TripHistoryItem[] = JSON.parse(raw);
          // Sort newest first
          setHistoryList(parsed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [isOpen]);

  const handleClearAll = () => {
    if (window.confirm("Do you want to wipe all stored trip records? This cannot be undone.")) {
      localStorage.removeItem('geofence_trip_history');
      setHistoryList([]);
    }
  };

  const handleReuse = (item: TripHistoryItem) => {
    onReuseDestination(item.lat, item.lon, item.destinationName, item.radius);
    onClose();
  };

  const formatDistance = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} KM`;
    }
    return `${meters} m`;
  };

  const formatDate = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" 
        onClick={onClose}
      />

      {/* Drawer Body */}
      <div className="relative w-full max-w-md bg-white dark:bg-slate-950 h-full shadow-2xl flex flex-col justify-between border-l border-slate-100 dark:border-slate-800 animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <History className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Trip History</h2>
              <p className="text-[10px] text-slate-400 font-mono">OFFLINE LOCAL LOGS</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {historyList.length > 0 && (
              <button
                onClick={handleClearAll}
                className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all"
                title="Wipe Logs"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 rounded-xl transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {historyList.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
              <div className="p-4 rounded-full bg-slate-50 text-slate-300 dark:bg-slate-900 dark:text-slate-700">
                <History className="h-10 w-10" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No Tripmeter Logs</p>
                <p className="text-xs text-slate-400 max-w-xs mt-1">Your travel commutes and geofenced trigger histories are stored locally on your device here.</p>
              </div>
            </div>
          ) : (
            historyList.map((item) => (
              <div 
                key={item.id} 
                className="group relative rounded-3xl bg-slate-50/80 hover:bg-slate-100 p-5 border border-slate-200/60 dark:bg-slate-900/60 dark:hover:bg-slate-900/80 dark:border-slate-800/80 transition-all shadow-xs hover:shadow-md"
              >
                {/* Status Badges */}
                <div className="absolute top-4 right-4 flex items-center gap-1.5">
                  {item.status === 'triggered' && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      <AlertTriangle className="h-3 w-3" /> Woken Up
                    </span>
                  )}
                  {item.status === 'completed' && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <CheckCircle className="h-3 w-3" /> Arrived
                    </span>
                  )}
                  {item.status === 'active' && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 animated-ring">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-600 animate-ping" /> Tracking
                    </span>
                  )}
                  {item.status === 'cancelled' && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      <Ban className="h-3 w-3" /> Dismissed
                    </span>
                  )}
                </div>

                {/* Primary Content fields */}
                <div className="space-y-2">
                  <div className="flex items-start gap-1.5 max-w-[70%]">
                    <MapPin className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" title={item.destinationName}>
                        {item.destinationName.split(',')[0]}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate" title={item.destinationName}>
                        {item.destinationName}
                      </p>
                    </div>
                  </div>

                  {/* Secondary stats */}
                  <div className="flex items-center gap-4 text-[10px] text-slate-400 font-mono mt-1 pt-2 border-t border-slate-200/40 dark:border-slate-800/40">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {formatDate(item.timestamp)}
                    </span>
                    <span>•</span>
                    <span>Radius: <strong>{formatDistance(item.radius)}</strong></span>
                  </div>
                </div>

                {/* Hover Quick Reuse Button */}
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => handleReuse(item)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200/60 hover:bg-slate-50 dark:text-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700 shadow-xs transition-all"
                  >
                    <RotateCcw className="h-3 w-3" /> Quick Commute
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info banner */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-850 text-[11px] text-slate-400 dark:text-slate-500 text-center leading-relaxed">
          🔒 Private Off-Database Session. All log details remain locked specifically onto this local browser file directory.
        </div>
      </div>
    </div>
  );
}
