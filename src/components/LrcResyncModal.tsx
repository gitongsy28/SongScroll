import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Sliders, 
  Clock, 
  Check, 
  RotateCcw, 
  Save, 
  Music, 
  Video, 
  HardDrive,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { BackTrackItem, Song } from '../types';
import { calibrateLrcFromLine, parseChordPro, shiftLrcTimestamps } from '../utils/chordpro';

interface LrcResyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song;
  rawChordPro: string;
  activeTrack: BackTrackItem | null;
  getCurrentAudioTime: () => number; // live getter for audio playback time in seconds
  onApplyOffset: (newRawChordPro: string, totalDeltaSec: number) => void;
  onSavePermanent: (newRawChordPro: string) => Promise<string | void> | void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.00';
  const mins = Math.floor(seconds / 60);
  const remSecs = seconds % 60;
  const secs = Math.floor(remSecs);
  const centi = Math.floor((remSecs - secs) * 100);
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}.${centi < 10 ? '0' : ''}${centi}`;
}

export const LrcResyncModal: React.FC<LrcResyncModalProps> = ({
  isOpen,
  onClose,
  song,
  rawChordPro,
  activeTrack,
  getCurrentAudioTime,
  onApplyOffset,
  onSavePermanent,
}) => {
  const [initialRawSnapshot] = useState<string>(rawChordPro);
  const [liveAudioTime, setLiveAudioTime] = useState<number>(() => getCurrentAudioTime());
  const [totalOffset, setTotalOffset] = useState<number>(0);
  const [selectedLineIdx, setSelectedLineIdx] = useState<number | null>(null);
  const [calibrateFollowing, setCalibrateFollowing] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Poll live playback counter while modal is open so the timer stays accurate without lagging playback
  useEffect(() => {
    if (!isOpen) return;
    setLiveAudioTime(getCurrentAudioTime());
    const interval = setInterval(() => {
      setLiveAudioTime(getCurrentAudioTime());
    }, 150);
    return () => clearInterval(interval);
  }, [isOpen, getCurrentAudioTime]);

  // Extract ALL lyric lines (both timestamped AND un-timestamped)
  const parsed = useMemo(() => parseChordPro(rawChordPro), [rawChordPro]);
  const lyricLines = useMemo(() => {
    return parsed.lines
      .map((l, idx) => ({ ...l, originalLineIndex: idx }))
      .filter((l) => {
        if (l.type !== 'lyrics') return false;
        const text = l.segments?.map((s) => (s.chord ? `[${s.chord}]` : '') + (s.lyrics || '')).join('').trim() || '';
        return text.length > 0;
      });
  }, [parsed.lines]);

  // Active selected line (or closest timestamped line to current audio time by default)
  const activeLine = useMemo(() => {
    if (selectedLineIdx !== null) {
      return lyricLines.find((l) => l.originalLineIndex === selectedLineIdx) || lyricLines[0] || null;
    }
    if (lyricLines.length === 0) return null;
    const withTs = lyricLines.filter((l) => l.timeSeconds !== undefined && l.timeSeconds >= 0);
    if (withTs.length === 0) return lyricLines[0];

    let closest = withTs[0];
    let minDiff = Math.abs(liveAudioTime - (closest.timeSeconds || 0));
    for (let i = 1; i < withTs.length; i++) {
      const diff = Math.abs(liveAudioTime - (withTs[i].timeSeconds || 0));
      if (diff < minDiff) {
        minDiff = diff;
        closest = withTs[i];
      }
    }
    return closest;
  }, [selectedLineIdx, lyricLines, liveAudioTime]);

  if (!isOpen) return null;

  const handleNudge = (delta: number) => {
    const nextOffset = Math.round((totalOffset + delta) * 100) / 100;
    setTotalOffset(nextOffset);
    const shiftedRaw = shiftLrcTimestamps(rawChordPro, delta);
    onApplyOffset(shiftedRaw, nextOffset);
    setSaveSuccess(false);
    setSaveMessage(null);
  };

  const handleSyncToAudio = () => {
    if (!activeLine) return;
    const exactNow = getCurrentAudioTime();
    const sourceIdx = activeLine.sourceLineIndex;
    if (sourceIdx === undefined || sourceIdx < 0) return;

    const updatedRaw = calibrateLrcFromLine(
      rawChordPro,
      sourceIdx,
      exactNow,
      calibrateFollowing
    );

    if (activeLine.timeSeconds !== undefined) {
      const diff = Math.round((exactNow - activeLine.timeSeconds) * 100) / 100;
      setTotalOffset(Math.round((totalOffset + diff) * 100) / 100);
    }

    onApplyOffset(updatedRaw, totalOffset);
    setSaveSuccess(false);
    setSaveMessage(null);
  };

  const handleSelectNextLine = () => {
    if (!activeLine || lyricLines.length === 0) return;
    const pos = lyricLines.findIndex((l) => l.originalLineIndex === activeLine.originalLineIndex);
    if (pos >= 0 && pos + 1 < lyricLines.length) {
      setSelectedLineIdx(lyricLines[pos + 1].originalLineIndex);
    }
  };

  const handleSaveToSongFile = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      // Save rawChordPro directly (already reflects all live calibrations/nudges — never double-shift!)
      const feedback = await onSavePermanent(rawChordPro);
      setSaveSuccess(true);
      if (typeof feedback === 'string' && feedback) {
        setSaveMessage(feedback);
      }
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1400);
    } catch (err: any) {
      console.error('Failed to save LRC timestamps:', err);
      setSaveMessage(err?.message || 'Failed to save timestamps');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    onApplyOffset(initialRawSnapshot, 0);
    setTotalOffset(0);
    setSaveSuccess(false);
    setSaveMessage(null);
  };

  const getCleanPreviewText = (line: typeof lyricLines[number]) => {
    const raw = line.raw || line.segments?.map((s) => (s.chord ? `[${s.chord}]` : '') + (s.lyrics || '')).join('') || '';
    return raw.replace(/^\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]/, '').trim();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100 max-h-[90vh]">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                Resync LRC Timestamps
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {song.title}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Calibrate timestamps or stamp missing lines to match your selected audio/video
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          
          {/* Active Audio Playback Reference */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {activeTrack?.type === 'youtube' ? (
                <Video className="w-5 h-5 text-red-400 shrink-0" />
              ) : activeTrack?.type === 'github' || activeTrack?.type === 'audio-url' ? (
                <Music className="w-5 h-5 text-purple-400 shrink-0" />
              ) : (
                <HardDrive className="w-5 h-5 text-amber-400 shrink-0" />
              )}
              <div>
                <div className="font-bold text-slate-200">
                  {activeTrack?.description || 'Active Playback Timer Reference'}
                </div>
                <div className="text-[10px] text-slate-400">
                  Live Playhead Time
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 px-3 py-1.5 rounded-xl">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span className="font-mono text-sm font-black text-emerald-300">
                {formatTime(liveAudioTime)}
              </span>
            </div>
          </div>

          {/* Target Line Comparison & Alignment */}
          {activeLine ? (
            <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">
                  Target Lyric Line to Synchronize
                </span>
                <span className={`font-mono text-[11px] font-bold ${
                  activeLine.timeSeconds !== undefined ? 'text-purple-400' : 'text-rose-400'
                }`}>
                  {activeLine.timeSeconds !== undefined
                    ? `Current: ${formatTime(activeLine.timeSeconds)}`
                    : 'No Timestamp (--:--.--)'}
                </span>
              </div>

              <div className="bg-slate-900/90 border border-purple-500/20 rounded-lg p-2.5 font-mono text-xs text-slate-200">
                {getCleanPreviewText(activeLine)}
              </div>

              {/* Calibrate following lines toggle */}
              <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={calibrateFollowing}
                  onChange={(e) => setCalibrateFollowing(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-800 accent-purple-500"
                />
                <span>
                  Also adjust following timestamped lines (keep earlier lines untouched &amp; preserve gaps)
                </span>
              </label>

              {/* Alignment + Next line buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSyncToAudio}
                  className="flex-1 py-2.5 px-3 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
                >
                  <Sliders className="w-4 h-4" />
                  <span>
                    Align This Line to Audio Time ({formatTime(liveAudioTime)})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={handleSelectNextLine}
                  className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-xl font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Move selection to next lyric line"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>No lyric lines found in this song.</span>
            </div>
          )}

          {/* Fine Tuning Nudge Controls (shifts whole song) */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300">Global Offset Nudge (All Timestamped Lines)</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-[11px]">Shift:</span>
                <span className={`font-mono font-bold text-xs ${
                  totalOffset > 0 ? 'text-emerald-400' : totalOffset < 0 ? 'text-amber-400' : 'text-slate-400'
                }`}>
                  {totalOffset > 0 ? `+${totalOffset.toFixed(2)}s` : `${totalOffset.toFixed(2)}s`}
                </span>
                {rawChordPro !== initialRawSnapshot && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="p-1 text-slate-400 hover:text-slate-200 rounded flex items-center gap-1 text-[10px]"
                    title="Reset all changes made in this session"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 pt-1">
              {[
                { label: '-2.0s', val: -2.0 },
                { label: '-1.0s', val: -1.0 },
                { label: '-0.5s', val: -0.5 },
                { label: '-0.1s', val: -0.1 },
                { label: '+0.1s', val: 0.1 },
                { label: '+0.5s', val: 0.5 },
                { label: '+1.0s', val: 1.0 },
                { label: '+2.0s', val: 2.0 },
              ].map((b) => (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => handleNudge(b.val)}
                  className="py-1.5 px-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 text-slate-200 rounded-lg font-mono font-bold text-[11px] text-center transition-all cursor-pointer active:scale-95"
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lyric Line Selector (includes lines with NO timestamp!) */}
          {lyricLines.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-400 block">
                Select Any Lyric Line to Synchronize or Stamp ({lyricLines.length} lines):
              </span>
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1 border border-slate-800 rounded-xl p-1.5 bg-slate-950/50">
                {lyricLines.map((l) => {
                  const isSelected = activeLine?.originalLineIndex === l.originalLineIndex;
                  const hasTs = l.timeSeconds !== undefined && l.timeSeconds >= 0;
                  return (
                    <button
                      key={l.originalLineIndex}
                      type="button"
                      onClick={() => setSelectedLineIdx(l.originalLineIndex)}
                      className={`w-full text-left p-1.5 rounded-lg font-mono text-[11px] flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected 
                          ? 'bg-purple-500/25 border border-purple-400/50 text-white' 
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <span className="truncate pr-2">
                        {getCleanPreviewText(l)}
                      </span>
                      <span className={`shrink-0 font-bold px-1.5 py-0.5 rounded text-[10px] ${
                        hasTs ? 'text-amber-400' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      }`}>
                        {hasTs ? formatTime(l.timeSeconds!) : 'No Sync'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {saveMessage && (
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px]">
              {saveMessage}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
          >
            Keep for Session Only
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveToSongFile}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving to Song...</span>
              </>
            ) : saveSuccess ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>Saved Permanently!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Permanently to Song (.cho)</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
