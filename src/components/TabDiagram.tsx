import React, { useState, useEffect, useRef } from 'react';

export interface TabDiagramProps {
  title?: string;
  lines: string[];
  className?: string;
  isAddChordMode?: boolean;
}

/**
 * TabDiagram Component
 * Renders ChordPro {start_of_tab} ... {end_of_tab} blocks as a unified,
 * single-section diagram with a pure white background and crisp black lines/text.
 *
 * Key Design & Usability features:
 * 1. Monospaced font with disabled ligatures & calibrated letter-spacing so
 *    dashes (------) have visible breaks between characters for column alignment.
 * 2. No blank lines between string rows (works dynamically for 6-string guitar,
 *    4-string ukulele, bass, etc.).
 * 3. Dynamic width scaling: scales font-size proportionally to container width
 *    to fit max width (number of dashes) while preserving readability.
 * 4. High-contrast white background and black text matching Tab Sample specification.
 * 5. Single combined section in both play mode and Chord Edit (+ Chord) mode.
 *    Chord Add/Move edit is cleanly disabled for TAB sections.
 */
export const TabDiagram: React.FC<TabDiagramProps> = ({ 
  title, 
  lines, 
  className = '', 
  isAddChordMode = false 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Clean lines: strip empty or whitespace-only lines so string lines are completely contiguous
  const cleanLines = lines.filter((l) => l.trim().length > 0);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateWidth();
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  if (cleanLines.length === 0 && !title) return null;

  // Find maximum characters per line in this tab section
  const maxLineLength = Math.max(...cleanLines.map((l) => l.length), 32);

  // Character width ratio in Consolas/monospace with ~0.04em letter-spacing is roughly 0.615
  // Calculate optimal font size so all dashes fit within available width if possible
  let computedFontSize = 13;
  if (containerWidth > 0) {
    // Inner padding is ~28px total (14px on each side)
    const availableWidth = Math.max(containerWidth - 28, 180);
    // Ideal font size to fit all characters in available width
    const idealFontSize = availableWidth / (maxLineLength * 0.615);
    // Clamp font size between 9px (mobile readable floor) and 14px (desktop comfortable max)
    computedFontSize = Math.max(9, Math.min(14, Math.floor(idealFontSize * 10) / 10));
  }

  return (
    <div
      ref={containerRef}
      className={`tab-diagram-container my-3 p-3.5 sm:p-4 bg-white text-black rounded-xl border border-slate-300 shadow-sm max-w-full overflow-x-auto select-all ${
        isAddChordMode ? 'ring-2 ring-amber-400/80 shadow-md' : ''
      } ${className}`}
      style={{
        backgroundColor: '#ffffff',
        color: '#000000',
      }}
      onClick={(e) => {
        if (isAddChordMode) {
          e.stopPropagation();
        }
      }}
    >
      {/* In Add/Move Chord mode: clear combined section banner and disabled notice */}
      {isAddChordMode && (
        <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 mb-2 border-b border-slate-200 text-xs font-sans select-none">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
            <span>TAB Combined Section (All strings unified)</span>
          </div>
          <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
            Chord Add/Move edit disabled for TAB
          </span>
        </div>
      )}

      {/* Tab Section Header Title */}
      {title && (
        <div className="font-bold text-black text-sm sm:text-base mb-1.5 tracking-tight font-sans select-all leading-tight">
          {title}
        </div>
      )}

      {/* Tab Strings Block */}
      <pre
        className="tab-diagram-pre text-black whitespace-pre m-0 p-0 font-medium select-all"
        style={{
          fontFamily: 'Consolas, "Liberation Mono", Menlo, Monaco, "Courier New", monospace',
          fontVariantLigatures: 'none',
          fontFeatureSettings: '"liga" 0, "calt" 0, "dlig" 0',
          fontSize: `${computedFontSize}px`,
          lineHeight: '1.26',
          letterSpacing: '0.04em',
          color: '#000000',
        }}
      >
        {cleanLines.join('\n')}
      </pre>
    </div>
  );
};
