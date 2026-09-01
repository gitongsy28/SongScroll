// Web Audio API metronome synthesizer
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Play a short metronome click
 * isAccent = true for beat 1 (higher pitch)
 */
export function playMetronomeTick(isAccent: boolean = false, volume: number = 0.5): void {
  try {
    if (volume <= 0) return;
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    // Beat 1 gets high pitch (1600 Hz), other beats get 1000 Hz
    osc.frequency.setValueAtTime(isAccent ? 1600 : 1000, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.04);

    const masterVol = Math.max(0.01, Math.min(1, volume)) * 0.4;
    gain.gain.setValueAtTime(masterVol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  } catch (err) {
    // AudioContext might need user gesture
  }
}
