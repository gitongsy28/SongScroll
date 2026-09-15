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
  Download, 
  Columns, 
  Sliders, 
  Info,
  Guitar,
  FileText,
  Trash2,
  Edit,
  X,
  Sparkles,
  Timer,
  Check,
  Save,
  MoveHorizontal
} from 'lucide-react';
import { 
  BackTrackItem, 
  ChordProLine, 
  ChordSegment, 
  DisplayMode,
  ParsedChordPro, 
  RepositoryConfig, 
  Song, 
  ViewerSettings, 
  VisualTheme 
} from '../types';
import { 
  adjustCursorToRightOfChord,
  buildHeaderInfoItems,
  generateSummaryLines, 
  insertChordIntoLine,
  moveChordInLine,
  isValidBackTrack, 
  parseChordDefineDirective,
  parseChordPro, 
  reformatChordPro,
  serializeChordPro, 
  transposeChord, 
  updateChordProDefineDirective,
  updateChordProScrollSpeed,
  updateChordProBackTracks
} from '../utils/chordpro';
import { ChordVoicing } from '../utils/guitarChords';
import { downloadSongFile } from '../utils/storage';
import { Metronome } from './Metronome';
import { ChordDiagram, MiniChordDiagram } from './ChordDiagram';
import { ChordHint, ChordDiagramCard } from './ChordHint';
import { BackTrackModal } from './BackTrackModal';
import { BackTrackFloatingPlayer } from './BackTrackFloatingPlayer';
import { TabDiagram } from './TabDiagram';

interface SongViewerProps {
  song: Song;
  onBack: () => void;
  settings: ViewerSettings;
  onUpdateSettings: (newSettings: Partial<ViewerSettings>) => void;
  onEditSong: (song: Song) => void;
  onDeleteSong?: (songId: string) => void;
  initialSummaryMode?: boolean;
  repoConfig?: RepositoryConfig;
  onSaveSong?: (song: Song) => Promise<void> | void;
}

export const SongViewer: React.FC<SongViewerProps> = ({
  song,
  onBack,
  settings,
  onUpdateSettings,
  onEditSong,
  onDeleteSong,
  initialSummaryMode = false,
  repoConfig,
  onSaveSong,
}) => {
  // Transpose state: semitone half-step offset (-11 to +11)
  const [transposeOffset, setTransposeOffset] = useState<number>(0);
  const [preferSharps, setPreferSharps] = useState<boolean>(settings.preferSharps ?? true);
  
  // 3 Display Modes: 'summary' | 'normal' | 'detailed' (Default: 'normal')
  const [displayMode, setDisplayMode] = useState<DisplayMode>(
    initialSummaryMode ? 'summary' : 'normal'
  );

  // Custom Chords state & Raw ChordPro state
  const [currentRawChordPro, setCurrentRawChordPro] = useState<string>(song.rawChordPro);
  const [songCustomChords, setSongCustomChords] = useState<Record<string, ChordVoicing>>(
    song.parsed?.customChords || {}
  );
  const [hasCustomChordChanges, setHasCustomChordChanges] = useState<boolean>(false);

  // Sync raw ChordPro when song props update from editor/save/disk
  useEffect(() => {
    setCurrentRawChordPro(song.rawChordPro);
    setSongCustomChords(song.parsed?.customChords || {});
    setHasCustomChordChanges(false);
  }, [song.id, song.rawChordPro, song.updatedAt]);

  // Target context for chord click: which line, chord index, and source line
  const [activeChordTarget, setActiveChordTarget] = useState<{
    chord: string;
    rawChord?: string;
    lineIndex?: number;
    segIdx?: number;
    chordIndexInLine?: number;
    sourceLineIndex?: number;
    rawLine?: string;
  } | null>(null);

  // Add / Move Chord mode & dialog state
  const [isAddChordMode, setIsAddChordMode] = useState<boolean>(false);
  const [insertChordModal, setInsertChordModal] = useState<{
    isOpen: boolean;
    sourceLineIndex: number;
    previewLineText: string;
    mode?: 'add' | 'move';
    targetChordIndexInLine?: number;
    rawChord?: string;
  } | null>(null);
  const [insertChordName, setInsertChordName] = useState<string>('');
  const [insertCursorPos, setInsertCursorPos] = useState<number>(0);
  const lineInputRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-scroll state
  const [isScrolling, setIsScrolling] = useState<boolean>(false);
  const songDefaultSpeed = song.scrollSpeed ?? song.parsed?.scrollSpeed;
  const [scrollSpeed, setScrollSpeed] = useState<number>(songDefaultSpeed || settings.scrollSpeed || 30); // px / sec
  const [scrollProgress, setScrollProgress] = useState<number>(0);

  // Save prompt state on exit
  const [showSaveExitModal, setShowSaveExitModal] = useState<boolean>(false);
  const [isSavingOnExit, setIsSavingOnExit] = useState<boolean>(false);
  const [initialDefaultSpeed, setInitialDefaultSpeed] = useState<number | undefined>(
    song.scrollSpeed ?? song.parsed?.scrollSpeed
  );
  const [hasManuallyChangedSpeed, setHasManuallyChangedSpeed] = useState<boolean>(false);

  // ScrollPause directive countdown state
  const [isScrollPausedByDirective, setIsScrollPausedByDirective] = useState<boolean>(false);
  const [pauseCountdown, setPauseCountdown] = useState<number | null>(null);
  const triggeredPausesRef = useRef<Set<string>>(new Set());
  const pauseIntervalRef = useRef<any>(null);
  const isScrollPausedRef = useRef<boolean>(false);
  isScrollPausedRef.current = isScrollPausedByDirective;

  // Appearance & Stage settings
  const [fontSize, setFontSize] = useState<number>(settings.fontSize || 18);
  const [columnCount, setColumnCount] = useState<1 | 2>(settings.columnCount || 1);
  const [theme, setTheme] = useState<VisualTheme>(settings.theme || 'stage-dark');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState<boolean>(false);
  const [activeChordDiagram, setActiveChordDiagram] = useState<string | null>(null);

  // BackTrack accompaniment modal & floating player state
  const [showBackTrackModal, setShowBackTrackModal] = useState<boolean>(false);
  const [songBackTracks, setSongBackTracks] = useState<BackTrackItem[]>(() => {
    return song.backtracks || song.parsed?.backtracks || parseChordPro(song.rawChordPro).backtracks || [];
  });
  const [activeFloatingTrack, setActiveFloatingTrack] = useState<BackTrackItem | null>(null);

  // Metronome tempo state (defaults to song tempo or 100)
  const [currentTempo, setCurrentTempo] = useState<number>(song.tempo || 100);

  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const exactScrollTopRef = useRef<number>(0);
  const isScrollingRef = useRef<boolean>(isScrolling);
  isScrollingRef.current = isScrolling;

  // Proportional Auto-Adjustment of Scroll Speed in Detailed Mode:
  // In Detailed mode, inline mini chord diagrams expand vertical line height (~1.8x).
  // The effective speed scales automatically to maintain singing/playing sync.
  const effectiveScrollSpeed = useMemo(() => {
    if (displayMode === 'detailed') {
      return Math.round(scrollSpeed * 1.8);
    }
    return scrollSpeed;
  }, [scrollSpeed, displayMode]);

  const effectiveScrollSpeedRef = useRef<number>(effectiveScrollSpeed);
  effectiveScrollSpeedRef.current = effectiveScrollSpeed;

  // Re-parse dynamically if user edits chords or directives
  const parsed: ParsedChordPro = useMemo(() => {
    const p = parseChordPro(currentRawChordPro);
    // Combine custom chords
    p.customChords = { ...p.customChords, ...songCustomChords };
    return p;
  }, [currentRawChordPro, songCustomChords]);

  // Compute displayed lines based on 3 Display Modes
  const displayLines = useMemo(() => {
    if (displayMode === 'summary') {
      return generateSummaryLines(parsed.lines);
    }
    return parsed.lines;
  }, [parsed.lines, displayMode]);

  // Unique chords present in song
  const songChords = useMemo(() => {
    const chordSet = new Set<string>();
    parsed.lines.forEach((l) => {
      l.segments?.forEach((s) => {
        if (s.chord) chordSet.add(s.chord);
      });
    });
    Object.keys(songCustomChords).forEach((c) => chordSet.add(c));
    return Array.from(chordSet);
  }, [parsed.lines, songCustomChords]);

  // Screen Wake Lock API to prevent screen from dimming on stage
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

    // Re-arm any ScrollPause elements that have moved back below the trigger line
    const pauseElements = containerRef.current.querySelectorAll('[data-scroll-pause]');
    const containerRect = containerRef.current.getBoundingClientRect();
    const triggerLine = containerRect.top + containerRect.height * 0.35;
    pauseElements.forEach((el) => {
      const elRect = el.getBoundingClientRect();
      const pauseId = el.getAttribute('data-pause-id') || 'pause-default';
      if (elRect.top > triggerLine) {
        triggeredPausesRef.current.delete(pauseId);
      }
    });
  }, []);

  // Update scroll speed whenever active song changes and has a defined scrollSpeed
  useEffect(() => {
    const speed = song.scrollSpeed ?? song.parsed?.scrollSpeed;
    if (speed && speed > 0) {
      setScrollSpeed(speed);
      onUpdateSettings({ scrollSpeed: speed });
    }
    setHasManuallyChangedSpeed(false);
    triggeredPausesRef.current.clear();
  }, [song.id, song.scrollSpeed, song.parsed?.scrollSpeed]);

  // Trigger ScrollPause directive timer
  const triggerScrollPause = useCallback((seconds: number) => {
    if (pauseIntervalRef.current) {
      clearInterval(pauseIntervalRef.current);
      pauseIntervalRef.current = null;
    }

    setIsScrollPausedByDirective(true);
    isScrollPausedRef.current = true;
    setPauseCountdown(seconds);

    let remaining = seconds;
    pauseIntervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(pauseIntervalRef.current);
        pauseIntervalRef.current = null;
        setIsScrollPausedByDirective(false);
        isScrollPausedRef.current = false;
        setPauseCountdown(null);
      } else {
        setPauseCountdown(remaining);
      }
    }, 1000);
  }, []);

  // Skip pause manually
  const handleSkipPause = () => {
    if (pauseIntervalRef.current) {
      clearInterval(pauseIntervalRef.current);
      pauseIntervalRef.current = null;
    }
    setIsScrollPausedByDirective(false);
    isScrollPausedRef.current = false;
    setPauseCountdown(null);
  };

  // Cleanup pause interval on unmount
  useEffect(() => {
    return () => {
      if (pauseIntervalRef.current) {
        clearInterval(pauseIntervalRef.current);
      }
    };
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
      const deltaSeconds = Math.min((timestamp - lastTimestampRef.current) / 1000, 0.1);
      lastTimestampRef.current = timestamp;

      if (containerRef.current && isScrollingRef.current) {
        // If currently paused by ScrollPause directive, wait without moving scrollTop
        if (!isScrollPausedRef.current) {
          const scrollAmount = effectiveScrollSpeedRef.current * deltaSeconds;
          exactScrollTopRef.current += scrollAmount;
          containerRef.current.scrollTop = exactScrollTopRef.current;

          const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
          const maxScroll = scrollHeight - clientHeight;
          if (maxScroll > 0) {
            setScrollProgress(Math.min(100, Math.max(0, (scrollTop / maxScroll) * 100)));
          }

          // Check if any ScrollPause element reached 2/3 up the scroll window (top 33% of window)
          const pauseElements = containerRef.current.querySelectorAll('[data-scroll-pause]');
          const containerRect = containerRef.current.getBoundingClientRect();
          const triggerLine = containerRect.top + containerRect.height * 0.35;

          pauseElements.forEach((el) => {
            const pauseId = el.getAttribute('data-pause-id') || 'pause-default';
            const elRect = el.getBoundingClientRect();
            // If the element has moved back below the trigger line (e.g., scrolled up), re-arm it
            if (elRect.top > triggerLine) {
              triggeredPausesRef.current.delete(pauseId);
            } else if (!triggeredPausesRef.current.has(pauseId)) {
              if (elRect.top <= triggerLine && elRect.top >= containerRect.top) {
                triggeredPausesRef.current.add(pauseId);
                const pauseSeconds = parseInt(el.getAttribute('data-scroll-pause') || '8', 10);
                triggerScrollPause(pauseSeconds);
              }
            }
          });

          if (scrollTop + clientHeight >= scrollHeight - 2) {
            // Reached bottom of song
            setIsScrolling(false);
            return;
          }
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
  }, [isScrolling, triggerScrollPause]);

  // Restart scroll from top
  const handleRestart = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      exactScrollTopRef.current = 0;
      setScrollProgress(0);
      triggeredPausesRef.current.clear();
      handleSkipPause();
    }
  };

  const handlePageUp = () => {
    if (containerRef.current) {
      const step = containerRef.current.clientHeight * 0.8;
      const targetScroll = Math.max(0, containerRef.current.scrollTop - step);
      containerRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
      exactScrollTopRef.current = targetScroll;
      handleSkipPause();

      // Proactively clear any pauses above the target scroll position immediately
      const pauseElements = containerRef.current.querySelectorAll('[data-scroll-pause]');
      const containerH = containerRef.current.clientHeight;
      pauseElements.forEach((el) => {
        const elTop = (el as HTMLElement).offsetTop;
        const triggerScrollPos = elTop - containerH * 0.35;
        const pauseId = el.getAttribute('data-pause-id') || 'pause-default';
        if (targetScroll < triggerScrollPos) {
          triggeredPausesRef.current.delete(pauseId);
        }
      });

      // Also schedule checks during and after smooth scrolling
      const rearmPauses = () => {
        if (!containerRef.current) return;
        const pEls = containerRef.current.querySelectorAll('[data-scroll-pause]');
        const cRect = containerRef.current.getBoundingClientRect();
        const tLine = cRect.top + cRect.height * 0.35;
        pEls.forEach((el) => {
          const eRect = el.getBoundingClientRect();
          const pId = el.getAttribute('data-pause-id') || 'pause-default';
          if (eRect.top > tLine - 10) {
            triggeredPausesRef.current.delete(pId);
          }
        });
      };

      rearmPauses();
      setTimeout(rearmPauses, 50);
      setTimeout(rearmPauses, 150);
      setTimeout(rearmPauses, 300);
      setTimeout(rearmPauses, 500);
    }
  };

  const handlePageDown = () => {
    if (containerRef.current) {
      const step = containerRef.current.clientHeight * 0.8;
      containerRef.current.scrollBy({ top: step, behavior: 'smooth' });
      exactScrollTopRef.current += step;
      handleSkipPause();
    }
  };

  const handleSpeedChange = (newSpeed: number) => {
    const clamped = Math.max(1, Math.min(120, newSpeed));
    setScrollSpeed(clamped);
    onUpdateSettings({ scrollSpeed: clamped });

    if (initialDefaultSpeed !== undefined && clamped === initialDefaultSpeed) {
      setHasManuallyChangedSpeed(false);
    } else {
      setHasManuallyChangedSpeed(true);
    }
  };

  // Keyboard Shortcuts
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
          setDisplayMode('summary');
        }
      } else if (e.key === 'n' || e.key === 'N') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setDisplayMode('normal');
        }
      } else if (e.key === 'd' || e.key === 'D') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          setDisplayMode('detailed');
        }
      } else if (e.key === '+' || e.key === '=') {
        setTransposeOffset((prev) => (prev + 1) % 12);
      } else if (e.key === '-' || e.key === '_') {
        setTransposeOffset((prev) => (prev - 1) % 12);
      } else if (e.key === 'Escape') {
        handleAttemptExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scrollSpeed, hasManuallyChangedSpeed, hasCustomChordChanges]);

  // Handle chord diagram "Keep Change" from editor
  const handleKeepChordChange = (
    originalChord: string,
    newChordName: string,
    newVoicing: ChordVoicing,
    applyToAll: boolean
  ) => {
    const targetChordIndex = activeChordTarget?.chordIndexInLine;
    const rawOriginalChord = activeChordTarget?.rawChord || (
      transposeOffset !== 0 ? transposeChord(originalChord, -transposeOffset, preferSharps) : originalChord
    );
    const rawNewChord = transposeOffset !== 0
      ? transposeChord(newChordName, -transposeOffset, preferSharps)
      : newChordName;

    // 1. Update custom voicings state
    setSongCustomChords((prev) => {
      const next = { ...prev };
      // Register custom voicing for the new chord name
      next[newChordName] = newVoicing;
      if (rawNewChord !== newChordName) {
        next[rawNewChord] = newVoicing;
      }
      if (applyToAll) {
        // Only map old chord names if applyToAll is explicitly checked!
        if (originalChord && originalChord !== newChordName) {
          next[originalChord] = newVoicing;
        }
        if (rawOriginalChord && rawOriginalChord !== newChordName) {
          next[rawOriginalChord] = newVoicing;
        }
      }
      return next;
    });

    // 2. Update raw ChordPro with line replacement and {define} directive
    setCurrentRawChordPro((prevRaw) => {
      if (applyToAll) {
        // Global replacement across entire song
        let updated = prevRaw;
        if (rawOriginalChord !== rawNewChord) {
          const escapedOrig = rawOriginalChord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          updated = updated.replace(new RegExp(`\\[${escapedOrig}\\]`, 'g'), `[${rawNewChord}]`);
        }
        if (originalChord !== newChordName && originalChord !== rawOriginalChord) {
          const escapedTrans = originalChord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          updated = updated.replace(new RegExp(`\\[${escapedTrans}\\]`, 'g'), `[${rawNewChord}]`);
        }
        return updateChordProDefineDirective(updated, rawNewChord, newVoicing);
      } else {
        // Local replacement: update only this selected chord occurrence on target line!
        // NOTE: We perform the line modification on prevRaw FIRST before calling updateChordProDefineDirective
        // so that newly inserted {define} lines do NOT shift targetLineIdx!
        const lines = prevRaw.split(/\r?\n/);
        let targetLineIdx = activeChordTarget?.sourceLineIndex ?? -1;

        // Verify target line contains the expected chord or find matching line
        if (
          targetLineIdx < 0 || 
          targetLineIdx >= lines.length || 
          (rawOriginalChord && !lines[targetLineIdx].includes(`[${rawOriginalChord}]`))
        ) {
          if (activeChordTarget?.rawLine) {
            const foundIdx = lines.findIndex((l) => l === activeChordTarget.rawLine);
            if (foundIdx !== -1) {
              targetLineIdx = foundIdx;
            } else if (rawOriginalChord) {
              const candidateIdx = lines.findIndex((l) => l.includes(`[${rawOriginalChord}]`));
              if (candidateIdx !== -1) {
                targetLineIdx = candidateIdx;
              }
            }
          }
        }

        if (targetLineIdx >= 0 && targetLineIdx < lines.length) {
          const line = lines[targetLineIdx];
          if (targetChordIndex !== undefined && targetChordIndex >= 0) {
            let chordCount = 0;
            let replaced = false;
            lines[targetLineIdx] = line.replace(/\[([^\]]+)\]/g, (match, ch) => {
              if (chordCount === targetChordIndex) {
                chordCount++;
                replaced = true;
                return `[${rawNewChord}]`;
              }
              chordCount++;
              return match;
            });
            // If chordCount did not reach targetChordIndex, fallback to first occurrence of rawOriginalChord
            if (!replaced && rawOriginalChord) {
              const escapedOrig = rawOriginalChord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              lines[targetLineIdx] = line.replace(new RegExp(`\\[${escapedOrig}\\]`), `[${rawNewChord}]`);
            }
          } else if (rawOriginalChord) {
            const escapedOrig = rawOriginalChord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            lines[targetLineIdx] = line.replace(new RegExp(`\\[${escapedOrig}\\]`), `[${rawNewChord}]`);
          }
        }

        const updatedRaw = lines.join('\n');
        return updateChordProDefineDirective(updatedRaw, rawNewChord, newVoicing);
      }
    });

    setHasCustomChordChanges(true);
    setActiveChordDiagram(null);
    setActiveChordTarget(null);
  };

  // Delete chord from selected line
  const handleDeleteChord = () => {
    if (!activeChordTarget || activeChordTarget.sourceLineIndex === undefined || activeChordTarget.chordIndexInLine === undefined || activeChordTarget.chordIndexInLine < 0) {
      setActiveChordDiagram(null);
      setActiveChordTarget(null);
      return;
    }

    const targetChordIndex = activeChordTarget.chordIndexInLine;
    const rawChordToDelete = activeChordTarget.rawChord || (
      transposeOffset !== 0 ? transposeChord(activeChordTarget.chord, -transposeOffset, preferSharps) : activeChordTarget.chord
    );

    setCurrentRawChordPro((prevRaw) => {
      const lines = prevRaw.split(/\r?\n/);
      let targetLineIdx = activeChordTarget.sourceLineIndex!;

      if (
        targetLineIdx < 0 || 
        targetLineIdx >= lines.length || 
        (rawChordToDelete && !lines[targetLineIdx].includes(`[${rawChordToDelete}]`))
      ) {
        if (activeChordTarget.rawLine) {
          const foundIdx = lines.findIndex((l) => l === activeChordTarget.rawLine);
          if (foundIdx !== -1) {
            targetLineIdx = foundIdx;
          }
        }
      }

      if (targetLineIdx >= 0 && targetLineIdx < lines.length) {
        const line = lines[targetLineIdx];
        let chordCount = 0;
        let deleted = false;
        lines[targetLineIdx] = line.replace(/\[([^\]]+)\]/g, (match) => {
          if (chordCount === targetChordIndex) {
            chordCount++;
            deleted = true;
            return ''; // delete this chord bracket
          }
          chordCount++;
          return match;
        });
        if (!deleted && rawChordToDelete) {
          const escapedOrig = rawChordToDelete.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          lines[targetLineIdx] = line.replace(new RegExp(`\\[${escapedOrig}\\]`), '');
        }
        return lines.join('\n');
      }
      return prevRaw;
    });

    setHasCustomChordChanges(true);
    setActiveChordDiagram(null);
    setActiveChordTarget(null);
  };

  // Derived current target line text for the insert modal
  const targetLineText = useMemo(() => {
    if (!insertChordModal) return '';
    const lines = currentRawChordPro.split(/\r?\n/);
    let targetIdx = insertChordModal.sourceLineIndex;

    // Check if targetIdx points to the expected line
    if (
      targetIdx < 0 ||
      targetIdx >= lines.length ||
      (insertChordModal.previewLineText && lines[targetIdx] !== insertChordModal.previewLineText)
    ) {
      if (insertChordModal.previewLineText) {
        const foundIdx = lines.findIndex((l) => l === insertChordModal.previewLineText);
        if (foundIdx !== -1) {
          targetIdx = foundIdx;
        }
      }
    }

    if (targetIdx >= 0 && targetIdx < lines.length) {
      return lines[targetIdx];
    }
    return insertChordModal.previewLineText || '';
  }, [insertChordModal, currentRawChordPro]);

  // Handle cursor positioning inside the active read-only text box
  const handleLineCursorEvent = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const rawPos = el.selectionStart ?? 0;
    const adjustedPos = adjustCursorToRightOfChord(targetLineText, rawPos);
    if (adjustedPos !== rawPos) {
      el.setSelectionRange(adjustedPos, adjustedPos);
    }
    setInsertCursorPos(adjustedPos);
  };

  // Confirm inserting or moving a chord onto a line
  const handleConfirmInsertChord = () => {
    if (!insertChordModal || !insertChordName.trim()) return;
    const cleanName = insertChordName.trim().replace(/^\[|\]$/g, '');
    const chordOriginal = insertChordModal.rawChord 
      ? insertChordModal.rawChord.trim().replace(/^\[|\]$/g, '') 
      : cleanName;

    setCurrentRawChordPro((prevRaw) => {
      const lines = prevRaw.split(/\r?\n/);
      let targetIdx = insertChordModal.sourceLineIndex;

      // Locate line if indices shifted or preview line does not match directly
      if (
        targetIdx < 0 ||
        targetIdx >= lines.length ||
        (insertChordModal.previewLineText && lines[targetIdx] !== insertChordModal.previewLineText)
      ) {
        if (insertChordModal.previewLineText) {
          const foundIdx = lines.findIndex((l) => l === insertChordModal.previewLineText);
          if (foundIdx !== -1) {
            targetIdx = foundIdx;
          }
        }
      }

      // If in move mode and target line still does not contain chord bracket, search by chord occurrence
      if (insertChordModal.mode === 'move') {
        if (
          targetIdx < 0 || 
          targetIdx >= lines.length || 
          (!lines[targetIdx].includes(`[${chordOriginal}]`) && !lines[targetIdx].includes(`[${cleanName}]`))
        ) {
          const foundChordLine = lines.findIndex(
            (l) => l.includes(`[${chordOriginal}]`) || l.includes(`[${cleanName}]`)
          );
          if (foundChordLine !== -1) {
            targetIdx = foundChordLine;
          }
        }
      }

      if (targetIdx >= 0 && targetIdx < lines.length) {
        const line = lines[targetIdx];
        if (insertChordModal.mode === 'move') {
          lines[targetIdx] = moveChordInLine(
            line,
            chordOriginal,
            insertChordModal.targetChordIndexInLine,
            insertCursorPos,
            cleanName
          );
        } else {
          lines[targetIdx] = insertChordIntoLine(line, cleanName, insertCursorPos);
        }
        return lines.join('\n');
      }
      return prevRaw;
    });
    setHasCustomChordChanges(true);
    setInsertChordModal(null);
    setInsertChordName('');
    setInsertCursorPos(0);
  };

  // Initiate moving a chord from the chord diagram modal
  const handleInitiateMoveChord = () => {
    if (!activeChordTarget || activeChordTarget.sourceLineIndex === undefined) return;
    const rawLines = currentRawChordPro.split(/\r?\n/);
    const targetIdx = activeChordTarget.sourceLineIndex;
    const exactLine = (targetIdx >= 0 && targetIdx < rawLines.length)
      ? rawLines[targetIdx]
      : (activeChordTarget.rawLine || '');

    const chordNameToMove = activeChordTarget.rawChord || (
      transposeOffset !== 0 
        ? transposeChord(activeChordTarget.chord, -transposeOffset, preferSharps) 
        : activeChordTarget.chord
    );

    setActiveChordDiagram(null);
    setInsertChordName(chordNameToMove);
    setInsertChordModal({
      isOpen: true,
      sourceLineIndex: targetIdx,
      previewLineText: exactLine,
      mode: 'move',
      targetChordIndexInLine: activeChordTarget.chordIndexInLine,
      rawChord: chordNameToMove,
    });
    setInsertCursorPos(0);
  };

  // Exit Check: has speed or custom chord changes
  const isWritableRepo = repoConfig?.sourceType === 'local-drive' || repoConfig?.sourceType === 'github-master';
  const hasSpeedDiff = hasManuallyChangedSpeed && (initialDefaultSpeed === undefined || scrollSpeed !== initialDefaultSpeed);
  const hasPendingChanges = hasSpeedDiff || hasCustomChordChanges;

  const handleAttemptExit = useCallback(() => {
    if (hasPendingChanges) {
      setShowSaveExitModal(true);
    } else {
      onBack();
    }
  }, [hasPendingChanges, onBack]);

  // Save changes and return to song without exiting
  const handleConfirmSaveAndReturn = async () => {
    setIsSavingOnExit(true);
    try {
      // 1. Update raw with scroll speed if speed was altered
      let rawToSave = currentRawChordPro;
      if (hasSpeedDiff) {
        rawToSave = updateChordProScrollSpeed(rawToSave, scrollSpeed);
      }

      // 2. Reformat and beautify directives in standard order!
      rawToSave = reformatChordPro(rawToSave);

      // 3. Parse updated song
      const updatedParsed = parseChordPro(rawToSave);
      updatedParsed.customChords = { ...updatedParsed.customChords, ...songCustomChords };

      const updatedSong: Song = {
        ...song,
        scrollSpeed: scrollSpeed,
        rawChordPro: rawToSave,
        parsed: updatedParsed,
        backtracks: updatedParsed.backtracks,
        updatedAt: Date.now(),
      };

      if (onSaveSong) {
        await onSaveSong(updatedSong);
      }

      // Update in-memory state so user can continue without exit
      setCurrentRawChordPro(rawToSave);
      setInitialDefaultSpeed(scrollSpeed);
      setHasManuallyChangedSpeed(false);
      setHasCustomChordChanges(false);
      setShowSaveExitModal(false);
    } catch (err) {
      console.error('Failed to save song changes:', err);
    } finally {
      setIsSavingOnExit(false);
    }
  };

  // Save changes and return to songbook
  const handleConfirmSaveAndExit = async () => {
    setIsSavingOnExit(true);
    try {
      // 1. Update raw with scroll speed if speed was altered
      let rawToSave = currentRawChordPro;
      if (hasSpeedDiff) {
        rawToSave = updateChordProScrollSpeed(rawToSave, scrollSpeed);
      }

      // 2. Reformat and beautify directives in standard order!
      rawToSave = reformatChordPro(rawToSave);

      // 3. Parse updated song
      const updatedParsed = parseChordPro(rawToSave);
      updatedParsed.customChords = { ...updatedParsed.customChords, ...songCustomChords };

      const updatedSong: Song = {
        ...song,
        scrollSpeed: scrollSpeed,
        rawChordPro: rawToSave,
        parsed: updatedParsed,
        backtracks: updatedParsed.backtracks,
        updatedAt: Date.now(),
      };

      if (onSaveSong) {
        await onSaveSong(updatedSong);
      }
    } catch (err) {
      console.error('Failed to save song changes on exit:', err);
    } finally {
      setIsSavingOnExit(false);
      setShowSaveExitModal(false);
      onBack();
    }
  };

  const handleConfirmDiscardAndExit = () => {
    setShowSaveExitModal(false);
    onBack();
  };

  // BackTrack handlers
  const handleUpdateBackTracks = (updatedTracks: BackTrackItem[]) => {
    setSongBackTracks(updatedTracks);
    setCurrentRawChordPro((prevRaw) => {
      return updateChordProBackTracks(prevRaw, updatedTracks);
    });
    setHasCustomChordChanges(true);
  };

  const allSongBackTracks: BackTrackItem[] = useMemo(() => {
    return songBackTracks;
  }, [songBackTracks]);

  const validBackTracks = useMemo(() => {
    return allSongBackTracks.filter(isValidBackTrack);
  }, [allSongBackTracks]);

  const handleSelectBackTrack = (track: BackTrackItem, launchMode: 'browser' | 'pip' = 'browser') => {
    setActiveFloatingTrack(track);

    if (launchMode === 'browser') {
      let targetUrl = track.url;
      if (track.type === 'local' && !targetUrl.startsWith('file:///')) {
        targetUrl = `file:///${targetUrl.replace(/\\/g, '/')}`;
      }
      try {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      } catch (err) {
        console.error('Failed to open backtrack URL in browser:', err);
      }
    }
  };

  const handleOpenBackTrackInBrowser = (track: BackTrackItem) => {
    let targetUrl = track.url;
    if (track.type === 'local' && !targetUrl.startsWith('file:///')) {
      targetUrl = `file:///${targetUrl.replace(/\\/g, '/')}`;
    }
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleTransposeStep = (direction: 1 | -1) => {
    setTransposeOffset((prev) => {
      const next = prev + direction;
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

  // Auto created header info line items
  const headerInfoItems = useMemo(() => {
    return buildHeaderInfoItems(parsed, currentKey);
  }, [parsed, currentKey]);

  // Graphical defined chords list ({define: ...})
  const definedChordsList = useMemo(() => {
    const list: { name: string; voicing: ChordVoicing }[] = [];
    const seen = new Set<string>();

    for (const pl of parsed.lines) {
      if (pl.type === 'define' && pl.text) {
        const def = parseChordDefineDirective(pl.text);
        if (def && !seen.has(def.name)) {
          seen.add(def.name);
          list.push(def);
        }
      }
    }

    if (songCustomChords) {
      for (const [cName, val] of Object.entries(songCustomChords)) {
        const voicing = val as ChordVoicing;
        if (!seen.has(cName) && voicing && Array.isArray(voicing.frets)) {
          seen.add(cName);
          list.push({ name: cName, voicing });
        }
      }
    }

    return list;
  }, [parsed.lines, songCustomChords]);

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
            onClick={handleAttemptExit}
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
              {(parsed.scrollSpeed || song.scrollSpeed) && (
                <span 
                  className="px-1.5 py-0.2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded text-[10px] font-mono font-bold shrink-0"
                  title="Song Default Auto-Scroll Speed"
                >
                  {parsed.scrollSpeed || song.scrollSpeed} px/s
                </span>
              )}
            </div>
            <p className="text-[11px] opacity-70 truncate">
              {parsed.artist}
            </p>
          </div>
        </div>

        {/* Center/Right: 3 Display Mode Buttons [D] [N] [S], Add Chord, BackTrack & Transpose */}
        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2.5 shrink-0">
          {/* 3 Display Mode Buttons: [D] Detailed, [N] Normal, [S] Summary */}
          <div 
            id="viewer-display-mode-selector"
            className="flex items-center bg-slate-900/90 border border-slate-700/80 rounded-xl p-0.5 shadow-sm"
          >
            <button
              id="mode-detailed-btn"
              type="button"
              onClick={() => setDisplayMode('detailed')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                displayMode === 'detailed'
                  ? 'bg-amber-400 text-slate-950 font-black shadow-sm ring-1 ring-amber-400/50'
                  : 'text-slate-300 hover:text-amber-300 hover:bg-slate-800'
              }`}
              title="Detailed Mode [D] - Shows compact guitar chord grid diagram above every chord"
            >
              D
            </button>
            <button
              id="mode-normal-btn"
              type="button"
              onClick={() => setDisplayMode('normal')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                displayMode === 'normal'
                  ? 'bg-amber-400 text-slate-950 font-black shadow-sm ring-1 ring-amber-400/50'
                  : 'text-slate-300 hover:text-amber-300 hover:bg-slate-800'
              }`}
              title="Normal Mode [N] - Standard lyrics & chords scrolling view"
            >
              N
            </button>
            <button
              id="mode-summary-btn"
              type="button"
              onClick={() => setDisplayMode('summary')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                displayMode === 'summary'
                  ? 'bg-amber-400 text-slate-950 font-black shadow-sm ring-1 ring-amber-400/50'
                  : 'text-slate-300 hover:text-amber-300 hover:bg-slate-800'
              }`}
              title="Summary Mode [S] - Song structural outline, intro/outro chords & first 3 words reminder"
            >
              S
            </button>
          </div>

          {/* Add Chord Mode Button */}
          <button
            id="viewer-add-chord-btn"
            type="button"
            onClick={() => setIsAddChordMode(!isAddChordMode)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border shadow-sm ${
              isAddChordMode
                ? 'bg-amber-400 text-slate-950 border-amber-300 ring-2 ring-amber-400/60 font-black animate-pulse'
                : 'bg-slate-900/90 text-slate-300 border-slate-700/80 hover:text-amber-300 hover:bg-slate-800'
            }`}
            title={isAddChordMode ? 'Add Chord mode active: click any lyrics/chord line to drop a chord (Click again or Esc to cancel)' : 'Add Chord - Click to insert a chord on any line'}
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">{isAddChordMode ? 'Adding Chord...' : '+ Chord'}</span>
          </button>

          {/* BackTrack Accompaniment Button */}
          <button
            id="viewer-backtrack-btn"
            type="button"
            onClick={() => setShowBackTrackModal(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-md border bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-600 hover:border-purple-400/60 hover:text-purple-300"
            title="Open BackTrack accompaniment links & audio (YouTube, MP3, tutorial)"
          >
            <Play className="w-3.5 h-3.5 text-purple-400 fill-current" />
            <span className="tracking-wide hidden xs:inline">BackTrack</span>
            {validBackTracks.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-purple-500/25 text-purple-300 border border-purple-500/40">
                {validBackTracks.length}
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

          {/* Top-Right Corner Metronome */}
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
        className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 focus:outline-none select-text relative"
      >
        <div className="max-w-4xl mx-auto space-y-6 pb-40">
          {/* Song Header Info Card */}
          <div className="border-b border-slate-800/50 pb-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {parsed.title}
              </h2>
              <p className="text-base sm:text-lg opacity-80">
                {parsed.artist}
              </p>

              {/* Auto Created Header Info Line displaying concatenated text of specifically defined notations */}
              {headerInfoItems.length > 0 && (
                <div 
                  id="song-header-info-line"
                  className="mt-2 text-xs sm:text-sm font-mono text-slate-300 flex flex-wrap items-center gap-y-1 select-none"
                >
                  {headerInfoItems.map((item, idx) => (
                    <React.Fragment key={item.type}>
                      {idx > 0 && <span className="mx-2 text-slate-500 font-sans">|</span>}
                      {item.isKeyChord ? (
                        <span
                          onClick={() => setActiveChordDiagram(item.value)}
                          className="cursor-pointer hover:text-amber-300 underline decoration-dotted underline-offset-2 transition-colors inline-flex items-center gap-1 font-semibold text-amber-400"
                          title={`Click to view or edit chord diagram for key ${item.value}`}
                        >
                          <span>Key: {item.value}</span>
                          {transposeOffset !== 0 && (
                            <span className="text-xs text-amber-300 font-normal no-underline">
                              ➔ {currentKey} ({transposeOffset > 0 ? `+${transposeOffset}` : transposeOffset})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="opacity-90">{item.fullText}</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Defined Chords Graphical Row ({define: ...}) at the beginning of song before intro */}
          {definedChordsList.length > 0 && (
            <div 
              id="defined-chords-row" 
              className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl"
            >
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5 select-none">
                <Guitar className="w-3.5 h-3.5 text-amber-400" />
                <span>Custom Defined Chords</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 overflow-x-auto pb-1">
                {definedChordsList.map((item) => (
                  <div
                    key={item.name}
                    onClick={() => setActiveChordDiagram(item.name)}
                    className="cursor-pointer transition-transform hover:scale-105 active:scale-95"
                    title={`Click to edit [${item.name}] chord diagram`}
                  >
                    <ChordDiagramCard
                      chordName={item.name}
                      voicing={item.voicing}
                      className="shadow-sm hover:border-amber-400"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mode Notification Banners */}
          {displayMode === 'summary' && (
            <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 text-xs text-amber-300 animate-in fade-in">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Summary Mode [S]:</strong> Section headers, intro/outro chords, and first 3 words reminder.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDisplayMode('normal')}
                className="text-[11px] underline text-amber-400 hover:text-amber-200 shrink-0 font-semibold ml-2"
              >
                Switch to Normal Mode [N]
              </button>
            </div>
          )}

          {displayMode === 'detailed' && (
            <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2 text-xs text-amber-300 animate-in fade-in">
              <div className="flex items-center gap-2">
                <Guitar className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Detailed Mode [D]:</strong> Guitar chord diagrams displayed above every chord. Scroll speed auto-adjusted ({effectiveScrollSpeed}px/s).
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDisplayMode('normal')}
                className="text-[11px] underline text-amber-400 hover:text-amber-200 shrink-0 font-semibold ml-2"
              >
                Switch to Normal Mode [N]
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
                lineIndex={idx}
                line={line}
                transposeOffset={transposeOffset}
                preferSharps={preferSharps}
                themeStyles={themeStyles}
                displayMode={displayMode}
                customChords={songCustomChords}
                isAddChordMode={isAddChordMode}
                onChordClick={(chord, context) => {
                  if (isAddChordMode) {
                    // Selecting a specific chord while Add Chord mode is active switches directly to Move Chord!
                    const rawLines = currentRawChordPro.split(/\r?\n/);
                    const targetIdx = context?.sourceLineIndex ?? idx;
                    const exactLine = (targetIdx >= 0 && targetIdx < rawLines.length)
                      ? rawLines[targetIdx]
                      : (context?.rawLine || '');

                    const chordNameToMove = context?.rawChord || (
                      transposeOffset !== 0 
                        ? transposeChord(chord, -transposeOffset, preferSharps) 
                        : chord
                    );

                    setInsertChordName(chordNameToMove);
                    setInsertChordModal({
                      isOpen: true,
                      sourceLineIndex: targetIdx,
                      previewLineText: exactLine,
                      mode: 'move',
                      targetChordIndexInLine: context?.chordIndexInLine,
                      rawChord: chordNameToMove,
                    });
                    setInsertCursorPos(0);
                    setIsAddChordMode(false);
                    return;
                  }

                  setActiveChordTarget(context ? { chord, ...context } : { chord, rawChord: chord });
                  setActiveChordDiagram(chord);
                }}
                onLineClick={(sourceLineIdx, lineText) => {
                  const rawLines = currentRawChordPro.split(/\r?\n/);
                  const targetIdx = sourceLineIdx ?? idx;
                  const exactLine = (targetIdx >= 0 && targetIdx < rawLines.length)
                    ? rawLines[targetIdx]
                    : (lineText || '');

                  setInsertChordName('');
                  setInsertChordModal({
                    isOpen: true,
                    sourceLineIndex: targetIdx,
                    previewLineText: exactLine,
                    mode: 'add',
                  });
                  setInsertCursorPos(0);
                  setIsAddChordMode(false);
                }}
              />
            ))}
          </div>
        </div>
      </main>

      {/* Floating ScrollPause Countdown Badge (shown when lead/solo pause is triggered - 20% smaller) */}
      {isScrollPausedByDirective && pauseCountdown !== null && (
        <div 
          id="scroll-pause-countdown-badge"
          onClick={handleSkipPause}
          className="fixed top-20 right-6 sm:right-12 z-50 bg-slate-900/95 border-2 border-amber-400 text-amber-300 px-3 py-2 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-2.5 cursor-pointer hover:bg-slate-800 transition-transform active:scale-95 animate-bounce"
          title="Lead/Solo pause in progress - Click to resume scrolling immediately"
        >
          <div className="p-1.5 bg-amber-500/20 rounded-lg border border-amber-500/40">
            <Timer className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          <div>
            <div className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">
              Solo / Lead Break Pause
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-400 font-mono">
                {pauseCountdown}s
              </span>
              <span className="text-[9px] text-amber-300/80 underline font-medium">
                Tap to resume
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Guitar Chord Grids Editor / Diagram Modal */}
      {activeChordDiagram && (
        <ChordDiagramModal
          chord={activeChordDiagram}
          onClose={() => {
            setActiveChordDiagram(null);
            setActiveChordTarget(null);
          }}
          onKeepChange={handleKeepChordChange}
          onDeleteChord={handleDeleteChord}
          onMoveChord={handleInitiateMoveChord}
          existingCustomChords={songCustomChords}
        />
      )}

      {/* Insert Chord Modal */}
      {insertChordModal && (
        <div 
          id="insert-chord-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setInsertChordModal(null)}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm">
                {insertChordModal.mode === 'move' ? (
                  <>
                    <MoveHorizontal className="w-4 h-4 text-sky-400" />
                    <span className="text-sky-300">Move Chord [{insertChordName.trim().replace(/^\[|\]$/g, '') || '...'}] in Line</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-amber-400" />
                    <span className="text-amber-400">Insert Chord to Line</span>
                  </>
                )}
              </div>
              <button 
                onClick={() => setInsertChordModal(null)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Active Read-Only Textbox for Cursor Positioning */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <span>Target Line</span>
                  <span className="text-[11px] font-normal text-amber-400/90">
                    {insertChordModal.mode === 'move' ? '(Click to choose new position for chord)' : '(Click to position chord)'}
                  </span>
                </label>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span className="text-[10px] text-slate-400">Jump:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setInsertCursorPos(0);
                      if (lineInputRef.current) {
                        lineInputRef.current.focus();
                        lineInputRef.current.setSelectionRange(0, 0);
                      }
                    }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px] border border-slate-700"
                  >
                    Start
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const endPos = targetLineText.length;
                      setInsertCursorPos(endPos);
                      if (lineInputRef.current) {
                        lineInputRef.current.focus();
                        lineInputRef.current.setSelectionRange(endPos, endPos);
                      }
                    }}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px] border border-slate-700"
                  >
                    End
                  </button>
                </div>
              </div>

              <div className="relative">
                <textarea
                  ref={lineInputRef}
                  readOnly
                  value={targetLineText}
                  onClick={handleLineCursorEvent}
                  onKeyUp={handleLineCursorEvent}
                  onSelect={handleLineCursorEvent}
                  onPointerUp={handleLineCursorEvent}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl text-slate-100 font-mono text-sm leading-relaxed cursor-text resize-none focus:outline-none select-text"
                  placeholder="(Empty line)"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {insertChordModal.mode === 'move'
                  ? 'Click anywhere in the text box above to move the chord to that position.'
                  : 'Click in the text box above to position where the chord is added. If placed inside a chord, it automatically shifts to the right of the chord.'}
              </p>
            </div>

            {/* Live Line Preview */}
            <div className="p-3 bg-slate-950/90 border border-slate-800 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className={insertChordModal.mode === 'move' ? 'text-sky-400' : 'text-amber-400'}>Resulting Line Preview:</span>
                <span className="text-slate-400 font-mono text-[10px]">
                  Cursor at pos {insertCursorPos} of {targetLineText.length}
                </span>
              </div>
              <div className="font-mono text-xs text-slate-200 overflow-x-auto whitespace-pre py-0.5">
                {insertChordModal.mode === 'move' ? (
                  <span className="text-slate-300">
                    {moveChordInLine(
                      targetLineText,
                      insertChordModal.rawChord || insertChordName.trim().replace(/^\[|\]$/g, '') || '?',
                      insertChordModal.targetChordIndexInLine,
                      insertCursorPos,
                      insertChordName.trim().replace(/^\[|\]$/g, '') || '?'
                    )}
                  </span>
                ) : (
                  <>
                    <span className="text-slate-300">{targetLineText.slice(0, insertCursorPos)}</span>
                    <span className="inline-block px-1.5 py-0.2 bg-amber-400 text-slate-950 font-bold rounded shadow-sm">
                      [{insertChordName.trim().replace(/^\[|\]$/g, '') || '?'}]
                    </span>
                    <span className="text-slate-300">{targetLineText.slice(insertCursorPos)}</span>
                  </>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Chord Name (e.g., G, D/F#, Em7, Cadd9)
              </label>
              <input
                type="text"
                value={insertChordName}
                onChange={(e) => setInsertChordName(e.target.value)}
                placeholder="Type chord name..."
                autoFocus
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-100 font-mono text-sm focus:outline-none focus:border-amber-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmInsertChord();
                }}
              />
            </div>

            {/* Quick chord buttons from song */}
            {songChords && songChords.length > 0 && (
              <div>
                <span className="text-[11px] font-bold text-slate-400 block mb-1.5">
                  Quick Chords from Song:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {songChords.map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => setInsertChordName(ch)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-colors ${
                        insertChordName === ch
                          ? 'bg-amber-400 text-slate-950 border-amber-300'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-amber-300'
                      }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setInsertChordModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmInsertChord}
                disabled={!insertChordName.trim()}
                className={`px-4 py-2 rounded-xl disabled:opacity-50 text-slate-950 text-xs font-bold flex items-center gap-1.5 ${
                  insertChordModal.mode === 'move'
                    ? 'bg-sky-400 hover:bg-sky-300 text-slate-950'
                    : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                }`}
              >
                {insertChordModal.mode === 'move' ? (
                  <>
                    <MoveHorizontal className="w-4 h-4" />
                    Move Chord
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Insert Chord
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
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

          {/* 3 Display Modes Card */}
          <div className="p-3 rounded-xl border bg-slate-950/70 border-slate-800 space-y-2">
            <div className="text-slate-100 font-bold flex items-center gap-1.5 text-xs">
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Display Mode</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setDisplayMode('detailed')}
                className={`py-1.5 px-2 rounded-lg text-center font-bold text-xs border transition-colors ${
                  displayMode === 'detailed'
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-amber-300'
                }`}
                title="Detailed Mode"
              >
                [D] Detailed
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('normal')}
                className={`py-1.5 px-2 rounded-lg text-center font-bold text-xs border transition-colors ${
                  displayMode === 'normal'
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-amber-300'
                }`}
                title="Normal Mode"
              >
                [N] Normal
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('summary')}
                className={`py-1.5 px-2 rounded-lg text-center font-bold text-xs border transition-colors ${
                  displayMode === 'summary'
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-amber-300'
                }`}
                title="Summary Mode"
              >
                [S] Summary
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

      {/* Bottom Floating Auto-Scroll Control Bar */}
      <footer
        id="auto-scroll-control-bar"
        className={`sticky bottom-0 z-40 px-3 sm:px-6 py-2.5 sm:py-3 border-t backdrop-blur-md ${themeStyles.barBg} shadow-2xl`}
      >
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Reposition, 3-Mode Toggle & Restart Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Quick 3 Display Mode Toggle in Bottom Bar */}
            <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-xl p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setDisplayMode('detailed')}
                className={`px-2 py-1 rounded-lg font-bold transition-all ${
                  displayMode === 'detailed'
                    ? 'bg-amber-400 text-slate-950 font-black'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
                title="Detailed Mode [D] with inline guitar chord diagrams"
              >
                D
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('normal')}
                className={`px-2 py-1 rounded-lg font-bold transition-all ${
                  displayMode === 'normal'
                    ? 'bg-amber-400 text-slate-950 font-black'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
                title="Normal Mode [N]"
              >
                N
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('summary')}
                className={`px-2 py-1 rounded-lg font-bold transition-all ${
                  displayMode === 'summary'
                    ? 'bg-amber-400 text-slate-950 font-black'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
                title="Summary Mode [S]"
              >
                S
              </button>
            </div>

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
              {displayMode === 'detailed' ? `${effectiveScrollSpeed}px/s*` : `${scrollSpeed}px/s`}
            </span>
          </div>
        </div>
      </footer>

      {/* Save Exit Confirmation Modal (for Chord Changes & Scroll Speed) */}
      {showSaveExitModal && (
        <div 
          id="save-exit-prompt-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSavingOnExit) {
              setShowSaveExitModal(false);
            }
          }}
        >
          <div 
            className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden text-slate-100 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <Save className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    Save Changes to File?
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[260px]">
                    {song.title} {song.artist ? `• ${song.artist}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSavingOnExit}
                onClick={() => setShowSaveExitModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                title="Cancel and stay on this song"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-sm">
              <p className="text-slate-300 leading-relaxed text-xs">
                You made adjustments during this session. Would you like to save these changes and beautify your ChordPro file?
              </p>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5 text-xs">
                {hasSpeedDiff && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Scroll Speed:</span>
                    <span className="font-mono text-amber-300 font-bold">
                      {initialDefaultSpeed !== undefined ? `${initialDefaultSpeed}px/s ➔ ` : ''}{scrollSpeed} px/s
                    </span>
                  </div>
                )}

                {hasCustomChordChanges && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Custom Chord Voicings:</span>
                    <span className="font-mono text-emerald-300 font-bold">
                      {Object.keys(songCustomChords).length} defined
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 text-amber-300">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>File Beautification:</span>
                  </span>
                  <span className="text-slate-300 font-medium">Standard directive ordering applied</span>
                </div>
              </div>

              <div className="text-xs text-slate-400 bg-slate-800/40 rounded-lg p-2.5 flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Target: <strong className="text-slate-200">{repoConfig?.sourceType === 'github-master' ? 'Master GitHub repository' : 'Master Local Drive repository'}</strong>
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-2.5">
              <button
                id="save-exit-discard-btn"
                type="button"
                disabled={isSavingOnExit}
                onClick={handleConfirmDiscardAndExit}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 transition-colors disabled:opacity-50"
              >
                Discard & Exit
              </button>
              <button
                id="save-exit-save-return-btn"
                type="button"
                disabled={isSavingOnExit}
                onClick={handleConfirmSaveAndReturn}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-amber-300 border border-amber-500/40 hover:border-amber-400 shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
                title="Save changes to file and stay in this song"
              >
                {isSavingOnExit ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-amber-400" />
                    <span>Save & Return</span>
                  </>
                )}
              </button>
              <button
                id="save-exit-save-btn"
                type="button"
                disabled={isSavingOnExit}
                onClick={handleConfirmSaveAndExit}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-[0.98] text-slate-950 shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {isSavingOnExit ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 stroke-[2.5]" />
                    <span>Save & Exit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BackTrack Selection Modal */}
      <BackTrackModal
        isOpen={showBackTrackModal}
        onClose={() => setShowBackTrackModal(false)}
        song={song}
        backtracks={songBackTracks}
        onUpdateBackTracks={handleUpdateBackTracks}
        onSelectTrack={handleSelectBackTrack}
        onEditSong={() => onEditSong(song)}
        activeTrackId={activeFloatingTrack?.id}
      />

      {/* BackTrack Floating Player (YouTube PiP & Background Audio) */}
      <BackTrackFloatingPlayer
        track={activeFloatingTrack}
        onClose={() => setActiveFloatingTrack(null)}
        onOpenInBrowser={handleOpenBackTrackInBrowser}
      />
    </div>
  );
};

// Key badge with quick chord diagram hint on hover
const KeyBadgeItem: React.FC<{
  originalKey: string;
  currentKey: string;
  transposeOffset: number;
  customChords?: Record<string, ChordVoicing>;
  onClick: () => void;
}> = ({ originalKey, currentKey, transposeOffset, customChords, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);
  const activeKeyChord = currentKey || originalKey;

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        type="button"
        onClick={onClick}
        className="px-2.5 py-1 bg-sky-950/70 hover:bg-sky-900/80 border border-sky-800/60 text-sky-300 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
      >
        <span>Key: {originalKey}</span>
        {transposeOffset !== 0 && (
          <span className="text-amber-400 font-bold ml-1">
            ➔ {currentKey} ({transposeOffset > 0 ? `+${transposeOffset}` : transposeOffset})
          </span>
        )}
      </button>
      {isHovered && activeKeyChord && (
        <ChordHint 
          chordName={activeKeyChord} 
          customVoicing={customChords?.[activeKeyChord]}
          customChords={customChords}
        />
      )}
    </div>
  );
};

// Chord Segment item rendering with quick-reference graphic popup on cursor hover
interface ChordSegmentItemProps {
  chord: string;
  rawChord?: string;
  customVoicing?: ChordVoicing;
  customChords?: Record<string, ChordVoicing>;
  themeChordStyle: string;
  onChordClick: () => void;
}

const ChordSegmentItem: React.FC<ChordSegmentItemProps> = ({
  chord,
  rawChord,
  customVoicing,
  customChords,
  themeChordStyle,
  onChordClick,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => {
        if (chord) setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
    >
      <span
        onClick={(e) => {
          e.stopPropagation();
          if (chord) onChordClick();
        }}
        className={`min-h-[1.3em] font-mono select-none cursor-pointer transition-all hover:underline ${
          chord ? themeChordStyle : 'opacity-0'
        }`}
      >
        {chord || '\u00A0'}
      </span>

      {isHovered && chord && (
        <ChordHint 
          chordName={chord} 
          rawChord={rawChord}
          customVoicing={customVoicing}
          customChords={customChords}
        />
      )}
    </div>
  );
};

// Line Renderer for standard lyrics, comments, choruses, bridges, and tabs
interface RenderLineProps {
  lineIndex: number;
  line: ChordProLine;
  transposeOffset: number;
  preferSharps: boolean;
  themeStyles: any;
  displayMode: DisplayMode;
  customChords?: Record<string, ChordVoicing>;
  isAddChordMode?: boolean;
  onChordClick: (
    chord: string,
    context?: { 
      chord: string; 
      rawChord?: string;
      lineIndex: number; 
      segIdx: number; 
      chordIndexInLine?: number; 
      sourceLineIndex?: number;
      rawLine?: string;
    }
  ) => void;
  onLineClick?: (sourceLineIndex?: number, lineText?: string) => void;
}

const RenderLine: React.FC<RenderLineProps> = ({
  lineIndex,
  line,
  transposeOffset,
  preferSharps,
  themeStyles,
  displayMode,
  customChords,
  isAddChordMode,
  onChordClick,
  onLineClick,
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

  if (line.type === 'define') {
    // Defined chords are rendered as graphical cards in the horizontal row before intro
    return null;
  }

  if (line.type === 'chorus_end' || line.type === 'bridge_end') {
    return <div className="mb-3" />;
  }

  if (line.type === 'tab_end') {
    return null;
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
    if (displayMode === 'summary') return null;

    const tabTitle = line.text || '';
    const tabLines = line.tabLines && line.tabLines.length > 0 
      ? line.tabLines 
      : (line.type === 'tab' && line.text ? [line.text] : []);

    if (tabLines.length === 0 && !tabTitle) return null;

    return (
      <TabDiagram
        title={tabTitle}
        lines={tabLines}
        isAddChordMode={isAddChordMode}
      />
    );
  }

  // ScrollPause directive line
  if (line.type === 'scroll_pause') {
    const pauseSec = line.pauseSeconds || line.scrollPauseSec || 8;
    if (isAddChordMode) {
      return (
        <div 
          data-scroll-pause={pauseSec}
          data-pause-id={`pause-${lineIndex}`}
          className="my-3 py-2 px-3.5 bg-amber-500/15 border border-amber-500/40 rounded-xl text-amber-300 flex items-center justify-between text-xs font-mono font-semibold select-none"
        >
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-amber-400" />
            <span>Scroll Pause: {pauseSec}s (Guitar Solo / Lead Break)</span>
          </div>
          <span className="text-[10px] text-amber-400/80 font-sans hidden sm:inline">
            Directive Line
          </span>
        </div>
      );
    }

    // Playing screen: Static right-justified indicator to avoid distracting the musician
    return (
      <div 
        data-scroll-pause={pauseSec}
        data-pause-id={`pause-${lineIndex}`}
        className="my-1.5 flex justify-end select-none"
      >
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-300/80 text-xs font-mono">
          <Timer className="w-3.5 h-3.5 text-amber-400" />
          <span>{pauseSec}s</span>
        </div>
      </div>
    );
  }

  if (line.type === 'lyrics' && line.segments) {
    const rawLineText = line.segments.map(s => (s.chord ? `[${s.chord}]` : '') + (s.lyrics || '')).join('');
    let chordOccurrenceInLine = 0;

    return (
      <div 
        className={`flex flex-wrap items-end my-1.5 leading-snug rounded-lg transition-colors ${
          isAddChordMode 
            ? 'cursor-pointer p-1 bg-amber-500/10 hover:bg-amber-500/20 ring-1 ring-amber-400/50' 
            : ''
        }`}
        onClick={() => {
          if (isAddChordMode && onLineClick) {
            onLineClick(line.sourceLineIndex, rawLineText);
          }
        }}
      >
        {line.segments.map((seg, segIdx) => {
          const rawChord = seg.chord || '';
          const isChordSeg = Boolean(rawChord);
          const currentChordIdx = isChordSeg ? chordOccurrenceInLine++ : -1;
          const transposedChord = rawChord
            ? transposeChord(rawChord, transposeOffset, preferSharps)
            : '';

          return (
            <div
              key={segIdx}
              className={`inline-flex flex-col mr-1 group/seg align-bottom items-start ${
                displayMode === 'detailed' && transposedChord ? 'min-w-[42px]' : ''
              }`}
            >
              {/* Detailed Mode: Compact Chord Diagram centered directly above the chord name */}
              <div className="flex flex-col items-center justify-end w-fit">
                {displayMode === 'detailed' && transposedChord && (
                  <div 
                    className="flex justify-center pb-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChordClick(transposedChord, { 
                        chord: transposedChord, 
                        rawChord,
                        lineIndex, 
                        segIdx, 
                        chordIndexInLine: currentChordIdx, 
                        sourceLineIndex: line.sourceLineIndex,
                        rawLine: line.raw || rawLineText,
                      });
                    }}
                    title={`Click to edit [${transposedChord}] chord grid`}
                  >
                    <MiniChordDiagram
                      chordName={transposedChord}
                      rawChord={rawChord}
                      customVoicing={customChords?.[transposedChord] || (rawChord ? customChords?.[rawChord] : undefined)}
                      customChords={customChords}
                    />
                  </div>
                )}

                {/* Chord Row */}
                <ChordSegmentItem
                  chord={transposedChord}
                  rawChord={rawChord}
                  customVoicing={customChords?.[transposedChord] || (rawChord ? customChords?.[rawChord] : undefined)}
                  customChords={customChords}
                  themeChordStyle={themeStyles.chord}
                  onChordClick={() => onChordClick(transposedChord, { 
                    chord: transposedChord, 
                    rawChord,
                    lineIndex, 
                    segIdx, 
                    chordIndexInLine: currentChordIdx, 
                    sourceLineIndex: line.sourceLineIndex,
                    rawLine: line.raw || rawLineText,
                  })}
                />
              </div>

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

// Guitar Chord Diagram & Builder modal
const ChordDiagramModal: React.FC<{ 
  chord: string; 
  onClose: () => void;
  onKeepChange?: (
    originalChord: string,
    newChordName: string,
    newVoicing: ChordVoicing,
    applyToAll: boolean
  ) => void;
  onDeleteChord?: () => void;
  onMoveChord?: () => void;
  existingCustomChords?: Record<string, ChordVoicing>;
}> = ({ chord, onClose, onKeepChange, onDeleteChord, onMoveChord, existingCustomChords }) => {
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm">
        <ChordDiagram 
          chordName={chord} 
          onClose={onClose} 
          onKeepChange={onKeepChange}
          onDeleteChord={onDeleteChord}
          onMoveChord={onMoveChord}
          existingCustomChords={existingCustomChords}
        />
      </div>
    </div>
  );
};
