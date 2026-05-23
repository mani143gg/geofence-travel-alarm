/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

let audioCtx: AudioContext | null = null;
let oscillator1: OscillatorNode | null = null;
let oscillator2: OscillatorNode | null = null;
let gainNode: GainNode | null = null;
let sirenInterval: any = null;

export interface AlarmSoundOption {
  id: string;
  name: string;
  description: string;
}

export const ALARM_SOUND_OPTIONS: AlarmSoundOption[] = [
  { id: 'classic', name: '🚨 Classic Emergency', description: 'Sweeping high-pitched electronic siren' },
  { id: 'bell', name: '🔔 Railway Crossing Bell', description: 'Rhythmic metallic bell impact with sustained ring' },
  { id: 'sonar', name: '📡 Submarine Sonar Ping', description: 'Echoing deep acoustic radar beacon pulses' },
  { id: 'arcade', name: '👾 Retro Arcade Alert', description: 'Chiptune style 8-bit warnings' },
  { id: 'zen', name: '🧘 Zen Singing Bowl', description: 'Gentle swelling harmonic chime' }
];

/**
 * Initializes the AudioContext lazily after a user interaction gesture
 */
function getAudioContext(): AudioContext {
  if (!audioCtx) {
    // Support prefix for Safari
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Start playing a looping synthesized sound effect based on the selected sound option.
 */
export function startAlarmSound(soundType: string = 'classic') {
  try {
    const ctx = getAudioContext();
    
    // If already playing, stop first to avoid overlaps
    stopAlarmSound();

    gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.7, ctx.currentTime);
    gainNode.connect(ctx.destination);

    if (soundType === 'classic') {
      // Create a powerful dual oscillator sound
      oscillator1 = ctx.createOscillator();
      oscillator1.type = "sawtooth";
      oscillator1.frequency.setValueAtTime(580, ctx.currentTime);
      oscillator1.connect(gainNode);

      oscillator2 = ctx.createOscillator();
      oscillator2.type = "sine";
      oscillator2.frequency.setValueAtTime(620, ctx.currentTime);
      oscillator2.connect(gainNode);

      oscillator1.start();
      oscillator2.start();

      // Alternate frequency pitch in real-time to simulate an emergency vehicle siren
      let isHighPitch = false;
      sirenInterval = setInterval(() => {
        if (!ctx || ctx.state === "suspended") return;
        const targetFreq1 = isHighPitch ? 880 : 520;
        const targetFreq2 = isHighPitch ? 920 : 540;
        
        oscillator1?.frequency?.exponentialRampToValueAtTime(targetFreq1, ctx.currentTime + 0.25);
        oscillator2?.frequency?.exponentialRampToValueAtTime(targetFreq2, ctx.currentTime + 0.25);
        
        isHighPitch = !isHighPitch;
      }, 450);

    } else if (soundType === 'bell') {
      // Rhythmic railway bell impact every 600ms
      const playBellPulse = () => {
        if (!ctx || ctx.state === "suspended" || !gainNode) return;
        const now = ctx.currentTime;
        
        const noteGain = ctx.createGain();
        noteGain.gain.setValueAtTime(0.6, now);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        noteGain.connect(gainNode);

        const osc1 = ctx.createOscillator();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(850, now);
        osc1.connect(noteGain);

        const osc2 = ctx.createOscillator();
        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(1250, now);
        osc2.connect(noteGain);

        osc1.start(now);
        osc1.stop(now + 0.6);
        osc2.start(now);
        osc2.stop(now + 0.6);

        setTimeout(() => {
          try {
            osc1.disconnect();
            osc2.disconnect();
            noteGain.disconnect();
          } catch (e) {}
        }, 800);
      };

      playBellPulse();
      sirenInterval = setInterval(playBellPulse, 600);

    } else if (soundType === 'sonar') {
      // Echoing submarine sonar acoustics every 1.5 seconds
      const playSonarPulse = () => {
        if (!ctx || ctx.state === "suspended" || !gainNode) return;
        const now = ctx.currentTime;

        const noteGain = ctx.createGain();
        noteGain.gain.setValueAtTime(0.001, now);
        noteGain.gain.linearRampToValueAtTime(0.8, now + 0.05);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
        noteGain.connect(gainNode);

        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.4);
        osc.connect(noteGain);

        osc.start(now);
        osc.stop(now + 1.4);

        setTimeout(() => {
          try {
            osc.disconnect();
            noteGain.disconnect();
          } catch (e) {}
        }, 1600);
      };

      playSonarPulse();
      sirenInterval = setInterval(playSonarPulse, 1500);

    } else if (soundType === 'arcade') {
      // Alternating high chiptune scales
      let state = 0;
      const playArcadeTick = () => {
        if (!ctx || ctx.state === "suspended" || !gainNode) return;
        const now = ctx.currentTime;

        const noteGain = ctx.createGain();
        noteGain.gain.setValueAtTime(0.4, now);
        noteGain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
        noteGain.connect(gainNode);

        const osc = ctx.createOscillator();
        osc.type = "square";
        
        const freqs = [600, 800, 1000, 1200];
        const targetFreq = freqs[state % freqs.length];
        osc.frequency.setValueAtTime(targetFreq, now);
        osc.connect(noteGain);

        osc.start(now);
        osc.stop(now + 0.28);

        state++;

        setTimeout(() => {
          try {
            osc.disconnect();
            noteGain.disconnect();
          } catch (e) {}
        }, 400);
      };

      playArcadeTick();
      sirenInterval = setInterval(playArcadeTick, 300);

    } else if (soundType === 'zen') {
      // Rich overtone chords mimicking a meditation sound bowl decaying slowly
      const playZenChord = () => {
        if (!ctx || ctx.state === "suspended" || !gainNode) return;
        const now = ctx.currentTime;

        const noteGain = ctx.createGain();
        noteGain.gain.setValueAtTime(0.001, now);
        noteGain.gain.linearRampToValueAtTime(0.5, now + 0.8);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);
        noteGain.connect(gainNode);

        const fundamental = 293.66; // D4
        const partials = [1.0, 1.5, 2.0, 2.5]; 
        const oscillators: OscillatorNode[] = [];

        partials.forEach((mult) => {
          const osc = ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.setValueAtTime(fundamental * mult, now);
          osc.connect(noteGain);
          osc.start(now);
          osc.stop(now + 2.5);
          oscillators.push(osc);
        });

        setTimeout(() => {
          try {
            oscillators.forEach(osc => osc.disconnect());
            noteGain.disconnect();
          } catch (e) {}
        }, 2800);
      };

      playZenChord();
      sirenInterval = setInterval(playZenChord, 2500);
    }
  } catch (error) {
    console.error("Failed to start alarm sound engine", error);
  }
}

/**
 * Stop any running alarm sirens cleanly and release audio components.
 */
export function stopAlarmSound() {
  if (sirenInterval) {
    clearInterval(sirenInterval);
    sirenInterval = null;
  }

  try {
    if (oscillator1) {
      oscillator1.stop();
      oscillator1.disconnect();
      oscillator1 = null;
    }
    if (oscillator2) {
      oscillator2.stop();
      oscillator2.disconnect();
      oscillator2 = null;
    }
    if (gainNode) {
      gainNode.disconnect();
      gainNode = null;
    }
  } catch (e) {
    console.warn("Error stopping oscillators:", e);
  }
}

/**
 * Triggers a short feedback chime to acknowledge setup button triggers.
 */
export function playChime() {
  try {
    const ctx = getAudioContext();
    const chimeGain = ctx.createGain();
    chimeGain.gain.setValueAtTime(0.2, ctx.currentTime);
    chimeGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    chimeGain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
    
    osc.connect(chimeGain);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.log("Audio contexts blocked on initial click, chime silent until page has focus.");
  }
}
