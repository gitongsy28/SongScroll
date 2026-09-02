export interface ChordSegment {
  chord?: string;
  lyrics: string;
  isChordOnly?: boolean;
}

export type LineType = 
  | 'lyrics' 
  | 'comment' 
  | 'chorus_start' 
  | 'chorus_end' 
  | 'bridge_start' 
  | 'bridge_end' 
  | 'tab_start' 
  | 'tab_end' 
  | 'tab' 
  | 'directive' 
  | 'empty';

export interface ChordProLine {
  type: LineType;
  segments?: ChordSegment[];
  text?: string;
  raw?: string;
}

export interface ParsedChordPro {
  title: string;
  artist: string;
  subtitle?: string;
  key?: string;
  era?: string; // e.g. "70s", "80s", "90s", "00s", "10s", etc.
  tempo?: number;
  timeSignature?: string;
  capo?: number;
  duration?: string;
  comment?: string;
  lines: ChordProLine[];
  metadata: Record<string, string>;
  raw: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  subtitle?: string;
  key?: string;
  era?: string; // e.g. "70s", "80s", "90s", "00s", "10s"
  tempo?: number; // BPM
  timeSignature?: string;
  capo?: number;
  duration?: string;
  rawChordPro: string;
  parsed?: ParsedChordPro;
  filePath?: string;
  fileName?: string;
  dateAdded: number;
  updatedAt: number;
  tags?: string[];
  notes?: string;
}

export type VisualTheme = 'stage-dark' | 'paper-light' | 'amoled-black' | 'vintage-sepia';

export interface ViewerSettings {
  isScrolling: boolean;
  scrollSpeed: number; // pixels per second (typically 10 - 150)
  fontSize: number; // in pixels (14 - 36)
  chordSizeRatio: number; // chord font size multiplier (0.8 - 1.2)
  chordColor: string;
  chordStyle: 'above' | 'inline';
  columnCount: 1 | 2;
  theme: VisualTheme;
  transposeOffset: number; // semitones (-11 to +11)
  preferSharps: boolean;
  autoResumeAfterManualScroll: boolean;
  highlightCurrentSection: boolean;
}

export interface MetronomeState {
  isPlaying: boolean;
  tempo: number;
  timeSignature: string;
  soundEnabled: boolean;
  volume: number; // 0 to 1
}

export interface RepositoryConfig {
  directoryPath: string;
  directoryName: string;
  isFileSystemApiSupported: boolean;
  hasDirectoryHandle: boolean;
  lastSyncedAt?: number;
  totalFilesFound?: number;
}
