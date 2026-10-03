// Web Audio API based alarm buzzer sound utility

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      sharedAudioContext = new AudioContextClass();
    }
    if (sharedAudioContext.state === 'suspended') {
      void sharedAudioContext.resume();
    }
    return sharedAudioContext;
  } catch (err) {
    console.error('AudioContext initialization error:', err);
    return null;
  }
}

// Ensure audio context is ready on first user interaction
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
  };
  window.addEventListener('click', unlockAudio, { once: false, passive: true });
  window.addEventListener('keydown', unlockAudio, { once: false, passive: true });
  window.addEventListener('touchstart', unlockAudio, { once: false, passive: true });
}

// Plays a single clean notification chime for early warnings (once)
export function playWarningChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    void ctx.resume().then(() => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.12); // A5
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.4, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    });
  } catch (err) {
    console.warn('Audio error:', err);
  }
}

// Plays a single critical alarm burst (once)
export function playCriticalAlarmSound(pulses = 3): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    void ctx.resume().then(() => {
      const now = ctx.currentTime;
      for (let i = 0; i < pulses; i++) {
        const offset = i * 0.22;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(950, now + offset);
        osc.frequency.linearRampToValueAtTime(1200, now + offset + 0.12);
        gain.gain.setValueAtTime(0.001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.45, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.20);
      }
    });
  } catch (err) {
    console.warn('Audio error:', err);
  }
}

// Export alias for backward compatibility
export const playAlarmSound = playCriticalAlarmSound;
