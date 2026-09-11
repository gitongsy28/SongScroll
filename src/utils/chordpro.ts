import { BackTrackItem, BackTrackType, ChordProLine, ChordSegment, ParsedChordPro, Song } from '../types';
import { ChordVoicing } from './guitarChords';

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
 * Transposes a full chord name (e.g. "Am7", "F#/A#", "Gadd9", "C#m7b5", "*G7", "**C")
 */
export function transposeChord(chord: string, semitones: number, preferSharps?: boolean): string {
  if (!chord || semitones === 0) return chord;

  const trimmed = chord.trim();
  // Extract leading or trailing asterisks used for altered/custom chords
  const prefixMatch = trimmed.match(/^(\*+)(.*)$/);
  const prefixAsterisks = prefixMatch ? prefixMatch[1] : '';
  const withoutPrefix = prefixMatch ? prefixMatch[2] : trimmed;

  const suffixMatch = withoutPrefix.match(/^(.*?)(\*+)$/);
  const suffixAsterisks = suffixMatch ? suffixMatch[2] : '';
  const coreChord = suffixMatch ? suffixMatch[1] : withoutPrefix;

  const match = coreChord.match(CHORD_REGEX);
  if (!match) return chord;

  const [, rootLetter, accidental, suffix, slashBass] = match;
  const rootNote = rootLetter.toUpperCase() + accidental;
  
  const transposedRoot = transposeNote(rootNote, semitones, preferSharps);
  
  let transposedBass = '';
  if (slashBass) {
    transposedBass = '/' + transposeNote(slashBass, semitones, preferSharps);
  }

  return `${prefixAsterisks}${transposedRoot}${suffix}${transposedBass}${suffixAsterisks}`;
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
  let scrollSpeed: number | undefined;
  const backtracksMap = new Map<number, BackTrackItem>();
  const customChordsMap: Record<string, ChordVoicing> = {};
  let inTab = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prevParsedCount = parsedLines.length;
    const trimmed = line.trim();

    if (!trimmed) {
      parsedLines.push({ type: 'empty', raw: line, sourceLineIndex: i });
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
        case 'meta': {
          // ChordPro meta directive: {meta: key value} e.g. {meta: ScrollSpeed 15}
          const match = value.match(/^([a-zA-Z0-9_-]+)(?:[\s:=]+(.*))?$/);
          if (match) {
            const metaKey = match[1].trim();
            const metaVal = (match[2] || '').trim();
            metadata[metaKey] = metaVal;
            const normKey = metaKey.toLowerCase();
            if (normKey === 'scrollspeed' || normKey === 'scroll_speed' || normKey === 'speed') {
              const num = parseFloat(metaVal);
              if (!isNaN(num) && num > 0) {
                scrollSpeed = num;
              }
            } else if (/^backtrack([1-5])$/.test(normKey)) {
              const bt = parseBackTrackEntry(metaKey, metaVal, line);
              if (bt) {
                backtracksMap.set(bt.index, bt);
              }
            } else if (normKey === 'scrollpausesec' || normKey === 'scroll_pause_sec' || normKey === 'scrollpause') {
              const pauseNum = parseFloat(metaVal.replace(/^[:\s=]+/, ''));
              parsedLines.push({
                type: 'scroll_pause',
                pauseSeconds: !isNaN(pauseNum) && pauseNum > 0 ? pauseNum : 5,
                raw: line,
              });
            }
          }
          break;
        }
        case 'scrollpausesec':
        case 'scroll_pause_sec':
        case 'scrollpause': {
          const pauseNum = parseFloat(value.replace(/^[:\s=]+/, ''));
          parsedLines.push({
            type: 'scroll_pause',
            pauseSeconds: !isNaN(pauseNum) && pauseNum > 0 ? pauseNum : 5,
            raw: line,
          });
          break;
        }
        case 'define':
        case 'd': {
          const customVoicing = parseChordDefineDirective(value);
          if (customVoicing) {
            customChordsMap[customVoicing.name] = customVoicing.voicing;
          }
          parsedLines.push({ type: 'define', text: value, raw: line });
          break;
        }
        case 'backtrack1':
        case 'backtrack2':
        case 'backtrack3':
        case 'backtrack4':
        case 'backtrack5': {
          const bt = parseBackTrackEntry(directive, value, line);
          if (bt) {
            backtracksMap.set(bt.index, bt);
          }
          break;
        }
        case 'scrollspeed':
        case 'scroll_speed': {
          const num = parseFloat(value);
          if (!isNaN(num) && num > 0) {
            scrollSpeed = num;
          }
          break;
        }
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

    for (let k = prevParsedCount; k < parsedLines.length; k++) {
      parsedLines[k].sourceLineIndex = i;
    }
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

  const backtracks = Array.from(backtracksMap.values()).sort((a, b) => a.index - b.index);

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
    scrollSpeed,
    lines: parsedLines,
    metadata,
    backtracks,
    customChords: Object.keys(customChordsMap).length > 0 ? customChordsMap : undefined,
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
  if (parsed.scrollSpeed) result.push(`{meta: ScrollSpeed ${parsed.scrollSpeed}}`);
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
 * Updates or adds the {meta: ScrollSpeed <speed>} directive in a ChordPro raw string.
 * Preserves existing directives, chords, lyrics, comments, and structure.
 */
export function updateChordProScrollSpeed(rawChordPro: string, newSpeed: number): string {
  const metaRegex = /\{meta:\s*scrollspeed\b[^}]*\}/i;
  const directRegex = /\{scrollspeed\b[^}]*\}/i;

  if (metaRegex.test(rawChordPro)) {
    return rawChordPro.replace(metaRegex, `{meta: ScrollSpeed ${newSpeed}}`);
  }
  if (directRegex.test(rawChordPro)) {
    return rawChordPro.replace(directRegex, `{meta: ScrollSpeed ${newSpeed}}`);
  }

  // If not present, locate header section to insert directive cleanly
  const lines = rawChordPro.split(/\r?\n/);
  let insertIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim().toLowerCase();
    if (
      trimmed.startsWith('{title') ||
      trimmed.startsWith('{t:') ||
      trimmed.startsWith('{artist') ||
      trimmed.startsWith('{a:') ||
      trimmed.startsWith('{subtitle') ||
      trimmed.startsWith('{st:') ||
      trimmed.startsWith('{key') ||
      trimmed.startsWith('{k:') ||
      trimmed.startsWith('{tempo') ||
      trimmed.startsWith('{bpm') ||
      trimmed.startsWith('{time') ||
      trimmed.startsWith('{capo') ||
      trimmed.startsWith('{duration') ||
      trimmed.startsWith('{era') ||
      trimmed.startsWith('{meta')
    ) {
      insertIndex = i;
    } else if (trimmed && !trimmed.startsWith('{') && insertIndex >= 0) {
      break;
    }
  }

  if (insertIndex >= 0) {
    lines.splice(insertIndex + 1, 0, `{meta: ScrollSpeed ${newSpeed}}`);
    return lines.join('\n');
  }

  return `{meta: ScrollSpeed ${newSpeed}}\n${rawChordPro}`;
}

/**
 * Creates a Song object from raw ChordPro text
 */
export function createSongFromChordPro(rawText: string, filePath?: string, fileName?: string, explicitId?: string): Song {
  const parsed = parseChordPro(rawText);
  const derivedFileName = fileName || 
    (filePath ? filePath.split(/[/\\]/).pop() : undefined) || 
    `${parsed.artist ? `${parsed.artist} - ` : ''}${parsed.title || 'Untitled'}.cho`;
  const id = explicitId || generateDeterministicSongId(parsed.title, parsed.artist, derivedFileName);
  
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
    scrollSpeed: parsed.scrollSpeed,
    backtracks: parsed.backtracks,
    rawChordPro: rawText,
    parsed,
    filePath: filePath || '',
    fileName: derivedFileName,
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

/**
 * Parses a BackTrack metadata entry (e.g. key="BackTrack1", value="Babe BackTrack No Vocal : https://www.youtube.com/watch?v=sBRkqQhUERY : ")
 */
export function parseBackTrackEntry(key: string, value: string, rawLine?: string): BackTrackItem | null {
  const keyMatch = key.match(/^backtrack([1-5])$/i);
  if (!keyMatch) return null;
  const index = parseInt(keyMatch[1], 10);

  let content = (value || '').trim();
  // Strip trailing colon if present (e.g. "... : }")
  content = content.replace(/:\s*$/, '').trim();

  let description = '';
  let targetUrl = '';

  // Look for colon separator between description and target URL/path
  const colonIndex = content.indexOf(':');
  if (colonIndex !== -1) {
    const candidateDesc = content.slice(0, colonIndex).trim();
    const candidateUrl = content.slice(colonIndex + 1).trim();

    // Check if the first part looks like a scheme or drive letter rather than a description
    if (/^(https?:\/\/|file:\/\/|[a-zA-Z]:[\\/])/i.test(candidateDesc)) {
      description = `BackTrack ${index}`;
      targetUrl = content;
    } else {
      description = candidateDesc;
      targetUrl = candidateUrl.replace(/:\s*$/, '').trim();
    }
  } else {
    description = `BackTrack ${index}`;
    targetUrl = content;
  }

  const type = detectBackTrackType(targetUrl);

  return {
    id: `BackTrack${index}`,
    index,
    description: description || `BackTrack ${index}`,
    url: targetUrl,
    type,
    rawDirective: rawLine,
  };
}

/**
 * Classifies the type of BackTrack target
 */
export function detectBackTrackType(url: string): BackTrackType {
  const clean = (url || '').trim().toLowerCase();
  if (clean.includes('youtube.com/') || clean.includes('youtu.be/')) {
    return 'youtube';
  }
  if (clean.includes('github.com/') && (clean.endsWith('.mp3') || clean.endsWith('.wav') || clean.endsWith('.mp4') || clean.endsWith('.m4a') || clean.endsWith('.ogg'))) {
    return 'github';
  }
  if (/^[a-zA-Z]:[/\\]/.test((url || '').trim()) || clean.startsWith('file:///')) {
    return 'local';
  }
  if (clean.endsWith('.mp3') || clean.endsWith('.wav') || clean.endsWith('.ogg') || clean.endsWith('.m4a') || clean.endsWith('.flac') || clean.endsWith('.aac')) {
    return 'audio-url';
  }
  return 'web';
}

/**
 * Validates a BackTrack item, filtering out blank, incomplete, or template placeholder entries
 */
export function isValidBackTrack(item: BackTrackItem): boolean {
  if (!item || !item.url) return false;
  const url = item.url.trim();
  const desc = item.description.trim();

  // Filter out empty or whitespace
  if (!url || !desc) return false;

  // Filter out template placeholders
  if (
    desc.includes('<Link description>') ||
    desc.includes('<Description>') ||
    desc.includes('<Link') ||
    desc.toLowerCase() === 'description' ||
    desc.toLowerCase() === '<link description>'
  ) {
    return false;
  }

  if (
    url.includes('<URL') ||
    url.includes('<Path') ||
    url.includes('<Mp3') ||
    url.includes('<URL/Mp3/Mp4/Wav/etc>')
  ) {
    return false;
  }

  // Filter incomplete URLs
  if (
    url === 'https://' ||
    url === 'http://' ||
    url === 'https://www.youtube.com/watch?v=' ||
    url === 'https://youtu.be/'
  ) {
    return false;
  }

  // URL must be either a valid http/https URL, file URL, or valid local drive path
  if (/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(url)) return true;
  if (/^file:\/\/\/.+/i.test(url)) return true;
  if (/^[a-zA-Z]:[/\\][^\0]+$/i.test(url)) return true;
  if (/^\.?\/[^\0]+\.(mp3|wav|mp4|m4a|ogg|flac|aac|webm)$/i.test(url)) return true;
  if (/^https?:\/\//i.test(url) && url.length > 10) return true;

  return false;
}

/**
 * Extracts YouTube 11-character video ID from various YouTube URL formats
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

/**
 * Converts a GitHub blob URL to direct streamable raw URL for HTML5 audio
 */
export function getStreamableAudioUrl(url: string): string {
  if (!url) return '';
  if (url.includes('github.com') && url.includes('/blob/')) {
    return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
  }
  return url;
}

/**
 * Parses a standard ChordPro {define: Name base-fret N frets f1 f2 f3 f4 f5 f6} directive
 */
export function parseChordDefineDirective(directiveValue: string): { name: string; voicing: ChordVoicing } | null {
  const match = directiveValue.trim().match(/^([^\s:]+)\s+base[-_]?fret\s+(\d+)\s+frets\s+([xX0-9\s-]+)/i);
  if (!match) return null;

  const name = match[1].trim();
  const baseFret = parseInt(match[2], 10) || 1;
  const rawFrets = match[3].trim().split(/\s+/);

  if (rawFrets.length < 6) return null;

  const frets = rawFrets.slice(0, 6).map(f => {
    const clean = f.trim().toLowerCase();
    if (clean === 'x' || clean === '-1') return -1;
    const num = parseInt(clean, 10);
    return isNaN(num) ? -1 : num;
  });

  return {
    name,
    voicing: {
      frets,
      fingers: [0, 0, 0, 0, 0, 0],
      baseFret,
    },
  };
}

/**
 * Formats a ChordVoicing into a standard ChordPro {define: ...} directive string
 */
export function formatChordDefineDirective(name: string, voicing: ChordVoicing): string {
  const baseFret = voicing.baseFret || 1;
  const fretsStr = voicing.frets.map(f => (f < 0 ? 'x' : f)).join(' ');
  return `{define: ${name} base-fret ${baseFret} frets ${fretsStr}}`;
}

/**
 * Inserts or updates a {define: ...} directive in raw ChordPro text
 */
export function updateChordProDefineDirective(rawText: string, chordName: string, voicing: ChordVoicing): string {
  const newDirective = formatChordDefineDirective(chordName, voicing);
  const lines = rawText.split(/\r?\n/);
  
  const escapedName = chordName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const defineRegex = new RegExp(`^\\{\\s*(?:define|idefine|d)(?:\\s*:\\s*|\\s+)${escapedName}(?:\\s+|$|[}:])`, 'i');
  
  let replaced = false;
  const newLines = lines.map(line => {
    if (defineRegex.test(line.trim())) {
      replaced = true;
      return newDirective;
    }
    return line;
  });

  if (replaced) {
    return newLines.join('\n');
  }

  // Insert after existing define / idefine block
  let insertIndex = -1;
  for (let i = 0; i < newLines.length; i++) {
    const trimmed = newLines[i].trim();
    if (/^\{\s*(?:define|idefine|d)[\s:]/i.test(trimmed)) {
      insertIndex = i + 1;
    }
  }

  if (insertIndex !== -1) {
    newLines.splice(insertIndex, 0, newDirective);
    return newLines.join('\n');
  }

  // Otherwise, insert before the first non-empty, non-directive line
  for (let i = 0; i < newLines.length; i++) {
    const trimmed = newLines[i].trim();
    if (trimmed && !trimmed.startsWith('{')) {
      newLines.splice(i, 0, newDirective);
      return newLines.join('\n');
    }
  }

  return `${newDirective}\n${rawText}`;
}

/**
 * Re-orders header directives according to the user specification:
 * 1. {title:}
 * 2. {artist:}
 * 3. {key:}
 * 4. {Year:}
 * 5. {Era:}
 * 6. {capo:}
 * 7. {tempo:}
 * 8. {time:}
 * 9. {duration:}
 * 10. {meta: ScrollSpeed ...}
 * 11. {comment:...}
 *     <--- 1 empty row
 * 12. {meta: BackTrack1...5}
 *     <--- 1 empty row
 * 13. {define:...}
 *     <--- 2 empty rows before actual song starts
 *
 * CRITICAL: The song area (lyrics, chords, tabs, section markers, and empty lines)
 * is kept completely untouched to protect the musician's exact scroll timing.
 */
export function reformatChordPro(chordProText: string): string {
  const lines = chordProText.split(/\r?\n/);
  
  // Find where the actual song body begins
  let songStartIndex = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    const isDirective = trimmed.startsWith('{') && trimmed.endsWith('}');
    if (!isDirective) {
      // Lyrics or chord line -> song area starts here!
      songStartIndex = i;
      break;
    }
    
    const inner = trimmed.slice(1, -1).trim();
    const colonIdx = inner.indexOf(':');
    const directiveKey = (colonIdx !== -1 ? inner.slice(0, colonIdx) : inner).trim().toLowerCase();
    const directiveVal = colonIdx !== -1 ? inner.slice(colonIdx + 1).trim() : '';
    
    // Check if directive is a song section structure
    if (
      directiveKey === 'start_of_chorus' || directiveKey === 'soc' ||
      directiveKey === 'start_of_verse' || directiveKey === 'sov' ||
      directiveKey === 'start_of_bridge' || directiveKey === 'sob' ||
      directiveKey === 'start_of_tab' || directiveKey === 'sot' ||
      directiveKey === 'start_of_grid' || directiveKey === 'sog' ||
      (directiveKey === 'meta' && /scrollpausesec/i.test(directiveVal)) ||
      directiveKey === 'scrollpausesec' || directiveKey === 'scroll_pause_sec'
    ) {
      songStartIndex = i;
      break;
    }
    
    if (directiveKey === 'comment' || directiveKey === 'c' || directiveKey === 'ci' || directiveKey === 'cb') {
      if (/^(verse|chorus|bridge|intro|outro|solo|interlude|instrumental|pre-chorus|riff|hook)/i.test(directiveVal)) {
        songStartIndex = i;
        break;
      }
    }
  }

  const rawHeaderLines = lines.slice(0, songStartIndex);
  const rawSongLines = lines.slice(songStartIndex);

  let title = '';
  let artist = '';
  let key = '';
  let year = '';
  let era = '';
  let capo = '';
  let tempo = '';
  let time = '';
  let duration = '';
  let scrollSpeed = '';
  const headerComments: string[] = [];
  const otherHeaderMetas: string[] = [];
  const backtracksMap = new Map<number, string>();
  const defines: string[] = [];

  // Helper to extract directive info
  const parseDirectiveInfo = (trimmedLine: string) => {
    if (!trimmedLine.startsWith('{') || !trimmedLine.endsWith('}')) return null;
    const inner = trimmedLine.slice(1, -1).trim();
    const colonIdx = inner.indexOf(':');
    let keyName = '';
    let val = '';
    if (colonIdx !== -1) {
      keyName = inner.slice(0, colonIdx).trim().toLowerCase();
      val = inner.slice(colonIdx + 1).trim();
    } else {
      const parts = inner.match(/^([a-zA-Z0-9_-]+)(?:[\s:=]+(.*))?$/);
      if (parts) {
        keyName = parts[1].toLowerCase();
        val = (parts[2] || '').trim();
      } else {
        keyName = inner.toLowerCase();
      }
    }
    return { inner, keyName, val, raw: trimmedLine };
  };

  const processDirective = (trimmedLine: string, isFromHeaderArea: boolean) => {
    const parsed = parseDirectiveInfo(trimmedLine);
    if (!parsed) return;
    const { keyName, val, inner } = parsed;

    if (keyName === 'title' || keyName === 't') {
      if (!title) title = val;
    } else if (keyName === 'artist' || keyName === 'a' || keyName === 'subtitle' || keyName === 'st' || keyName === 'sub' || keyName === 'composer') {
      if (!artist) artist = val;
    } else if (keyName === 'key' || keyName === 'k') {
      if (!key) key = val;
    } else if (keyName === 'year' || (keyName === 'meta' && /^year/i.test(val))) {
      if (!year) year = val.replace(/^year[\s:=]*/i, '').trim();
    } else if (keyName === 'era' || keyName === 'decade' || (keyName === 'meta' && /^era/i.test(val))) {
      if (!era) era = val.replace(/^era[\s:=]*/i, '').trim();
    } else if (keyName === 'capo') {
      if (capo === '') capo = val;
    } else if (keyName === 'tempo' || keyName === 'bpm') {
      if (!tempo) tempo = val;
    } else if (keyName === 'time' || keyName === 'timesig') {
      if (!time) time = val;
    } else if (keyName === 'duration') {
      if (!duration) duration = val;
    } else if (keyName === 'scrollspeed' || keyName === 'scroll_speed' || (keyName === 'meta' && /^scrollspeed/i.test(val))) {
      if (!scrollSpeed) scrollSpeed = val.replace(/^scrollspeed[\s:=]*/i, '').trim();
    } else if (keyName === 'comment' || keyName === 'c' || keyName === 'ci' || keyName === 'cb') {
      if (isFromHeaderArea) {
        headerComments.push(trimmedLine);
      }
    } else if (/^backtrack([1-5])$/i.test(keyName)) {
      const idx = parseInt(keyName.replace(/backtrack/i, ''), 10);
      backtracksMap.set(idx, trimmedLine);
    } else if (keyName === 'meta' && /^backtrack([1-5])/i.test(val)) {
      const idxMatch = val.match(/^backtrack([1-5])/i);
      const idx = idxMatch ? parseInt(idxMatch[1], 10) : 1;
      backtracksMap.set(idx, trimmedLine);
    } else if (keyName === 'define' || keyName === 'idefine' || keyName === 'd') {
      const normalizedDefine = trimmedLine.replace(/^\{\s*idefine\s*:/i, '{define:');
      defines.push(normalizedDefine);
    } else {
      otherHeaderMetas.push(trimmedLine);
    }
  };

  // Helper to determine if a directive line in the song body is actually a header metadata directive
  const isHeaderMetadataDirective = (trimmedLine: string): boolean => {
    const parsed = parseDirectiveInfo(trimmedLine);
    if (!parsed) return false;
    const { keyName, val } = parsed;

    // Header metadata keys that must be extracted to the header
    if (
      keyName === 'title' || keyName === 't' ||
      keyName === 'artist' || keyName === 'a' || keyName === 'subtitle' || keyName === 'st' || keyName === 'sub' || keyName === 'composer' ||
      keyName === 'key' || keyName === 'k' ||
      keyName === 'year' ||
      keyName === 'era' || keyName === 'decade' ||
      keyName === 'capo' ||
      keyName === 'tempo' || keyName === 'bpm' ||
      keyName === 'time' || keyName === 'timesig' ||
      keyName === 'duration' ||
      keyName === 'scrollspeed' || keyName === 'scroll_speed' ||
      keyName === 'define' || keyName === 'idefine' || keyName === 'd' ||
      /^backtrack[1-5]$/i.test(keyName)
    ) {
      return true;
    }

    // Meta directives: check if scrollspeed, year, era, backtrack, etc. (do NOT extract scrollpause!)
    if (keyName === 'meta') {
      if (/scrollpausesec|scroll_pause/i.test(val)) {
        return false; // Stay in song body!
      }
      return true; // ScrollSpeed, BackTrack, Era, Year, etc. -> extract to header!
    }

    return false;
  };

  for (const line of rawHeaderLines) {
    processDirective(line.trim(), true);
  }

  // Scan songLines: extract any header metadata directives (including any at the bottom of the file)
  const cleanedSongLines: string[] = [];
  for (const line of rawSongLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}') && isHeaderMetadataDirective(trimmed)) {
      processDirective(trimmed, false);
      continue;
    }
    cleanedSongLines.push(line);
  }

  // Trim leading blank lines from cleanedSongLines
  while (cleanedSongLines.length > 0 && !cleanedSongLines[0].trim()) {
    cleanedSongLines.shift();
  }

  // Trim trailing blank lines from cleanedSongLines (so removing bottom metadata doesn't leave trailing blank rows)
  while (cleanedSongLines.length > 0 && !cleanedSongLines[cleanedSongLines.length - 1].trim()) {
    cleanedSongLines.pop();
  }

  // Group 1: Standard Meta
  const group1: string[] = [];
  if (title) group1.push(`{title: ${title}}`);
  if (artist) group1.push(`{artist: ${artist}}`);
  if (key) group1.push(`{key: ${key}}`);
  if (year) group1.push(`{Year: ${year}}`);
  if (era) group1.push(`{Era: ${era}}`);
  if (capo !== '') group1.push(`{capo: ${capo}}`);
  if (tempo) group1.push(`{tempo: ${tempo}}`);
  if (time) group1.push(`{time: ${time}}`);
  if (duration) group1.push(`{duration: ${duration}}`);
  if (scrollSpeed) group1.push(`{meta: ScrollSpeed : ${scrollSpeed}}`);
  for (const c of headerComments) group1.push(c);
  for (const om of otherHeaderMetas) group1.push(om);

  // Group 2: Backtracks 1..5 in order
  const group2: string[] = [];
  for (let b = 1; b <= 5; b++) {
    if (backtracksMap.has(b)) {
      group2.push(backtracksMap.get(b)!);
    }
  }

  // Group 3: defines (deduplicated)
  const uniqueDefines = Array.from(new Set(defines));
  const group3 = uniqueDefines;

  const headerBlocks: string[] = [];
  if (group1.length > 0) headerBlocks.push(group1.join('\n'));
  if (group2.length > 0) headerBlocks.push(group2.join('\n'));
  if (group3.length > 0) headerBlocks.push(group3.join('\n'));

  const formattedHeader = headerBlocks.join('\n\n');

  if (headerBlocks.length === 0) {
    return cleanedSongLines.join('\n');
  }

  if (cleanedSongLines.length > 0) {
    // Exactly 2 empty rows before the song area begins = 3 newlines (\n\n\n)
    return `${formattedHeader}\n\n\n${cleanedSongLines.join('\n')}`;
  }

  return formattedHeader;
}

/**
 * Detects if cursor is positioned inside a [chord] bracket, and if so,
 * shifts the position to right after the closing ']' bracket of that chord.
 */
export function adjustCursorToRightOfChord(text: string, pos: number): number {
  const chordRegex = /\[([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = chordRegex.exec(text)) !== null) {
    const chordStart = match.index;
    const chordEnd = chordStart + match[0].length; // index right after ']'
    // If cursor is strictly after '[' and up to or at ']' (i.e. inside the chord)
    if (pos > chordStart && pos <= chordEnd - 1) {
      return chordEnd;
    }
  }
  return pos;
}

/**
 * Inserts a chord into a ChordPro line at the specified cursor position,
 * handling spaces appropriately between adjacent chords or lyrics.
 */
export function insertChordIntoLine(line: string, chordName: string, pos: number): string {
  const cleanName = chordName.trim().replace(/^\[|\]$/g, '');
  if (!cleanName) return line;
  const chordBracket = `[${cleanName}]`;
  
  const safePos = Math.max(0, Math.min(line.length, pos));
  const before = line.slice(0, safePos);
  const after = line.slice(safePos);

  const needsSpaceBefore = before.endsWith(']') && !before.endsWith(' ');
  const spaceBefore = needsSpaceBefore ? ' ' : '';
  const needsSpaceAfter = after.startsWith('[') && !after.startsWith(' ');
  const spaceAfter = needsSpaceAfter ? ' ' : '';

  return `${before}${spaceBefore}${chordBracket}${spaceAfter}${after}`;
}
