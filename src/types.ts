import { ChordVoicing } from './utils/guitarChords';

export interface ChordSegment {
  chord?: string;
  lyrics: string;
  isChordOnly?: boolean;
}

export type DisplayMode = 'summary' | 'normal' | 'detailed';

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
  | 'define'
  | 'scroll_pause'
  | 'empty';

export interface ChordProLine {
  type: LineType;
  segments?: ChordSegment[];
  text?: string;
  raw?: string;
  pauseSeconds?: number;
  sourceLineIndex?: number;
  tabLines?: string[];
}

export type BackTrackType = 'youtube' | 'audio-url' | 'github' | 'local' | 'web';

export interface BackTrackItem {
  id: string; // e.g. "BackTrack1"
  index: number; // 1 to 5
  description: string;
  url: string;
  type: BackTrackType;
  rawDirective?: string;
}

export interface ParsedChordPro {
  title: string;
  artist: string;
  subtitle?: string;
  key?: string;
  year?: string;
  era?: string; // e.g. "70s", "80s", "90s", "00s", "10s", etc.
  tempo?: number;
  timeSignature?: string;
  capo?: number;
  duration?: string;
  scrollSpeed?: number; // pixels per second default auto-scroll speed
  comment?: string;
  lines: ChordProLine[];
  metadata: Record<string, string>;
  backtracks?: BackTrackItem[];
  customChords?: Record<string, ChordVoicing>;
  raw: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  subtitle?: string;
  key?: string;
  year?: string;
  era?: string; // e.g. "70s", "80s", "90s", "00s", "10s"
  tempo?: number; // BPM
  timeSignature?: string;
  capo?: number;
  duration?: string;
  scrollSpeed?: number; // Default auto-scroll speed (px/s)
  backtracks?: BackTrackItem[];
  customChords?: Record<string, ChordVoicing>;
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
  instrument?: 'guitar' | 'ukulele' | 'bass';
  measureInsertWidth?: number; // columns per newly added measure (default 20)
  tabWrapMode?: 'fit' | 'wrap'; // Scale to fit width vs Wrap measures onto next row
}

export interface MetronomeState {
  isPlaying: boolean;
  tempo: number;
  timeSignature: string;
  soundEnabled: boolean;
  volume: number; // 0 to 1
}

export type RepositorySourceType = 'local-drive' | 'github-master' | 'github-url' | 'bundled';

export interface RepositoryConfig {
  sourceType?: RepositorySourceType;
  directoryPath: string; // Local path e.g. "D:/Songbook/" or GitHub URL "https://github.com/gitongsy28/mastersongbook"
  directoryName: string;
  githubUrl?: string; // Shared GitHub URL (e.g. gigsongbook)
  githubToken?: string; // GitHub Personal Access Token (for private shared repo or master repo)
  masterGithubUrl?: string; // Master GitHub Repository URL (e.g. mastersongbook)
  masterGithubToken?: string; // Master GitHub Personal Access Token (with write permission)
  masterSubtype?: 'local' | 'github'; // Sub-mode inside Master Repo
  isFileSystemApiSupported: boolean;
  hasDirectoryHandle: boolean;
  lastSyncedAt?: number;
  totalFilesFound?: number;
}
