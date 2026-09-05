/**
 * Comprehensive Guitar Chord Library & Diagram Generator
 * Supports multiple voicings, fingerings, barre chords, notes, intervals,
 * and dynamic CAGED movable barre chord generation for any chord.
 */

export interface ChordVoicing {
  frets: number[]; // 6 strings [E, A, D, G, B, e]: -1 = mute, 0 = open, 1..24 = fret
  fingers: number[]; // 0 for open/mute, 1=index, 2=middle, 3=ring, 4=pinky, -1=thumb
  baseFret: number; // 1 for open position, or the lowest fret displayed
  barres?: { fret: number; fromString: number; toString: number; finger: number }[];
  name?: string; // e.g. "Open Position", "5th Fret Barre", etc.
}

export interface GuitarChordData {
  chord: string; // e.g. "Am", "D/F#"
  name: string; // e.g. "A Minor"
  root: string; // e.g. "A"
  quality: string; // e.g. "minor", "major", "7", etc.
  notes: string[]; // e.g. ["A", "C", "E"]
  intervals: string[]; // e.g. ["1", "b3", "5"]
  voicings: ChordVoicing[];
}

export const STRING_TUNING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'] as const;
export const STRING_BASE_SEMITONES = [4, 9, 2, 7, 11, 4]; // E2, A2, D3, G3, B3, E4 in semitones (0=C, 1=C#, 2=D, ...)
export const CHROMATIC_NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const CHROMATIC_NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Maps chord name variations to canonical format
 */
export function normalizeChordName(name: string): string {
  if (!name) return '';
  return name.trim();
}

/**
 * Note on a given string and fret
 */
export function getNoteOnFret(stringIndex: number, fret: number, preferFlat = false): string | null {
  if (fret < 0) return null;
  const base = STRING_BASE_SEMITONES[stringIndex];
  const noteIndex = (base + fret) % 12;
  return preferFlat ? CHROMATIC_NOTES_FLAT[noteIndex] : CHROMATIC_NOTES_SHARP[noteIndex];
}

/**
 * Standard Guitar Chords Database with authentic fingerings and multiple positions
 */
export const GUITAR_CHORDS_LIBRARY: Record<string, GuitarChordData> = {
  // --- A CHORDS ---
  'A': {
    chord: 'A',
    name: 'A Major',
    root: 'A',
    quality: 'major',
    notes: ['A', 'C#', 'E'],
    intervals: ['1', '3', '5'],
    voicings: [
      {
        name: 'Open Position',
        frets: [-1, 0, 2, 2, 2, 0],
        fingers: [0, 0, 1, 2, 3, 0],
        baseFret: 1,
      },
      {
        name: '5th Fret Barre (E-shape)',
        frets: [5, 7, 7, 6, 5, 5],
        fingers: [1, 3, 4, 2, 1, 1],
        baseFret: 5,
        barres: [{ fret: 5, fromString: 0, toString: 5, finger: 1 }],
      },
      {
        name: '12th Fret (A-shape)',
        frets: [-1, 12, 14, 14, 14, 12],
        fingers: [0, 1, 2, 3, 4, 1],
        baseFret: 12,
        barres: [{ fret: 12, fromString: 1, toString: 5, finger: 1 }],
      },
    ],
  },
  'Am': {
    chord: 'Am',
    name: 'A Minor',
    root: 'A',
    quality: 'minor',
    notes: ['A', 'C', 'E'],
    intervals: ['1', 'b3', '5'],
    voicings: [
      {
        name: 'Open Position',
        frets: [-1, 0, 2, 2, 1, 0],
        fingers: [0, 0, 2, 3, 1, 0],
        baseFret: 1,
      },
      {
        name: '5th Fret Barre (Em-shape)',
        frets: [5, 7, 7, 5, 5, 5],
        fingers: [1, 3, 4, 1, 1, 1],
        baseFret: 5,
        barres: [{ fret: 5, fromString: 0, toString: 5, finger: 1 }],
      },
      {
        name: 'High Voicing (Dm-shape)',
        frets: [-1, -1, 7, 9, 10, 8],
        fingers: [0, 0, 1, 3, 4, 2],
        baseFret: 7,
      },
    ],
  },
  'A7': {
    chord: 'A7',
    name: 'A Dominant 7th',
    root: 'A',
    quality: 'dominant 7th',
    notes: ['A', 'C#', 'E', 'G'],
    intervals: ['1', '3', '5', 'b7'],
    voicings: [
      {
        name: 'Open Position',
        frets: [-1, 0, 2, 0, 2, 0],
        fingers: [0, 0, 1, 0, 2, 0],
        baseFret: 1,
      },
      {
        name: '5th Fret Barre',
        frets: [5, 7, 5, 6, 5, 5],
        fingers: [1, 3, 1, 2, 1, 1],
        baseFret: 5,
        barres: [{ fret: 5, fromString: 0, toString: 5, finger: 1 }],
      },
    ],
  },
  'Am7': {
    chord: 'Am7',
    name: 'A Minor 7th',
    root: 'A',
    quality: 'minor 7th',
    notes: ['A', 'C', 'E', 'G'],
    intervals: ['1', 'b3', '5', 'b7'],
    voicings: [
      {
        name: 'Open Position',
        frets: [-1, 0, 2, 0, 1, 0],
        fingers: [0, 0, 2, 0, 1, 0],
        baseFret: 1,
      },
      {
        name: '5th Fret Barre',
        frets: [5, 7, 5, 5, 5, 5],
        fingers: [1, 3, 1, 1, 1, 1],
        baseFret: 5,
        barres: [{ fret: 5, fromString: 0, toString: 5, finger: 1 }],
      },
    ],
  },
  'Amaj7': {
    chord: 'Amaj7',
    name: 'A Major 7th',
    root: 'A',
    quality: 'major 7th',
    notes: ['A', 'C#', 'E', 'G#'],
    intervals: ['1', '3', '5', '7'],
    voicings: [
      {
        name: 'Open Position',
        frets: [-1, 0, 2, 1, 2, 0],
        fingers: [0, 0, 2, 1, 3, 0],
        baseFret: 1,
      },
      {
        name: '5th Fret Barre',
        frets: [5, 7, 6, 6, 5, 5],
        fingers: [1, 4, 2, 3, 1, 1],
        baseFret: 5,
        barres: [{ fret: 5, fromString: 0, toString: 5, finger: 1 }],
      },
    ],
  },
  'Asus2': {
    chord: 'Asus2',
    name: 'A Suspended 2nd',
    root: 'A',
    quality: 'suspended 2nd',
    notes: ['A', 'B', 'E'],
    intervals: ['1', '2', '5'],
    voicings: [
      {
        name: 'Open Position',
        frets: [-1, 0, 2, 2, 0, 0],
        fingers: [0, 0, 1, 2, 0, 0],
        baseFret: 1,
      },
    ],
  },
  'Asus4': {
    chord: 'Asus4',
    name: 'A Suspended 4th',
    root: 'A',
    quality: 'suspended 4th',
    notes: ['A', 'D', 'E'],
    intervals: ['1', '4', '5'],
    voicings: [
      {
        name: 'Open Position',
        frets: [-1, 0, 2, 2, 3, 0],
        fingers: [0, 0, 1, 2, 3, 0],
        baseFret: 1,
      },
    ],
  },
  'A7sus4': {
    chord: 'A7sus4',
    name: 'A 7th Suspended 4th',
    root: 'A',
    quality: '7sus4',
    notes: ['A', 'D', 'E', 'G'],
    intervals: ['1', '4', '5', 'b7'],
    voicings: [
      {
        name: 'Open Position',
        frets: [-1, 0, 2, 0, 3, 0],
        fingers: [0, 0, 1, 0, 3, 0],
        baseFret: 1,
      },
    ],
  },
  'Aadd9': {
    chord: 'Aadd9',
    name: 'A Added 9th',
    root: 'A',
    quality: 'add9',
    notes: ['A', 'C#', 'E', 'B'],
    intervals: ['1', '3', '5', '9'],
    voicings: [
      {
        name: 'Open Position',
        frets: [-1, 0, 2, 4, 2, 0],
        fingers: [0, 0, 1, 3, 2, 0],
        baseFret: 1,
      },
    ],
  },

  // --- B CHORDS ---
  'B': {
    chord: 'B',
    name: 'B Major',
    root: 'B',
    quality: 'major',
    notes: ['B', 'D#', 'F#'],
    intervals: ['1', '3', '5'],
    voicings: [
      {
        name: '2nd Fret Barre (A-shape)',
        frets: [-1, 2, 4, 4, 4, 2],
        fingers: [0, 1, 2, 3, 4, 1],
        baseFret: 2,
        barres: [{ fret: 2, fromString: 1, toString: 5, finger: 1 }],
      },
      {
        name: '7th Fret Barre (E-shape)',
        frets: [7, 9, 9, 8, 7, 7],
        fingers: [1, 3, 4, 2, 1, 1],
        baseFret: 7,
        barres: [{ fret: 7, fromString: 0, toString: 5, finger: 1 }],
      },
    ],
  },
  'Bm': {
    chord: 'Bm',
    name: 'B Minor',
    root: 'B',
    quality: 'minor',
    notes: ['B', 'D', 'F#'],
    intervals: ['1', 'b3', '5'],
    voicings: [
      {
        name: '2nd Fret Barre (Am-shape)',
        frets: [-1, 2, 4, 4, 3, 2],
        fingers: [0, 1, 3, 4, 2, 1],
        baseFret: 2,
        barres: [{ fret: 2, fromString: 1, toString: 5, finger: 1 }],
      },
      {
        name: '7th Fret Barre (Em-shape)',
        frets: [7, 9, 9, 7, 7, 7],
        fingers: [1, 3, 4, 1, 1, 1],
        baseFret: 7,
        barres: [{ fret: 7, fromString: 0, toString: 5, finger: 1 }],
      },
    ],
  },
  'B7': {
    chord: 'B7',
    name: 'B Dominant 7th',
    root: 'B',
    quality: 'dominant 7th',
    notes: ['B', 'D#', 'F#', 'A'],
    intervals: ['1', '3', '5', 'b7'],
    voicings: [
      {
        name: 'Open Position',
        frets: [-1, 2, 1, 2, 0, 2],
        fingers: [0, 2, 1, 3, 0, 4],
        baseFret: 1,
      },
      {
        name: '2nd Fret Barre',
        frets: [-1, 2, 4, 2, 4, 2],
        fingers: [0, 1, 3, 1, 4, 1],
        baseFret: 2,
        barres: [{ fret: 2, fromString: 1, toString: 5, finger: 1 }],
      },
    ],
  },
  'Bm7': {
    chord: 'Bm7',
    name: 'B Minor 7th',
    root: 'B',
    quality: 'minor 7th',
    notes: ['B', 'D', 'F#', 'A'],
    intervals: ['1', 'b3', '5', 'b7'],
    voicings: [
      {
        name: '2nd Fret Barre',
        frets: [-1, 2, 4, 2, 3, 2],
        fingers: [0, 1, 3, 1, 2, 1],
        baseFret: 2,
        barres: [{ fret: 2, fromString: 1, toString: 5, finger: 1 }],
      },
      {
        name: '7th Fret Barre',
        frets: [7, 9, 7, 7, 7, 7],
        fingers: [1, 3, 1, 1, 1, 1],
        baseFret: 7,
        barres: [{ fret: 7, fromString: 0, toString: 5, finger: 1 }],
      },
    ],
  },
  'Bmaj7': {
    chord: 'Bmaj7',
    name: 'B Major 7th',
    root: 'B',
    quality: 'major 7th',
    notes: ['B', 'D#', 'F#', 'A#'],
    intervals: ['1', '3', '5', '7'],
    voicings: [
      {
        name: '2nd Fret Barre',
        frets: [-1, 2, 4, 3, 4, 2],
        fingers: [0, 1, 3, 2, 4, 1],
        baseFret: 2,
        barres: [{ fret: 2, fromString: 1, toString: 5, finger: 1 }],
      },
    ],
  },

  // --- Bb / A# CHORDS ---
  'Bb': {
    chord: 'Bb',
    name: 'B Flat Major',
    root: 'Bb',
    quality: 'major',
    notes: ['Bb', 'D', 'F'],
    intervals: ['1', '3', '5'],
    voicings: [
      {
        name: '1st Fret Barre (A-shape)',
        frets: [-1, 1, 3, 3, 3, 1],
        fingers: [0, 1, 2, 3, 4, 1],
        baseFret: 1,
        barres: [{ fret: 1, fromString: 1, toString: 5, finger: 1 }],
      },
      {
        name: '6th Fret Barre (E-shape)',
        frets: [6, 8, 8, 7, 6, 6],
        fingers: [1, 3, 4, 2, 1, 1],
        baseFret: 6,
        barres: [{ fret: 6, fromString: 0, toString: 5, finger: 1 }],
      },
    ],
  },
  'Bbm': {
    chord: 'Bbm',
    name: 'B Flat Minor',
    root: 'Bb',
    quality: 'minor',
    notes: ['Bb', 'Db', 'F'],
    intervals: ['1', 'b3', '5'],
    voicings: [
      {
        name: '1st Fret Barre (Am-shape)',
        frets: [-1, 1, 3, 3, 2, 1],
        fingers: [0, 1, 3, 4, 2, 1],
        baseFret: 1,
        barres: [{ fret: 1, fromString: 1, toString: 5, finger: 1 }],
      },
      {
        name: '6th Fret Barre (Em-shape)',
        frets: [6, 8, 8, 6, 6, 6],
        fingers: [1, 3, 4, 1, 1, 1],
        baseFret: 6,
        barres: [{ fret: 6, fromString: 0, toString: 5, finger: 1 }],
      },
    ],
  },
  'Bb7': {
    chord: 'Bb7',
    name: 'B Flat 7th',
    root: 'Bb',
    quality: 'dominant 7th',
    notes: ['Bb', 'D', 'F', 'Ab'],
    intervals: ['1', '3', '5', 'b7'],
    voicings: [
      {
        name: '1st Fret Barre',
        frets: [-1, 1, 3, 1, 3, 1],
        fingers: [0, 1, 3, 1, 4, 1],
        baseFret: 1,
        barres: [{ fret: 1, fromString: 1, toString: 5, finger: 1 }],
      },
    ],
  },

  // --- C CHORDS ---
  'C': {
    chord: 'C',
    name: 'C Major',
    root: 'C',
    quality: 'major',
    notes: ['C', 'E', 'G'],
    intervals: ['1', '3', '5'],
    voicings: [
      {
        name: 'Open Position',
        frets: [-1, 3, 2, 0, 1, 0],
        fingers: [0, 3, 2, 0, 1, 0],
        baseFret: 1,
      },
      {
        name: '3rd Fret Barre (A-shape)',
        frets: [-1, 3, 5, 5, 5, 3],
        fingers: [0, 1, 2, 3, 4, 1],
        baseFret: 3,
        barres: [{ fret: 3, fromString: 1, toString: 5, finger: 1 }],
      },
      {
        name: '8th Fret Barre (E-shape)',
        frets: [8, 10, 10, 9, 8, 8],
        fingers: [1, 3, 4, 2, 1, 1],
        baseFret: 8,
        barres: [{ fret: 8, fromString: 0, toString: 5, finger: 1 }],
      },
    ],
  },
  'Cm': {
    chord: 'Cm',
    name: 'C Minor',
    root: 'C',
    quality: 'minor',
    notes: ['C', 'Eb', 'G'],
    intervals: ['1', 'b3', '5'],
    voicings: [
      {
        name: '3rd Fret Barre (Am-shape)',
        frets: [-1, 3, 5, 5, 4, 3],
        fingers: [0, 1, 3, 4, 2, 1],
        baseFret: 3,
        barres: [{ fret: 3, fromString: 1, toString: 5, finger: 1 }],
      },
      {
        name: '8th Fret Barre (Em-shape)',
        frets: [8, 10, 10, 8, 8, 8],
        fingers: [1, 3, 4, 1, 1, 1],
        baseFret: 8,
        barres: [{ fret: 8, fromString: 0, toString: 5, finger: 1 }],
      },
    ],
  },
  'C7': {
    chord: 'C7',
    name: 'C Dominant 7th',
    root: 'C',
    quality: 'dominant 7th',
    notes: ['C', 'E', 'G', 'Bb'],
    intervals: ['1', '3', '5', 'b7'],
    voicings: [
      {
        name: 'Open Position',
        frets: [-1, 3, 2, 3, 1, 0],
        fingers: [0, 3, 2, 4, 1, 0],
        baseFret: 1,
      },
      {
        name: '3rd Fret Barre',
        frets: [-1, 3, 5, 3, 5, 3],
        fingers: [0, 1, 3, 1, 4, 1],
        baseFret: 3,
        barres: [{ fret: 3, fromString: 1, toString: 5, finger: 1 }],
      },
    ],
  },
  'Cmaj7': {
    chord: 'Cmaj7',
    name: 'C Major 7th',
    root: 'C',
    quality: 'major 7th',
    notes: ['C', 'E', 'G', 'B'],
    intervals: ['1', '3', '5', '7'],
    voicings: [
      {
        name: 'Open Position',
        frets: [-1, 3, 2, 0, 0, 0],
        fingers: [0, 3, 2, 0, 0, 0],
        baseFret: 1,
      },
      {
        name: '3rd Fret Barre',
        frets: [-1, 3, 5, 4, 5, 3],
        fingers: [0, 1, 3, 2, 4, 1],
        baseFret: 3,
        barres: [{ fret: 3, fromString: 1, toString: 5, finger: 1 }],
      },
    ],
  },
  'Cadd9': {
    chord: 'Cadd9',
    name: 'C Added 9th',
    root: 'C',
    quality: 'add9',
    notes: ['C', 'E', 'G', 'D'],
    intervals: ['1', '3', '5', '9'],
    voicings: [
      {
        name: 'Open Position',
        frets: [-1, 3, 2, 0, 3, 0],
        fingers: [0, 2, 1, 0, 3, 0],
        baseFret: 1,
      },
      {
        name: 'Alternative Open',
        frets: [-1, 3, 2, 0, 3, 3],
        fingers: [0, 2, 1, 0, 3, 4],
        baseFret: 1,
      },
    ],
  },
  'Csus4': {
    chord: 'Csus4',
    name: 'C Suspended 4th',
    root: 'C',
    quality: 'suspended 4th',
    notes: ['C', 'F', 'G'],
    intervals: ['1', '4', '5'],
    voicings: [
      {
        name: 'Open Position',
        frets: [-1, 3, 3, 0, 1, 1],
        fingers: [0, 3, 4, 0, 1, 1],
        baseFret: 1,
        barres: [{ fret: 1, fromString: 4, toString: 5, finger: 1 }],
      },
    ],
  },

  // --- C# / Db CHORDS ---
  'C#': {
    chord: 'C#',
    name: 'C Sharp Major',
    root: 'C#',
    quality: 'major',
    notes: ['C#', 'F', 'G#'],
    intervals: ['1', '3', '5'],
    voicings: [
      {
        name: '4th Fret Barre (A-shape)',
        frets: [-1, 4, 6, 6, 6, 4],
        fingers: [0, 1, 2, 3, 4, 1],
        baseFret: 4,
        barres: [{ fret: 4, fromString: 1, toString: 5, finger: 1 }],
      },
    ],
  },
  'C#m': {
    chord: 'C#m',
    name: 'C Sharp Minor',
    root: 'C#',
    quality: 'minor',
    notes: ['C#', 'E', 'G#'],
    intervals: ['1', 'b3', '5'],
    voicings: [
      {
        name: '4th Fret Barre (Am-shape)',
        frets: [-1, 4, 6, 6, 5, 4],
        fingers: [0, 1, 3, 4, 2, 1],
        baseFret: 4,
        barres: [{ fret: 4, fromString: 1, toString: 5, finger: 1 }],
      },
      {
        name: '9th Fret Barre (Em-shape)',
        frets: [9, 11, 11, 9, 9, 9],
        fingers: [1, 3, 4, 1, 1, 1],
        baseFret: 9,
        barres: [{ fret: 9, fromString: 0, toString: 5, finger: 1 }],
      },
    ],
  },
  'C#7': {
    chord: 'C#7',
    name: 'C Sharp 7th',
    root: 'C#',
    quality: 'dominant 7th',
    notes: ['C#', 'F', 'G#', 'B'],
    intervals: ['1', '3', '5', 'b7'],
    voicings: [
      {
        name: '4th Fret Barre',
        frets: [-1, 4, 6, 4, 6, 4],
        fingers: [0, 1, 3, 1, 4, 1],
        baseFret: 4,
        barres: [{ fret: 4, fromString: 1, toString: 5, finger: 1 }],
      },
    ],
  },

  // --- D CHORDS ---
  'D': {
    chord: 'D',
    name: 'D Major',
    root: 'D',
    quality: 'major',
    notes: ['D', 'F#', 'A'],
    intervals: ['1', '3', '5'],
    voicings: [
      {
        name: 'Open Position',
        frets: [-1, -1, 0, 2, 3, 2],
        fingers: [0, 0, 0, 1, 3, 2],
        baseFret: 1,
      },
      {
        name: '5th Fret Barre (A-shape)',
        frets: [-1, 5, 7, 7, 7, 5],
        fingers: [0, 1, 2, 3, 4, 1],
        baseFret: 5,
        barres: [{ fret: 5, fromString: 1, toString: 5, finger: 1 }],
      },
      {
        name: '10th Fret Barre (E-shape)',
        frets: [10, 12, 12, 11, 10, 10],
        fingers: [1, 3, 4, 2, 1, 1],
        baseFret: 10,
        barres: [{ fret: 10, fromString: 0, toString: 5, finger: 1 }],
      },
    ],
  },
  'Dm': {
    chord: 'Dm',
    name: 'D Minor',
    root: 'D',
    quality: 'minor',
    notes: ['D', 'F', 'A'],
    intervals: ['1', 'b3', '5'],
    voicings: [
      {
        name: 'Open Position',
        frets: [-1, -1, 0, 2, 3, 1],
        fingers: [0, 0, 0, 2, 3, 1],
        baseFret: 1,
      },
      {
        name: '5th Fret Barre (Am-shape)',
        frets: [-1, 5, 7, 7, 6, 5],
        fingers: [0, 1, 3, 4, 2, 1],
        baseFret: 5,
        barres: [{ fret: 5, fromString: 1, toString: 5, finger: 1 }],
      },
    ],
  },
  'D7': {
    chord: 'D7',
    name: 'D Dominant 7th',
    root: 'D',
    quality: 'dominant 7th',
    notes: ['D', 'F#', 'A', 'C'],
    intervals: ['1', '3', '5', 'b7'],
    voicings: [
      {
        name: 'Open Position',
        frets: [-1, -1, 0, 2, 1, 2],
        fingers: [0, 0, 0, 2, 1, 3],
        baseFret: 1,
      },
      {
        name: '5th Fret Barre',
        frets: [-1, 5, 7, 5, 7, 5],
        fingers: [0, 1, 3, 1, 4, 1],
        baseFret: 5,
        barres: [{ fret: 5, fromString: 1, toString: 5, finger: 1 }],
      },
    ],
  },
  'Dm7': {
    chord: 'Dm7',
    name: 'D Minor 7th',
    root: 'D',
    quality: 'minor 7th',
    notes: ['D', 'F', 'A', 'C'],
    intervals: ['1', 'b3', '5', 'b7'],
    voicings: [
      {
        name: 'Open Position',
        frets: [-1, -1, 0, 2, 1, 1],
        fingers: [0, 0, 0, 2, 1, 1],
        baseFret: 1,
        barres: [{ fret: 1, fromString: 4, toString: 5, finger: 1 }],
      },
      {
        name: '5th Fret Barre',
        frets: [-1, 5, 7, 5, 6, 5],
        fingers: [0, 1, 3, 1, 2, 1],
        baseFret: 5,
        barres: [{ fret: 5, fromString: 1, toString: 5, finger: 1 }],
      },
    ],
  },
  'Dmaj7': {
    chord: 'Dmaj7',
    name: 'D Major 7th',
    root: 'D',
    quality: 'major 7th',
    notes: ['D', 'F#', 'A', 'C#'],
    intervals: ['1', '3', '5', '7'],
    voicings: [
      {
        name: 'Open Position',
        frets: [-1, -1, 0, 2, 2, 2],
        fingers: [0, 0, 0, 1, 1, 1],
        baseFret: 1,
        barres: [{ fret: 2, fromString: 3, toString: 5, finger: 1 }],
      },
    ],
  },
  'Dsus2': {
    chord: 'Dsus2',
    name: 'D Suspended 2nd',
    root: 'D',
    quality: 'suspended 2nd',
    notes: ['D', 'E', 'A'],
    intervals: ['1', '2', '5'],
    voicings: [
      {
        name: 'Open Position',
        frets: [-1, -1, 0, 2, 3, 0],
        fingers: [0, 0, 0, 1, 2, 0],
        baseFret: 1,
      },
    ],
  },
  'Dsus4': {
    chord: 'Dsus4',
    name: 'D Suspended 4th',
    root: 'D',
    quality: 'suspended 4th',
    notes: ['D', 'G', 'A'],
    intervals: ['1', '4', '5'],
    voicings: [
      {
        name: 'Open Position',
        frets: [-1, -1, 0, 2, 3, 3],
        fingers: [0, 0, 0, 1, 2, 3],
        baseFret: 1,
      },
    ],
  },

  // --- D# / Eb CHORDS ---
  'Eb': {
    chord: 'Eb',
    name: 'E Flat Major',
    root: 'Eb',
    quality: 'major',
    notes: ['Eb', 'G', 'Bb'],
    intervals: ['1', '3', '5'],
    voicings: [
      {
        name: '6th Fret Barre (A-shape)',
        frets: [-1, 6, 8, 8, 8, 6],
        fingers: [0, 1, 2, 3, 4, 1],
        baseFret: 6,
        barres: [{ fret: 6, fromString: 1, toString: 5, finger: 1 }],
      },
      {
        name: '11th Fret Barre (E-shape)',
        frets: [11, 13, 13, 12, 11, 11],
        fingers: [1, 3, 4, 2, 1, 1],
        baseFret: 11,
        barres: [{ fret: 11, fromString: 0, toString: 5, finger: 1 }],
      },
    ],
  },
  'D#': {
    chord: 'D#',
    name: 'D Sharp Major',
    root: 'D#',
    quality: 'major',
    notes: ['D#', 'G', 'A#'],
    intervals: ['1', '3', '5'],
    voicings: [
      {
        name: '6th Fret Barre',
        frets: [-1, 6, 8, 8, 8, 6],
        fingers: [0, 1, 2, 3, 4, 1],
        baseFret: 6,
        barres: [{ fret: 6, fromString: 1, toString: 5, finger: 1 }],
      },
    ],
  },

  // --- E CHORDS ---
  'E': {
    chord: 'E',
    name: 'E Major',
    root: 'E',
    quality: 'major',
    notes: ['E', 'G#', 'B'],
    intervals: ['1', '3', '5'],
    voicings: [
      {
        name: 'Open Position',
        frets: [0, 2, 2, 1, 0, 0],
        fingers: [0, 2, 3, 1, 0, 0],
        baseFret: 1,
      },
      {
        name: '7th Fret Barre (A-shape)',
        frets: [-1, 7, 9, 9, 9, 7],
        fingers: [0, 1, 2, 3, 4, 1],
        baseFret: 7,
        barres: [{ fret: 7, fromString: 1, toString: 5, finger: 1 }],
      },
    ],
  },
  'Em': {
    chord: 'Em',
    name: 'E Minor',
    root: 'E',
    quality: 'minor',
    notes: ['E', 'G', 'B'],
    intervals: ['1', 'b3', '5'],
    voicings: [
      {
        name: 'Open Position',
        frets: [0, 2, 2, 0, 0, 0],
        fingers: [0, 2, 3, 0, 0, 0],
        baseFret: 1,
      },
      {
        name: '7th Fret Barre (Am-shape)',
        frets: [-1, 7, 9, 9, 8, 7],
        fingers: [0, 1, 3, 4, 2, 1],
        baseFret: 7,
        barres: [{ fret: 7, fromString: 1, toString: 5, finger: 1 }],
      },
    ],
  },
  'E7': {
    chord: 'E7',
    name: 'E Dominant 7th',
    root: 'E',
    quality: 'dominant 7th',
    notes: ['E', 'G#', 'B', 'D'],
    intervals: ['1', '3', '5', 'b7'],
    voicings: [
      {
        name: 'Open Position',
        frets: [0, 2, 0, 1, 0, 0],
        fingers: [0, 2, 0, 1, 0, 0],
        baseFret: 1,
      },
      {
        name: '4-finger Open',
        frets: [0, 2, 2, 1, 3, 0],
        fingers: [0, 2, 3, 1, 4, 0],
        baseFret: 1,
      },
      {
        name: '7th Fret Barre',
        frets: [-1, 7, 9, 7, 9, 7],
        fingers: [0, 1, 3, 1, 4, 1],
        baseFret: 7,
        barres: [{ fret: 7, fromString: 1, toString: 5, finger: 1 }],
      },
    ],
  },
  'Em7': {
    chord: 'Em7',
    name: 'E Minor 7th',
    root: 'E',
    quality: 'minor 7th',
    notes: ['E', 'G', 'B', 'D'],
    intervals: ['1', 'b3', '5', 'b7'],
    voicings: [
      {
        name: 'Open Position',
        frets: [0, 2, 0, 0, 0, 0],
        fingers: [0, 2, 0, 0, 0, 0],
        baseFret: 1,
      },
      {
        name: 'Alternative (Wonderwall shape)',
        frets: [0, 2, 2, 0, 3, 3],
        fingers: [0, 1, 2, 0, 3, 4],
        baseFret: 1,
      },
      {
        name: '7th Fret Barre',
        frets: [-1, 7, 9, 7, 8, 7],
        fingers: [0, 1, 3, 1, 2, 1],
        baseFret: 7,
        barres: [{ fret: 7, fromString: 1, toString: 5, finger: 1 }],
      },
    ],
  },
  'Emaj7': {
    chord: 'Emaj7',
    name: 'E Major 7th',
    root: 'E',
    quality: 'major 7th',
    notes: ['E', 'G#', 'B', 'D#'],
    intervals: ['1', '3', '5', '7'],
    voicings: [
      {
        name: 'Open Position',
        frets: [0, 2, 1, 1, 0, 0],
        fingers: [0, 3, 1, 2, 0, 0],
        baseFret: 1,
      },
      {
        name: '7th Fret Barre',
        frets: [-1, 7, 9, 8, 9, 7],
        fingers: [0, 1, 3, 2, 4, 1],
        baseFret: 7,
        barres: [{ fret: 7, fromString: 1, toString: 5, finger: 1 }],
      },
    ],
  },
  'Esus4': {
    chord: 'Esus4',
    name: 'E Suspended 4th',
    root: 'E',
    quality: 'suspended 4th',
    notes: ['E', 'A', 'B'],
    intervals: ['1', '4', '5'],
    voicings: [
      {
        name: 'Open Position',
        frets: [0, 2, 2, 2, 0, 0],
        fingers: [0, 2, 3, 4, 0, 0],
        baseFret: 1,
      },
    ],
  },

  // --- F CHORDS ---
  'F': {
    chord: 'F',
    name: 'F Major',
    root: 'F',
    quality: 'major',
    notes: ['F', 'A', 'C'],
    intervals: ['1', '3', '5'],
    voicings: [
      {
        name: '1st Fret Full Barre (E-shape)',
        frets: [1, 3, 3, 2, 1, 1],
        fingers: [1, 3, 4, 2, 1, 1],
        baseFret: 1,
        barres: [{ fret: 1, fromString: 0, toString: 5, finger: 1 }],
      },
      {
        name: 'Easy 4-String F',
        frets: [-1, -1, 3, 2, 1, 1],
        fingers: [0, 0, 3, 2, 1, 1],
        baseFret: 1,
        barres: [{ fret: 1, fromString: 4, toString: 5, finger: 1 }],
      },
      {
        name: '8th Fret Barre (A-shape)',
        frets: [-1, 8, 10, 10, 10, 8],
        fingers: [0, 1, 2, 3, 4, 1],
        baseFret: 8,
        barres: [{ fret: 8, fromString: 1, toString: 5, finger: 1 }],
      },
    ],
  },
  'Fm': {
    chord: 'Fm',
    name: 'F Minor',
    root: 'F',
    quality: 'minor',
    notes: ['F', 'Ab', 'C'],
    intervals: ['1', 'b3', '5'],
    voicings: [
      {
        name: '1st Fret Barre',
        frets: [1, 3, 3, 1, 1, 1],
        fingers: [1, 3, 4, 1, 1, 1],
        baseFret: 1,
        barres: [{ fret: 1, fromString: 0, toString: 5, finger: 1 }],
      },
      {
        name: '8th Fret Barre',
        frets: [-1, 8, 10, 10, 9, 8],
        fingers: [0, 1, 3, 4, 2, 1],
        baseFret: 8,
        barres: [{ fret: 8, fromString: 1, toString: 5, finger: 1 }],
      },
    ],
  },
  'F7': {
    chord: 'F7',
    name: 'F Dominant 7th',
    root: 'F',
    quality: 'dominant 7th',
    notes: ['F', 'A', 'C', 'Eb'],
    intervals: ['1', '3', '5', 'b7'],
    voicings: [
      {
        name: '1st Fret Barre',
        frets: [1, 3, 1, 2, 1, 1],
        fingers: [1, 3, 1, 2, 1, 1],
        baseFret: 1,
        barres: [{ fret: 1, fromString: 0, toString: 5, finger: 1 }],
      },
    ],
  },
  'Fmaj7': {
    chord: 'Fmaj7',
    name: 'F Major 7th',
    root: 'F',
    quality: 'major 7th',
    notes: ['F', 'A', 'C', 'E'],
    intervals: ['1', '3', '5', '7'],
    voicings: [
      {
        name: 'Open Position',
        frets: [-1, -1, 3, 2, 1, 0],
        fingers: [0, 0, 3, 2, 1, 0],
        baseFret: 1,
      },
      {
        name: '1st Fret Barre',
        frets: [1, 3, 2, 2, 1, 1],
        fingers: [1, 4, 2, 3, 1, 1],
        baseFret: 1,
        barres: [{ fret: 1, fromString: 0, toString: 5, finger: 1 }],
      },
    ],
  },

  // --- F# / Gb CHORDS ---
  'F#': {
    chord: 'F#',
    name: 'F Sharp Major',
    root: 'F#',
    quality: 'major',
    notes: ['F#', 'A#', 'C#'],
    intervals: ['1', '3', '5'],
    voicings: [
      {
        name: '2nd Fret Barre (E-shape)',
        frets: [2, 4, 4, 3, 2, 2],
        fingers: [1, 3, 4, 2, 1, 1],
        baseFret: 2,
        barres: [{ fret: 2, fromString: 0, toString: 5, finger: 1 }],
      },
    ],
  },
  'F#m': {
    chord: 'F#m',
    name: 'F Sharp Minor',
    root: 'F#',
    quality: 'minor',
    notes: ['F#', 'A', 'C#'],
    intervals: ['1', 'b3', '5'],
    voicings: [
      {
        name: '2nd Fret Barre (Em-shape)',
        frets: [2, 4, 4, 2, 2, 2],
        fingers: [1, 3, 4, 1, 1, 1],
        baseFret: 2,
        barres: [{ fret: 2, fromString: 0, toString: 5, finger: 1 }],
      },
    ],
  },
  'F#7': {
    chord: 'F#7',
    name: 'F Sharp Dominant 7th',
    root: 'F#',
    quality: 'dominant 7th',
    notes: ['F#', 'A#', 'C#', 'E'],
    intervals: ['1', '3', '5', 'b7'],
    voicings: [
      {
        name: '2nd Fret Barre',
        frets: [2, 4, 2, 3, 2, 2],
        fingers: [1, 3, 1, 2, 1, 1],
        baseFret: 2,
        barres: [{ fret: 2, fromString: 0, toString: 5, finger: 1 }],
      },
    ],
  },
  'F#m7': {
    chord: 'F#m7',
    name: 'F Sharp Minor 7th',
    root: 'F#',
    quality: 'minor 7th',
    notes: ['F#', 'A', 'C#', 'E'],
    intervals: ['1', 'b3', '5', 'b7'],
    voicings: [
      {
        name: '2nd Fret Barre',
        frets: [2, 4, 2, 2, 2, 2],
        fingers: [1, 3, 1, 1, 1, 1],
        baseFret: 2,
        barres: [{ fret: 2, fromString: 0, toString: 5, finger: 1 }],
      },
    ],
  },

  // --- G CHORDS ---
  'G': {
    chord: 'G',
    name: 'G Major',
    root: 'G',
    quality: 'major',
    notes: ['G', 'B', 'D'],
    intervals: ['1', '3', '5'],
    voicings: [
      {
        name: 'Standard Open',
        frets: [3, 2, 0, 0, 0, 3],
        fingers: [2, 1, 0, 0, 0, 3],
        baseFret: 1,
      },
      {
        name: 'Folk 4-Finger Open',
        frets: [3, 2, 0, 0, 3, 3],
        fingers: [2, 1, 0, 0, 3, 4],
        baseFret: 1,
      },
      {
        name: '3rd Fret Barre (E-shape)',
        frets: [3, 5, 5, 4, 3, 3],
        fingers: [1, 3, 4, 2, 1, 1],
        baseFret: 3,
        barres: [{ fret: 3, fromString: 0, toString: 5, finger: 1 }],
      },
      {
        name: '10th Fret Barre (A-shape)',
        frets: [-1, 10, 12, 12, 12, 10],
        fingers: [0, 1, 2, 3, 4, 1],
        baseFret: 10,
        barres: [{ fret: 10, fromString: 1, toString: 5, finger: 1 }],
      },
    ],
  },
  'Gm': {
    chord: 'Gm',
    name: 'G Minor',
    root: 'G',
    quality: 'minor',
    notes: ['G', 'Bb', 'D'],
    intervals: ['1', 'b3', '5'],
    voicings: [
      {
        name: '3rd Fret Barre (Em-shape)',
        frets: [3, 5, 5, 3, 3, 3],
        fingers: [1, 3, 4, 1, 1, 1],
        baseFret: 3,
        barres: [{ fret: 3, fromString: 0, toString: 5, finger: 1 }],
      },
      {
        name: '10th Fret Barre (Am-shape)',
        frets: [-1, 10, 12, 12, 11, 10],
        fingers: [0, 1, 3, 4, 2, 1],
        baseFret: 10,
        barres: [{ fret: 10, fromString: 1, toString: 5, finger: 1 }],
      },
    ],
  },
  'G7': {
    chord: 'G7',
    name: 'G Dominant 7th',
    root: 'G',
    quality: 'dominant 7th',
    notes: ['G', 'B', 'D', 'F'],
    intervals: ['1', '3', '5', 'b7'],
    voicings: [
      {
        name: 'Open Position',
        frets: [3, 2, 0, 0, 0, 1],
        fingers: [3, 2, 0, 0, 0, 1],
        baseFret: 1,
      },
      {
        name: '3rd Fret Barre',
        frets: [3, 5, 3, 4, 3, 3],
        fingers: [1, 3, 1, 2, 1, 1],
        baseFret: 3,
        barres: [{ fret: 3, fromString: 0, toString: 5, finger: 1 }],
      },
    ],
  },
  'Gmaj7': {
    chord: 'Gmaj7',
    name: 'G Major 7th',
    root: 'G',
    quality: 'major 7th',
    notes: ['G', 'B', 'D', 'F#'],
    intervals: ['1', '3', '5', '7'],
    voicings: [
      {
        name: 'Open Position',
        frets: [3, 2, 0, 0, 0, 2],
        fingers: [2, 1, 0, 0, 0, 3],
        baseFret: 1,
      },
      {
        name: '3rd Fret Barre',
        frets: [3, 5, 4, 4, 3, 3],
        fingers: [1, 4, 2, 3, 1, 1],
        baseFret: 3,
        barres: [{ fret: 3, fromString: 0, toString: 5, finger: 1 }],
      },
    ],
  },
  'Gsus4': {
    chord: 'Gsus4',
    name: 'G Suspended 4th',
    root: 'G',
    quality: 'suspended 4th',
    notes: ['G', 'C', 'D'],
    intervals: ['1', '4', '5'],
    voicings: [
      {
        name: 'Open Position',
        frets: [3, 2, 0, 0, 1, 3],
        fingers: [3, 2, 0, 0, 1, 4],
        baseFret: 1,
      },
    ],
  },

  // --- G# / Ab CHORDS ---
  'Ab': {
    chord: 'Ab',
    name: 'A Flat Major',
    root: 'Ab',
    quality: 'major',
    notes: ['Ab', 'C', 'Eb'],
    intervals: ['1', '3', '5'],
    voicings: [
      {
        name: '4th Fret Barre (E-shape)',
        frets: [4, 6, 6, 5, 4, 4],
        fingers: [1, 3, 4, 2, 1, 1],
        baseFret: 4,
        barres: [{ fret: 4, fromString: 0, toString: 5, finger: 1 }],
      },
    ],
  },
  'G#': {
    chord: 'G#',
    name: 'G Sharp Major',
    root: 'G#',
    quality: 'major',
    notes: ['G#', 'C', 'D#'],
    intervals: ['1', '3', '5'],
    voicings: [
      {
        name: '4th Fret Barre (E-shape)',
        frets: [4, 6, 6, 5, 4, 4],
        fingers: [1, 3, 4, 2, 1, 1],
        baseFret: 4,
        barres: [{ fret: 4, fromString: 0, toString: 5, finger: 1 }],
      },
    ],
  },
  'G#m': {
    chord: 'G#m',
    name: 'G Sharp Minor',
    root: 'G#',
    quality: 'minor',
    notes: ['G#', 'B', 'D#'],
    intervals: ['1', 'b3', '5'],
    voicings: [
      {
        name: '4th Fret Barre (Em-shape)',
        frets: [4, 6, 6, 4, 4, 4],
        fingers: [1, 3, 4, 1, 1, 1],
        baseFret: 4,
        barres: [{ fret: 4, fromString: 0, toString: 5, finger: 1 }],
      },
    ],
  },

  // --- POPULAR SLASH CHORDS ---
  'D/F#': {
    chord: 'D/F#',
    name: 'D Major with F# Bass',
    root: 'D',
    quality: 'slash',
    notes: ['F#', 'D', 'A'],
    intervals: ['3', '1', '5'],
    voicings: [
      {
        name: 'Thumb-over Bass F#',
        frets: [2, 0, 0, 2, 3, 2],
        fingers: [1, 0, 0, 2, 4, 3],
        baseFret: 1,
      },
      {
        name: 'Alternative Muted 5th',
        frets: [2, -1, 0, 2, 3, 2],
        fingers: [1, 0, 0, 2, 4, 3],
        baseFret: 1,
      },
    ],
  },
  'G/B': {
    chord: 'G/B',
    name: 'G Major with B Bass',
    root: 'G',
    quality: 'slash',
    notes: ['B', 'G', 'D'],
    intervals: ['3', '1', '5'],
    voicings: [
      {
        name: 'Open Position',
        frets: [-1, 2, 0, 0, 0, 3],
        fingers: [0, 1, 0, 0, 0, 3],
        baseFret: 1,
      },
      {
        name: '4-finger Open',
        frets: [-1, 2, 0, 0, 3, 3],
        fingers: [0, 1, 0, 0, 3, 4],
        baseFret: 1,
      },
    ],
  },
  'C/E': {
    chord: 'C/E',
    name: 'C Major with E Bass',
    root: 'C',
    quality: 'slash',
    notes: ['E', 'C', 'G'],
    intervals: ['3', '1', '5'],
    voicings: [
      {
        name: 'Open Position',
        frets: [0, 3, 2, 0, 1, 0],
        fingers: [0, 3, 2, 0, 1, 0],
        baseFret: 1,
      },
    ],
  },
  'A/E': {
    chord: 'A/E',
    name: 'A Major with E Bass',
    root: 'A',
    quality: 'slash',
    notes: ['E', 'A', 'C#'],
    intervals: ['5', '1', '3'],
    voicings: [
      {
        name: 'Open Position',
        frets: [0, 0, 2, 2, 2, 0],
        fingers: [0, 0, 1, 2, 3, 0],
        baseFret: 1,
      },
    ],
  },
  'Am/G': {
    chord: 'Am/G',
    name: 'A Minor with G Bass',
    root: 'A',
    quality: 'slash',
    notes: ['G', 'A', 'C', 'E'],
    intervals: ['b7', '1', 'b3', '5'],
    voicings: [
      {
        name: 'Open Position',
        frets: [3, 0, 2, 2, 1, 0],
        fingers: [3, 0, 2, 2, 1, 0],
        baseFret: 1,
      },
    ],
  },
};

/**
 * Root note distance from C (semitones: C=0, C#=1, D=2, ...)
 */
const NOTE_SEMITONE_MAP: Record<string, number> = {
  'C': 0, 'B#': 0,
  'C#': 1, 'Db': 1,
  'D': 2,
  'D#': 3, 'Eb': 3,
  'E': 4, 'Fb': 4,
  'F': 5, 'E#': 5,
  'F#': 6, 'Gb': 6,
  'G': 7,
  'G#': 8, 'Ab': 8,
  'A': 9,
  'A#': 10, 'Bb': 10,
  'B': 11, 'Cb': 11,
};

/**
 * Parses any arbitrary chord name into Root, Quality/Suffix, and Bass Note
 * e.g. "F#m7/C#" -> root: "F#", quality: "m7", bass: "C#"
 */
export function parseChordName(chordName: string): { root: string; quality: string; bass?: string } {
  if (!chordName) return { root: '', quality: '' };
  
  const parts = chordName.trim().split('/');
  const main = parts[0];
  const bass = parts[1] ? parts[1].trim() : undefined;

  const match = main.match(/^([A-G][#b]?)(.*)$/);
  if (!match) {
    return { root: chordName, quality: '', bass };
  }

  return {
    root: match[1],
    quality: match[2],
    bass,
  };
}

/**
 * Dynamically generate movable CAGED barre chord voicings for any chord
 * if it doesn't already have an entry in the static library.
 */
export function generateMovableChord(chordName: string): GuitarChordData | null {
  const { root, quality, bass } = parseChordName(chordName);
  const rootSemis = NOTE_SEMITONE_MAP[root];
  if (rootSemis === undefined) return null;

  const isMinor = /^(m|min|minor)(?!aj)/i.test(quality);
  const isMaj7 = /maj7|M7/i.test(quality);
  const is7 = /7(?!sus)/i.test(quality) && !isMaj7 && !isMinor;
  const isM7 = isMinor && /7/.test(quality);
  const isSus4 = /sus4|sus(?!2)/i.test(quality);
  const isSus2 = /sus2/i.test(quality);

  const voicings: ChordVoicing[] = [];

  // 1. E-shape movable barre (Root on 6th string, Low E is fret rootSemis + (rootSemis < 4 ? 12 : 0) - 4)
  // E is semitone 4. So F (5) is fret 1. G (7) is fret 3. A (9) is fret 5.
  let eFret = (rootSemis - 4 + 12) % 12;
  if (eFret === 0) eFret = 12;

  if (isMinor) {
    // Em shape: [0, 2, 2, 0, 0, 0] transposed
    voicings.push({
      name: `${eFret}th Fret Barre (Em-shape)`,
      frets: [eFret, eFret + 2, eFret + 2, eFret, eFret, eFret],
      fingers: [1, 3, 4, 1, 1, 1],
      baseFret: eFret,
      barres: [{ fret: eFret, fromString: 0, toString: 5, finger: 1 }],
    });
  } else if (is7) {
    // E7 shape: [0, 2, 0, 1, 0, 0] transposed
    voicings.push({
      name: `${eFret}th Fret Barre (E7-shape)`,
      frets: [eFret, eFret + 2, eFret, eFret + 1, eFret, eFret],
      fingers: [1, 3, 1, 2, 1, 1],
      baseFret: eFret,
      barres: [{ fret: eFret, fromString: 0, toString: 5, finger: 1 }],
    });
  } else if (isM7) {
    // Em7 shape: [0, 2, 0, 0, 0, 0] transposed
    voicings.push({
      name: `${eFret}th Fret Barre (Em7-shape)`,
      frets: [eFret, eFret + 2, eFret, eFret, eFret, eFret],
      fingers: [1, 3, 1, 1, 1, 1],
      baseFret: eFret,
      barres: [{ fret: eFret, fromString: 0, toString: 5, finger: 1 }],
    });
  } else {
    // E Major shape: [0, 2, 2, 1, 0, 0] transposed
    voicings.push({
      name: `${eFret}th Fret Barre (E-shape)`,
      frets: [eFret, eFret + 2, eFret + 2, eFret + 1, eFret, eFret],
      fingers: [1, 3, 4, 2, 1, 1],
      baseFret: eFret,
      barres: [{ fret: eFret, fromString: 0, toString: 5, finger: 1 }],
    });
  }

  // 2. A-shape movable barre (Root on 5th string, A is semitone 9. Bb is fret 1. C is fret 3. D is fret 5.)
  let aFret = (rootSemis - 9 + 12) % 12;
  if (aFret === 0) aFret = 12;

  if (isMinor) {
    // Am shape: [-1, 0, 2, 2, 1, 0] transposed
    voicings.push({
      name: `${aFret}th Fret Barre (Am-shape)`,
      frets: [-1, aFret, aFret + 2, aFret + 2, aFret + 1, aFret],
      fingers: [0, 1, 3, 4, 2, 1],
      baseFret: aFret,
      barres: [{ fret: aFret, fromString: 1, toString: 5, finger: 1 }],
    });
  } else if (is7) {
    // A7 shape: [-1, 0, 2, 0, 2, 0] transposed
    voicings.push({
      name: `${aFret}th Fret Barre (A7-shape)`,
      frets: [-1, aFret, aFret + 2, aFret, aFret + 2, aFret],
      fingers: [0, 1, 3, 1, 4, 1],
      baseFret: aFret,
      barres: [{ fret: aFret, fromString: 1, toString: 5, finger: 1 }],
    });
  } else {
    // A Major shape: [-1, 0, 2, 2, 2, 0] transposed
    voicings.push({
      name: `${aFret}th Fret Barre (A-shape)`,
      frets: [-1, aFret, aFret + 2, aFret + 2, aFret + 2, aFret],
      fingers: [0, 1, 2, 3, 4, 1],
      baseFret: aFret,
      barres: [{ fret: aFret, fromString: 1, toString: 5, finger: 1 }],
    });
  }

  // Determine notes and intervals
  const baseNotes: string[] = [root];
  const intervals: string[] = ['1'];

  const thirdOffset = isMinor ? 3 : isSus4 ? 5 : isSus2 ? 2 : 4;
  const thirdNote = CHROMATIC_NOTES_SHARP[(rootSemis + thirdOffset) % 12];
  baseNotes.push(thirdNote);
  intervals.push(isMinor ? 'b3' : isSus4 ? '4' : isSus2 ? '2' : '3');

  const fifthNote = CHROMATIC_NOTES_SHARP[(rootSemis + 7) % 12];
  baseNotes.push(fifthNote);
  intervals.push('5');

  if (is7 || isM7) {
    const seventh = CHROMATIC_NOTES_SHARP[(rootSemis + 10) % 12];
    baseNotes.push(seventh);
    intervals.push('b7');
  } else if (isMaj7) {
    const maj7th = CHROMATIC_NOTES_SHARP[(rootSemis + 11) % 12];
    baseNotes.push(maj7th);
    intervals.push('7');
  }

  return {
    chord: chordName,
    name: `${root} ${quality || 'Major'}${bass ? ` / ${bass}` : ''}`.trim(),
    root,
    quality: quality || 'major',
    notes: baseNotes,
    intervals,
    voicings,
  };
}

/**
 * Retrieves comprehensive chord data for any requested chord symbol.
 * Checks static dictionary first, falls back to CAGED procedural generator.
 */
export function getGuitarChordData(chordName: string): GuitarChordData | null {
  if (!chordName) return null;
  const trimmed = chordName.trim();

  // 1. Direct match
  if (GUITAR_CHORDS_LIBRARY[trimmed]) {
    return GUITAR_CHORDS_LIBRARY[trimmed];
  }

  // 2. Check without slash bass if slash chord not specifically found
  const { root, quality, bass } = parseChordName(trimmed);
  const baseChord = `${root}${quality}`;

  if (bass && GUITAR_CHORDS_LIBRARY[baseChord]) {
    const baseData = GUITAR_CHORDS_LIBRARY[baseChord];
    return {
      ...baseData,
      chord: trimmed,
      name: `${baseData.name} (Bass in ${bass})`,
    };
  }

  // 3. Fallback to procedural movable generator
  return generateMovableChord(trimmed);
}

/**
 * Sound synthesis for plucking or strumming a guitar chord using Web Audio API
 */
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Pluck a single guitar string at a specific frequency
 */
export function playGuitarNote(stringIndex: number, fret: number): void {
  if (fret < 0) return; // Muted string
  const ctx = getAudioContext();
  if (!ctx) return;

  // Calculate frequency: MIDI note for open strings: [40, 45, 50, 55, 59, 64]
  const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
  const midiNote = OPEN_MIDI[stringIndex] + fret;
  const freq = 440 * Math.pow(2, (midiNote - 69) / 12);

  const now = ctx.currentTime;

  // Guitar-like physical synthesis: Triangle oscillator + sub harmonics + lowpass filter envelope
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, now);

  osc2.type = 'sawtooth';
  osc2.frequency.setValueAtTime(freq * 2, now); // 2nd harmonic sparkle

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(freq * 6, now);
  filter.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 1.2);

  // Pluck attack & natural decay
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.25, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

  const osc2Gain = ctx.createGain();
  osc2Gain.gain.setValueAtTime(0.08, now);
  osc2Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

  osc.connect(filter);
  osc2.connect(osc2Gain);
  osc2Gain.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc2.start(now);
  osc.stop(now + 2.0);
  osc2.stop(now + 2.0);
}

/**
 * Strum the entire chord with realistic staggered acoustic guitar string delay
 */
export function strumGuitarChord(frets: number[], downstroke = true): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const validStrings: { stringIndex: number; fret: number }[] = [];
  frets.forEach((fret, i) => {
    if (fret >= 0) {
      validStrings.push({ stringIndex: i, fret });
    }
  });

  if (!downstroke) {
    validStrings.reverse();
  }

  // Stagger plucks by ~28-35ms
  validStrings.forEach((item, index) => {
    setTimeout(() => {
      playGuitarNote(item.stringIndex, item.fret);
    }, index * 32);
  });
}
