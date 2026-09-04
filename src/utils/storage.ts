import { RepositoryConfig, RepositorySourceType, Song, ViewerSettings } from '../types';
import { createSongFromChordPro, deduplicateSongs } from './chordpro';
import { getInitialSongs } from './sampleSongs';

const DB_NAME = 'chordpro_reader_db';
const DB_VERSION = 1;
const STORE_SONGS = 'songs';
const STORE_CONFIG = 'config';

const STORAGE_KEY_REPO = 'chordpro_repo_config';
const STORAGE_KEY_SETTINGS = 'chordpro_viewer_settings';
const STORAGE_KEY_FALLBACK_SONGS = 'chordpro_local_songs_fallback';
const STORAGE_PREFIX_SOURCE_SONGS = 'chordpro_source_songs_';

export const DEFAULT_VIEWER_SETTINGS: ViewerSettings = {
  isScrolling: false,
  scrollSpeed: 30, // 30 pixels per second
  fontSize: 18,
  chordSizeRatio: 1.0,
  chordColor: '#38bdf8', // Sky 400
  chordStyle: 'above',
  columnCount: 1,
  theme: 'stage-dark',
  transposeOffset: 0,
  preferSharps: true,
  autoResumeAfterManualScroll: true,
  highlightCurrentSection: true,
};

export const DEFAULT_REPO_CONFIG: RepositoryConfig = {
  sourceType: 'bundled',
  directoryPath: '/public/SongBook/',
  directoryName: 'Bundled SongBook',
  isFileSystemApiSupported: typeof window !== 'undefined' && 'showDirectoryPicker' in window,
  hasDirectoryHandle: false,
  lastSyncedAt: undefined,
  totalFilesFound: 0,
};

// Global memory handle for the active directory if user connected via File System Access API
let directoryHandleRef: any = null;

export function getDirectoryHandle(): any {
  return directoryHandleRef;
}

export function setDirectoryHandle(handle: any) {
  directoryHandleRef = handle;
}

/**
 * Open IndexedDB database with Promise wrapper
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_SONGS)) {
        db.createObjectStore(STORE_SONGS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CONFIG)) {
        db.createObjectStore(STORE_CONFIG, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save songs for a specific repository source type (e.g. 'local-drive', 'github-url', 'bundled')
 */
export function saveSourceSongs(sourceType: RepositorySourceType, songs: Song[]): void {
  try {
    const unique = deduplicateSongs(songs);
    localStorage.setItem(`${STORAGE_PREFIX_SOURCE_SONGS}${sourceType}`, JSON.stringify(unique));
  } catch {
    // ignore
  }
}

/**
 * Load cached songs for a specific repository source type
 */
export function loadSourceSongs(sourceType: RepositorySourceType): Song[] | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX_SOURCE_SONGS}${sourceType}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return deduplicateSongs(parsed);
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Clear all songs in the active store
 */
export async function clearAllSongs(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SONGS, 'readwrite');
      const store = tx.objectStore(STORE_SONGS);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY_FALLBACK_SONGS);
    } catch {}
  }
}

/**
 * Replace active songs completely with a clean, deduplicated set of songs.
 * Clears out any prior songs, preventing duplicate accumulation.
 */
export async function replaceActiveSongs(songs: Song[], sourceType?: RepositorySourceType): Promise<Song[]> {
  const uniqueSongs = deduplicateSongs(songs);

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SONGS, 'readwrite');
      const store = tx.objectStore(STORE_SONGS);
      
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        uniqueSongs.forEach((song) => store.put(song));
      };
      clearReq.onerror = () => reject(clearReq.error);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    try {
      localStorage.setItem(STORAGE_KEY_FALLBACK_SONGS, JSON.stringify(uniqueSongs));
    } catch {}
  }

  if (sourceType) {
    saveSourceSongs(sourceType, uniqueSongs);
  }

  return uniqueSongs;
}

/**
 * Load all songs from IndexedDB or initial sample dataset
 */
export async function loadAllSongs(): Promise<Song[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_SONGS, 'readonly');
      const store = tx.objectStore(STORE_SONGS);
      const req = store.getAll();

      req.onsuccess = async () => {
        const results = req.result as Song[];
        if (results && results.length > 0) {
          const deduped = deduplicateSongs(results);
          // If duplicates were detected in IndexedDB from previous runs, clean the store immediately
          if (deduped.length !== results.length) {
            await replaceActiveSongs(deduped);
          }
          resolve(deduped);
        } else {
          // Initialize with sample songs
          const samples = getInitialSongs();
          await replaceActiveSongs(samples, 'bundled');
          resolve(samples);
        }
      };

      req.onerror = () => {
        const fallback = deduplicateSongs(loadFallbackSongs());
        resolve(fallback);
      };
    });
  } catch (err) {
    return deduplicateSongs(loadFallbackSongs());
  }
}

/**
 * Save a single song to database
 */
export async function saveSong(song: Song): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SONGS, 'readwrite');
      const store = tx.objectStore(STORE_SONGS);
      const req = store.put(song);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    saveSongToFallback(song);
  }
}

/**
 * Save multiple songs at once with deduplication
 */
export async function saveMultipleSongs(songs: Song[]): Promise<void> {
  const uniqueSongs = deduplicateSongs(songs);
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SONGS, 'readwrite');
      const store = tx.objectStore(STORE_SONGS);
      uniqueSongs.forEach((s) => store.put(s));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    try {
      localStorage.setItem(STORAGE_KEY_FALLBACK_SONGS, JSON.stringify(uniqueSongs));
    } catch {
      // ignore
    }
  }
}

/**
 * Delete a song by id
 */
export async function deleteSong(songId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SONGS, 'readwrite');
      const store = tx.objectStore(STORE_SONGS);
      const req = store.delete(songId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    const songs = loadFallbackSongs().filter((s) => s.id !== songId);
    localStorage.setItem(STORAGE_KEY_FALLBACK_SONGS, JSON.stringify(songs));
  }
}

/**
 * Reset library back to original sample songs
 */
export async function resetToDefaultSongs(): Promise<Song[]> {
  const samples = getInitialSongs();
  return replaceActiveSongs(samples, 'bundled');
}

/**
 * Save repository path / settings
 */
export function saveRepositoryConfig(config: RepositoryConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_REPO, JSON.stringify(config));
  } catch {
    // ignore
  }
}

/**
 * Load repository config
 */
export function loadRepositoryConfig(): RepositoryConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REPO);
    if (raw) {
      const parsed = JSON.parse(raw);
      const inferredSource: RepositorySourceType = 
        parsed.sourceType || 
        (parsed.directoryPath?.includes('/public/SongBook') || parsed.directoryPath === '/SongBook/' ? 'bundled' : 
         parsed.directoryPath?.includes('github.com') ? 'github-url' : 'local-drive');

      return {
        ...DEFAULT_REPO_CONFIG,
        ...parsed,
        sourceType: inferredSource,
        isFileSystemApiSupported: typeof window !== 'undefined' && 'showDirectoryPicker' in window,
      };
    }
  } catch {
    // ignore
  }
  return DEFAULT_REPO_CONFIG;
}

/**
 * Save user viewer preferences
 */
export function saveViewerSettings(settings: ViewerSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

/**
 * Load user viewer preferences
 */
export function loadViewerSettings(): ViewerSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) {
      return { ...DEFAULT_VIEWER_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_VIEWER_SETTINGS;
}

// Fallback helper functions
function loadFallbackSongs(): Song[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FALLBACK_SONGS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  const samples = getInitialSongs();
  try {
    localStorage.setItem(STORAGE_KEY_FALLBACK_SONGS, JSON.stringify(samples));
  } catch {
    // ignore
  }
  return samples;
}

function saveSongToFallback(song: Song) {
  const songs = loadFallbackSongs();
  const index = songs.findIndex((s) => s.id === song.id);
  if (index >= 0) {
    songs[index] = song;
  } else {
    songs.push(song);
  }
  try {
    localStorage.setItem(STORAGE_KEY_FALLBACK_SONGS, JSON.stringify(songs));
  } catch {
    // ignore
  }
}

/**
 * Read all ChordPro files from a FileSystemDirectoryHandle (File System Access API)
 */
export async function syncSongsFromDirectoryHandle(dirHandle: any, customDirPath: string): Promise<Song[]> {
  const songs: Song[] = [];
  const validExts = ['.cho', '.crd', '.chopro', '.chordpro', '.pro', '.txt'];

  async function scanDirectory(handle: any, currentPath: string) {
    for await (const entry of handle.values()) {
      if (entry.kind === 'file') {
        const name = entry.name.toLowerCase();
        if (validExts.some((ext) => name.endsWith(ext))) {
          try {
            const file = await entry.getFile();
            const text = await file.text();
            const song = createSongFromChordPro(text, `${currentPath}/${entry.name}`, entry.name);
            songs.push(song);
          } catch (e) {
            console.error(`Failed to read file ${entry.name}`, e);
          }
        }
      } else if (entry.kind === 'directory') {
        await scanDirectory(entry, `${currentPath}/${entry.name}`);
      }
    }
  }

  await scanDirectory(dirHandle, customDirPath.replace(/\/$/, ''));
  return deduplicateSongs(songs);
}

/**
 * Parse uploaded files or folder from standard file input / drop event
 */
export async function parseUploadedFiles(fileList: FileList | File[], customDirPath: string): Promise<Song[]> {
  const songs: Song[] = [];
  const files = Array.from(fileList);
  const validExts = ['.cho', '.crd', '.chopro', '.chordpro', '.pro', '.txt'];

  for (const file of files) {
    const name = file.name.toLowerCase();
    if (validExts.some((ext) => name.endsWith(ext))) {
      try {
        const text = await file.text();
        const relPath = (file as any).webkitRelativePath || file.name;
        const song = createSongFromChordPro(text, `${customDirPath}/${relPath}`, file.name);
        songs.push(song);
      } catch (err) {
        console.error('Error reading uploaded file:', file.name, err);
      }
    }
  }

  return deduplicateSongs(songs);
}

/**
 * Export song to .cho file download
 */
export function downloadSongFile(song: Song, content?: string): void {
  const text = content || song.rawChordPro;
  const filename = song.fileName || `${song.artist} - ${song.title}.cho`;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
