import React, { useState, useMemo } from 'react';
import { 
  Volume2, 
  ChevronLeft, 
  ChevronRight, 
  Copy, 
  Check, 
  Music, 
  RotateCcw,
  Sparkles,
  Save,
  CheckSquare,
  Square,
  Trash2,
  MoveHorizontal
} from 'lucide-react';
import { 
  ChordVoicing, 
  getGuitarChordData, 
  getNoteOnFret, 
  playGuitarNote, 
  STRING_TUNING_NAMES, 
  strumGuitarChord,
  detectChordFromVoicing,
  DetectedChordResult,
  resolveChordVoicing
} from '../utils/guitarChords';

export interface ChordDiagramProps {
  chordName: string;
  onClose?: () => void;
  className?: string;
  showStrumButton?: boolean;
  onKeepChange?: (
    originalChord: string,
    newChordName: string,
    newVoicing: ChordVoicing,
    applyToAll: boolean
  ) => void;
  onDeleteChord?: () => void;
  onMoveChord?: () => void;
  existingCustomChords?: Record<string, ChordVoicing>;
}

export const ChordDiagram: React.FC<ChordDiagramProps> = ({
  chordName,
  onClose,
  className = '',
  showStrumButton = true,
  onKeepChange,
  onDeleteChord,
  onMoveChord,
  existingCustomChords,
}) => {
  // Check if there is an existing custom voicing for this chord
  const initialCustomVoicing = existingCustomChords?.[chordName];
  const standardChordData = getGuitarChordData(chordName);
  const initialStandardVoicing = standardChordData?.voicings?.[0];

  const defaultBaseFret = initialCustomVoicing?.baseFret || initialStandardVoicing?.baseFret || 1;
  const defaultFrets = initialCustomVoicing?.frets 
    ? [...initialCustomVoicing.frets] 
    : initialStandardVoicing?.frets 
    ? [...initialStandardVoicing.frets] 
    : [-1, 0, 0, 0, 0, 0];

  // Editable states
  const [frets, setFrets] = useState<number[]>(defaultFrets);
  const [baseFret, setBaseFret] = useState<number>(defaultBaseFret);
  const [isManualNameOverride, setIsManualNameOverride] = useState<boolean>(false);
  const [editedChordName, setEditedChordName] = useState<string>(chordName);
  const [applyToAll, setApplyToAll] = useState<boolean>(false);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeStringPlucked, setActiveStringPlucked] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Detect chord name from current frets & baseFret
  const detected: DetectedChordResult = useMemo(() => {
    return detectChordFromVoicing(frets, baseFret, existingCustomChords, chordName);
  }, [frets, baseFret, existingCustomChords, chordName]);

  // Update edited chord name automatically unless user manually typed an override
  const currentDisplayName = isManualNameOverride ? editedChordName : detected.chordName;

  // SVG Geometry Constants
  const svgWidth = 248;
  const svgHeight = 250;
  const startX = 46;
  const stringSpacing = 28; // 6 strings: x = 46, 74, 102, 130, 158, 186
  const startY = 46;
  const fretCount = 5;
  const fretSpacing = 30; // 5 frets: y = 46, 76, 106, 136, 166, 196
  const gridBottom = startY + fretCount * fretSpacing;
  const gridRight = startX + 5 * stringSpacing;

  const stringX = (idx: number) => startX + idx * stringSpacing;
  const stringGauges = [2.4, 2.0, 1.6, 1.3, 1.0, 0.8];
  const isNut = baseFret === 1;

  // Format tab notation string (e.g. "x02210")
  const tabNotation = frets.map(f => (f < 0 ? 'x' : f)).join('');

  // Handle single string pluck audio
  const handlePluck = (strIdx: number, fret: number) => {
    if (fret < 0) return;
    setActiveStringPlucked(strIdx);
    playGuitarNote(strIdx, fret);
    setTimeout(() => setActiveStringPlucked(null), 300);
  };

  // Strum entire chord
  const handleStrum = () => {
    strumGuitarChord(frets);
  };

  // Click on nut / open indicator area: toggle between open (0) and muted (-1)
  const handleNutClick = (strIdx: number) => {
    setFrets(prev => {
      const next = [...prev];
      if (next[strIdx] === 0) {
        // From open to muted
        next[strIdx] = -1;
      } else {
        // From muted or fretted to open
        next[strIdx] = 0;
        playGuitarNote(strIdx, 0);
      }
      return next;
    });
    setIsDirty(true);
  };

  // Click on a fret cell: toggle dot or set string to fret
  const handleFretCellClick = (strIdx: number, fretNumber: number) => {
    setFrets(prev => {
      const next = [...prev];
      if (next[strIdx] === fretNumber) {
        // If clicking existing fret, toggle it off
        next[strIdx] = isNut ? 0 : -1;
      } else {
        // Place dot on this fret
        next[strIdx] = fretNumber;
        playGuitarNote(strIdx, fretNumber);
      }
      return next;
    });
    setIsDirty(true);
  };

  // Stepper for Base Fret (1 to 15)
  const handleBaseFretChange = (delta: number) => {
    setBaseFret(prev => {
      const newBase = Math.max(1, Math.min(15, prev + delta));
      // Adjust frets if needed so they stay relative or within range
      setFrets(currFrets => {
        return currFrets.map(f => {
          if (f <= 0) return f;
          const adjusted = f + delta;
          return adjusted > 0 ? adjusted : (isNut ? 0 : -1);
        });
      });
      return newBase;
    });
    setIsDirty(true);
  };

  // Reset to initial voicing
  const handleResetVoicing = () => {
    setFrets([...defaultFrets]);
    setBaseFret(defaultBaseFret);
    setEditedChordName(chordName);
    setIsManualNameOverride(false);
    setIsDirty(false);
  };

  // Copy notation
  const handleCopyNotation = () => {
    navigator.clipboard.writeText(`${currentDisplayName}: ${tabNotation}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Keep changes and commit custom chord
  const handleCommitKeepChange = () => {
    if (!onKeepChange) return;

    const newVoicing: ChordVoicing = {
      baseFret,
      frets: [...frets],
      fingers: [0, 0, 0, 0, 0, 0],
    };

    onKeepChange(chordName, currentDisplayName, newVoicing, applyToAll);
  };

  return (
    <div 
      id="guitar-chord-diagram-editor"
      className={`bg-slate-900 border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col items-center max-w-sm w-full mx-auto select-none ${className}`}
    >
      {/* Header Bar */}
      <div className="w-full flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
            <Music className="w-4 h-4" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <input
                id="chord-builder-name-input"
                type="text"
                value={currentDisplayName}
                onChange={(e) => {
                  setEditedChordName(e.target.value);
                  setIsManualNameOverride(true);
                  setIsDirty(true);
                }}
                className="font-extrabold text-xl text-amber-400 tracking-tight bg-slate-950/80 border border-slate-700/80 rounded-lg px-2 py-0.5 focus:border-amber-400 focus:outline-none w-28"
                title="Edit chord name"
              />

              {detected.isAltered ? (
                <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[10px] font-bold shrink-0">
                  Altered (*)
                </span>
              ) : detected.isStandard ? (
                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded text-[10px] font-bold shrink-0">
                  Standard
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-slate-400 font-mono mt-1">
              {detected.notes && detected.notes.length > 0 && (
                <div className="flex items-center gap-1">
                  <span>Notes:</span>
                  <span className="text-slate-200 font-semibold">{detected.notes.join(' • ')}</span>
                </div>
              )}
              {detected.bass && (
                <div className="flex items-center gap-1">
                  <span>Bass:</span>
                  <span className="text-sky-300 font-semibold">{detected.bass}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {onClose && (
          <button 
            id="close-chord-editor-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors text-xs ml-2"
            title="Close"
          >
            ✕
          </button>
        )}
      </div>

      {/* Base Fret Stepper Toolbar */}
      <div className="w-full flex items-center justify-between mt-3 px-1 py-1.5 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs">
        <div className="flex items-center gap-1 text-slate-400">
          <span className="text-[11px] font-medium pl-1">Base Fret:</span>
          <span className="font-mono font-bold text-amber-300 px-1">{baseFret}</span>
          {baseFret === 1 && (
            <span className="text-[10px] text-slate-500">(Nut)</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleBaseFretChange(-1)}
            disabled={baseFret <= 1}
            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 font-bold rounded-md transition-colors"
            title="Decrease base fret"
          >
            -
          </button>
          <button
            type="button"
            onClick={() => handleBaseFretChange(1)}
            disabled={baseFret >= 15}
            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 font-bold rounded-md transition-colors"
            title="Increase base fret"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleResetVoicing}
            className="ml-2 p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-md transition-colors"
            title="Reset to default shape"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Interactive SVG Guitar Fretboard Grid */}
      <div className="relative my-2">
        <svg 
          width={svgWidth} 
          height={svgHeight} 
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="overflow-visible"
        >
          {/* Base Fret Label for higher positions */}
          {!isNut && (
            <text
              x={startX - 14}
              y={startY + 19}
              textAnchor="end"
              className="fill-amber-400 font-mono text-[12px] font-bold select-none"
            >
              {baseFret}fr
            </text>
          )}

          {/* Fret wire lines (horizontal) */}
          {Array.from({ length: fretCount + 1 }).map((_, i) => {
            const y = startY + i * fretSpacing;
            const isNutWire = isNut && i === 0;

            return (
              <line
                key={`fret-${i}`}
                x1={startX}
                y1={y}
                x2={gridRight}
                y2={y}
                className={isNutWire ? "stroke-slate-100" : "stroke-slate-700"}
                strokeWidth={isNutWire ? "5.5" : "1.5"}
                strokeLinecap="round"
              />
            );
          })}

          {/* Strings (vertical) */}
          {Array.from({ length: 6 }).map((_, i) => {
            const x = stringX(i);
            const isPlucked = activeStringPlucked === i;

            return (
              <line
                key={`str-${i}`}
                x1={x}
                y1={startY}
                x2={x}
                y2={gridBottom}
                className={isPlucked ? "stroke-amber-300" : "stroke-slate-400"}
                strokeWidth={stringGauges[i]}
                strokeLinecap="round"
              />
            );
          })}

          {/* Clickable Hit Areas for Fret Cells */}
          {Array.from({ length: 6 }).map((_, strIdx) => {
            return Array.from({ length: fretCount }).map((_, fIdx) => {
              const fretNumber = baseFret + fIdx;
              const x = stringX(strIdx);
              const y = startY + fIdx * fretSpacing;

              return (
                <rect
                  key={`cell-${strIdx}-${fretNumber}`}
                  x={x - stringSpacing / 2}
                  y={y}
                  width={stringSpacing}
                  height={fretSpacing}
                  className="fill-transparent hover:fill-amber-400/10 cursor-pointer"
                  onClick={() => handleFretCellClick(strIdx, fretNumber)}
                >
                  <title>String {STRING_TUNING_NAMES[strIdx]}, Fret {fretNumber} - Click to edit</title>
                </rect>
              );
            });
          })}

          {/* Mute (✕) and Open (○) Symbols above the nut */}
          {frets.map((fret, i) => {
            const x = stringX(i);
            const y = startY - 14;

            if (fret === -1) {
              // Mute: Cross
              return (
                <g 
                  key={`mute-${i}`} 
                  className="cursor-pointer hover:opacity-80"
                  onClick={() => handleNutClick(i)}
                >
                  <circle cx={x} cy={y} r="8" className="fill-transparent" />
                  <line 
                    x1={x - 4} 
                    y1={y - 4} 
                    x2={x + 4} 
                    y2={y + 4} 
                    className="stroke-rose-400" 
                    strokeWidth="2.2" 
                    strokeLinecap="round" 
                  />
                  <line 
                    x1={x + 4} 
                    y1={y - 4} 
                    x2={x - 4} 
                    y2={y + 4} 
                    className="stroke-rose-400" 
                    strokeWidth="2.2" 
                    strokeLinecap="round" 
                  />
                  <title>Muted - Click to toggle Open/Mute</title>
                </g>
              );
            }

            if (fret === 0) {
              // Open: Clean Circle
              return (
                <g
                  key={`open-${i}`}
                  className="cursor-pointer hover:opacity-80"
                  onClick={() => handleNutClick(i)}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r="5.5"
                    className="stroke-slate-200 fill-transparent hover:stroke-amber-300 hover:fill-amber-400/20 transition-all"
                    strokeWidth="2"
                  />
                  <title>Open - Click to toggle Open/Mute</title>
                </g>
              );
            }

            // If fretted on the neck, render blank hit-circle above nut to allow clearing
            return (
              <circle
                key={`nut-clear-${i}`}
                cx={x}
                cy={y}
                r="6"
                className="fill-transparent hover:fill-slate-800 hover:stroke-slate-500 cursor-pointer"
                strokeWidth="1"
                onClick={() => handleNutClick(i)}
              >
                <title>Clear fret and set to Open/Mute</title>
              </circle>
            );
          })}

          {/* Fretted Dots on Neck */}
          {frets.map((fret, strIdx) => {
            if (fret <= 0) return null;

            const relFret = fret - baseFret + 1;
            if (relFret < 1 || relFret > fretCount) return null;

            const x = stringX(strIdx);
            const y = startY + (relFret - 0.5) * fretSpacing;

            return (
              <g 
                key={`dot-${strIdx}`}
                className="cursor-pointer group"
                onClick={() => handleFretCellClick(strIdx, fret)}
              >
                <circle
                  cx={x}
                  cy={y}
                  r="9.5"
                  className="fill-amber-400 group-hover:fill-rose-500 stroke-slate-950 shadow-md transition-all duration-100"
                  strokeWidth="1.5"
                />
                <title>Fret {fret} - Click to remove</title>
              </g>
            );
          })}

          {/* Bottom Labels: Tuning string letters & Note Played */}
          {STRING_TUNING_NAMES.map((strName, i) => {
            const x = stringX(i);
            const fret = frets[i];
            const notePlayed = getNoteOnFret(i, fret);

            return (
              <g key={`label-${i}`}>
                {/* String tuning letter */}
                <text
                  x={x}
                  y={gridBottom + 16}
                  textAnchor="middle"
                  className="fill-slate-400 font-mono text-[10px] font-semibold"
                >
                  {strName}
                </text>
                {/* Note played on string */}
                <text
                  x={x}
                  y={gridBottom + 30}
                  textAnchor="middle"
                  className={`font-mono text-[10px] font-bold ${
                    fret < 0 
                      ? 'fill-rose-400/80' 
                      : fret === 0 
                      ? 'fill-sky-300' 
                      : 'fill-amber-300'
                  }`}
                >
                  {notePlayed || '✕'}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Interactive Controls Bar: Tab chip & Strum */}
      <div className="w-full flex items-center justify-between text-xs text-slate-400 pt-1 pb-2">
        {/* Tab notation chip */}
        <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 font-mono text-[11px]">
          <span className="text-slate-500">Tab:</span>
          <span className="text-amber-300 font-bold">{tabNotation}</span>
          <button
            type="button"
            onClick={handleCopyNotation}
            className="text-slate-400 hover:text-slate-200 transition-colors ml-0.5"
            title="Copy Chord Tab Notation"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>

        {/* Strum button */}
        {showStrumButton && (
          <button
            type="button"
            id="strum-chord-audio-btn"
            onClick={handleStrum}
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-all shadow-sm active:scale-95"
            title="Strum this chord"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Strum</span>
          </button>
        )}
      </div>

      {/* "Keep Change" & "Delete" Section */}
      {onKeepChange && (
        <div className="w-full mt-2 pt-2.5 border-t border-slate-800 flex flex-col gap-2">
          {/* Apply scope checkbox: Always reads "Apply to all [chordName] in song" */}
          <button
            type="button"
            onClick={() => setApplyToAll(!applyToAll)}
            className="flex items-center gap-2 text-xs text-slate-300 hover:text-slate-100 text-left select-none py-1"
          >
            {applyToAll ? (
              <CheckSquare className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Square className="w-4 h-4 text-slate-500 shrink-0" />
            )}
            <span className="text-[11px] font-medium text-slate-200">
              Apply to all [{chordName}] in song
            </span>
          </button>

          {/* Action Buttons: Delete & Keep Change */}
          <div className="flex items-center gap-2 pt-0.5">
            {onDeleteChord && (
              confirmDelete ? (
                <div className="flex items-center gap-1.5 p-1 bg-rose-950/60 border border-rose-800/80 rounded-xl animate-in fade-in">
                  <span className="text-[10px] text-rose-300 font-semibold px-1 whitespace-nowrap">
                    Confirm delete?
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteChord();
                      onClose?.();
                    }}
                    className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-[10px] transition-colors whitespace-nowrap"
                  >
                    Yes, Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg text-[10px] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  id="delete-chord-btn"
                  onClick={() => setConfirmDelete(true)}
                  className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shrink-0"
                  title="Remove this chord from line"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              )
            )}

            {onMoveChord && (
              <button
                type="button"
                id="move-chord-btn"
                onClick={() => {
                  onMoveChord();
                  onClose?.();
                }}
                className="px-3 py-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shrink-0"
                title="Move this chord to a different position in the line"
              >
                <MoveHorizontal className="w-3.5 h-3.5" />
                <span>Move</span>
              </button>
            )}

            <button
              type="button"
              id="keep-chord-change-btn"
              onClick={handleCommitKeepChange}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold rounded-xl shadow-lg transition-all active:scale-[0.98] text-xs uppercase tracking-wider"
            >
              <Save className="w-4 h-4" />
              <span>Keep Change</span>
            </button>
          </div>
        </div>
      )}

      {/* Guide footer */}
      <div className="w-full border-t border-slate-800/80 mt-2.5 pt-1.5 flex justify-between items-center text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <span className="text-rose-400 font-bold">✕</span> Mute &bull;{' '}
          <span className="text-slate-200 font-bold">○</span> Open &bull;{' '}
          <span className="text-amber-400 font-bold">&bull;</span> Tap fret to place/remove
        </span>
      </div>
    </div>
  );
};

/**
 * Compact Mini Chord Diagram for Detailed Mode
 * 20% bigger than original, crisp white background with black lines and border
 */
interface MiniChordDiagramProps {
  chordName: string;
  customVoicing?: ChordVoicing;
  customChords?: Record<string, ChordVoicing>;
  rawChord?: string;
}

export const MiniChordDiagram: React.FC<MiniChordDiagramProps> = ({
  chordName,
  customVoicing,
  customChords,
  rawChord,
}) => {
  const voicing = resolveChordVoicing(chordName, customVoicing, customChords, rawChord);

  if (!voicing || !voicing.frets) {
    return null;
  }

  const baseFret = voicing.baseFret || 1;
  const isNut = baseFret === 1;
  const frets = voicing.frets;

  // 20% larger dimensions: 42x46 (was 34x38)
  const width = 42;
  const height = 46;
  const startX = 8.5;
  const stringSpacing = 5.2; // 6 strings: 8.5 to 34.5
  const startY = 10;
  const fretSpacing = 6.2; // 4 frets displayed: 10 to 34.8
  const fretCount = 4;
  const gridRight = startX + 5 * stringSpacing;
  const gridBottom = startY + fretCount * fretSpacing;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block overflow-visible select-none rounded shadow-xs"
    >
      {/* Crisp White Card Background with subtle border */}
      <rect
        x="0.5"
        y="0.5"
        width={width - 1}
        height={height - 1}
        rx="3.5"
        fill="#ffffff"
        stroke="#cbd5e1"
        strokeWidth="0.8"
      />

      {/* Base fret indication if not nut */}
      {!isNut && (
        <text
          x={startX - 1.8}
          y={startY + 5.5}
          textAnchor="end"
          className="fill-black font-mono text-[6px] font-black"
        >
          {baseFret}
        </text>
      )}

      {/* Frets horizontal lines (Black) */}
      {Array.from({ length: fretCount + 1 }).map((_, f) => {
        const y = startY + f * fretSpacing;
        const isNutWire = isNut && f === 0;

        return (
          <line
            key={`mini-fret-${f}`}
            x1={startX}
            y1={y}
            x2={gridRight}
            y2={y}
            stroke="#000000"
            strokeWidth={isNutWire ? "2.2" : "0.8"}
          />
        );
      })}

      {/* Strings vertical lines (Black) */}
      {Array.from({ length: 6 }).map((_, s) => {
        const x = startX + s * stringSpacing;
        return (
          <line
            key={`mini-str-${s}`}
            x1={x}
            y1={startY}
            x2={x}
            y2={gridBottom}
            stroke="#18181b"
            strokeWidth="0.8"
          />
        );
      })}

      {/* Nut indicators (o / x) */}
      {frets.map((fret, s) => {
        const x = startX + s * stringSpacing;
        const y = startY - 3.2;

        if (fret === -1) {
          // X
          return (
            <text
              key={`mini-nut-${s}`}
              x={x}
              y={y}
              textAnchor="middle"
              className="fill-rose-600 font-extrabold text-[6px]"
            >
              ×
            </text>
          );
        }

        if (fret === 0) {
          // O
          return (
            <circle
              key={`mini-nut-${s}`}
              cx={x}
              cy={y - 1.8}
              r="1.5"
              stroke="#000000"
              strokeWidth="0.8"
              fill="#ffffff"
            />
          );
        }

        return null;
      })}

      {/* Finger Dots (Solid Black) */}
      {frets.map((fret, s) => {
        if (fret <= 0) return null;
        const relFret = fret - baseFret + 1;
        if (relFret < 1 || relFret > fretCount) return null;

        const x = startX + s * stringSpacing;
        const y = startY + (relFret - 0.5) * fretSpacing;

        return (
          <circle
            key={`mini-dot-${s}`}
            cx={x}
            cy={y}
            r="2.1"
            fill="#000000"
            stroke="#000000"
            strokeWidth="0.2"
          />
        );
      })}
    </svg>
  );
};
