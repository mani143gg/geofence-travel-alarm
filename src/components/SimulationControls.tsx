/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Play, Pause, FastForward, Navigation, Info, ShieldAlert, Cpu } from 'lucide-react';

interface SimulationControlsProps {
  isSimulating: boolean;
  onToggleSimulating: () => void;
  speedKmh: number;
  onChangeSpeed: (kmh: number) => void;
  pollingIntervalSeconds: number;
  onResetSimulation: () => void;
  hasRoute: boolean;
  progressPercent: number;
  nested?: boolean;
}

export default function SimulationControls({
  isSimulating,
  onToggleSimulating,
  speedKmh,
  onChangeSpeed,
  pollingIntervalSeconds,
  onResetSimulation,
  hasRoute,
  progressPercent,
  nested = false
}: SimulationControlsProps) {

  // Suggest presets based on different vehicles
  const PRESETS = [
    { label: "🚶 Walk", speed: 5 },
    { label: "🚌 Bus/Cab", speed: 45 },
    { label: "🚄 Express Train", speed: 120 },
  ];

  const content = (
    <>
      {/* Simulation Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold font-sans text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Navigation className="h-4 w-4 text-emerald-500 animate-pulse animate-duration-1000" /> SPEED-ADAPTIVE GPS SIMULATION
        </span>
        <div className="flex items-center gap-2">
          {hasRoute && (
            <button
              onClick={onResetSimulation}
              className="text-[10px] font-mono font-bold text-rose-500 hover:text-rose-600 transition-colors bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/40 px-2 py-0.5 rounded-lg"
            >
              RESET
            </button>
          )}
          <span className={`inline-block h-2 w-2 rounded-full ${isSimulating ? 'bg-emerald-500 animate-ping' : 'bg-slate-300 dark:bg-slate-700'}`} />
        </div>
      </div>

      {!hasRoute ? (
        <div className="rounded-xl bg-orange-50/50 dark:bg-orange-950/10 p-3 text-xs text-orange-600 dark:text-orange-400 flex items-start gap-2 border border-orange-500/10 leading-relaxed font-sans">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <p>
            Choose a destination on the map first to enable simulation parameters.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          
          {/* Main Sim Controller Panel */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleSimulating}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-200 shadow-xs cursor-pointer ${
                isSimulating
                  ? "bg-amber-500 hover:bg-amber-600 text-white"
                  : "bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              }`}
            >
              {isSimulating ? (
                <>
                  <Pause className="h-4 w-4" /> Pause Commute
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" /> Simulate GPS Trip
                </>
              )}
            </button>
          </div>

          {/* Progress Indicator Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono">
              <span>Departure</span>
              <span>{progressPercent.toFixed(0)}% Complete</span>
              <span>Stop Boundary</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-300 rounded-full" 
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Speed range sliders */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                Simulated speed:
                <strong className="text-slate-800 dark:text-slate-100 font-mono text-sm ml-1">
                  {speedKmh} km/h
                </strong>
              </span>

              {/* Dynamic polling frequency label */}
              <div className="flex items-center gap-1 text-[10px] font-mono bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-850 px-2 py-0.5 rounded-lg">
                <Cpu className="h-3 w-3 text-emerald-500" />
                Adaptive Poll: <strong className="text-emerald-500">{pollingIntervalSeconds}s</strong>
              </div>
            </div>

            <input
              type="range"
              min={0}
              max={160}
              step={5}
              value={speedKmh}
              onChange={(e) => onChangeSpeed(parseInt(e.target.value))}
              disabled={!isSimulating}
              className={`w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 ${!isSimulating ? 'opacity-50' : ''}`}
            />
          </div>

          {/* Speed Presets Buttons */}
          <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            {PRESETS.map((preset) => (
              <button
                key={preset.speed}
                type="button"
                onClick={() => onChangeSpeed(preset.speed)}
                disabled={!isSimulating}
                className={`flex-1 min-w-[70px] py-1.5 px-2.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                  speedKmh === preset.speed
                    ? "bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-emerald-500 font-bold"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                } ${!isSimulating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Explanation Footer about adaptive polling logic */}
          <div className="text-[10px] leading-relaxed text-slate-400 dark:text-slate-500 font-sans italic bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-850">
            💡 <strong>Smart Battery Polling:</strong> While traveling on high-speed rail ({'>'}60km/h), notifications are processed every <strong>5s</strong> to prevent stop bypass. While stationary, tracking scales back to <strong>25s</strong> to prevent battery drain.
          </div>

        </div>
      )}
    </>
  );

  if (nested) {
    return (
      <div className="space-y-4">
        {content}
      </div>
    );
  }

  return (
    <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-5 shadow-sm dark:shadow-xl space-y-4">
      {content}
    </div>
  );
}
