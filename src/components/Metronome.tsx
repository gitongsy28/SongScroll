import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Volume2, Volume1, VolumeX, Plus, Minus, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { playMetronomeTick } from '../utils/metronomeAudio';

interface MetronomeProps {
  tempo: number; // BPM
  timeSignature?: string; // e.g. "4/4", "3/4", "6/8"
  onTempoChange?: (newTempo: number) => void;
  compact?: boolean;
}

export const Metronome: React.FC<MetronomeProps> = ({
  tempo = 100,
  timeSignature = '4/4',
  onTempoChange,
  compact = false,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentBeat, setCurrentBeat] = useState<number>(0);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem('songscroll_metronome_vol');
    return saved ? parseFloat(saved) : 0.9;
  });
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [tapTimes, setTapTimes] = useState<number[]>([]);

  // Parse time signature beats per bar
  const beatsPerMeasure = parseInt(timeSignature.split('/')[0], 10) || 4;

  const currentBeatRef = useRef(0);
  currentBeatRef.current = currentBeat;

  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const beatsRef = useRef(beatsPerMeasure);
  beatsRef.current = beatsPerMeasure;

  // Animation pendulum tick state
  const [pendulumSide, setPendulumSide] = useState<'left' | 'right'>('left');

  const handleVolumeChange = (newVol: number) => {
    const clamped = Math.max(0.05, Math.min(1.0, newVol));
    setVolume(clamped);
    localStorage.setItem('songscroll_metronome_vol', clamped.toString());
  };

  useEffect(() => {
    if (!isPlaying || tempo <= 0) return;

    const intervalMs = (60 / tempo) * 1000;

    const interval = setInterval(() => {
      const nextBeat = (currentBeatRef.current + 1) % beatsRef.current;
      setCurrentBeat(nextBeat);
      setPendulumSide((prev) => (prev === 'left' ? 'right' : 'left'));

      if (soundEnabledRef.current) {
        const isAccent = nextBeat === 0;
        playMetronomeTick(isAccent, volumeRef.current);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isPlaying, tempo]);

  // Tap tempo handler
  const handleTap = useCallback(() => {
    const now = Date.now();
    const newTaps = [...tapTimes.filter((t) => now - t < 3000), now];
    setTapTimes(newTaps);

    if (newTaps.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < newTaps.length; i++) {
        intervals.push(newTaps[i] - newTaps[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgInterval);
      if (calculatedBpm >= 30 && calculatedBpm <= 280 && onTempoChange) {
        onTempoChange(calculatedBpm);
      }
    }
  }, [tapTimes, onTempoChange]);

  const tickDurationSec = 60 / tempo;

  return (
    <div
      id="metronome-widget"
      className="relative z-30 flex flex-col items-end"
    >
      {/* Main Top-Right Pill Display */}
      <div
        className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-lg px-3 py-1.5 transition-all select-none hover:border-amber-500/50"
      >
        {/* Animated Pendulum Icon */}
        <div className="relative w-5 h-7 flex items-end justify-center overflow-hidden">
          <div
            className="w-1.5 h-6 bg-gradient-to-t from-amber-400 to-amber-200 rounded-full origin-bottom transition-transform"
            style={{
              transform: isPlaying
                ? pendulumSide === 'left'
                  ? 'rotate(-26deg)'
                  : 'rotate(26deg)'
                : 'rotate(0deg)',
              transitionDuration: `${tickDurationSec * 0.9}s`,
              transitionTimingFunction: 'ease-in-out',
            }}
          />
          {/* Pendulum Weight Bob */}
          <div
            className="absolute top-1 w-2.5 h-2.5 rounded-full bg-amber-400 border border-slate-950 transition-transform shadow-sm"
            style={{
              transform: isPlaying
                ? pendulumSide === 'left'
                  ? 'translate(-4px, 0)'
                  : 'translate(4px, 0)'
                : 'none',
              transitionDuration: `${tickDurationSec * 0.9}s`,
              transitionTimingFunction: 'ease-in-out',
            }}
          />
        </div>

        {/* BPM and Beat Indicator */}
        <div className="flex flex-col items-start leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-sm font-bold text-amber-300 tracking-tight">
              {tempo}
            </span>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              BPM
            </span>
            <span className="text-[10px] font-medium text-slate-500 bg-slate-800 px-1 py-0.5 rounded">
              {timeSignature}
            </span>
          </div>

          {/* Beat visual dots */}
          <div className="flex items-center gap-1 mt-0.5">
            {Array.from({ length: beatsPerMeasure }).map((_, index) => {
              const isCurrent = isPlaying && currentBeat === index;
              const isAccent = index === 0;
              return (
                <span
                  key={index}
                  className={`inline-block rounded-full transition-all duration-100 ${
                    isCurrent
                      ? isAccent
                        ? 'w-2 h-2 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)] scale-125'
                        : 'w-1.5 h-1.5 bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)] scale-110'
                      : isAccent
                      ? 'w-1.5 h-1.5 bg-slate-600'
                      : 'w-1 h-1 bg-slate-700'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Quick Play/Pause Toggle */}
        <button
          id="metronome-play-toggle"
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          title={isPlaying ? 'Pause metronome ticking' : 'Start metronome ticking'}
          className={`p-1 rounded-lg transition-colors ${
            isPlaying
              ? 'text-amber-400 hover:bg-slate-800'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
        </button>

        {/* Sound Click Track Mute/Unmute */}
        <button
          id="metronome-sound-toggle"
          type="button"
          onClick={() => {
            const next = !soundEnabled;
            setSoundEnabled(next);
            if (next) {
              // Play immediate preview tick
              playMetronomeTick(true, volumeRef.current);
            }
          }}
          title={soundEnabled ? 'Mute audible click' : 'Enable audible high-pitch click'}
          className={`p-1 rounded-lg transition-colors ${
            soundEnabled
              ? 'text-sky-400 hover:bg-slate-800'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
          }`}
        >
          {soundEnabled ? (
            volume > 0.5 ? <Volume2 className="w-3.5 h-3.5" /> : <Volume1 className="w-3.5 h-3.5" />
          ) : (
            <VolumeX className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Expand / Controls toggle */}
        <button
          id="metronome-expand-toggle"
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-slate-400 hover:text-slate-200 p-0.5 rounded hover:bg-slate-800"
          title="Metronome settings"
        >
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded Control Popover */}
      {isExpanded && (
        <div
          id="metronome-settings-panel"
          className="mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 w-64 flex flex-col gap-3 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150 text-xs"
        >
          {/* Tempo section */}
          <div className="flex items-center justify-between text-slate-300 font-medium">
            <span>Tempo Adjustment</span>
            <span className="font-mono text-amber-300 font-bold text-sm">{tempo} BPM</span>
          </div>

          {/* Quick BPM Increment / Decrement */}
          <div className="flex items-center gap-1.5">
            <button
              id="bpm-minus-5"
              type="button"
              onClick={() => onTempoChange && onTempoChange(Math.max(30, tempo - 5))}
              className="flex-1 py-1 px-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 rounded font-mono text-[11px] text-center"
            >
              -5
            </button>
            <button
              id="bpm-minus-1"
              type="button"
              onClick={() => onTempoChange && onTempoChange(Math.max(30, tempo - 1))}
              className="py-1 px-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 rounded"
              title="Decrease 1 BPM"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              id="bpm-plus-1"
              type="button"
              onClick={() => onTempoChange && onTempoChange(Math.min(260, tempo + 1))}
              className="py-1 px-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 rounded"
              title="Increase 1 BPM"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              id="bpm-plus-5"
              type="button"
              onClick={() => onTempoChange && onTempoChange(Math.min(260, tempo + 5))}
              className="flex-1 py-1 px-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 rounded font-mono text-[11px] text-center"
            >
              +5
            </button>
          </div>

          {/* Tempo Slider */}
          <input
            id="metronome-slider"
            type="range"
            min="40"
            max="220"
            value={tempo}
            onChange={(e) => onTempoChange && onTempoChange(parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
          />

          {/* Volume Control Section */}
          <div className="pt-2 border-t border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5 font-medium">
                {volume > 0.5 ? (
                  <Volume2 className="w-3.5 h-3.5 text-sky-400" />
                ) : (
                  <Volume1 className="w-3.5 h-3.5 text-sky-400" />
                )}
                Click Volume:
              </span>
              <span className="font-mono text-sky-300 font-bold">
                {Math.round(volume * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="metronome-volume-slider"
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                value={volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  handleVolumeChange(val);
                }}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
              <button
                type="button"
                onClick={() => playMetronomeTick(true, volume)}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-sky-300 text-[10px] font-bold rounded border border-slate-700 shrink-0"
                title="Preview metronome sound click"
              >
                Test
              </button>
            </div>
          </div>

          {/* Tap Tempo Button */}
          <button
            id="tap-tempo-button"
            type="button"
            onClick={handleTap}
            className="w-full py-1.5 bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 active:scale-98 text-amber-300 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all text-xs"
          >
            <Activity className="w-3.5 h-3.5" />
            Tap Tempo (Click beat)
          </button>
        </div>
      )}
    </div>
  );
};

