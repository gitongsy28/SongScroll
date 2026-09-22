import React, { useState, useEffect, useRef } from 'react';

export interface TabDiagramProps {
  title?: string;
  lines: string[];
  className?: string;
  isAddChordMode?: boolean;
  onEditTab?: () => void;
  tabWrapMode?: 'fit' | 'wrap';
}

/**
 * TabDiagram Component
 * Renders ChordPro {start_of_tab} ... {end_of_tab} blocks as a unified,
 * single-section diagram with a pure white background and crisp black lines/text.
 *
 * Supports both:
 * - 'fit': Proportional auto-scaling to fit the full line width
 * - 'wrap': Measure wrapping into multi-row string systems when wide
 */
export const TabDiagram: React.FC<TabDiagramProps> = ({ 
  title, 
  lines, 
  className = '', 
  isAddChordMode = false,
  onEditTab,
  tabWrapMode = 'fit',
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

  // Helper to parse line into [stringLabel, measureContents[]]
  // e.g. "e|-----|-----|" -> label: "e", measures: ["-----", "-----"]
  const parsedMeasuresByLine = cleanLines.map((line) => {
    const pipeIdx = line.indexOf('|');
    if (pipeIdx === -1) return { label: '', measures: [line] };
    const label = line.slice(0, pipeIdx);
    const rest = line.slice(pipeIdx + 1);
    // split by '|' while ignoring trailing empty split
    const parts = rest.split('|');
    if (parts.length > 1 && parts[parts.length - 1] === '') {
      parts.pop();
    }
    return { label, measures: parts };
  });

  const numMeasures = parsedMeasuresByLine[0]?.measures.length || 1;
  const canWrap = tabWrapMode === 'wrap' && numMeasures > 1 && parsedMeasuresByLine.every(p => p.measures.length === numMeasures);

  // If wrapping is enabled, group measures so that each group fits within container
  let wrappedGroups: string[][] = [];
  if (canWrap) {
    // For each measure index m, build the block of strings
    // e.g. measure m = lines with `label|measures[m]|`
    for (let m = 0; m < numMeasures; m++) {
      const measureLines = parsedMeasuresByLine.map((p) => `${p.label}|${p.measures[m]}|`);
      wrappedGroups.push(measureLines);
    }
  }

  // Find maximum characters per line in this tab section
  const maxLineLength = canWrap 
    ? Math.max(...wrappedGroups.flatMap(g => g.map(l => l.length)), 24)
    : Math.max(...cleanLines.map((l) => l.length), 32);

  // Character width ratio in Consolas/monospace with ~0.04em letter-spacing is roughly 0.615
  let computedFontSize = 13;
  if (containerWidth > 0) {
    const availableWidth = Math.max(containerWidth - 20, 180);
    const idealFontSize = availableWidth / (maxLineLength * 0.615);
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
      {canWrap ? (
        <div className="space-y-2">
          {wrappedGroups.map((group, gIdx) => (
            <div key={gIdx} className="overflow-x-auto">
              {numMeasures > 1 && (
                <div className="text-[10px] font-sans font-semibold text-slate-500 mb-0.5">
                  Measure {gIdx + 1}
                </div>
              )}
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
                {group.join('\n')}
              </pre>
            </div>
          ))}
        </div>
      ) : (
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
      )}
    </div>
  );
};
