import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, Check, RotateCcw, RotateCw, Plus, Trash2, Copy, ClipboardPaste, 
  Columns, Music, AlertCircle, ArrowLeft, ArrowRight, ArrowUp, ArrowDown,
  FileSpreadsheet
} from 'lucide-react';
import { TabDiagram } from './TabDiagram';

export interface TabEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newLines: string[], newTitle?: string) => void;
  initialTitle?: string;
  initialLines?: string[];
  instrument?: 'guitar' | 'ukulele' | 'bass';
  measureInsertWidth?: number; // default 20
  maxTotalColumns?: number; // default 120
}

interface SelectionBox {
  measureIdx: number;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

const INSTRUMENT_STRINGS = {
  guitar: ['e', 'B', 'G', 'D', 'A', 'E'],
  ukulele: ['g', 'C', 'E', 'A'],
  bass: ['G', 'D', 'A', 'E'],
};

export const TabEditorModal: React.FC<TabEditorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTitle = '',
  initialLines = [],
  instrument = 'guitar',
  measureInsertWidth = 20,
  maxTotalColumns = 120,
}) => {
  // Title state
  const [title, setTitle] = useState<string>(initialTitle);
  const [activeInstrument, setActiveInstrument] = useState<'guitar' | 'ukulele' | 'bass'>(instrument);

  // String labels (e.g. ['e', 'B', 'G', 'D', 'A', 'E'])
  const [stringLabels, setStringLabels] = useState<string[]>(INSTRUMENT_STRINGS[instrument]);

  // Measures data structure: measures[measureIndex][rowIndex][colIndex]
  const [measures, setMeasures] = useState<string[][][]>([]);

  // Cursor position: active cell
  const [cursor, setCursor] = useState<{ measureIdx: number; rowIdx: number; colIdx: number }>({
    measureIdx: 0,
    rowIdx: 0,
    colIdx: 0,
  });

  // Block selection
  const [selection, setSelection] = useState<SelectionBox | null>(null);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);

  // Mode: INS (Insert column on type) vs OVR (Overwrite cell on type)
  const [isInsertMode, setIsInsertMode] = useState<boolean>(false);

  // Clipboard for block copy/paste: rows x cols matrix
  const [clipboard, setClipboard] = useState<{ rows: number; cols: number; data: string[][] } | null>(null);

  // Toast / error notification
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'info' | 'success' } | null>(null);

  // Undo / Redo history
  const [history, setHistory] = useState<Array<{ measures: string[][][]; title: string; stringLabels: string[] }>>([]);
  const [future, setFuture] = useState<Array<{ measures: string[][][]; title: string; stringLabels: string[] }>>([]);

  const containerRef = useRef<HTMLDivElement>(null);

  const showNotification = useCallback((message: string, type: 'error' | 'info' | 'success' = 'error') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  }, []);

  // Initialize from initialLines or default empty measure
  useEffect(() => {
    if (!isOpen) return;

    setTitle(initialTitle || '');
    setActiveInstrument(instrument);

    const defaultLabels = INSTRUMENT_STRINGS[instrument] || INSTRUMENT_STRINGS.guitar;
    const cleanLines = (initialLines || []).filter((l) => l.trim().length > 0);

    if (cleanLines.length === 0) {
      // Create empty single measure with default width
      setStringLabels(defaultLabels);
      const width = Math.max(8, Math.min(40, measureInsertWidth || 20));
      const initialMeasure: string[][] = defaultLabels.map(() => Array(width).fill('-'));
      setMeasures([initialMeasure]);
      setCursor({ measureIdx: 0, rowIdx: 0, colIdx: 0 });
      setHistory([]);
      setFuture([]);
      return;
    }

    // Parse existing lines
    const parsedLabels: string[] = [];
    const rawMeasuresPerString: string[][] = [];

    for (const line of cleanLines) {
      const match = line.match(/^\s*([A-Za-z0-9#b]{1,3})\s*\|(.*)$/);
      if (match) {
        parsedLabels.push(match[1]);
        const body = match[2];
        const segments = body.split('|');
        if (segments.length > 1 && segments[segments.length - 1].trim() === '') {
          segments.pop();
        }
        rawMeasuresPerString.push(segments);
      } else {
        const segments = line.split('|');
        if (segments.length > 1 && segments[segments.length - 1].trim() === '') {
          segments.pop();
        }
        rawMeasuresPerString.push(segments);
      }
    }

    const finalLabels = parsedLabels.length === rawMeasuresPerString.length && parsedLabels.length > 0
      ? parsedLabels
      : defaultLabels;

    const numStrings = finalLabels.length;
    const maxMeasures = Math.max(
      1,
      ...rawMeasuresPerString.map((s) => s.length)
    );

    const parsedMeasures: string[][][] = [];

    for (let m = 0; m < maxMeasures; m++) {
      let measureWidth = 0;
      for (let s = 0; s < numStrings; s++) {
        const seg = rawMeasuresPerString[s]?.[m] || '';
        if (seg.length > measureWidth) measureWidth = seg.length;
      }
      if (measureWidth === 0) {
        measureWidth = Math.max(8, Math.min(40, measureInsertWidth || 20));
      }

      const measureGrid: string[][] = [];
      for (let s = 0; s < numStrings; s++) {
        const seg = rawMeasuresPerString[s]?.[m] || '';
        const cells = seg.split('');
        while (cells.length < measureWidth) {
          cells.push('-');
        }
        measureGrid.push(cells.slice(0, measureWidth));
      }
      parsedMeasures.push(measureGrid);
    }

    setStringLabels(finalLabels);
    setMeasures(parsedMeasures.length > 0 ? parsedMeasures : [defaultLabels.map(() => Array(20).fill('-'))]);
    setCursor({ measureIdx: 0, rowIdx: 0, colIdx: 0 });
    setHistory([]);
    setFuture([]);
  }, [isOpen, initialLines, initialTitle, instrument, measureInsertWidth]);

  // Save state to undo history
  const pushHistory = useCallback((newMeasures: string[][][], newTitle = title, newLabels = stringLabels) => {
    setHistory((prev) => [
      ...prev.slice(-30),
      {
        measures: JSON.parse(JSON.stringify(measures)),
        title,
        stringLabels: [...stringLabels],
      },
    ]);
    setFuture([]);
    setMeasures(newMeasures);
    setTitle(newTitle);
    setStringLabels(newLabels);
  }, [measures, title, stringLabels]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setFuture((prev) => [
      {
        measures: JSON.parse(JSON.stringify(measures)),
        title,
        stringLabels: [...stringLabels],
      },
      ...prev,
    ]);
    setHistory((prev) => prev.slice(0, prev.length - 1));
    setMeasures(previous.measures);
    setTitle(previous.title);
    setStringLabels(previous.stringLabels);
  }, [history, measures, title, stringLabels]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory((prev) => [
      ...prev,
      {
        measures: JSON.parse(JSON.stringify(measures)),
        title,
        stringLabels: [...stringLabels],
      },
    ]);
    setFuture((prev) => prev.slice(1));
    setMeasures(next.measures);
    setTitle(next.title);
    setStringLabels(next.stringLabels);
  }, [future, measures, title, stringLabels]);

  // Total columns calculation
  const totalColumns = measures.reduce((acc, m) => acc + (m[0]?.length || 0), 0);

  // Normalize selection box bounds
  const getNormalizedSelection = useCallback((sel: SelectionBox | null) => {
    if (!sel) return null;
    return {
      measureIdx: sel.measureIdx,
      minRow: Math.min(sel.startRow, sel.endRow),
      maxRow: Math.max(sel.startRow, sel.endRow),
      minCol: Math.min(sel.startCol, sel.endCol),
      maxCol: Math.max(sel.startCol, sel.endCol),
    };
  }, []);

  // Update a single cell character
  const setCellChar = useCallback((char: string) => {
    if (measures.length === 0) return;
    const { measureIdx, rowIdx, colIdx } = cursor;
    const currentMeasure = measures[measureIdx];
    if (!currentMeasure || !currentMeasure[rowIdx]) return;

    const measureWidth = currentMeasure[rowIdx].length;
    const newMeasures = JSON.parse(JSON.stringify(measures));

    if (isInsertMode) {
      // Insert mode: insert new column at colIdx across all strings
      for (let r = 0; r < newMeasures[measureIdx].length; r++) {
        newMeasures[measureIdx][r].splice(colIdx, 0, r === rowIdx ? char : '-');
      }
      pushHistory(newMeasures);
      setCursor({
        measureIdx,
        rowIdx,
        colIdx: colIdx + 1,
      });
      return;
    }

    // Overwrite mode
    newMeasures[measureIdx][rowIdx][colIdx] = char;

    // Check if at end of measure: auto-insert 1 new column of '-' across all strings
    if (colIdx === measureWidth - 1) {
      if (totalColumns + 1 > maxTotalColumns) {
        showNotification(`Reached maximum limit of ${maxTotalColumns} total columns across all measures.`, 'error');
        pushHistory(newMeasures);
      } else {
        for (let r = 0; r < newMeasures[measureIdx].length; r++) {
          newMeasures[measureIdx][r].push('-');
        }
        pushHistory(newMeasures);
        setCursor({
          measureIdx,
          rowIdx,
          colIdx: colIdx + 1,
        });
      }
    } else {
      pushHistory(newMeasures);
      setCursor({
        measureIdx,
        rowIdx,
        colIdx: colIdx + 1,
      });
    }
  }, [cursor, isInsertMode, measures, pushHistory, showNotification, totalColumns, maxTotalColumns]);

  // Column Insert: Inserts a column on ALL strings at current cursor column in active measure
  const handleInsertColumn = useCallback(() => {
    if (measures.length === 0) return;
    if (totalColumns + 1 > maxTotalColumns) {
      showNotification(`Cannot insert column: Exceeds maximum limit of ${maxTotalColumns} columns.`, 'error');
      return;
    }

    const { measureIdx, colIdx } = cursor;
    const newMeasures = JSON.parse(JSON.stringify(measures));

    for (let r = 0; r < newMeasures[measureIdx].length; r++) {
      newMeasures[measureIdx][r].splice(colIdx, 0, '-');
    }

    pushHistory(newMeasures);
    showNotification('Inserted column across all strings in current measure.', 'success');
  }, [cursor, maxTotalColumns, measures, pushHistory, showNotification, totalColumns]);

  // Column Delete: Deletes column on ALL strings at current cursor column in active measure
  const handleDeleteColumn = useCallback(() => {
    if (measures.length === 0) return;
    const { measureIdx, colIdx } = cursor;
    const currentMeasure = measures[measureIdx];
    if (!currentMeasure || currentMeasure[0].length <= 1) {
      showNotification('Cannot delete: Measure must contain at least 1 column.', 'error');
      return;
    }

    // Check if column has non-dash notes
    const hasNotes = currentMeasure.some((row) => row[colIdx] && row[colIdx] !== '-');
    if (hasNotes) {
      const confirmDelete = window.confirm(
        'The column at cursor position contains notes/chords. Are you sure you want to delete this column across all strings?'
      );
      if (!confirmDelete) return;
    }

    const newMeasures = JSON.parse(JSON.stringify(measures));
    for (let r = 0; r < newMeasures[measureIdx].length; r++) {
      newMeasures[measureIdx][r].splice(colIdx, 1);
    }

    const nextCol = Math.min(colIdx, newMeasures[measureIdx][0].length - 1);
    pushHistory(newMeasures);
    setCursor((prev) => ({ ...prev, colIdx: nextCol }));
    showNotification('Deleted column across all strings.', 'info');
  }, [cursor, measures, pushHistory, showNotification]);

  // Measure Insert: Inserts new blank measure to the right of current active measure
  const handleInsertMeasure = useCallback(() => {
    const insertWidth = Math.max(8, Math.min(40, measureInsertWidth || 20));
    if (totalColumns + insertWidth > maxTotalColumns) {
      showNotification(
        `Cannot insert measure: Adding ${insertWidth} columns would exceed the maximum limit of ${maxTotalColumns} columns.`,
        'error'
      );
      return;
    }

    const { measureIdx } = cursor;
    const numStrings = stringLabels.length;
    const blankMeasure: string[][] = Array.from({ length: numStrings }, () => Array(insertWidth).fill('-'));

    const newMeasures = JSON.parse(JSON.stringify(measures));
    newMeasures.splice(measureIdx + 1, 0, blankMeasure);

    pushHistory(newMeasures);
    setCursor({
      measureIdx: measureIdx + 1,
      rowIdx: cursor.rowIdx,
      colIdx: 0,
    });
    showNotification(`Inserted new blank measure with ${insertWidth} columns.`, 'success');
  }, [cursor, maxTotalColumns, measureInsertWidth, measures, pushHistory, showNotification, stringLabels.length, totalColumns]);

  // Measure Duplicate: Duplicates current active measure to the right
  const handleDuplicateMeasure = useCallback(() => {
    if (measures.length === 0) return;
    const { measureIdx } = cursor;
    const currentMeasure = measures[measureIdx];
    const width = currentMeasure[0]?.length || 20;

    if (totalColumns + width > maxTotalColumns) {
      showNotification(
        `Cannot duplicate measure: Adding ${width} columns would exceed the maximum limit of ${maxTotalColumns} columns.`,
        'error'
      );
      return;
    }

    const newMeasures = JSON.parse(JSON.stringify(measures));
    const duplicatedMeasure = JSON.parse(JSON.stringify(currentMeasure));
    newMeasures.splice(measureIdx + 1, 0, duplicatedMeasure);

    pushHistory(newMeasures);
    setCursor({
      measureIdx: measureIdx + 1,
      rowIdx: cursor.rowIdx,
      colIdx: 0,
    });
    showNotification(`Duplicated measure (${width} columns).`, 'success');
  }, [cursor, maxTotalColumns, measures, pushHistory, showNotification, totalColumns]);

  // Measure Delete: Deletes current active measure
  const handleDeleteMeasure = useCallback(() => {
    if (measures.length <= 1) {
      const resetWidth = Math.max(8, Math.min(40, measureInsertWidth || 20));
      const confirmReset = window.confirm('Reset this measure to blank columns?');
      if (!confirmReset) return;
      const blankMeasure = stringLabels.map(() => Array(resetWidth).fill('-'));
      pushHistory([blankMeasure]);
      setCursor({ measureIdx: 0, rowIdx: 0, colIdx: 0 });
      showNotification('Reset measure to blank.', 'info');
      return;
    }

    const { measureIdx } = cursor;
    const currentMeasure = measures[measureIdx];
    const hasNotes = currentMeasure.some((row) => row.some((c) => c !== '-'));

    if (hasNotes) {
      const confirmDelete = window.confirm(
        `Measure ${measureIdx + 1} contains notes. Are you sure you want to delete this entire measure?`
      );
      if (!confirmDelete) return;
    }

    const newMeasures = JSON.parse(JSON.stringify(measures));
    newMeasures.splice(measureIdx, 1);

    const nextMeasureIdx = Math.min(measureIdx, newMeasures.length - 1);
    const nextCol = Math.min(cursor.colIdx, newMeasures[nextMeasureIdx][0].length - 1);

    pushHistory(newMeasures);
    setCursor({
      measureIdx: nextMeasureIdx,
      rowIdx: Math.min(cursor.rowIdx, stringLabels.length - 1),
      colIdx: nextCol,
    });
    showNotification(`Deleted Measure ${measureIdx + 1}.`, 'info');
  }, [cursor, measureInsertWidth, measures, pushHistory, showNotification, stringLabels]);

  // Block Delete: Clears all cells in selection box to '-'
  const handleBlockDelete = useCallback(() => {
    const sel = getNormalizedSelection(selection);
    if (!sel) {
      // Clear single cell at cursor
      setCellChar('-');
      return;
    }

    const newMeasures = JSON.parse(JSON.stringify(measures));
    for (let r = sel.minRow; r <= sel.maxRow; r++) {
      for (let c = sel.minCol; c <= sel.maxCol; c++) {
        if (newMeasures[sel.measureIdx]?.[r]?.[c] !== undefined) {
          newMeasures[sel.measureIdx][r][c] = '-';
        }
      }
    }

    pushHistory(newMeasures);
    setSelection(null);
    showNotification('Cleared selected block cells to empty dashes.', 'info');
  }, [getNormalizedSelection, measures, pushHistory, selection, setCellChar, showNotification]);

  // Block Copy: Copies 2D matrix of selected cells
  const handleBlockCopy = useCallback(() => {
    const sel = getNormalizedSelection(selection);
    if (!sel) {
      // Copy single cell
      const { measureIdx, rowIdx, colIdx } = cursor;
      const char = measures[measureIdx]?.[rowIdx]?.[colIdx] || '-';
      setClipboard({
        rows: 1,
        cols: 1,
        data: [[char]],
      });
      showNotification('Copied cell to clipboard.', 'success');
      return;
    }

    const rowsCount = sel.maxRow - sel.minRow + 1;
    const colsCount = sel.maxCol - sel.minCol + 1;
    const data: string[][] = [];

    for (let r = sel.minRow; r <= sel.maxRow; r++) {
      const rowData: string[] = [];
      for (let c = sel.minCol; c <= sel.maxCol; c++) {
        rowData.push(measures[sel.measureIdx][r][c] || '-');
      }
      data.push(rowData);
    }

    setClipboard({
      rows: rowsCount,
      cols: colsCount,
      data,
    });
    showNotification(`Copied block (${rowsCount} strings × ${colsCount} cols) to clipboard.`, 'success');
  }, [cursor, getNormalizedSelection, measures, selection, showNotification]);

  // Block Paste: Pastes 2D clipboard block at cursor with strict boundary check
  const handleBlockPaste = useCallback(() => {
    if (!clipboard) {
      showNotification('Clipboard is empty. Select a block and click Copy first.', 'info');
      return;
    }

    const { measureIdx, rowIdx, colIdx } = cursor;
    const currentMeasure = measures[measureIdx];
    if (!currentMeasure) return;

    const measureRows = currentMeasure.length;
    const measureCols = currentMeasure[0]?.length || 0;

    const pasteMaxRow = rowIdx + clipboard.rows;
    const pasteMaxCol = colIdx + clipboard.cols;

    // CRITICAL REQUIREMENT: "Block if paste area exits the grid area."
    if (pasteMaxRow > measureRows || pasteMaxCol > measureCols) {
      showNotification(
        `Cannot paste: Paste area (${clipboard.rows} rows × ${clipboard.cols} cols) extends beyond the current measure boundaries (${measureRows} strings × ${measureCols} cols).`,
        'error'
      );
      return;
    }

    const newMeasures = JSON.parse(JSON.stringify(measures));
    for (let r = 0; r < clipboard.rows; r++) {
      for (let c = 0; c < clipboard.cols; c++) {
        newMeasures[measureIdx][rowIdx + r][colIdx + c] = clipboard.data[r][c];
      }
    }

    pushHistory(newMeasures);
    showNotification(`Pasted block (${clipboard.rows} × ${clipboard.cols}) successfully.`, 'success');
  }, [clipboard, cursor, measures, pushHistory, showNotification]);

  // Keyboard navigation & typing handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Ignore input if user is typing in the Title text input
    if ((e.target as HTMLElement).tagName === 'INPUT') return;

    // Copy / Paste / Undo / Redo shortcuts
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleBlockCopy();
        return;
      }
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        handleBlockPaste();
        return;
      }
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        handleRedo();
        return;
      }
    }

    // Insert key toggle
    if (e.key === 'Insert') {
      e.preventDefault();
      setIsInsertMode((prev) => !prev);
      return;
    }

    // Arrow navigation
    const { measureIdx, rowIdx, colIdx } = cursor;
    const currentMeasure = measures[measureIdx];
    if (!currentMeasure) return;

    const measureWidth = currentMeasure[0]?.length || 0;
    const numStrings = currentMeasure.length;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (colIdx < measureWidth - 1) {
        setCursor({ measureIdx, rowIdx, colIdx: colIdx + 1 });
      } else if (measureIdx < measures.length - 1) {
        setCursor({ measureIdx: measureIdx + 1, rowIdx, colIdx: 0 });
      }
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (colIdx > 0) {
        setCursor({ measureIdx, rowIdx, colIdx: colIdx - 1 });
      } else if (measureIdx > 0) {
        const prevWidth = measures[measureIdx - 1][0]?.length || 0;
        setCursor({ measureIdx: measureIdx - 1, rowIdx, colIdx: Math.max(0, prevWidth - 1) });
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (rowIdx > 0) {
        setCursor({ measureIdx, rowIdx: rowIdx - 1, colIdx });
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (rowIdx < numStrings - 1) {
        setCursor({ measureIdx, rowIdx: rowIdx + 1, colIdx });
      }
      return;
    }

    // Space: write dash and move right
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      setCellChar('-');
      return;
    }

    // Backspace: clear cell to '-' and move left (or delete selection)
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (selection) {
        handleBlockDelete();
      } else {
        const newMeasures = JSON.parse(JSON.stringify(measures));
        newMeasures[measureIdx][rowIdx][colIdx] = '-';
        const nextCol = colIdx > 0 ? colIdx - 1 : colIdx;
        pushHistory(newMeasures);
        setCursor({ measureIdx, rowIdx, colIdx: nextCol });
      }
      return;
    }

    // Delete key: clear cell to '-' (or delete selection)
    if (e.key === 'Delete') {
      e.preventDefault();
      if (selection) {
        handleBlockDelete();
      } else {
        const newMeasures = JSON.parse(JSON.stringify(measures));
        newMeasures[measureIdx][rowIdx][colIdx] = '-';
        pushHistory(newMeasures);
      }
      return;
    }

    // Allowed single character typing
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      setCellChar(e.key);
    }
  }, [cursor, handleBlockCopy, handleBlockDelete, handleBlockPaste, handleRedo, handleUndo, measures, pushHistory, selection, setCellChar]);

  // Convert current measures back to ChordPro TAB lines
  const generateTabLines = useCallback((): string[] => {
    const numStrings = stringLabels.length;
    const lines: string[] = [];

    for (let r = 0; r < numStrings; r++) {
      const label = stringLabels[r] || '-';
      const rowContent = measures.map((m) => (m[r] ? m[r].join('') : '')).join('|');
      lines.push(`${label}|${rowContent}|`);
    }

    return lines;
  }, [measures, stringLabels]);

  // Handle Keep Changes
  const handleKeepChanges = () => {
    const lines = generateTabLines();
    onSave(lines, title.trim());
    onClose();
  };

  // Instrument change handler
  const handleSelectInstrument = (inst: 'guitar' | 'ukulele' | 'bass') => {
    if (inst === activeInstrument) return;
    const newLabels = INSTRUMENT_STRINGS[inst];
    const newRowsCount = newLabels.length;

    const confirmSwitch = window.confirm(
      `Switching to ${inst.toUpperCase()} (${newRowsCount} strings) will adjust the number of string rows. Proceed?`
    );
    if (!confirmSwitch) return;

    const newMeasures = measures.map((m) => {
      const width = m[0]?.length || 20;
      const newGrid: string[][] = [];
      for (let r = 0; r < newRowsCount; r++) {
        newGrid.push(m[r] ? [...m[r]] : Array(width).fill('-'));
      }
      return newGrid;
    });

    setActiveInstrument(inst);
    setStringLabels(newLabels);
    pushHistory(newMeasures, title, newLabels);
    setCursor({
      measureIdx: 0,
      rowIdx: 0,
      colIdx: 0,
    });
  };

  if (!isOpen) return null;

  const currentMeasure = measures[cursor.measureIdx] || [];
  const measureCols = currentMeasure[0]?.length || 0;
  const normSel = getNormalizedSelection(selection);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      ref={containerRef}
    >
      <div 
        id="tab-editor-modal"
        className="bg-slate-900 border border-slate-700 w-full max-w-6xl max-h-[96vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 text-xs sm:text-sm"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/40">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base text-slate-100 flex items-center gap-2">
                <span>TAB Diagram Grid Editor</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 font-mono border border-slate-700">
                  Measure {cursor.measureIdx + 1}/{measures.length}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Spreadsheet-style single-character cell editor. Blank cells are auto-filled with &quot;-&quot;.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              title="Close without saving"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notification Toast */}
        {notification && (
          <div 
            className={`px-4 py-2 text-xs font-semibold flex items-center gap-2 border-b select-none transition-all ${
              notification.type === 'error'
                ? 'bg-rose-950/90 text-rose-200 border-rose-800'
                : notification.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
                : 'bg-sky-950/90 text-sky-200 border-sky-800'
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{notification.message}</span>
            <button 
              onClick={() => setNotification(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Section Config Bar: Title & Instrument */}
        <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <span className="text-slate-400 font-medium shrink-0">TAB Title:</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Intro Riff (with techniques)"
              className="flex-1 px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-sans"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Instrument:</span>
            <div className="flex rounded-lg border border-slate-700 bg-slate-950 p-0.5">
              {(['guitar', 'ukulele', 'bass'] as const).map((inst) => (
                <button
                  key={inst}
                  type="button"
                  onClick={() => handleSelectInstrument(inst)}
                  className={`px-2.5 py-0.5 rounded capitalize font-medium transition-colors ${
                    activeInstrument === inst
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {inst} ({INSTRUMENT_STRINGS[inst].length})
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 text-slate-400 font-mono text-xs">
            <span>
              Col: <strong className="text-amber-400">{cursor.colIdx + 1}</strong>/{measureCols}
            </span>
            <span>
              Total Cols: <strong className="text-slate-200">{totalColumns}</strong>/{maxTotalColumns}
            </span>
          </div>
        </div>

        {/* Main Toolbar: Column & Measure controls, Block actions, INS/OVR toggle */}
        <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 select-none text-xs">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Column Group */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg p-1">
              <span className="text-[11px] font-bold text-slate-400 px-1.5">Column:</span>
              <button
                type="button"
                onClick={handleInsertColumn}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-medium flex items-center gap-1"
                title="Insert a column on all strings at cursor position"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Insert</span>
              </button>
              <button
                type="button"
                onClick={handleDeleteColumn}
                className="px-2 py-1 bg-slate-800 hover:bg-rose-900/40 text-slate-200 hover:text-rose-300 rounded font-medium flex items-center gap-1"
                title="Delete column across all strings at cursor position"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Delete</span>
              </button>
            </div>

            {/* Measure Group */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg p-1">
              <span className="text-[11px] font-bold text-slate-400 px-1.5">Measure:</span>
              <button
                type="button"
                onClick={handleInsertMeasure}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-medium flex items-center gap-1"
                title={`Insert new blank measure (${measureInsertWidth} cols) to right`}
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>Insert</span>
              </button>
              <button
                type="button"
                onClick={handleDuplicateMeasure}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-medium flex items-center gap-1"
                title="Duplicate active measure to the right"
              >
                <Copy className="w-3.5 h-3.5 text-sky-400" />
                <span>Duplicate</span>
              </button>
              <button
                type="button"
                onClick={handleDeleteMeasure}
                className="px-2 py-1 bg-slate-800 hover:bg-rose-900/40 text-slate-200 hover:text-rose-300 rounded font-medium flex items-center gap-1"
                title="Delete active measure"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Delete</span>
              </button>
            </div>

            {/* Block Selection / Clipboard Group */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg p-1">
              <span className="text-[11px] font-bold text-slate-400 px-1.5">Block:</span>
              <button
                type="button"
                onClick={handleBlockCopy}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-medium flex items-center gap-1"
                title="Copy selected block or cell (Ctrl+C)"
              >
                <Copy className="w-3.5 h-3.5 text-sky-400" />
                <span>Copy</span>
              </button>
              <button
                type="button"
                onClick={handleBlockPaste}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-medium flex items-center gap-1"
                title="Paste copied block at cursor (Ctrl+V) - Blocked if exceeds grid"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-emerald-400" />
                <span>Paste</span>
              </button>
              <button
                type="button"
                onClick={handleBlockDelete}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-medium flex items-center gap-1"
                title="Clear selected cells to '-' (Delete/Backspace)"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Insert / Overwrite Mode toggle */}
            <button
              type="button"
              onClick={() => setIsInsertMode(!isInsertMode)}
              className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs border transition-colors ${
                isInsertMode
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'
              }`}
              title="Toggle Insert Mode (INS key). In INS mode, typing inserts a new column across all strings."
            >
              {isInsertMode ? 'MODE: INS' : 'MODE: OVR'}
            </button>

            {/* Undo / Redo buttons */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg p-0.5">
              <button
                type="button"
                onClick={handleUndo}
                disabled={history.length === 0}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:pointer-events-none"
                title="Undo (Ctrl+Z)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={future.length === 0}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:pointer-events-none"
                title="Redo (Ctrl+Y)"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Musical Technique Palette */}
        <div className="px-4 py-1.5 bg-slate-900/90 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto select-none text-xs">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">Quick Insert:</span>
          {['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-', 'h', 'p', 'b', 'r', '/', '\\', '~', 'x', '<', '>'].map((char) => (
            <button
              key={char}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setCellChar(char)}
              className="w-6 h-6 shrink-0 flex items-center justify-center font-mono font-bold rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 border border-slate-700 transition-colors"
              title={`Type ${char}`}
            >
              {char}
            </button>
          ))}
          <span className="text-[10px] text-slate-500 pl-2 shrink-0 hidden md:inline">
            (h: hammer, p: pull, b: bend, r: release, /: slide up, \: slide down, ~: vibrato, x: mute)
          </span>
        </div>

        {/* Interactive Spreadsheet Grid Container */}
        <div className="flex-1 overflow-x-auto overflow-y-auto p-4 bg-slate-950">
          <div className="inline-flex flex-col min-w-full pb-4">
            {/* Measure Column Headers */}
            <div className="flex items-center pl-10 mb-1.5">
              {measures.map((m, mIdx) => {
                const cols = m[0]?.length || 0;
                const isActive = cursor.measureIdx === mIdx;
                return (
                  <div
                    key={mIdx}
                    className={`flex items-center justify-between px-3 py-1 mr-2 rounded-t-lg border-t border-x text-xs font-mono select-none transition-colors ${
                      isActive
                        ? 'bg-slate-900 text-amber-400 border-amber-500/50 font-bold'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-900/50'
                    }`}
                    style={{ minWidth: `${cols * 24 + 16}px` }}
                    onClick={() => setCursor((prev) => ({ ...prev, measureIdx: mIdx, colIdx: 0 }))}
                  >
                    <span>Measure {mIdx + 1}</span>
                    <span className="text-[10px] opacity-70">({cols} cols)</span>
                  </div>
                );
              })}
            </div>

            {/* Grid Rows: one per string */}
            <div className="flex flex-col gap-1 border border-slate-800 p-2 rounded-xl bg-slate-900/90 shadow-inner">
              {stringLabels.map((stringLabel, rIdx) => (
                <div key={rIdx} className="flex items-center">
                  {/* String Tuning Label */}
                  <div className="w-8 h-7 flex items-center justify-center font-mono font-bold text-sm text-amber-400 bg-slate-950 rounded border border-slate-800 shrink-0 mr-1.5 select-none">
                    {stringLabel}
                  </div>

                  {/* Measures Side-by-Side */}
                  <div className="flex items-center">
                    {measures.map((m, mIdx) => {
                      const rowCells = m[rIdx] || [];
                      const isMeasureActive = cursor.measureIdx === mIdx;

                      return (
                        <React.Fragment key={mIdx}>
                          {/* Starting Barline for measure */}
                          <div className="w-1.5 h-7 flex items-center justify-center font-mono font-bold text-slate-500 select-none">
                            |
                          </div>

                          {/* Measure Cells Grid */}
                          <div 
                            className={`flex items-center py-0.5 px-0.5 rounded transition-colors ${
                              isMeasureActive ? 'bg-slate-950/80 ring-1 ring-slate-700' : 'bg-transparent'
                            }`}
                          >
                            {rowCells.map((cellChar, cIdx) => {
                              const isCursor =
                                cursor.measureIdx === mIdx &&
                                cursor.rowIdx === rIdx &&
                                cursor.colIdx === cIdx;

                              const isSelected =
                                normSel &&
                                normSel.measureIdx === mIdx &&
                                rIdx >= normSel.minRow &&
                                rIdx <= normSel.maxRow &&
                                cIdx >= normSel.minCol &&
                                cIdx <= normSel.maxCol;

                              // Character styling: numbers vs techniques vs dash
                              const isNumber = /^[0-9]$/.test(cellChar);
                              const isTechnique = /^[hpbr/\\~xX<>t()]$/.test(cellChar);

                              let cellColor = 'text-slate-500';
                              if (isNumber) cellColor = 'text-amber-300 font-bold';
                              else if (isTechnique) cellColor = 'text-sky-300 font-bold';
                              else if (cellChar !== '-') cellColor = 'text-emerald-300 font-bold';

                              return (
                                <div
                                  key={cIdx}
                                  data-measure={mIdx}
                                  data-row={rIdx}
                                  data-col={cIdx}
                                  onMouseDown={() => {
                                    setIsSelecting(true);
                                    setCursor({ measureIdx: mIdx, rowIdx: rIdx, colIdx: cIdx });
                                    setSelection({
                                      measureIdx: mIdx,
                                      startRow: rIdx,
                                      startCol: cIdx,
                                      endRow: rIdx,
                                      endCol: cIdx,
                                    });
                                  }}
                                  onMouseEnter={() => {
                                    if (isSelecting && selection && selection.measureIdx === mIdx) {
                                      setSelection({
                                        ...selection,
                                        endRow: rIdx,
                                        endCol: cIdx,
                                      });
                                    }
                                  }}
                                  onMouseUp={() => {
                                    setIsSelecting(false);
                                  }}
                                  className={`w-6 h-6 sm:w-6 sm:h-7 flex items-center justify-center font-mono text-xs sm:text-sm select-none cursor-pointer rounded-xs transition-all ${cellColor} ${
                                    isCursor
                                      ? 'bg-amber-400 text-slate-950 font-extrabold ring-2 ring-amber-300 shadow-md scale-105 z-10'
                                      : isSelected
                                      ? 'bg-sky-500/30 text-sky-100 ring-1 ring-sky-400'
                                      : 'hover:bg-slate-800'
                                  }`}
                                  title={`[${stringLabel}] Col ${cIdx + 1}: ${cellChar}`}
                                >
                                  {cellChar}
                                </div>
                              );
                            })}
                          </div>
                        </React.Fragment>
                      );
                    })}

                    {/* Closing Barline */}
                    <div className="w-1.5 h-7 flex items-center justify-center font-mono font-bold text-slate-500 select-none ml-0.5">
                      |
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Real-Time Tab Diagram Stage Preview */}
            <div className="mt-4 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-amber-400" />
                  Stage View Live Preview (High-Contrast Clean Print)
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Standard ChordPro Format ({stringLabels.length} Strings × {measures.length} Measures)
                </span>
              </div>
              <div className="rounded-xl overflow-hidden shadow-md">
                <TabDiagram
                  title={title}
                  lines={generateTabLines()}
                  isAddChordMode={false}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-950 border-t border-slate-800">
          <div className="text-xs text-slate-400 flex items-center gap-3">
            <span className="hidden sm:inline">
              Tip: Use <strong>Arrow keys</strong> to move, <strong>Space</strong> for blank, <strong>Ctrl+C / Ctrl+V</strong> for block copy/paste.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors text-xs sm:text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleKeepChanges}
              className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-bold transition-all shadow-md flex items-center gap-1.5 text-xs sm:text-sm"
            >
              <Check className="w-4 h-4" />
              <span>Keep Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
