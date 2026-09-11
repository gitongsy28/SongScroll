import React, { useLayoutEffect, useRef, useState } from 'react';
import { getGuitarChordData } from '../utils/guitarChords';

interface ChordHintProps {
  chordName: string;
}

/**
 * Compact, lightweight chord hint diagram for performance quick-reference on hover.
 * Styled with crisp white background, black lines, and high-contrast typography.
 */
export const ChordHint: React.FC<ChordHintProps> = ({ chordName }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<'top' | 'bottom'>('top');
  const [shiftX, setShiftX] = useState<number>(0);

  // Smart boundary collision detection: flips below chord if too close to top header,
  // and shifts horizontally if near viewport edges.
  useLayoutEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.top < 65) {
        setPlacement('bottom');
      }
      if (rect.left < 8) {
        setShiftX(8 - rect.left);
      } else if (rect.right > window.innerWidth - 8) {
        setShiftX((window.innerWidth - 8) - rect.right);
      }
    }
  }, []);

  const chordData = getGuitarChordData(chordName);
  const voicing = chordData && chordData.voicings && chordData.voicings.length > 0
    ? chordData.voicings[0]
    : null;

  // Visual layout constants
  const svgWidth = 80;
  const svgHeight = 92;
  const startX = 15;
  const stringSpacing = 10;
  const startY = 24;
  const fretSpacing = 11;
  const fretCount = 5;
  const gridBottom = startY + fretCount * fretSpacing; // 79
  const gridRight = startX + 5 * stringSpacing; // 65

  const baseFret = voicing?.baseFret || 1;
  const isNut = baseFret === 1;

  return (
    <div
      ref={containerRef}
      id={`chord-hint-${chordName}`}
      style={{
        transform: `translateX(calc(-50% + ${shiftX}px))`,
      }}
      className={`absolute z-40 pointer-events-none select-none left-1/2 ${
        placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
      } animate-in fade-in duration-75 drop-shadow-md`}
    >
      <div className="relative bg-white text-black rounded-lg border border-slate-300 p-1 shadow-xl flex flex-col items-center">
        {/* Directional Caret */}
        {placement === 'top' ? (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-r border-b border-slate-300 rotate-45" />
        ) : (
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-l border-t border-slate-300 rotate-45" />
        )}

        {voicing ? (
          <svg
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="overflow-visible block"
          >
            {/* Chord Name Header */}
            <text
              x={svgWidth / 2}
              y="11"
              textAnchor="middle"
              fontWeight="bold"
              fontSize={chordName.length > 5 ? '9' : '10.5'}
              fill="#000000"
              fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            >
              {chordName}
            </text>

            {/* Base Fret Indicator on Left (if starting fret > 1) */}
            {!isNut && (
              <text
                x="8"
                y={startY + 8}
                textAnchor="middle"
                fontWeight="bold"
                fontSize="7.5"
                fill="#000000"
                fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              >
                {baseFret}fr
              </text>
            )}

            {/* Nut Line or Top Fret Line */}
            {isNut ? (
              <rect
                x={startX - 0.5}
                y={startY - 3}
                width={gridRight - startX + 1}
                height="3"
                rx="0.5"
                fill="#000000"
              />
            ) : (
              <line
                x1={startX}
                y1={startY}
                x2={gridRight}
                y2={startY}
                stroke="#000000"
                strokeWidth="1.2"
              />
            )}

            {/* Horizontal Frets */}
            {Array.from({ length: fretCount }).map((_, i) => {
              const y = startY + (i + 1) * fretSpacing;
              return (
                <line
                  key={`fret-${i}`}
                  x1={startX}
                  y1={y}
                  x2={gridRight}
                  y2={y}
                  stroke="#000000"
                  strokeWidth="0.8"
                />
              );
            })}

            {/* Vertical Strings */}
            {Array.from({ length: 6 }).map((_, i) => {
              const x = startX + i * stringSpacing;
              return (
                <line
                  key={`str-${i}`}
                  x1={x}
                  y1={startY}
                  x2={x}
                  y2={gridBottom}
                  stroke="#000000"
                  strokeWidth={i === 0 ? '1.2' : i >= 4 ? '0.7' : '0.9'}
                  strokeLinecap="round"
                />
              );
            })}

            {/* Open (O) and Mute (X) Symbols Above Nut */}
            {voicing.frets.map((fret, i) => {
              const x = startX + i * stringSpacing;
              const y = 17;

              if (fret === -1) {
                // Mute: X
                return (
                  <g key={`mute-${i}`}>
                    <line
                      x1={x - 2.5}
                      y1={y - 2.5}
                      x2={x + 2.5}
                      y2={y + 2.5}
                      stroke="#000000"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                    <line
                      x1={x + 2.5}
                      y1={y - 2.5}
                      x2={x - 2.5}
                      y2={y + 2.5}
                      stroke="#000000"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                  </g>
                );
              }

              if (fret === 0) {
                // Open: O
                return (
                  <circle
                    key={`open-${i}`}
                    cx={x}
                    cy={y}
                    r="2.8"
                    stroke="#000000"
                    strokeWidth="1.1"
                    fill="none"
                  />
                );
              }

              return null;
            })}

            {/* Barre Lines */}
            {voicing.barres && voicing.barres.map((barre, bIdx) => {
              const relFret = barre.fret - baseFret + 1;
              if (relFret < 1 || relFret > fretCount) return null;
              const bY = startY + (relFret - 0.5) * fretSpacing;
              const x1 = startX + Math.min(barre.fromString, barre.toString) * stringSpacing;
              const x2 = startX + Math.max(barre.fromString, barre.toString) * stringSpacing;
              return (
                <g key={`barre-${bIdx}`}>
                  <rect
                    x={x1 - 4}
                    y={bY - 4}
                    width={x2 - x1 + 8}
                    height={8}
                    rx={4}
                    fill="#000000"
                  />
                  <text
                    x={(x1 + x2) / 2}
                    y={bY + 2.3}
                    textAnchor="middle"
                    fontSize="6"
                    fontWeight="bold"
                    fill="#ffffff"
                    fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                  >
                    {barre.finger || 1}
                  </text>
                </g>
              );
            })}

            {/* Fretted Dots & Finger Numbers */}
            {voicing.frets.map((fret, i) => {
              if (fret <= 0) return null;
              const relFret = fret - baseFret + 1;
              if (relFret < 1 || relFret > fretCount) return null;
              const cx = startX + i * stringSpacing;
              const cy = startY + (relFret - 0.5) * fretSpacing;
              const finger = voicing.fingers ? voicing.fingers[i] : 0;

              // If inside a barre at the same fret, the barre pill already covers it
              const isInsideBarre = voicing.barres?.some(
                b => b.fret === fret && i >= Math.min(b.fromString, b.toString) && i <= Math.max(b.fromString, b.toString)
              );

              if (isInsideBarre) return null;

              return (
                <g key={`dot-${i}`}>
                  <circle cx={cx} cy={cy} r="3.7" fill="#000000" />
                  {finger > 0 && (
                    <text
                      x={cx}
                      y={cy + 2.3}
                      textAnchor="middle"
                      fontWeight="bold"
                      fontSize="5.8"
                      fill="#ffffff"
                      fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                    >
                      {finger}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        ) : (
          <div className="w-20 py-2 text-center">
            <span className="font-bold text-xs text-black block">{chordName}</span>
            <span className="text-[9px] text-slate-500 block mt-0.5">Quick Hint</span>
          </div>
        )}
      </div>
    </div>
  );
};
