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
  let era: string | undefined;
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
        case 'era':
        case 'decade':
        case 'year':
          era = value;
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
    era,
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
  if (parsed.era) result.push(`{era: ${parsed.era}}`);
  
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
 * Generates a stable deterministic ID for a song based on filename or artist + title
 */
export function generateDeterministicSongId(title: string, artist: string, fileName?: string): string {
  const cleanSource = (fileName || `${artist} - ${title}`)
    .toLowerCase()
    .trim()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `song_${cleanSource || 'untitled'}`;
}

/**
 * Deduplicates an array of songs, preserving unique songs by ID and normalized Artist+Title
 */
export function deduplicateSongs(songs: Song[]): Song[] {
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const uniqueSongs: Song[] = [];

  for (const song of songs) {
    const normKey = `${(song.artist || '').trim().toLowerCase()}:::${(song.title || '').trim().toLowerCase()}`;
    const id = song.id;

    if (!seenIds.has(id) && (!normKey || normKey === ':::' || !seenKeys.has(normKey))) {
      seenIds.add(id);
      if (normKey && normKey !== ':::') {
        seenKeys.add(normKey);
      }
      uniqueSongs.push(song);
    }
  }

  return uniqueSongs;
}

/**
 * Creates a Song object from raw ChordPro text
 */
export function createSongFromChordPro(rawText: string, filePath?: string, fileName?: string, explicitId?: string): Song {
  const parsed = parseChordPro(rawText);
  const id = explicitId || generateDeterministicSongId(parsed.title, parsed.artist, fileName);
  
  return {
    id,
    title: parsed.title,
    artist: parsed.artist,
    subtitle: parsed.subtitle,
    key: parsed.key,
    era: parsed.era,
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

/**
 * Truncate a single lyrics line to its first 3 words for Summary Mode
 * Retains chords that fall within those 3 words or the first chord as reminder
 */
export function truncateLyricLineTo3Words(line: ChordProLine): ChordProLine {
  if (line.type !== 'lyrics' || !line.segments || line.segments.length === 0) {
    return line;
  }

  const totalText = line.segments.map((s) => s.lyrics || '').join('');
  const trimmedTotal = totalText.trim();
  if (!trimmedTotal) {
    // Chord-only line
    return line;
  }

  let wordsCounted = 0;
  const newSegments: ChordSegment[] = [];

  for (let i = 0; i < line.segments.length; i++) {
    const seg = line.segments[i];
    const segLyrics = seg.lyrics || '';

    if (wordsCounted >= 3) {
      break;
    }

    const tokens = segLyrics.split(/(\s+)/);
    let keptSegLyrics = '';

    for (let t = 0; t < tokens.length; t++) {
      const token = tokens[t];
      if (token.trim().length > 0) {
        if (wordsCounted < 3) {
          wordsCounted++;
          keptSegLyrics += token;
        } else {
          break;
        }
      } else {
        if (wordsCounted < 3) {
          keptSegLyrics += token;
        }
      }
    }

    newSegments.push({
      chord: seg.chord,
      lyrics: keptSegLyrics,
      isChordOnly: seg.isChordOnly,
    });
  }

  // If original had more than 3 words, append ellipsis
  const allWords = trimmedTotal.split(/\s+/);
  if (allWords.length > 3 && newSegments.length > 0) {
    const lastSeg = newSegments[newSegments.length - 1];
    const trimmedEnd = (lastSeg.lyrics || '').trimEnd();
    lastSeg.lyrics = trimmedEnd ? `${trimmedEnd}...` : '...';
  }

  // If new segments have no chord at all, but original line had a chord, attach first chord
  const hasAnyChordInNew = newSegments.some((s) => !!s.chord);
  if (!hasAnyChordInNew) {
    const firstChordInOrig = line.segments.find((s) => !!s.chord)?.chord;
    if (firstChordInOrig && newSegments.length > 0) {
      newSegments[0].chord = firstChordInOrig;
    }
  }

  return {
    ...line,
    segments: newSegments,
  };
}

export interface SectionBlock {
  header?: ChordProLine;
  footer?: ChordProLine;
  lines: ChordProLine[];
}

/**
 * Partition parsed ChordPro lines into logical song sections
 */
export function partitionIntoSections(lines: ChordProLine[]): SectionBlock[] {
  const sections: SectionBlock[] = [];
  let currentSection: SectionBlock = { lines: [] };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (
      line.type === 'comment' ||
      line.type === 'chorus_start' ||
      line.type === 'bridge_start' ||
      line.type === 'tab_start'
    ) {
      if (currentSection.header || currentSection.lines.length > 0) {
        sections.push(currentSection);
      }
      currentSection = {
        header: line,
        lines: [],
      };
    } else if (
      line.type === 'chorus_end' ||
      line.type === 'bridge_end' ||
      line.type === 'tab_end'
    ) {
      currentSection.footer = line;
      sections.push(currentSection);
      currentSection = { lines: [] };
    } else if (line.type === 'empty') {
      // Empty line closes the current unblocked section
      if (!currentSection.header || currentSection.header.type === 'comment') {
        if (currentSection.lines.length > 0) {
          sections.push(currentSection);
          currentSection = { lines: [] };
        }
      }
    } else if (line.type === 'directive') {
      // Skip directive lines in summary structure
    } else {
      currentSection.lines.push(line);
    }
  }

  if (currentSection.header || currentSection.lines.length > 0) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Generate Summary Mode lines from full ChordPro parsed lines
 * - Retains section headers
 * - For lyrics: only first 3 words of first line of each section with '...'
 * - For chords: full progressions shown for intro/outro/instrumental/solo/bridge with no lyrics;
 *   for verses/chorus with lyrics, only chords of the first reminder line are shown.
 */
export function generateSummaryLines(lines: ChordProLine[]): ChordProLine[] {
  const sections = partitionIntoSections(lines);
  const result: ChordProLine[] = [];

  sections.forEach((section, sIdx) => {
    // 1. Output Section Header
    if (section.header) {
      result.push(section.header);
    }

    // 2. Check if section has lyrics
    const hasLyrics = section.lines.some((l) => {
      if (l.type !== 'lyrics' || !l.segments) return false;
      const text = l.segments.map((s) => s.lyrics || '').join('').trim();
      return text.length > 0;
    });

    if (!hasLyrics) {
      // No lyrics in this section (e.g. Intro Bass Riff, Solo, Tab, Instrumental) -> retain all chords/tabs
      result.push(...section.lines);
    } else {
      // Section has lyrics: keep chords before first lyric, then first lyric line truncated to 3 words
      const firstLyricIndex = section.lines.findIndex((l) => {
        if (l.type !== 'lyrics' || !l.segments) return false;
        const text = l.segments.map((s) => s.lyrics || '').join('').trim();
        return text.length > 0;
      });

      if (firstLyricIndex !== -1) {
        // Retain any chord-only lines that preceded the first lyric line
        for (let i = 0; i < firstLyricIndex; i++) {
          result.push(section.lines[i]);
        }
        // Truncate the first lyric line to 3 words + reminder chords
        result.push(truncateLyricLineTo3Words(section.lines[firstLyricIndex]));
      }
    }

    // 3. Output Section Footer
    if (section.footer) {
      result.push(section.footer);
    }

    // 4. Space between sections
    if (sIdx < sections.length - 1) {
      result.push({ type: 'empty', raw: '' });
    }
  });

  return result;
}

