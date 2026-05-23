/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Orbit, Compass } from 'lucide-react';

interface SliderSelectorProps {
  radiusMeters: number;
  onChangeRadius: (meters: number) => void;
}

export default function SliderSelector({ radiusMeters, onChangeRadius }: SliderSelectorProps) {
  // Convert standard meters to visual presentation
  const isKm = radiusMeters >= 1000;
  const displayVal = isKm ? (radiusMeters / 1000).toFixed(1) : radiusMeters;
  const displayUnit = isKm ? "KM" : "meters";

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onChangeRadius(val);
  };

  const handleDirectInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    if (rawVal === '') return;
    
    let floatVal = parseFloat(rawVal);
    if (!isNaN(floatVal)) {
      // Clamp values between 500m and 50000m (50km)
      if (floatVal < 0.5) floatVal = 0.5;
      if (floatVal > 50) floatVal = 50;
      onChangeRadius(Math.round(floatVal * 1000));
    }
  };

  // Preset radii for fast one-handed commutes setup
  const PRESETS = [
    { label: "500m", meters: 500 },
    { label: "1 KM", meters: 1000 },
    { label: "2 KM", meters: 2000 },
    { label: "5 KM", meters: 5000 },
    { label: "10 KM", meters: 10000 },
  ];

  return (
    <div className="space-y-4">
      {/* Title Header with interactive inputs */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold tracking-wider font-sans text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1.5">
          <Orbit className="h-3.5 w-3.5 text-slate-500" /> GEOFENCE RADIUS
        </label>
        
        {/* Real-time editable radius reading */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 dark:bg-slate-800 dark:border-slate-700/80 rounded-xl px-2.5 py-1">
          <input
            type="number"
            value={isKm ? parseFloat((radiusMeters / 1000).toFixed(2)) : radiusMeters}
            step={isKm ? 0.1 : 50}
            onChange={(e) => {
              const parsed = parseFloat(e.target.value);
              if (isNaN(parsed)) return;
              if (isKm) {
                const clamped = Math.min(Math.max(parsed, 0.5), 50);
                onChangeRadius(Math.round(clamped * 1000));
              } else {
                const clamped = Math.min(Math.max(parsed, 500), 50000);
                onChangeRadius(Math.round(clamped));
              }
            }}
            className="w-12 text-right text-xs font-mono font-bold text-slate-800 dark:text-slate-100 bg-transparent focus:outline-none"
          />
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
            {displayUnit}
          </span>
        </div>
      </div>

      {/* Slider Selector Bar */}
      <div className="space-y-1">
        <input
          type="range"
          min={500}
          max={50000}
          step={radiusMeters < 5000 ? 100 : 500}
          value={radiusMeters}
          onChange={handleSliderChange}
          className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          style={{
            background: `linear-gradient(to right, #10b981 0%, #10b981 ${((radiusMeters - 500) / (50000 - 500)) * 100}%, #f3f4f6 ${((radiusMeters - 500) / (50000 - 500)) * 100}%, #f3f4f6 100%)`
          }}
        />
        <div className="flex justify-between text-[10px] font-mono font-semibold text-slate-400 dark:text-slate-500 px-0.5">
          <span>500 m</span>
          <span>10 KM</span>
          <span>25 KM</span>
          <span>50 KM</span>
        </div>
      </div>

      {/* Preset Micro-tags for instant clicking */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {PRESETS.map((preset) => (
          <button
            key={preset.meters}
            type="button"
            onClick={() => onChangeRadius(preset.meters)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all duration-200 ${
              radiusMeters === preset.meters
                ? "bg-emerald-500 border-transparent text-white shadow-xs"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/80"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
