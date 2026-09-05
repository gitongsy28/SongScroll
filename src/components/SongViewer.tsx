import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  RotateCcw, 
  ChevronUp, 
  ChevronDown, 
  Plus, 
  Minus, 
  Maximize, 
  Minimize, 
  Sun, 
  Moon, 
  Download, 
  Columns, 
  Type, 
  Music, 
  Hash, 
  Check, 
  Sliders, 
  Info,
  Guitar,
  FileText,
  Trash2,
  Edit
} from 'lucide-react';
import { ChordProLine, ChordSegment, ParsedChordPro, Song, ViewerSettings, VisualTheme } from '../types';
import { generateSummaryLines, serializeChordPro, transposeChord, transposeNote } from '../utils/chordpro';
import { downloadSongFile } from '../utils/storage';
import { Metronome } from './Metronome';
import { ChordDiagram } from './ChordDiagram';

interface SongViewerProps {
  song: Song;
  onBack: () => void;
  settings: ViewerSettings;
  onUpdateSettings: (newSettings: Partial<ViewerSettings>) => void;
  onEditSong: (song: Song) => void;
  onDeleteSong?: (songId: string) => void;
  initialSummaryMode?: boolean;
}

export const SongViewer: React.FC<SongViewerProps> = ({
  song,
  onBack,
  settings,
  onUpdateSettings,
  onEditSong,
  onDeleteSong,
  initialSummaryMode = false,
}) => {
  // Transpose state: semitone half-step offset (-11 to +11)
  const [transposeOffset, setTransposeOffset] = useState<number>(0);
  const [preferSharps, setPreferSharps] = useState<boolean>(settings.preferSharps ?? true);
  
  // Summary Mode state: quick practice reference and memorization
  const [isSummaryMode, setIsSummaryMode] = useState<boolean>(initialSummaryMode);

  // Auto-scroll state
  const [isScrolling, setIsScrolling] = useState<boolean>(false);
  const [scrollSpeed, setScrollSpeed] = useState<number>(settings.scrollSpeed || 30); // px / sec
  const [scrollProgress, setScrollProgress] = useState<number>(0);

  // Appearance & Stage settings
  const [fontSize, setFontSize] = useState<number>(settings.fontSize || 18);
  const [columnCount, setColumnCount] = useState<1 | 2>(settings.columnCount || 1);
  const [theme, setTheme] = useState<VisualTheme>(settings.theme || 'stage-dark');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState<boolean>(false);
  const [activeChordDiagram, setActiveChordDiagram] = useState<string | null>(null);

  // Metronome tempo state (defaults to song tempo or 100)
  const [currentTempo, setCurrentTempo] = useState<number>(song.tempo || 100);

  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const exactScrollTopRef = useRef<number>(0);
  const isScrollingRef = useRef<boolean>(isScrolling);
  isScrollingRef.current = isScrolling;

  const scrollSpeedRef = useRef<number>(scrollSpeed);
  scrollSpeedRef.current = scrollSpeed;

  const parsed: ParsedChordPro = song.parsed || {
    title: song.title,
    artist: song.artist,
    key: song.key,
    tempo: song.tempo,
    timeSignature: song.timeSignature || '4/4',
    lines: [],
    metadata: {},
    raw: song.rawChordPro,
  };

  // Compute displayed lines based on Summary Mode toggle
  const displayLines = useMemo(() => {
    if (!isSummaryMode) {
      return parsed.lines;
    }
    return generateSummaryLines(parsed.lines);
  }, [parsed.lines, isSummaryMode]);

  // Screen Wake Lock API to prevent screen from dimming/sleeping on music stand
  useEffect(() => {
    let wakeLock: any = null;
    if ('wakeLock' in navigator) {
      (navigator as any).wakeLock.request('screen').then((lock: any) => {
        wakeLock = lock;
      }).catch(() => {});
    }
    return () => {
      if (wakeLock) wakeLock.release();
    };
  }, []);

  // Update scroll progress on manual scroll & sync exact scroll position
  const handleScrollUpdate = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    if (!isScrollingRef.current) {
      exactScrollTopRef.current = scrollTop;
    }
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll > 0) {
      setScrollProgress(Math.min(100, Math.max(0, (scrollTop / maxScroll) * 100)));
    }
  }, []);

  // Auto-scroll loop using high-precision requestAnimationFrame with sub-pixel accumulator
  useEffect(() => {
    if (!isScrolling) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastTimestampRef.current = null;
      return;
    }

    // Initialize exact scroll top reference when starting scroll
    if (containerRef.current) {
      exactScrollTopRef.current = containerRef.current.scrollTop;
    }

    const scrollStep = (timestamp: number) => {
      if (!lastTimestampRef.current) {
        lastTimestampRef.current = timestamp;
      }
      // Cap deltaSeconds to 0.1s to avoid huge jumps on tab switch
      const deltaSeconds = Math.min((timestamp - lastTimestampRef.current) / 1000, 0.1);
      lastTimestampRef.current = timestamp;

      if (containerRef.current && isScrollingRef.current) {
        const scrollAmount = scrollSpeedRef.current * deltaSeconds;
        exactScrollTopRef.current += scrollAmount;
        containerRef.current.scrollTop = exactScrollTopRef.current;

        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const maxScroll = scrollHeight - clientHeight;
        if (maxScroll > 0) {
          setScrollProgress(Math.min(100, Math.max(0, (scrollTop / maxScroll) * 100)));
        }

        if (scrollTop + clientHeight >= scrollHeight - 2) {
          // Reached bottom of song
          setIsScrolling(false);
          return;
        }
      }

      if (isScrollingRef.current) {
        animationFrameRef.current = requestAnimationFrame(scrollStep);
      }
    };

    animationFrameRef.current = requestAnimationFrame(scrollStep);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isScrolling]);

  // Keyboard Shortcuts: Spacebar to toggle scroll, PgUp/PgDn to reposition
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsScrolling((prev) => !prev);
      } else if (e.code === 'PageUp' || e.code === 'ArrowUp') {
        if (e.altKey || e.code === 'PageUp') {
          e.preventDefault();
          handlePageUp();
        }
      } else if (e.code === 'PageDown' || e.code === 'ArrowDown') {
        if (e.altKey || e.code === 'PageDown') {
          e.preventDefault();
          handlePageDown();
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        handleRestart();
      } else if (e.key === 's' || e.key === 'S') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setIsSummaryMode((prev) => !prev);
        }
      } else if (e.key === '+' || e.key === '=') {
        setTransposeOffset((prev) => (prev + 1) % 12);
      } else if (e.key === '-' || e.key === '_') {
        setTransposeOffset((prev) => (prev - 1) % 12);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Controls Actions
  const handleRestart = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      exactScrollTopRef.current = 0;
    }
    setScrollProgress(0);
  };

  const handlePageUp = () => {
    if (containerRef.current) {
      const pageDistance = containerRef.current.clientHeight * 0.7;
      const target = Math.max(0, containerRef.current.scrollTop - pageDistance);
      containerRef.current.scrollTo({ top: target, behavior: 'smooth' });
      exactScrollTopRef.current = target;
    }
  };

  const handlePageDown = () => {
    if (containerRef.current) {
      const pageDistance = containerRef.current.clientHeight * 0.7;
      const target = containerRef.current.scrollTop + pageDistance;
      containerRef.current.scrollTo({ top: target, behavior: 'smooth' });
      exactScrollTopRef.current = target;
    }
  };

  const handleSpeedChange = (newSpeed: number) => {
    const clamped = Math.max(1, Math.min(150, newSpeed));
    setScrollSpeed(clamped);
    onUpdateSettings({ scrollSpeed: clamped });
  };

  const handleTransposeStep = (direction: 1 | -1) => {
    setTransposeOffset((prev) => {
      const next = prev + direction;
      // Keep within -11 to +11
      if (next > 11) return -11;
      if (next < -11) return 11;
      return next;
    });
  };

  const handleResetTranspose = () => {
    setTransposeOffset(0);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Export transposed song download
  const handleExportTransposed = () => {
    const serialized = serializeChordPro(parsed, transposeOffset, preferSharps);
    downloadSongFile(
      {
        ...song,
        fileName: `${song.artist} - ${song.title} (${transposeOffset >= 0 ? '+' : ''}${transposeOffset}st).cho`,
      },
      serialized
    );
  };

  // Calculate current transposed key name
  const originalKey = parsed.key || song.key || '';
  const currentKey = originalKey ? transposeChord(originalKey, transposeOffset, preferSharps) : '';

  // Theme styling definitions
  const themeStyles = {
    'stage-dark': {
      bg: 'bg-slate-950',
      text: 'text-slate-100',
      chord: 'text-amber-400 font-bold',
      comment: 'text-amber-300/80 bg-amber-950/40 border-amber-800/40',
      chorus: 'border-l-4 border-amber-500 pl-3 bg-slate-900/40',
      bridge: 'border-l-4 border-purple-500 pl-3 bg-purple-950/20',
      tab: 'bg-slate-900 text-emerald-300',
      headerBg: 'bg-slate-900/90 border-slate-800',
      barBg: 'bg-slate-900/95 border-slate-800 text-slate-200',
    },
    'paper-light': {
      bg: 'bg-stone-50',
      text: 'text-stone-900',
      chord: 'text-blue-700 font-bold',
      comment: 'text-amber-800 bg-amber-100/70 border-amber-300',
      chorus: 'border-l-4 border-blue-600 pl-3 bg-stone-100/80',
      bridge: 'border-l-4 border-purple-600 pl-3 bg-purple-50',
      tab: 'bg-stone-200 text-emerald-900',
      headerBg: 'bg-stone-100/90 border-stone-300',
      barBg: 'bg-stone-100/95 border-stone-300 text-stone-800',
    },
    'amoled-black': {
      bg: 'bg-black',
      text: 'text-zinc-100',
      chord: 'text-emerald-400 font-bold',
      comment: 'text-emerald-300 bg-zinc-900 border-zinc-800',
      chorus: 'border-l-4 border-emerald-500 pl-3 bg-zinc-950',
      bridge: 'border-l-4 border-cyan-500 pl-3 bg-zinc-950',
      tab: 'bg-zinc-900 text-emerald-300',
      headerBg: 'bg-black/90 border-zinc-800',
      barBg: 'bg-black/95 border-zinc-800 text-zinc-200',
    },
    'vintage-sepia': {
      bg: 'bg-[#f4ecd8]',
      text: 'text-[#433422]',
      chord: 'text-[#9c4114] font-bold',
      comment: 'text-[#6d4c2b] bg-[#e7d8bd] border-[#cbb390]',
      chorus: 'border-l-4 border-[#9c4114] pl-3 bg-[#ebe0c8]',
      bridge: 'border-l-4 border-[#6d4c2b] pl-3 bg-[#ebe0c8]',
      tab: 'bg-[#e2d5bd] text-[#2c4c38]',
      headerBg: 'bg-[#e9ddc5]/90 border-[#d4c3a7]',
      barBg: 'bg-[#e9ddc5]/95 border-[#d4c3a7] text-[#433422]',
    },
  }[theme];

  return (
    <div
      id="song-viewer-container"
      className={`relative w-full h-screen overflow-hidden flex flex-col ${themeStyles.bg} ${themeStyles.text} transition-colors duration-200`}
    >
      {/* Top Header Bar */}
      <header
        id="viewer-top-bar"
        className={`sticky top-0 z-40 px-2.5 sm:px-6 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-2 border-b backdrop-blur-md ${themeStyles.headerBg} shadow-sm`}
      >
        {/* Left: Back & Song Info */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button
            id="viewer-back-btn"
            type="button"
            onClick={onBack}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-1 transition-all border border-slate-700 shrink-0"
            title="Return to Songbook (Esc)"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Songbook</span>
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold truncate leading-tight">
                {parsed.title}
              </h1>
              {parsed.era && (
                <span className="px-1.5 py-0.2 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded text-[10px] font-mono font-bold shrink-0">
                  {parsed.era}
                </span>
              )}
            </div>
            <p className="text-[11px] opacity-70 truncate">
              {parsed.artist}
            </p>
          </div>
        </div>

        {/* Center/Right: Summary Button, Transpose Badges & Metronome */}
        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2.5 shrink-0">
          {/* Summary Mode Toggle Button */}
          <button
            id="toggle-summary-mode-btn"
            type="button"
            onClick={() => setIsSummaryMode(!isSummaryMode)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-md border ${
              isSummaryMode
                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-300 font-extrabold ring-2 ring-amber-400/40 shadow-amber-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-600 hover:border-amber-400/60 hover:text-amber-300'
            }`}
            title={
              isSummaryMode
                ? 'Exit Summary Mode (View Full Song - shortcut: S)'
                : 'Toggle Summary Mode (Section headers + first 3 words & reminder chords - shortcut: S)'
            }
          >
            <FileText className={`w-4 h-4 ${isSummaryMode ? 'text-slate-950 fill-slate-950/20' : 'text-amber-400'}`} />
            <span className="tracking-wide">
              {isSummaryMode ? 'Summary: ON' : 'Summary'}
            </span>
            {isSummaryMode ? (
              <span className="w-2 h-2 rounded-full bg-slate-950 animate-pulse" />
            ) : (
              <span className="text-[10px] px-1 py-0.2 rounded bg-slate-950/60 text-slate-400 border border-slate-700 font-mono hidden md:inline">
                S
              </span>
            )}
          </button>

          {/* Transpose Controls in Header */}
          <div
            id="viewer-transpose-controls"
            className="flex items-center bg-slate-900/80 border border-slate-700/80 rounded-xl p-1 shadow-sm text-xs"
          >
            <button
              id="transpose-down-btn"
              type="button"
              onClick={() => handleTransposeStep(-1)}
              className="p-1 sm:px-2 py-1 rounded-lg hover:bg-slate-800 active:bg-slate-700 text-amber-400 font-bold transition-colors"
              title="Transpose down 1 half-step (semitone)"
            >
              ♭ -1
            </button>

            <div 
              className="px-2 py-0.5 text-center cursor-pointer select-none"
              onClick={handleResetTranspose}
              title="Click to reset transposition"
            >
              <div className="font-mono font-bold text-xs text-amber-300">
                {currentKey || originalKey || 'Key'}
              </div>
              <div className="text-[9px] text-slate-400">
                {transposeOffset !== 0
                  ? `${transposeOffset > 0 ? '+' : ''}${transposeOffset}st`
                  : 'Orig'}
              </div>
            </div>

            <button
              id="transpose-up-btn"
              type="button"
              onClick={() => handleTransposeStep(1)}
              className="p-1 sm:px-2 py-1 rounded-lg hover:bg-slate-800 active:bg-slate-700 text-amber-400 font-bold transition-colors"
              title="Transpose up 1 half-step (semitone)"
            >
              +1 ♯
            </button>
          </div>

          {/* Feature 6: Top-Right Corner Metronome */}
          <Metronome
            tempo={currentTempo}
            timeSignature={parsed.timeSignature || '4/4'}
            onTempoChange={(newBpm) => setCurrentTempo(newBpm)}
          />

          {/* Quick Settings Drawer Toggle */}
          <button
            id="toggle-settings-drawer-btn"
            type="button"
            onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
            className={`p-2 rounded-xl border transition-colors flex items-center gap-1 text-xs font-semibold ${
              showSettingsDrawer
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-amber-400 border-slate-700'
            }`}
            title="Display, Stage & Summary Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Scroll Progress Bar */}
      <div className="w-full h-1 bg-slate-800/50 relative overflow-hidden shrink-0">
        <div
          id="scroll-progress-indicator"
          className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-75"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* Main Lyrics & Chords Scrolling Stage */}
      <main
        ref={containerRef}
        onScroll={handleScrollUpdate}
        id="lyrics-scroll-container"
        className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 focus:outline-none select-text"
      >
        <div className="max-w-4xl mx-auto space-y-6 pb-40">
          {/* Song Header Info Card */}
          <div className="border-b border-slate-800/50 pb-4 flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {parsed.title}
                </h2>
                {parsed.era && (
                  <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-md text-xs sm:text-sm font-mono font-bold">
                    {parsed.era}
                  </span>
                )}
              </div>
              <p className="text-base sm:text-lg opacity-80 mt-0.5">
                {parsed.artist}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              {originalKey && (
                <button
                  type="button"
                  onClick={() => setActiveChordDiagram(currentKey || originalKey)}
                  className="px-2.5 py-1 bg-sky-950/70 hover:bg-sky-900/80 border border-sky-800/60 text-sky-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                  title={`View guitar chord diagram for ${currentKey || originalKey}`}
                >
                  <span>Key: {originalKey}</span>
                  {transposeOffset !== 0 && (
                    <span className="text-amber-400 font-bold ml-1">
                      ➔ {currentKey} ({transposeOffset > 0 ? `+${transposeOffset}` : transposeOffset})
                    </span>
                  )}
                </button>
              )}
              {parsed.capo !== undefined && parsed.capo > 0 && (
                <span className="px-2.5 py-1 bg-purple-950/70 border border-purple-800/60 text-purple-300 rounded-lg">
                  Capo: Fret {parsed.capo}
                </span>
              )}
              <span className="px-2.5 py-1 bg-amber-950/70 border border-amber-800/60 text-amber-300 rounded-lg">
                Tempo: {currentTempo} BPM ({parsed.timeSignature || '4/4'})
              </span>
            </div>
          </div>

          {/* Summary Mode Banner */}
          {isSummaryMode && (
            <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 text-xs text-amber-300 animate-in fade-in">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Summary Mode:</strong> Section headers, intro/outro/instrumental chords, and first 3 words reminder.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsSummaryMode(false)}
                className="text-[11px] underline text-amber-400 hover:text-amber-200 shrink-0 font-semibold ml-2"
              >
                Restore Full Song
              </button>
            </div>
          )}

          {/* Render Parsed ChordPro Content */}
          <div
            id="chordpro-content-body"
            className={`font-mono-chord leading-relaxed ${
              columnCount === 2 ? 'sm:columns-2 gap-8' : ''
            }`}
            style={{ fontSize: `${fontSize}px` }}
          >
            {displayLines.map((line, idx) => (
              <RenderLine
                key={idx}
                line={line}
                transposeOffset={transposeOffset}
                preferSharps={preferSharps}
                themeStyles={themeStyles}
                onChordClick={(chord) => setActiveChordDiagram(chord)}
              />
            ))}
          </div>
        </div>
      </main>

      {/* Guitar Chord Fingering Popup Dialog if a chord is clicked */}
      {activeChordDiagram && (
        <ChordDiagramModal
          chord={activeChordDiagram}
          onClose={() => setActiveChordDiagram(null)}
        />
      )}

      {/* Floating Settings Drawer */}
      {showSettingsDrawer && (
        <div className="absolute top-14 right-4 z-50 w-80 max-h-[calc(100vh-5rem)] overflow-y-auto bg-slate-900/98 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl p-4 space-y-4 text-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-slate-100 flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-amber-400" />
              Stage & Display Settings
            </span>
            <button
              onClick={() => setShowSettingsDrawer(false)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs"
            >
              ✕
            </button>
          </div>

          {/* Prominent Summary Mode Toggle Card (Top of Settings) */}
          <div className={`p-3 rounded-xl border transition-all ${
            isSummaryMode 
              ? 'bg-amber-500/15 border-amber-400/50 shadow-sm' 
              : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-slate-100 font-bold flex items-center gap-1.5 text-xs">
                  <FileText className={`w-4 h-4 ${isSummaryMode ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span>Summary Mode</span>
                  {isSummaryMode && (
                    <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 text-[10px] font-extrabold">
                      ACTIVE
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  Retains section headers, intro/outro chords & 3-word lyric reminder
                </div>
              </div>
              <button
                id="drawer-summary-toggle-btn"
                type="button"
                onClick={() => setIsSummaryMode(!isSummaryMode)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 active:scale-95 ${
                  isSummaryMode
                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold shadow-md'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                {isSummaryMode ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* Enharmonic Spelling Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-medium">Chord Accidentals:</span>
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setPreferSharps(true)}
                className={`px-2.5 py-1 rounded font-mono font-bold ${
                  preferSharps ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                }`}
              >
                ♯ Sharps
              </button>
              <button
                type="button"
                onClick={() => setPreferSharps(false)}
                className={`px-2.5 py-1 rounded font-mono font-bold ${
                  !preferSharps ? 'bg-amber-500 text-slate-950' : 'text-slate-400'
                }`}
              >
                ♭ Flats
              </button>
            </div>
          </div>

          {/* Font Size Adjuster */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-slate-300">
              <span>Text & Chord Size:</span>
              <span className="font-mono text-amber-400 font-bold">{fontSize}px</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.max(13, s - 1))}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="range"
                min="13"
                max="32"
                value={fontSize}
                onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                className="flex-1 accent-amber-400"
              />
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.min(32, s + 1))}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Theme Selector */}
          <div className="space-y-1.5">
            <span className="text-slate-300 font-medium">Stage Theme:</span>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'stage-dark', label: 'Stage Dark' },
                { id: 'paper-light', label: 'Paper Light' },
                { id: 'amoled-black', label: 'AMOLED Black' },
                { id: 'vintage-sepia', label: 'Vintage Sepia' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id as any)}
                  className={`py-1.5 px-2 rounded-lg text-center font-medium border transition-colors ${
                    theme === t.id
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Column Mode & Fullscreen */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setColumnCount((c) => (c === 1 ? 2 : 1))}
              className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 flex items-center justify-center gap-1.5"
            >
              <Columns className="w-3.5 h-3.5" />
              {columnCount === 1 ? '2 Columns' : '1 Column'}
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="py-1.5 px-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 flex items-center justify-center gap-1.5"
            >
              {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
              {isFullscreen ? 'Exit Full' : 'Fullscreen'}
            </button>
          </div>

          {/* Actions & Danger Zone */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleExportTransposed}
                className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-[11px] font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                Export Transposed .cho
              </button>
              <button
                type="button"
                onClick={() => onEditSong(song)}
                className="text-sky-400 hover:text-sky-300 flex items-center gap-1 text-[11px] font-medium"
              >
                <Edit className="w-3.5 h-3.5" />
                Edit Song Text
              </button>
            </div>

            {onDeleteSong && (
              <div className="pt-2 border-t border-slate-800/80">
                <button
                  id="settings-delete-song-btn"
                  type="button"
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete "${song.title}" from your SongBook?\n\nThis will remove the song from your active repository.`)) {
                      onDeleteSong(song.id);
                      onBack();
                    }
                  }}
                  className="w-full py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 border border-rose-500/30 text-rose-300 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors text-xs"
                  title="Delete this song from SongBook"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  Delete Song from SongBook
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feature 4: Bottom Floating Auto-Scroll Control Bar */}
      <footer
        id="auto-scroll-control-bar"
        className={`sticky bottom-0 z-40 px-3 sm:px-6 py-2.5 sm:py-3 border-t backdrop-blur-md ${themeStyles.barBg} shadow-2xl`}
      >
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Reposition, Summary & Restart Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Quick Summary Toggle in Bottom Bar */}
            <button
              id="bottom-summary-toggle-btn"
              type="button"
              onClick={() => setIsSummaryMode(!isSummaryMode)}
              className={`px-2.5 sm:px-3 py-2 border rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 ${
                isSummaryMode
                  ? 'bg-amber-400 text-slate-950 border-amber-300 font-extrabold ring-1 ring-amber-400/50'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700 hover:text-amber-300'
              }`}
              title="Toggle Summary Mode (Shortcut: S)"
            >
              <FileText className={`w-3.5 h-3.5 ${isSummaryMode ? 'text-slate-950 fill-slate-950/20' : 'text-amber-400'}`} />
              <span className="hidden xs:inline">{isSummaryMode ? 'Summary: ON' : 'Summary'}</span>
            </button>

            {/* Restart from beginning */}
            <button
              id="scroll-restart-btn"
              type="button"
              onClick={handleRestart}
              className="px-2.5 sm:px-3 py-2 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              title="Restart from beginning (Home)"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Restart</span>
            </button>

            {/* Page Up Reposition */}
            <button
              id="scroll-page-up-btn"
              type="button"
              onClick={handlePageUp}
              className="px-2.5 sm:px-3 py-2 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 shadow-sm transition-all active:scale-95"
              title="Reposition Page Up (PgUp / Alt+Up)"
            >
              <ChevronUp className="w-4 h-4 text-sky-400" />
              <span>Page Up</span>
            </button>

            {/* Page Down Reposition */}
            <button
              id="scroll-page-down-btn"
              type="button"
              onClick={handlePageDown}
              className="px-2.5 sm:px-3 py-2 bg-slate-800/90 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 shadow-sm transition-all active:scale-95"
              title="Reposition Page Down (PgDn / Alt+Down)"
            >
              <ChevronDown className="w-4 h-4 text-sky-400" />
              <span>Page Down</span>
            </button>
          </div>

          {/* Primary Play / Pause Action Button */}
          <div className="flex items-center">
            <button
              id="scroll-play-pause-btn"
              type="button"
              onClick={() => setIsScrolling(!isScrolling)}
              className={`px-5 sm:px-7 py-2 sm:py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 transition-all shadow-lg active:scale-95 ${
                isScrolling
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/30'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30'
              }`}
              title="Play / Pause Auto-Scroll (Spacebar)"
            >
              {isScrolling ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>PAUSE</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>AUTO SCROLL</span>
                </>
              )}
            </button>
          </div>

          {/* Configurable Speed Adjuster */}
          <div className="flex items-center gap-2 bg-slate-950/70 border border-slate-800 px-2.5 py-1.5 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
              Speed:
            </span>

            <button
              id="scroll-speed-minus-btn"
              type="button"
              onClick={() => handleSpeedChange(scrollSpeed <= 10 ? scrollSpeed - 1 : scrollSpeed - 5)}
              className="p-1 text-slate-400 hover:text-slate-200 active:bg-slate-800 rounded"
              title="Decrease scroll speed"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <input
              id="scroll-speed-slider"
              type="range"
              min="1"
              max="120"
              step="1"
              value={scrollSpeed}
              onChange={(e) => handleSpeedChange(parseInt(e.target.value, 10) || 1)}
              className="w-16 sm:w-24 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />

            <button
              id="scroll-speed-plus-btn"
              type="button"
              onClick={() => handleSpeedChange(scrollSpeed < 10 ? scrollSpeed + 1 : scrollSpeed + 5)}
              className="p-1 text-slate-400 hover:text-slate-200 active:bg-slate-800 rounded"
              title="Increase scroll speed"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            <span className="font-mono text-xs font-bold text-amber-300 min-w-[42px] text-right">
              {scrollSpeed}px/s
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Line Renderer for standard lyrics, comments, choruses, bridges, and tabs
interface RenderLineProps {
  line: ChordProLine;
  transposeOffset: number;
  preferSharps: boolean;
  themeStyles: any;
  onChordClick: (chord: string) => void;
}

const RenderLine: React.FC<RenderLineProps> = ({
  line,
  transposeOffset,
  preferSharps,
  themeStyles,
  onChordClick,
}) => {
  if (line.type === 'empty') {
    return <div className="h-4" />;
  }

  if (line.type === 'comment') {
    return (
      <div
        className={`my-3 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider inline-block border ${themeStyles.comment}`}
      >
        {line.text}
      </div>
    );
  }

  if (line.type === 'chorus_start') {
    return (
      <div className={`mt-4 mb-2 ${themeStyles.chorus}`}>
        <span className="text-xs font-extrabold uppercase tracking-wider opacity-70 block mb-1">
          {line.text || 'Chorus'}
        </span>
      </div>
    );
  }

  if (line.type === 'chorus_end' || line.type === 'bridge_end' || line.type === 'tab_end') {
    return <div className="mb-3" />;
  }

  if (line.type === 'bridge_start') {
    return (
      <div className={`mt-4 mb-2 ${themeStyles.bridge}`}>
        <span className="text-xs font-extrabold uppercase tracking-wider opacity-70 block mb-1">
          {line.text || 'Bridge'}
        </span>
      </div>
    );
  }

  if (line.type === 'tab' || line.type === 'tab_start') {
    return (
      <pre className={`p-2.5 rounded-lg text-xs font-mono overflow-x-auto my-1 ${themeStyles.tab}`}>
        {line.text || ''}
      </pre>
    );
  }

  if (line.type === 'lyrics' && line.segments) {
    return (
      <div className="flex flex-wrap items-end my-1.5 leading-snug">
        {line.segments.map((seg, segIdx) => {
          const transposedChord = seg.chord
            ? transposeChord(seg.chord, transposeOffset, preferSharps)
            : '';

          return (
            <div
              key={segIdx}
              className="inline-flex flex-col mr-1 group/seg align-bottom"
            >
              {/* Chord Row */}
              <span
                onClick={() => transposedChord && onChordClick(transposedChord)}
                className={`min-h-[1.3em] font-mono select-none cursor-pointer transition-all hover:underline ${
                  transposedChord ? themeStyles.chord : 'opacity-0'
                }`}
                title={transposedChord ? `Click for guitar chord diagram: ${transposedChord}` : undefined}
              >
                {transposedChord || '\u00A0'}
              </span>

              {/* Lyrics Row */}
              <span className="select-text whitespace-pre">
                {seg.lyrics || '\u00A0'}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="my-1 opacity-80">
      {line.raw || ''}
    </div>
  );
};

// Guitar Chord Diagram popup
const ChordDiagramModal: React.FC<{ chord: string; onClose: () => void }> = ({ chord, onClose }) => {
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm">
        <ChordDiagram chordName={chord} onClose={onClose} />
      </div>
    </div>
  );
};
