import React, { useState } from 'react';
import { 
  Volume2, 
  ChevronLeft, 
  ChevronRight, 
  Copy, 
  Check, 
  Music, 
  Sparkles,
  Info
} from 'lucide-react';
import { 
  ChordVoicing, 
  getGuitarChordData, 
  getNoteOnFret, 
  playGuitarNote, 
  STRING_TUNING_NAMES, 
  strumGuitarChord 
} from '../utils/guitarChords';

interface ChordDiagramProps {
  chordName: string;
  onClose?: () => void;
  className?: string;
  showStrumButton?: boolean;
}

export const ChordDiagram: React.FC<ChordDiagramProps> = ({
  chordName,
  onClose,
  className = '',
  showStrumButton = true,
}) => {
  const [voicingIndex, setVoicingIndex] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeStringPlucked, setActiveStringPlucked] = useState<number | null>(null);

  const chordData = getGuitarChordData(chordName);

  if (!chordData || chordData.voicings.length === 0) {
    return (
      <div className={`p-6 text-center text-slate-300 bg-slate-900 rounded-2xl border border-slate-800 ${className}`}>
        <p className="font-bold text-base text-slate-100 mb-1">{chordName}</p>
        <p className="text-xs text-slate-400">Graphical chord diagram unavailable for this custom voicing.</p>
      </div>
    );
  }

  // Safe bounds for voicing
  const currentVoicingIdx = Math.min(voicingIndex, chordData.voicings.length - 1);
  const voicing: ChordVoicing = chordData.voicings[currentVoicingIdx];

  // SVG Geometry Constants
  const svgWidth = 240;
  const svgHeight = 252;
  const startX = 46;
  const stringSpacing = 28; // 6 strings: x = 46, 74, 102, 130, 158, 186
  const startY = 46;
  const fretCount = 5;
  const fretSpacing = 30; // 5 frets: y = 46, 76, 106, 136, 166, 196
  const gridBottom = startY + fretCount * fretSpacing; // 196
  const gridRight = startX + 5 * stringSpacing; // 186

  // String x-coordinates
  const stringX = (idx: number) => startX + idx * stringSpacing;

  // String line thicknesses for physical gauge realism
  const stringGauges = [2.4, 2.0, 1.6, 1.3, 1.0, 0.8];

  // Calculate base fret
  const baseFret = voicing.baseFret || 1;
  const isNut = baseFret === 1;

  // Format tab notation string (e.g. "x02210")
  const tabNotation = voicing.frets.map(f => (f < 0 ? 'x' : f)).join('');

  // Handle copy notation
  const handleCopyNotation = () => {
    navigator.clipboard.writeText(`${chordName}: ${tabNotation}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Pluck a specific string on click
  const handlePluck = (strIdx: number, fret: number) => {
    if (fret < 0) return;
    setActiveStringPlucked(strIdx);
    playGuitarNote(strIdx, fret);
    setTimeout(() => setActiveStringPlucked(null), 300);
  };

  // Strum entire chord
  const handleStrum = () => {
    strumGuitarChord(voicing.frets);
  };

  return (
    <div 
      id="guitar-chord-diagram-card"
      className={`bg-slate-900 border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col items-center max-w-sm w-full mx-auto select-none ${className}`}
    >
      {/* Header Bar */}
      <div className="w-full flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Music className="w-4 h-4" />
          </span>
          <div>
            <div className="flex items-baseline gap-2">
              <h3 className="font-extrabold text-xl text-slate-100 tracking-tight">{chordData.chord}</h3>
              <span className="text-xs text-amber-400/90 font-medium">{chordData.name}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400 font-mono">
              {chordData.notes && (
                <div className="flex items-center gap-1">
                  <span>Notes:</span>
                  <span className="text-slate-200 font-semibold">{chordData.notes.join(' • ')}</span>
                </div>
              )}
              {chordData.intervals && (
                <div className="flex items-center gap-1">
                  <span>Formula:</span>
                  <span className="text-amber-300 font-semibold">{chordData.intervals.join(' • ')}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {onClose && (
          <button 
            id="close-chord-popup-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors text-xs"
            title="Close"
          >
            ✕
          </button>
        )}
      </div>

      {/* Voicing / Position Navigation if multiple positions exist */}
      {chordData.voicings.length > 1 && (
        <div className="w-full flex items-center justify-between mt-2.5 px-1 text-xs">
          <span className="text-slate-400 font-medium text-[11px]">
            {voicing.name || `Position ${currentVoicingIdx + 1}`}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentVoicingIdx === 0}
              onClick={() => setVoicingIndex(prev => Math.max(0, prev - 1))}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 transition-colors"
              title="Previous Voicing"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-amber-300 font-semibold px-1">
              {currentVoicingIdx + 1} / {chordData.voicings.length}
            </span>
            <button
              type="button"
              disabled={currentVoicingIdx >= chordData.voicings.length - 1}
              onClick={() => setVoicingIndex(prev => Math.min(chordData.voicings.length - 1, prev + 1))}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 transition-colors"
              title="Next Voicing"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Graphical SVG Fretboard */}
      <div className="relative my-2 flex justify-center bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 shadow-inner">
        <svg 
          width={svgWidth} 
          height={svgHeight} 
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="overflow-visible"
        >
          {/* Base Fret Indicator (if fret > 1) */}
          {!isNut && (
            <g transform={`translate(${startX - 26}, ${startY + 15})`}>
              <rect 
                x="-1" 
                y="-11" 
                width="24" 
                height="19" 
                rx="4" 
                className="fill-amber-500/10 stroke-amber-500/40" 
                strokeWidth="1"
              />
              <text 
                x="11" 
                y="3" 
                textAnchor="middle" 
                className="fill-amber-300 font-bold text-[11px] font-mono"
              >
                {baseFret}fr
              </text>
            </g>
          )}

          {/* Frets (Horizontal Lines) */}
          {Array.from({ length: fretCount + 1 }).map((_, i) => {
            const y = startY + i * fretSpacing;
            const isNutLine = isNut && i === 0;

            if (isNutLine) {
              // Thick white nut at the top of the guitar neck
              return (
                <rect 
                  key={`nut-${i}`}
                  x={startX - 1}
                  y={startY - 6}
                  width={gridRight - startX + 2}
                  height={6}
                  rx="1.5"
                  className="fill-slate-200 stroke-slate-400"
                  strokeWidth="1"
                />
              );
            }

            return (
              <line
                key={`fret-${i}`}
                x1={startX}
                y1={y}
                x2={gridRight}
                y2={y}
                className="stroke-slate-600"
                strokeWidth={i === 0 ? "1.8" : "1.2"}
              />
            );
          })}

          {/* Strings (Vertical Lines) */}
          {STRING_TUNING_NAMES.map((_, i) => {
            const x = stringX(i);
            const isPlucked = activeStringPlucked === i;
            return (
              <line
                key={`string-${i}`}
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

          {/* Mute (✕) and Open (○) Symbols above the nut */}
          {voicing.frets.map((fret, i) => {
            const x = stringX(i);
            const y = startY - 14;

            if (fret === -1) {
              // Mute: Red/Rose Cross
              return (
                <g key={`mute-${i}`} className="cursor-not-allowed">
                  <line 
                    x1={x - 4} 
                    y1={y - 4} 
                    x2={x + 4} 
                    y2={y + 4} 
                    className="stroke-rose-400" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                  />
                  <line 
                    x1={x + 4} 
                    y1={y - 4} 
                    x2={x - 4} 
                    y2={y + 4} 
                    className="stroke-rose-400" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                  />
                </g>
              );
            }

            if (fret === 0) {
              // Open: Clean Circle
              return (
                <circle
                  key={`open-${i}`}
                  cx={x}
                  cy={y}
                  r="5"
                  className="stroke-slate-200 fill-transparent cursor-pointer hover:stroke-amber-300 hover:fill-amber-400/20 transition-all"
                  strokeWidth="1.8"
                  onClick={() => handlePluck(i, 0)}
                >
                  <title>String {STRING_TUNING_NAMES[i]} (Open) - Click to pluck</title>
                </circle>
              );
            }

            return null;
          })}

          {/* Barre Chords Rendering (e.g. index finger across multiple strings) */}
          {voicing.barres && voicing.barres.map((barre, bIdx) => {
            const relFret = barre.fret - baseFret + 1;
            if (relFret < 1 || relFret > fretCount) return null;

            const y = startY + (relFret - 0.5) * fretSpacing;
            const x1 = stringX(barre.fromString);
            const x2 = stringX(barre.toString);

            return (
              <g key={`barre-${bIdx}`}>
                <rect
                  x={Math.min(x1, x2) - 8}
                  y={y - 8}
                  width={Math.abs(x2 - x1) + 16}
                  height={16}
                  rx="8"
                  className="fill-amber-500/90 shadow-md cursor-pointer hover:fill-amber-400 transition-colors"
                />
                {/* Finger indicator on barre */}
                <text
                  x={(x1 + x2) / 2}
                  y={y + 3.5}
                  textAnchor="middle"
                  className="fill-slate-950 font-bold text-[11px] select-none pointer-events-none"
                >
                  {barre.finger || 1}
                </text>
              </g>
            );
          })}

          {/* Fretted Dots & Finger Numbers */}
          {voicing.frets.map((fret, strIdx) => {
            if (fret <= 0) return null; // Handled as open or muted

            const relFret = fret - baseFret + 1;
            if (relFret < 1 || relFret > fretCount) return null;

            const x = stringX(strIdx);
            const y = startY + (relFret - 0.5) * fretSpacing;
            const finger = voicing.fingers ? voicing.fingers[strIdx] : 0;

            // If string is part of a barre and not the root or distinct top, barre rect covers it
            const isInsideBarre = voicing.barres?.some(
              b => b.fret === fret && strIdx > b.fromString && strIdx < b.toString
            );

            if (isInsideBarre) {
              return null;
            }

            return (
              <g 
                key={`dot-${strIdx}`}
                className="cursor-pointer group"
                onClick={() => handlePluck(strIdx, fret)}
              >
                <circle
                  cx={x}
                  cy={y}
                  r="9"
                  className="fill-amber-400 group-hover:fill-amber-300 stroke-slate-950 shadow-md transition-transform duration-100 group-hover:scale-110"
                  strokeWidth="1.5"
                />
                {finger > 0 && (
                  <text
                    x={x}
                    y={y + 3.5}
                    textAnchor="middle"
                    className="fill-slate-950 font-black text-[10px] select-none pointer-events-none"
                  >
                    {finger}
                  </text>
                )}
                <title>Fret {fret} (Finger {finger || 'any'}) - Click to pluck</title>
              </g>
            );
          })}

          {/* Bottom Labels: Tuning string letters */}
          {STRING_TUNING_NAMES.map((strName, i) => {
            const x = stringX(i);
            const fret = voicing.frets[i];
            const notePlayed = getNoteOnFret(i, fret);

            return (
              <g key={`label-${i}`}>
                {/* String name */}
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

      {/* Interactive Controls & Legend */}
      <div className="w-full flex items-center justify-between text-xs text-slate-400 pt-1">
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

      {/* Subtle guide footer */}
      <div className="w-full border-t border-slate-800/80 mt-3 pt-2 flex justify-between items-center text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <span className="text-rose-400 font-bold">✕</span> Mute &bull;{' '}
          <span className="text-slate-200 font-bold">○</span> Open &bull;{' '}
          <span className="text-amber-400 font-bold">1-4</span> Finger
        </span>
        <span className="text-slate-400 font-medium">Click string to pluck</span>
      </div>
    </div>
  );
};
