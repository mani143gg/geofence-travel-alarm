/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Compass, ShieldCheck, Bell, Waves, ShieldAlert, Cpu } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const totalSteps = 3;

  if (!isOpen) return null;

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      localStorage.setItem('geofence_onboarded', 'true');
      onClose();
    }
  };

  const handleSkip = () => {
    localStorage.setItem('geofence_onboarded', 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/65 backdrop-blur-sm transition-opacity"
        onClick={handleSkip}
      />
      
      {/* Modal Box */}
      <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 shadow-2xl transition-all dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
        
        {/* Step Indicator */}
        <div className="absolute top-6 right-6 text-xs font-mono font-semibold text-slate-400 dark:text-slate-500">
          STEP {step} OF {totalSteps}
        </div>

        {/* Dynamic Content */}
        <div className="mt-2 text-center">
          {step === 1 && (
            <div className="space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-400">
                <Compass className="h-7 w-7 animate-pulse" />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                GPS Accuracy Setup
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                We utilize high-accuracy satellite telemetry (GPS) to trace your coordinates in real-time. This helps us awaken you exactly before your stop.
              </p>
              <div className="rounded-xl bg-slate-50 p-3 text-left text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 space-y-1">
                <p className="font-semibold text-slate-800 dark:text-slate-200">🔍 Accuracy Recommendations:</p>
                <p>• Avoid tunnels or thick concrete levels during tracking</p>
                <p>• Enable high-accuracy location service (GPS + cellular networks) on your hand-held phone device</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-500 dark:bg-violet-950/40 dark:text-violet-400">
                <Bell className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Critical Level Alerts
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                When minimized or backgrounded, we request notification permissions of a high emergency level. This ensures you hear your commuting alarm sound immediately!
              </p>
              <div className="rounded-xl bg-violet-50/50 p-3 text-left text-xs text-violet-800 dark:bg-violet-950/20 dark:text-violet-400 space-y-1">
                <p className="font-semibold">🔔 System Permissions Required:</p>
                <p>• Allow notifications to enable background services</p>
                <p>• The synthesiser will produce dual-frequency tones forced to alarm Commuter stops safely.</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400">
                <Cpu className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Battery Savings & App Keepalive
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Android & iOS aggressively freeze background tasks to conserve battery power. To guarantee maximum reliability during sleepy transits, adjust background limits.
              </p>
              <div className="rounded-xl bg-slate-50 p-3 text-left text-xs text-slate-600 dark:bg-slate-800/50 dark:text-slate-400 space-y-1.5">
                <div className="flex items-start gap-1.5">
                  <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <p><strong>Samsung / Pixel:</strong> Select "Unrestricted" in Application Settings &rarr; Battery Usage</p>
                </div>
                <div className="flex items-start gap-1.5">
                  <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <p><strong>Xiaomi / Huawei:</strong> Disable "Battery Saver" for GeoFence Travel Alarm</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={handleSkip}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
          >
            Skip Onboarding
          </button>
          
          <div className="flex gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                  step === i + 1 
                    ? 'w-4 bg-slate-800 dark:bg-white' 
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-colors shadow-sm"
          >
            {step === totalSteps ? "Confirm Setup" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
