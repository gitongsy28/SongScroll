import React, { useState, useEffect, useRef } from 'react';

export interface TabDiagramProps {
  title?: string;
  lines: string[];
  className?: string;
  isAddChordMode?: boolean;
  onEditTab?: () => void;
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
 * 5. Compact vertical margins and padding to maximize song view area.
 * 6. Interactive TAB Editor entry point in Add/Move Chord (+ Chord) mode.
 */
export const TabDiagram: React.FC<TabDiagramProps> = ({ 
  title, 
  lines, 
  className = '', 
  isAddChordMode = false,
  onEditTab,
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
    // Inner padding is ~20px total (10px on each side)
    const availableWidth = Math.max(containerWidth - 20, 180);
    // Ideal font size to fit all characters in available width
    const idealFontSize = availableWidth / (maxLineLength * 0.615);
    // Clamp font size between 9px (mobile readable floor) and 13.5px (desktop comfortable max)
    computedFontSize = Math.max(9, Math.min(13.5, Math.floor(idealFontSize * 10) / 10));
  }

  return (
    <div
      ref={containerRef}
      className={`tab-diagram-container my-1.5 sm:my-2 p-2 sm:p-2.5 bg-white text-black rounded-lg border border-slate-300 shadow-xs max-w-full overflow-x-auto select-all ${
        isAddChordMode ? 'ring-2 ring-amber-400 shadow-md cursor-pointer hover:ring-amber-500 transition-all' : ''
      } ${className}`}
      style={{
        backgroundColor: '#ffffff',
        color: '#000000',
      }}
      onClick={(e) => {
        if (isAddChordMode) {
          e.stopPropagation();
          if (onEditTab) {
            onEditTab();
          }
        }
      }}
      title={isAddChordMode ? 'Click to open TAB Editor' : undefined}
    >
      {/* In Add/Move Chord mode: clear combined section banner and edit button */}
      {isAddChordMode && (
        <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1 mb-1.5 border-b border-slate-200 text-xs font-sans select-none">
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block animate-pulse" />
            <span className="text-[11px] sm:text-xs">TAB Section</span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onEditTab) onEditTab();
            }}
            className="text-[11px] font-bold text-amber-950 bg-amber-300 hover:bg-amber-400 active:bg-amber-500 px-2.5 py-0.5 rounded shadow-xs border border-amber-400 transition-colors flex items-center gap-1"
          >
            <span>✏️ Edit TAB</span>
          </button>
        </div>
      )}

      {/* Tab Section Header Title */}
      {title && (
        <div className="font-bold text-black text-xs sm:text-sm mb-1 tracking-tight font-sans select-all leading-tight">
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
          lineHeight: '1.20',
          letterSpacing: '0.04em',
          color: '#000000',
        }}
      >
        {cleanLines.join('\n')}
      </pre>
    </div>
  );
};
