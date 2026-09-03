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
 * Play a high-pitch, high-clarity audible metronome click
 * @param isAccent true for beat 1 (higher pitch and punchier)
 * @param volume 0.0 to 1.0 master volume multiplier
 */
export function playMetronomeTick(isAccent: boolean = false, volume: number = 0.9): void {
  try {
    if (volume <= 0) return;
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Primary high-pitch tone oscillator
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // High attack transient for clear piercing attack
    const attackOsc = ctx.createOscillator();
    const attackGain = ctx.createGain();

    // Accent beat (Beat 1): 2500Hz -> 1900Hz; Regular beats: 1800Hz -> 1350Hz
    const startFreq = isAccent ? 2500 : 1800;
    const endFreq = isAccent ? 1900 : 1350;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.045);

    attackOsc.type = 'triangle';
    attackOsc.frequency.setValueAtTime(isAccent ? 3800 : 3000, now);
    attackOsc.frequency.exponentialRampToValueAtTime(800, now + 0.015);

    const effectiveVol = Math.max(0.01, Math.min(1, volume));
    const accentMultiplier = isAccent ? 1.0 : 0.85;

    // High gain output for strong audibility
    gain.gain.setValueAtTime(effectiveVol * accentMultiplier * 0.95, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    attackGain.gain.setValueAtTime(effectiveVol * 0.65, now);
    attackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);

    osc.connect(gain);
    gain.connect(ctx.destination);

    attackOsc.connect(attackGain);
    attackGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.055);

    attackOsc.start(now);
    attackOsc.stop(now + 0.02);
  } catch (err) {
    // AudioContext might need user interaction first
  }
}

