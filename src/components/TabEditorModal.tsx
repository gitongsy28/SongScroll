import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, Check, RotateCcw, RotateCw, Plus, Trash2, Copy, ClipboardPaste, 
  Music, AlertCircle, FileSpreadsheet
} from 'lucide-react';
import { TabDiagram } from './TabDiagram';
import { getGuitarChordData } from '../utils/guitarChords';

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

// Common ukulele chord voicings [g, C, E, A]
const UKULELE_CHORDS: Record<string, number[]> = {
  'C': [0, 0, 0, 3],
  'G': [0, 2, 3, 2],
  'Am': [2, 0, 0, 0],
  'F': [2, 0, 1, 0],
  'Em': [0, 4, 3, 2],
  'Dm': [2, 2, 1, 0],
  'D': [2, 2, 2, 0],
  'A': [2, 1, 0, 0],
  'E': [4, 4, 4, 2],
  'Bm': [4, 2, 2, 2],
  'G7': [0, 2, 1, 2],
  'C7': [0, 0, 0, 1],
  'D7': [2, 2, 2, 3],
  'E7': [1, 2, 0, 2],
  'A7': [0, 1, 0, 0],
  'B7': [2, 3, 2, 2],
};

// Technique buttons with explicit hover hint labels requested by user
const TECHNIQUE_BUTTONS = [
  { label: 'h', hint: 'h = hammer-on', char: 'h' },
  { label: 'p', hint: 'p = pull-off', char: 'p' },
  { label: 'b', hint: 'b = bend', char: 'b' },
  { label: 'r', hint: 'r = release', char: 'r' },
  { label: '/', hint: '/ = slide up', char: '/' },
  { label: '\\', hint: '\\ = slide down', char: '\\' },
  { label: '~~~', hint: '~~~ = vibrato', char: '~' },
  { label: 't12', hint: 't12 = tap (if needed)', char: 't' },
  { label: '<>7', hint: '<>7 = natural harmonic', char: '<' },
  { label: 'x', hint: 'x = muted note', char: 'x' },
];

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

  // Insert Chord Modal State
  const [showInsChordModal, setShowInsChordModal] = useState<boolean>(false);
  const [insChordInput, setInsChordInput] = useState<string>('Am');
  const [insChordError, setInsChordError] = useState<string | null>(null);

  // Undo / Redo history
  const [history, setHistory] = useState<Array<{ measures: string[][][]; title: string; stringLabels: string[] }>>([]);
  const [future, setFuture] = useState<Array<{ measures: string[][][]; title: string; stringLabels: string[] }>>([]);

  const containerRef = useRef<HTMLDivElement>(null);

  const showNotification = useCallback((message: string, type: 'error' | 'info' | 'success' = 'error') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  }, []);

  // Initialize from initialLines or default empty measure
  useEffect(() => {
    if (!isOpen) return;

    setTitle(initialTitle || '');
    setActiveInstrument(instrument);

    const defaultLabels = INSTRUMENT_STRINGS[instrument] || INSTRUMENT_STRINGS.guitar;
    const cleanLines = (initialLines || []).filter((l) => l.trim().length > 0);

    if (cleanLines.length === 0) {
      setStringLabels(defaultLabels);
      const width = Math.max(8, Math.min(40, measureInsertWidth || 20));
      const initialMeasure: string[][] = defaultLabels.map(() => Array(width).fill('-'));
      setMeasures([initialMeasure]);
      setCursor({ measureIdx: 0, rowIdx: 0, colIdx: 0 });
      setHistory([]);
      setFuture([]);
      return;
    }

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
        rawMeasuresPerString.push(segments.map((seg) => seg.replace(/\r/g, '')));
      } else {
        const parts = line.split('|');
        if (parts.length >= 2) {
          parsedLabels.push(parts[0].trim() || '-');
          const rest = parts.slice(1);
          if (rest.length > 1 && rest[rest.length - 1].trim() === '') {
            rest.pop();
          }
          rawMeasuresPerString.push(rest.map((seg) => seg.replace(/\r/g, '')));
        }
      }
    }

    if (rawMeasuresPerString.length === 0) {
      setStringLabels(defaultLabels);
      const width = Math.max(8, Math.min(40, measureInsertWidth || 20));
      const initialMeasure: string[][] = defaultLabels.map(() => Array(width).fill('-'));
      setMeasures([initialMeasure]);
      setCursor({ measureIdx: 0, rowIdx: 0, colIdx: 0 });
      setHistory([]);
      setFuture([]);
      return;
    }

    const numStrings = rawMeasuresPerString.length;
    const numMeasures = Math.max(...rawMeasuresPerString.map((arr) => arr.length), 1);
    const constructedMeasures: string[][][] = [];

    for (let m = 0; m < numMeasures; m++) {
      let maxColsInMeasure = 0;
      for (let s = 0; s < numStrings; s++) {
        const seg = rawMeasuresPerString[s]?.[m] || '';
        if (seg.length > maxColsInMeasure) {
          maxColsInMeasure = seg.length;
        }
      }
      if (maxColsInMeasure === 0) maxColsInMeasure = 20;

      const measureGrid: string[][] = [];
      for (let s = 0; s < numStrings; s++) {
        const seg = rawMeasuresPerString[s]?.[m] || '';
        const rowChars = seg.split('');
        while (rowChars.length < maxColsInMeasure) {
          rowChars.push('-');
        }
        measureGrid.push(rowChars);
      }
      constructedMeasures.push(measureGrid);
    }

    setStringLabels(parsedLabels.length === numStrings ? parsedLabels : defaultLabels);
    setMeasures(constructedMeasures);
    setCursor({ measureIdx: 0, rowIdx: 0, colIdx: 0 });
    setHistory([]);
    setFuture([]);
  }, [isOpen, initialLines, initialTitle, instrument, measureInsertWidth]);

  // History management
  const pushHistory = useCallback(
    (newMeasures: string[][][], newTitle = title, newLabels = stringLabels) => {
      setHistory((prev) => [
        ...prev,
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
    },
    [measures, title, stringLabels]
  );

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

    if (colIdx === measureWidth - 1) {
      if (totalColumns + 1 > maxTotalColumns) {
        showNotification(`Reached maximum limit of ${maxTotalColumns} total columns.`, 'error');
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
    showNotification('Inserted column across all strings.', 'success');
  }, [cursor, maxTotalColumns, measures, pushHistory, showNotification, totalColumns]);

  // Column Delete: Removes column(s) across all strings and shifts cells to the left
  // (No confirmation prompt, per user instructions)
  const handleDeleteColumn = useCallback(() => {
    if (measures.length === 0) return;
    const sel = getNormalizedSelection(selection);
    const newMeasures = JSON.parse(JSON.stringify(measures));

    if (sel) {
      const deleteCount = sel.maxCol - sel.minCol + 1;
      for (let r = 0; r < newMeasures[sel.measureIdx].length; r++) {
        newMeasures[sel.measureIdx][r].splice(sel.minCol, deleteCount);
        if (newMeasures[sel.measureIdx][r].length === 0) {
          newMeasures[sel.measureIdx][r].push('-');
        }
      }
      const nextCol = Math.min(sel.minCol, newMeasures[sel.measureIdx][0].length - 1);
      pushHistory(newMeasures);
      setSelection(null);
      setCursor({ measureIdx: sel.measureIdx, rowIdx: sel.minRow, colIdx: nextCol });
      showNotification(`Deleted ${deleteCount} column(s) and shifted left.`, 'info');
      return;
    }

    const { measureIdx, colIdx } = cursor;
    const currentMeasure = measures[measureIdx];
    if (!currentMeasure || currentMeasure[0].length <= 1) {
      // Clear single column to '-' if only 1 remains
      for (let r = 0; r < newMeasures[measureIdx].length; r++) {
        newMeasures[measureIdx][r][0] = '-';
      }
      pushHistory(newMeasures);
      showNotification('Cleared measure column.', 'info');
      return;
    }

    for (let r = 0; r < newMeasures[measureIdx].length; r++) {
      newMeasures[measureIdx][r].splice(colIdx, 1);
      if (newMeasures[measureIdx][r].length === 0) {
        newMeasures[measureIdx][r].push('-');
      }
    }

    const nextCol = Math.min(colIdx, newMeasures[measureIdx][0].length - 1);
    pushHistory(newMeasures);
    setCursor((prev) => ({ ...prev, colIdx: nextCol }));
    showNotification('Deleted column and shifted left.', 'info');
  }, [cursor, getNormalizedSelection, measures, pushHistory, selection, showNotification]);

  // Measure Insert: Inserts new blank measure to the right of current active measure
  const handleInsertMeasure = useCallback(() => {
    const insertWidth = Math.max(8, Math.min(40, measureInsertWidth || 20));
    if (totalColumns + insertWidth > maxTotalColumns) {
      showNotification(
        `Cannot insert measure: Adding ${insertWidth} columns would exceed limit of ${maxTotalColumns}.`,
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
    showNotification(`Inserted new measure (${insertWidth} cols).`, 'success');
  }, [cursor, maxTotalColumns, measureInsertWidth, measures, pushHistory, showNotification, stringLabels.length, totalColumns]);

  // Measure Duplicate: Duplicates current active measure to the right
  const handleDuplicateMeasure = useCallback(() => {
    if (measures.length === 0) return;
    const { measureIdx } = cursor;
    const currentMeasure = measures[measureIdx];
    const width = currentMeasure[0]?.length || 20;

    if (totalColumns + width > maxTotalColumns) {
      showNotification(
        `Cannot duplicate measure: Adding ${width} columns would exceed limit of ${maxTotalColumns}.`,
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
    showNotification(`Duplicated measure (${width} cols).`, 'success');
  }, [cursor, maxTotalColumns, measures, pushHistory, showNotification, totalColumns]);

  // Measure Delete: Deletes current active measure (No confirmation prompt)
  const handleDeleteMeasure = useCallback(() => {
    if (measures.length <= 1) {
      const resetWidth = Math.max(8, Math.min(40, measureInsertWidth || 20));
      const blankMeasure = stringLabels.map(() => Array(resetWidth).fill('-'));
      pushHistory([blankMeasure]);
      setCursor({ measureIdx: 0, rowIdx: 0, colIdx: 0 });
      showNotification('Reset measure to blank.', 'info');
      return;
    }

    const { measureIdx } = cursor;
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

  // Block Clear: Clears selected cells to '-' without shifting columns
  const handleBlockClear = useCallback(() => {
    const sel = getNormalizedSelection(selection);
    if (!sel) {
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
    showNotification('Cleared selected cells to empty dashes.', 'info');
  }, [getNormalizedSelection, measures, pushHistory, selection, setCellChar, showNotification]);

  // Block Delete: Removes the highlighted columns and shifts remaining cells left to fill
  const handleBlockDelete = useCallback(() => {
    const sel = getNormalizedSelection(selection);
    if (!sel) {
      handleDeleteColumn();
      return;
    }

    const newMeasures = JSON.parse(JSON.stringify(measures));
    const deleteCount = sel.maxCol - sel.minCol + 1;

    for (let r = 0; r < newMeasures[sel.measureIdx].length; r++) {
      newMeasures[sel.measureIdx][r].splice(sel.minCol, deleteCount);
      if (newMeasures[sel.measureIdx][r].length === 0) {
        newMeasures[sel.measureIdx][r].push('-');
      }
    }

    const nextCol = Math.min(sel.minCol, newMeasures[sel.measureIdx][0].length - 1);
    pushHistory(newMeasures);
    setSelection(null);
    setCursor({
      measureIdx: sel.measureIdx,
      rowIdx: sel.minRow,
      colIdx: nextCol,
    });
    showNotification(`Removed ${deleteCount} column(s) and shifted left.`, 'info');
  }, [getNormalizedSelection, handleDeleteColumn, measures, pushHistory, selection, showNotification]);

  // Block Copy: Copies 2D matrix of selected cells
  const handleBlockCopy = useCallback(() => {
    const sel = getNormalizedSelection(selection);
    if (!sel) {
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

    const rows = sel.maxRow - sel.minRow + 1;
    const cols = sel.maxCol - sel.minCol + 1;
    const data: string[][] = [];

    for (let r = sel.minRow; r <= sel.maxRow; r++) {
      const rowData: string[] = [];
      for (let c = sel.minCol; c <= sel.maxCol; c++) {
        rowData.push(measures[sel.measureIdx][r][c]);
      }
      data.push(rowData);
    }

    setClipboard({ rows, cols, data });
    showNotification(`Copied block (${rows} rows × ${cols} cols) to clipboard.`, 'success');
  }, [cursor, getNormalizedSelection, measures, selection, showNotification]);

  // Block Paste: Pastes copied block at cursor. Blocks if paste area exits grid area.
  const handleBlockPaste = useCallback(() => {
    if (!clipboard) {
      showNotification('Clipboard is empty. Select a block and click Copy first.', 'error');
      return;
    }

    const { measureIdx, rowIdx, colIdx } = cursor;
    const currentMeasure = measures[measureIdx];
    if (!currentMeasure) return;

    const measureRows = currentMeasure.length;
    const measureCols = currentMeasure[0]?.length || 0;

    const pasteMaxRow = rowIdx + clipboard.rows;
    const pasteMaxCol = colIdx + clipboard.cols;

    if (pasteMaxRow > measureRows || pasteMaxCol > measureCols) {
      showNotification(
        `Cannot paste: Paste area (${clipboard.rows} rows × ${clipboard.cols} cols) extends beyond measure boundaries (${measureRows} strings × ${measureCols} cols).`,
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

  // Insert Chord at cursor position
  const handleConfirmInsertChord = () => {
    const rawChord = insChordInput.trim().replace(/^\[|\]$/g, '');
    if (!rawChord) {
      setInsChordError('Please enter a chord name.');
      return;
    }

    let fretsForStrings: (string | number)[] = [];

    if (activeInstrument === 'guitar') {
      const chordData = getGuitarChordData(rawChord);
      if (!chordData || !chordData.voicings || chordData.voicings.length === 0) {
        setInsChordError(`Chord "${rawChord}" not recognized. Try chords like Am, C, G, D, Em, F, Bb.`);
        return;
      }
      const rawFrets = chordData.voicings[0].frets; // [E, A, D, G, B, e]
      // Row 0 is high e (frets[5]), Row 5 is low E (frets[0])
      fretsForStrings = [
        rawFrets[5] === -1 ? 'x' : rawFrets[5],
        rawFrets[4] === -1 ? 'x' : rawFrets[4],
        rawFrets[3] === -1 ? 'x' : rawFrets[3],
        rawFrets[2] === -1 ? 'x' : rawFrets[2],
        rawFrets[1] === -1 ? 'x' : rawFrets[1],
        rawFrets[0] === -1 ? 'x' : rawFrets[0],
      ];
    } else if (activeInstrument === 'ukulele') {
      const ukeVoicing = UKULELE_CHORDS[rawChord] || UKULELE_CHORDS[rawChord.toUpperCase()];
      if (ukeVoicing) {
        // [g, C, E, A]
        fretsForStrings = ukeVoicing.map((f) => (f === -1 ? 'x' : f));
      } else {
        setInsChordError(`Ukulele chord "${rawChord}" not found. Try C, G, Am, F, Em, D.`);
        return;
      }
    } else {
      // Bass: single root note on lowest string
      fretsForStrings = ['-', '-', '-', '0'];
    }

    const { measureIdx, colIdx } = cursor;
    const newMeasures = JSON.parse(JSON.stringify(measures));

    // Check if any fret is 2 digits (e.g. 10, 12)
    const hasDoubleDigit = fretsForStrings.some((f) => typeof f === 'number' && f >= 10);

    if (hasDoubleDigit) {
      // Insert 2 columns
      for (let r = 0; r < stringLabels.length; r++) {
        const val = fretsForStrings[r];
        if (typeof val === 'number' && val >= 10) {
          const strVal = String(val);
          newMeasures[measureIdx][r].splice(colIdx, 0, strVal[0], strVal[1]);
        } else {
          newMeasures[measureIdx][r].splice(colIdx, 0, String(val ?? '-'), '-');
        }
      }
      setCursor((prev) => ({ ...prev, colIdx: Math.min(colIdx + 2, newMeasures[measureIdx][0].length - 1) }));
    } else {
      // Insert 1 column across all strings
      for (let r = 0; r < stringLabels.length; r++) {
        const val = fretsForStrings[r] !== undefined ? String(fretsForStrings[r]) : '-';
        newMeasures[measureIdx][r].splice(colIdx, 0, val);
      }
      setCursor((prev) => ({ ...prev, colIdx: Math.min(colIdx + 1, newMeasures[measureIdx][0].length - 1) }));
    }

    pushHistory(newMeasures);
    setShowInsChordModal(false);
    showNotification(`Inserted chord [${rawChord}] at cursor column.`, 'success');
  };

  // Keyboard navigation & typing handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Ignore input if user is typing in any text input
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

      // Backspace key: remove cell on the left and shift all text on the right of cursor left
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (selection) {
          handleBlockDelete();
        } else if (colIdx > 0) {
          const newMeasures = JSON.parse(JSON.stringify(measures));
          for (let r = 0; r < newMeasures[measureIdx].length; r++) {
            newMeasures[measureIdx][r].splice(colIdx - 1, 1);
            if (newMeasures[measureIdx][r].length === 0) {
              newMeasures[measureIdx][r].push('-');
            }
          }
          pushHistory(newMeasures);
          setCursor({ measureIdx, rowIdx, colIdx: colIdx - 1 });
        }
        return;
      }

      // Delete key: clear cell to '-' (does not shift)
      if (e.key === 'Delete') {
        e.preventDefault();
        if (selection) {
          handleBlockClear();
        } else {
          setCellChar('-');
        }
        return;
      }

      // Allowed single character typing
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setCellChar(e.key);
      }
    },
    [cursor, handleBlockClear, handleBlockCopy, handleBlockDelete, handleBlockPaste, handleRedo, handleUndo, measures, pushHistory, selection, setCellChar]
  );

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

  // Instrument change handler (No confirmation prompt)
  const handleSelectInstrument = (inst: 'guitar' | 'ukulele' | 'bass') => {
    if (inst === activeInstrument) return;
    const newLabels = INSTRUMENT_STRINGS[inst];
    const newRowsCount = newLabels.length;

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
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs select-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      ref={containerRef}
      onMouseUp={() => setIsSelecting(false)}
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
              <h2 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                <span>TAB Diagram Grid Editor</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-300 font-mono border border-slate-700">
                  Measure {cursor.measureIdx + 1}/{measures.length}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Single-character cell grid. Blank cells auto-filled with &quot;-&quot;.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
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
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <span className="text-slate-300 font-medium shrink-0">TAB Title:</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Intro Riff (with techniques)"
              className="flex-1 px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-sans"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-medium">Instrument:</span>
            <div className="flex rounded-lg border border-slate-700 bg-slate-950 p-0.5">
              {(['guitar', 'ukulele', 'bass'] as const).map((inst) => (
                <button
                  key={inst}
                  type="button"
                  onClick={() => handleSelectInstrument(inst)}
                  className={`px-2.5 py-0.5 rounded capitalize font-medium transition-colors cursor-pointer ${
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

        {/* Main Toolbar: Generous spacing between Column, Measure, Block groups */}
        <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 sm:gap-5 select-none text-xs">
          <div className="flex flex-wrap items-center gap-4 sm:gap-5">
            {/* Column Group: Title in Bright White, Button Desc in Grey */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl p-1.5">
              <span className="text-xs font-extrabold text-white px-1.5">Column:</span>
              <button
                type="button"
                onClick={handleInsertColumn}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 rounded-lg font-medium text-xs border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                title="Insert a column on all strings at cursor position"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ins</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setInsChordInput('Am');
                  setInsChordError(null);
                  setShowInsChordModal(true);
                }}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 rounded-lg font-medium text-xs border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                title="Insert standard chord at cursor position across all strings"
              >
                <Music className="w-3.5 h-3.5 text-amber-400" />
                <span>InsChord</span>
              </button>
              <button
                type="button"
                onClick={handleDeleteColumn}
                className="px-2.5 py-1 bg-slate-800 hover:bg-rose-950/50 text-slate-400 hover:text-rose-200 rounded-lg font-medium text-xs border border-slate-700 hover:border-rose-800 transition-colors flex items-center gap-1 cursor-pointer"
                title="Delete column across all strings at cursor and shift left"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Del</span>
              </button>
            </div>

            {/* Measure Group: Title in Bright White, Button Desc in Grey */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl p-1.5">
              <span className="text-xs font-extrabold text-white px-1.5">Measure:</span>
              <button
                type="button"
                onClick={handleInsertMeasure}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 rounded-lg font-medium text-xs border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                title={`Insert new blank measure (${measureInsertWidth} cols) to right`}
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>Ins</span>
              </button>
              <button
                type="button"
                onClick={handleDuplicateMeasure}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 rounded-lg font-medium text-xs border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                title="Duplicate active measure to the right"
              >
                <Copy className="w-3.5 h-3.5 text-sky-400" />
                <span>Duplicate</span>
              </button>
              <button
                type="button"
                onClick={handleDeleteMeasure}
                className="px-2.5 py-1 bg-slate-800 hover:bg-rose-950/50 text-slate-400 hover:text-rose-200 rounded-lg font-medium text-xs border border-slate-700 hover:border-rose-800 transition-colors flex items-center gap-1 cursor-pointer"
                title="Delete active measure"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Del</span>
              </button>
            </div>

            {/* Block Group: Title in Bright White, Button Desc in Grey */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-xl p-1.5">
              <span className="text-xs font-extrabold text-white px-1.5">Block:</span>
              <button
                type="button"
                onClick={handleBlockCopy}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 rounded-lg font-medium text-xs border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                title="Copy selected block or cell (Ctrl+C)"
              >
                <Copy className="w-3.5 h-3.5 text-sky-400" />
                <span>Copy</span>
              </button>
              <button
                type="button"
                onClick={handleBlockPaste}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 rounded-lg font-medium text-xs border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                title="Paste copied block at cursor (Ctrl+V) - Blocked if exceeds grid"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-emerald-400" />
                <span>Paste</span>
              </button>
              <button
                type="button"
                onClick={handleBlockClear}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 rounded-lg font-medium text-xs border border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                title="Clear selected cells to '-' without shifting (Delete key)"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                <span>Clear</span>
              </button>
              <button
                type="button"
                onClick={handleBlockDelete}
                className="px-2.5 py-1 bg-slate-800 hover:bg-rose-950/50 text-slate-400 hover:text-rose-200 rounded-lg font-medium text-xs border border-slate-700 hover:border-rose-800 transition-colors flex items-center gap-1 cursor-pointer"
                title="Remove highlighted cells and shift remaining cells left to fill"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Del</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Insert / Overwrite Mode toggle */}
            <button
              type="button"
              onClick={() => setIsInsertMode(!isInsertMode)}
              className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs border transition-colors cursor-pointer ${
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
                className="p-1.5 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title="Undo (Ctrl+Z)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={future.length === 0}
                className="p-1.5 rounded hover:bg-slate-800 text-slate-300 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title="Redo (Ctrl+Y)"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Musical Palette with Hover Hints */}
        <div className="px-4 py-1.5 bg-slate-900/90 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto select-none text-xs">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0">Quick Insert:</span>
          {/* Numbers 0 to 9 & dash */}
          {['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-'].map((char) => (
            <button
              key={char}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setCellChar(char)}
              className="w-6 h-6 shrink-0 flex items-center justify-center font-mono font-bold rounded bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
              title={char === '-' ? 'Empty string dash (-)' : `Fret ${char}`}
            >
              {char}
            </button>
          ))}

          <span className="h-4 w-px bg-slate-700 mx-1 shrink-0" />

          {/* Technique buttons with hover cursor hints */}
          {TECHNIQUE_BUTTONS.map((btn) => (
            <button
              key={btn.label}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setCellChar(btn.char)}
              className="h-6 px-1.5 shrink-0 flex items-center justify-center font-mono font-bold text-xs rounded bg-slate-800 hover:bg-sky-400 hover:text-slate-950 text-sky-300 border border-slate-700 transition-colors cursor-pointer"
              title={btn.hint}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Interactive Spreadsheet Grid Container: White Fretboard background, black strings/notation */}
        <div className="flex-1 overflow-x-auto overflow-y-auto p-4 bg-slate-950">
          <div className="inline-flex flex-col min-w-full pb-4">
            {/* Measure Column Headers */}
            <div className="flex items-center pl-8 mb-1.5">
              {measures.map((m, mIdx) => {
                const cols = m[0]?.length || 0;
                const isActive = cursor.measureIdx === mIdx;
                return (
                  <button
                    key={mIdx}
                    type="button"
                    className={`flex items-center justify-between px-3 py-1 mr-2 rounded-t-lg border-t border-x text-xs font-mono select-none transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-white text-black border-slate-300 font-bold shadow-xs'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                    }`}
                    style={{ minWidth: `${cols * 22 + 16}px` }}
                    onClick={() => setCursor((prev) => ({ ...prev, measureIdx: mIdx, colIdx: 0 }))}
                  >
                    <span>Measure {mIdx + 1}</span>
                    <span className="text-[10px] opacity-70">({cols} cols)</span>
                  </button>
                );
              })}
            </div>

            {/* Fretboard Grid: PURE WHITE BACKGROUND, BLACK TEXT/LINES, NO HORIZONTAL BORDER LINES */}
            <div className="flex flex-col border border-slate-300 rounded-xl bg-white shadow-xs p-2 overflow-x-auto">
              {stringLabels.map((stringLabel, rIdx) => (
                <div key={rIdx} className="flex items-center">
                  {/* String Tuning Label */}
                  <div className="w-6 h-6 flex items-center justify-center font-mono font-bold text-xs text-black shrink-0 mr-1 select-none">
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
                          <div className="w-2 h-6 flex items-center justify-center font-mono font-bold text-black select-none text-xs">
                            |
                          </div>

                          {/* Measure Cells Grid: NO horizontal border lines, strings are dashes */}
                          <div 
                            className={`flex items-center transition-colors ${
                              isMeasureActive ? 'bg-amber-50/40' : 'bg-transparent'
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

                              const isNumber = /^[0-9]$/.test(cellChar);
                              const isTechnique = /^[hpbr/\\~xX<>t()]$/.test(cellChar);

                              let cellColor = 'text-slate-700 font-bold';
                              if (isNumber) cellColor = 'text-black font-extrabold';
                              else if (isTechnique) cellColor = 'text-blue-700 font-bold';
                              else if (cellChar !== '-') cellColor = 'text-emerald-700 font-bold';

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
                                  className={`w-5 h-6 sm:w-5.5 sm:h-6 flex items-center justify-center font-mono text-xs select-none cursor-pointer transition-all ${cellColor} ${
                                    isCursor
                                      ? 'bg-amber-300 text-black font-black ring-2 ring-amber-500 rounded-xs shadow-xs z-10 scale-105'
                                      : isSelected
                                      ? 'bg-sky-200 text-sky-950 ring-1 ring-sky-400 font-bold'
                                      : 'hover:bg-slate-100'
                                  }`}
                                  style={{
                                    fontFamily: 'Consolas, "Liberation Mono", Menlo, Monaco, "Courier New", monospace',
                                    letterSpacing: '0.04em',
                                  }}
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
                    <div className="w-2 h-6 flex items-center justify-center font-mono font-bold text-black select-none ml-0.5 text-xs">
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
              Tip: Use <strong>Arrow keys</strong> to move, <strong>Space</strong> for dash, <strong>Backspace</strong> to delete & shift left, <strong>Ctrl+C / Ctrl+V</strong> for block copy/paste.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors text-xs sm:text-sm cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleKeepChanges}
              className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-bold transition-all shadow-md flex items-center gap-1.5 text-xs sm:text-sm cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Keep Changes</span>
            </button>
          </div>
        </div>
      </div>

      {/* Insert Chord Popup Prompt */}
      {showInsChordModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 w-full max-w-sm flex flex-col gap-4 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Music className="w-4 h-4 text-amber-400" />
                <span>Insert Chord into TAB</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowInsChordModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Chord to Insert:
                </label>
                <span className="text-[10px] text-slate-400 capitalize">
                  {activeInstrument} Tuning
                </span>
              </div>
              <input
                type="text"
                autoFocus
                value={insChordInput}
                onChange={(e) => {
                  setInsChordInput(e.target.value);
                  setInsChordError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmInsertChord();
                  if (e.key === 'Escape') setShowInsChordModal(false);
                }}
                placeholder="e.g. Am, C, G, D, Em, F#m, D7"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-base focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none"
              />
              {insChordError ? (
                <p className="text-xs text-rose-400 mt-1.5">{insChordError}</p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Inserts standard chord fingering across all strings at column {cursor.colIdx + 1}.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowInsChordModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmInsertChord}
                className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl font-bold text-xs transition-colors shadow-sm cursor-pointer"
              >
                Insert Chord
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
