import { ChordProLine, ChordSegment, ParsedChordPro, Song } from '../types';

// Chromatic scales
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Map for pitch index normalization
const NOTE_PITCH_MAP: Record<string, number> = {
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

// Common keys that typically prefer flats
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

/**
 * Transposes a single note (e.g., "C#", "Bb", "F") by a given number of semitones.
 */
export function transposeNote(note: string, semitones: number, preferSharps?: boolean): string {
  if (!note || semitones === 0) return note;

  const cleanNote = note.trim();
  const pitch = NOTE_PITCH_MAP[cleanNote];
  if (pitch === undefined) return note;

  // Normalize semitones to 0 - 11 range
  const newPitch = (pitch + (semitones % 12) + 12) % 12;

  if (preferSharps !== undefined) {
    return preferSharps ? SHARPS[newPitch] : FLATS[newPitch];
  }

  // Preserve flat if original was flat, else default to sharp
  if (cleanNote.includes('b')) {
    return FLATS[newPitch];
  }
  return SHARPS[newPitch];
}

/**
 * Regex to parse a chord into: Root, Accidental, Suffix/Quality, and optional Slash Bass
 * Examples:
 * "C#m7/G#" -> root: "C", acc: "#", suffix: "m7", bass: "G#"
 * "Bbmaj7"   -> root: "B", acc: "b", suffix: "maj7", bass: undefined
 * "F#sus4/A" -> root: "F", acc: "#", suffix: "sus4", bass: "A"
 */
const CHORD_REGEX = /^([A-Ga-g])([#b]?)([^/]*)(?:\/([A-Ga-g][#b]?))?$/;

/**
 * Transposes a full chord name (e.g. "Am7", "F#/A#", "Gadd9", "C#m7b5")
 */
export function transposeChord(chord: string, semitones: number, preferSharps?: boolean): string {
  if (!chord || semitones === 0) return chord;

  const match = chord.trim().match(CHORD_REGEX);
  if (!match) return chord;

  const [, rootLetter, accidental, suffix, slashBass] = match;
  const rootNote = rootLetter.toUpperCase() + accidental;
  
  const transposedRoot = transposeNote(rootNote, semitones, preferSharps);
  
  let transposedBass = '';
  if (slashBass) {
    transposedBass = '/' + transposeNote(slashBass, semitones, preferSharps);
  }

  return `${transposedRoot}${suffix}${transposedBass}`;
}

/**
 * Parse standard ChordPro file format into structured AST
 */
export function parseChordPro(chordProText: string): ParsedChordPro {
  const lines = chordProText.split(/\r?\n/);
  const metadata: Record<string, string> = {};
  const parsedLines: ChordProLine[] = [];

  let title = 'Untitled Song';
  let artist = 'Unknown Artist';
  let subtitle = '';
  let key: string | undefined;
  let tempo: number | undefined;
  let timeSignature = '4/4';
  let capo: number | undefined;
  let duration = '';
  let inTab = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      parsedLines.push({ type: 'empty', raw: line });
      continue;
    }

    // Directive parsing: {directive: value} or {directive}
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const inner = trimmed.slice(1, -1).trim();
      const colonIndex = inner.indexOf(':');
      let directive = '';
      let value = '';

      if (colonIndex !== -1) {
        directive = inner.slice(0, colonIndex).trim().toLowerCase();
        value = inner.slice(colonIndex + 1).trim();
      } else {
        directive = inner.toLowerCase();
      }

      metadata[directive] = value;

      switch (directive) {
        case 'title':
        case 't':
          title = value;
          break;
        case 'artist':
        case 'a':
          artist = value;
          break;
        case 'subtitle':
        case 'st':
        case 'sub':
          subtitle = value;
          break;
        case 'key':
        case 'k':
          key = value;
          break;
        case 'tempo':
        case 'bpm': {
          const num = parseInt(value, 10);
          if (!isNaN(num) && num > 20 && num < 320) {
            tempo = num;
          }
          break;
        }
        case 'time':
        case 'timesig':
          timeSignature = value;
          break;
        case 'capo': {
          const num = parseInt(value, 10);
          if (!isNaN(num)) capo = num;
          break;
        }
        case 'duration':
          duration = value;
          break;
        case 'comment':
        case 'c':
        case 'ci':
        case 'cb':
          parsedLines.push({ type: 'comment', text: value, raw: line });
          break;
        case 'start_of_chorus':
        case 'soc':
          parsedLines.push({ type: 'chorus_start', raw: line, text: value || 'Chorus' });
          break;
        case 'end_of_chorus':
        case 'eoc':
          parsedLines.push({ type: 'chorus_end', raw: line });
          break;
        case 'start_of_bridge':
        case 'sob':
          parsedLines.push({ type: 'bridge_start', raw: line, text: value || 'Bridge' });
          break;
        case 'end_of_bridge':
        case 'eob':
          parsedLines.push({ type: 'bridge_end', raw: line });
          break;
        case 'start_of_tab':
        case 'sot':
          inTab = true;
          parsedLines.push({ type: 'tab_start', raw: line });
          break;
        case 'end_of_tab':
        case 'eot':
          inTab = false;
          parsedLines.push({ type: 'tab_end', raw: line });
          break;
        default:
          parsedLines.push({ type: 'directive', text: `${directive}: ${value}`, raw: line });
          break;
      }
      continue;
    }

    if (inTab) {
      parsedLines.push({ type: 'tab', text: line, raw: line });
      continue;
    }

    // Parse lyrics line with embedded chords: e.g. [Am]Amazing [F]grace
    const segments: ChordSegment[] = [];
    let currentIndex = 0;
    const chordMatches = [...line.matchAll(/\[([^\]]+)\]/g)];

    if (chordMatches.length === 0) {
      // Plain lyric line or text
      parsedLines.push({
        type: 'lyrics',
        segments: [{ lyrics: line }],
        raw: line,
      });
      continue;
    }

    for (let m = 0; m < chordMatches.length; m++) {
      const match = chordMatches[m];
      const chordText = match[1];
      const matchIndex = match.index!;

      // Lyrics before this chord (if at the start of line)
      if (matchIndex > currentIndex) {
        const precedingLyrics = line.slice(currentIndex, matchIndex);
        if (segments.length === 0) {
          segments.push({ lyrics: precedingLyrics });
        } else {
          segments[segments.length - 1].lyrics += precedingLyrics;
        }
      }

      // Next lyrics belong to this chord until next chord or end of line
      const nextMatch = chordMatches[m + 1];
      const chordEnd = matchIndex + match[0].length;
      const lyricsEnd = nextMatch ? nextMatch.index! : line.length;
      const trailingLyrics = line.slice(chordEnd, lyricsEnd);

      segments.push({
        chord: chordText,
        lyrics: trailingLyrics,
        isChordOnly: trailingLyrics.trim().length === 0 && m === chordMatches.length - 1 && currentIndex === 0,
      });

      currentIndex = lyricsEnd;
    }

    parsedLines.push({
      type: 'lyrics',
      segments,
      raw: line,
    });
  }

  // Attempt to infer key from first chord if not specified
  if (!key) {
    for (const pl of parsedLines) {
      if (pl.type === 'lyrics' && pl.segments) {
        for (const seg of pl.segments) {
          if (seg.chord) {
            const m = seg.chord.match(/^([A-G][#b]?m?)/);
            if (m) {
              key = m[1];
              break;
            }
          }
        }
      }
      if (key) break;
    }
  }

  // Default tempo if not specified
  if (!tempo) {
    tempo = 100;
  }

  return {
    title,
    artist,
    subtitle,
    key,
    tempo,
    timeSignature,
    capo,
    duration,
    lines: parsedLines,
    metadata,
    raw: chordProText,
  };
}

/**
 * Re-serialize parsed song back to ChordPro format with applied transposition
 */
export function serializeChordPro(parsed: ParsedChordPro, transposeSemitones: number = 0, preferSharps?: boolean): string {
  const result: string[] = [];

  // Header directives
  result.push(`{title: ${parsed.title}}`);
  if (parsed.artist) result.push(`{artist: ${parsed.artist}}`);
  if (parsed.subtitle) result.push(`{subtitle: ${parsed.subtitle}}`);
  
  if (parsed.key) {
    const newKey = transposeChord(parsed.key, transposeSemitones, preferSharps);
    result.push(`{key: ${newKey}}`);
  }
  if (parsed.tempo) result.push(`{tempo: ${parsed.tempo}}`);
  if (parsed.timeSignature) result.push(`{time: ${parsed.timeSignature}}`);
  if (parsed.capo) result.push(`{capo: ${parsed.capo}}`);
  if (parsed.duration) result.push(`{duration: ${parsed.duration}}`);
  result.push('');

  for (const line of parsed.lines) {
    switch (line.type) {
      case 'empty':
        result.push('');
        break;
      case 'comment':
        result.push(`{comment: ${line.text || ''}}`);
        break;
      case 'chorus_start':
        result.push('{start_of_chorus}');
        break;
      case 'chorus_end':
        result.push('{end_of_chorus}');
        break;
      case 'bridge_start':
        result.push('{start_of_bridge}');
        break;
      case 'bridge_end':
        result.push('{end_of_bridge}');
        break;
      case 'tab_start':
        result.push('{start_of_tab}');
        break;
      case 'tab_end':
        result.push('{end_of_tab}');
        break;
      case 'tab':
        result.push(line.text || '');
        break;
      case 'lyrics':
        if (line.segments) {
          let lineStr = '';
          for (const seg of line.segments) {
            if (seg.chord) {
              const tc = transposeChord(seg.chord, transposeSemitones, preferSharps);
              lineStr += `[${tc}]`;
            }
            lineStr += seg.lyrics;
          }
          result.push(lineStr);
        } else {
          result.push(line.raw || '');
        }
        break;
      default:
        result.push(line.raw || '');
        break;
    }
  }

  return result.join('\n');
}

/**
 * Creates a Song object from raw ChordPro text
 */
export function createSongFromChordPro(rawText: string, filePath?: string, fileName?: string): Song {
  const parsed = parseChordPro(rawText);
  const id = 'song_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
  
  return {
    id,
    title: parsed.title,
    artist: parsed.artist,
    subtitle: parsed.subtitle,
    key: parsed.key,
    tempo: parsed.tempo,
    timeSignature: parsed.timeSignature,
    capo: parsed.capo,
    duration: parsed.duration,
    rawChordPro: rawText,
    parsed,
    filePath: filePath || '',
    fileName: fileName || `${parsed.artist} - ${parsed.title}.cho`,
    dateAdded: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Helper to determine if a key signature typically uses flats
 */
export function shouldUseFlats(key?: string): boolean {
  if (!key) return false;
  return FLAT_KEYS.has(key.trim());
}

/**
 * Guitar chord diagrams database for common chords
 * strings: [E, A, D, G, B, e] where -1 = mute, 0 = open, 1-4 = fret number
 */
export interface GuitarChordFingering {
  chord: string;
  frets: number[]; // 6 elements [E, A, D, G, B, e]
  baseFret?: number;
  barre?: number;
}

export const GUITAR_CHORDS_DB: Record<string, GuitarChordFingering> = {
  'C': { chord: 'C', frets: [-1, 3, 2, 0, 1, 0] },
  'Cm': { chord: 'Cm', frets: [-1, 3, 5, 5, 4, 3], baseFret: 3, barre: 3 },
  'C7': { chord: 'C7', frets: [-1, 3, 2, 3, 1, 0] },
  'Cmaj7': { chord: 'Cmaj7', frets: [-1, 3, 2, 0, 0, 0] },
  'D': { chord: 'D', frets: [-1, -1, 0, 2, 3, 2] },
  'Dm': { chord: 'Dm', frets: [-1, -1, 0, 2, 3, 1] },
  'D7': { chord: 'D7', frets: [-1, -1, 0, 2, 1, 2] },
  'Dsus4': { chord: 'Dsus4', frets: [-1, -1, 0, 2, 3, 3] },
  'E': { chord: 'E', frets: [0, 2, 2, 1, 0, 0] },
  'Em': { chord: 'Em', frets: [0, 2, 2, 0, 0, 0] },
  'E7': { chord: 'E7', frets: [0, 2, 0, 1, 0, 0] },
  'Em7': { chord: 'Em7', frets: [0, 2, 0, 0, 0, 0] },
  'F': { chord: 'F', frets: [1, 3, 3, 2, 1, 1], baseFret: 1, barre: 1 },
  'Fm': { chord: 'Fm', frets: [1, 3, 3, 1, 1, 1], baseFret: 1, barre: 1 },
  'F#m': { chord: 'F#m', frets: [2, 4, 4, 2, 2, 2], baseFret: 2, barre: 2 },
  'F#': { chord: 'F#', frets: [2, 4, 4, 3, 2, 2], baseFret: 2, barre: 2 },
  'G': { chord: 'G', frets: [3, 2, 0, 0, 0, 3] },
  'Gm': { chord: 'Gm', frets: [3, 5, 5, 3, 3, 3], baseFret: 3, barre: 3 },
  'G7': { chord: 'G7', frets: [3, 2, 0, 0, 0, 1] },
  'A': { chord: 'A', frets: [-1, 0, 2, 2, 2, 0] },
  'Am': { chord: 'Am', frets: [-1, 0, 2, 2, 1, 0] },
  'A7': { chord: 'A7', frets: [-1, 0, 2, 0, 2, 0] },
  'Am7': { chord: 'Am7', frets: [-1, 0, 2, 0, 1, 0] },
  'B': { chord: 'B', frets: [-1, 2, 4, 4, 4, 2], baseFret: 2, barre: 2 },
  'Bm': { chord: 'Bm', frets: [-1, 2, 4, 4, 3, 2], baseFret: 2, barre: 2 },
  'B7': { chord: 'B7', frets: [-1, 2, 1, 2, 0, 2] },
  'Bb': { chord: 'Bb', frets: [-1, 1, 3, 3, 3, 1], baseFret: 1, barre: 1 },
  'Bbm': { chord: 'Bbm', frets: [-1, 1, 3, 3, 2, 1], baseFret: 1, barre: 1 },
  'Eb': { chord: 'Eb', frets: [-1, 6, 8, 8, 8, 6], baseFret: 6, barre: 6 },
  'Ab': { chord: 'Ab', frets: [4, 6, 6, 5, 4, 4], baseFret: 4, barre: 4 },
  'C#m': { chord: 'C#m', frets: [-1, 4, 6, 6, 5, 4], baseFret: 4, barre: 4 },
};

export function getGuitarChord(chordName: string): GuitarChordFingering | undefined {
  if (!chordName) return undefined;
  // Clean slash bass for fingering lookup
  const clean = chordName.split('/')[0].trim();
  return GUITAR_CHORDS_DB[clean];
}
