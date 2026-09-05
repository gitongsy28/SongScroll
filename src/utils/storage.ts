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
  if (handle) {
    storeDirectoryHandleInDB(handle);
  }
}

/**
 * Persist FileSystemDirectoryHandle into IndexedDB
 */
export async function storeDirectoryHandleInDB(handle: any): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CONFIG, 'readwrite');
      const store = tx.objectStore(STORE_CONFIG);
      const req = store.put({ key: 'active_directory_handle', handle });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not store directory handle in IndexedDB', err);
  }
}

/**
 * Retrieve persisted FileSystemDirectoryHandle from IndexedDB
 */
export async function getStoredDirectoryHandleFromDB(): Promise<any> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_CONFIG, 'readonly');
      const store = tx.objectStore(STORE_CONFIG);
      const req = store.get('active_directory_handle');
      req.onsuccess = () => {
        if (req.result && req.result.handle) {
          resolve(req.result.handle);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Initialize / restore stored directory handle
 */
export async function restoreActiveDirectoryHandle(): Promise<any> {
  if (directoryHandleRef) return directoryHandleRef;
  try {
    const handle = await getStoredDirectoryHandleFromDB();
    if (handle) {
      directoryHandleRef = handle;
      return handle;
    }
  } catch (e) {
    console.warn('Failed to restore active directory handle', e);
  }
  return null;
}

/**
 * Check whether a physical directory handle is currently active for Master Repo
 */
export function isMasterFolderConnected(): boolean {
  return !!directoryHandleRef;
}

/**
 * Get the name of the currently connected Master Folder
 */
export function getConnectedFolderName(): string | null {
  return directoryHandleRef?.name || null;
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

export interface SaveSongResult {
  success: boolean;
  diskUpdated: boolean;
  fileName: string;
  message: string;
}

/**
 * Resolves or finds the target FileSystemFileHandle within a directory handle.
 * 1. Checks exact relative path from song.filePath
 * 2. Checks candidate filenames in root folder
 * 3. Recursively scans directory and subfolders for exact or base/normalized match
 */
async function resolveFileHandleForSong(
  dirHandle: any,
  song: Song,
  targetFileName: string
): Promise<{ fileHandle: any; relativePath: string } | null> {
  // Helper to traverse a relative path like "Pop/Hotel California.txt"
  async function getHandleFromSubpath(subpath: string): Promise<{ fileHandle: any; relativePath: string } | null> {
    try {
      const clean = subpath.replace(/^[/\\]+/, '').replace(/[/\\]+$/, '');
      const parts = clean.split(/[/\\]/).filter(Boolean);
      if (parts.length === 0) return null;
      const fileName = parts.pop()!;
      let curDir = dirHandle;
      for (const part of parts) {
        curDir = await curDir.getDirectoryHandle(part, { create: false });
      }
      const fileHandle = await curDir.getFileHandle(fileName, { create: false });
      return { fileHandle, relativePath: clean };
    } catch {
      return null;
    }
  }

  // 1. Try resolving exact subpath from song.filePath
  if (song.filePath) {
    const norm = song.filePath.replace(/\\/g, '/');
    let sub = '';
    const dirNameLower = dirHandle.name.toLowerCase();
    const idx = norm.toLowerCase().indexOf(dirNameLower);
    if (idx >= 0) {
      sub = norm.substring(idx + dirNameLower.length).replace(/^[/\\]+/, '');
    } else if (!norm.includes(':') && !norm.startsWith('/')) {
      sub = norm;
    }
    if (sub) {
      const match = await getHandleFromSubpath(sub);
      if (match) return match;
    }
  }

  // Candidate filenames to search for
  const rawTitle = (song.title || '').trim();
  const rawArtist = (song.artist || '').trim();
  const normTitle = rawTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normArtist = rawArtist.toLowerCase().replace(/[^a-z0-9]/g, '');
  const validExts = ['.cho', '.crd', '.chopro', '.chordpro', '.pro', '.txt'];

  const candidateNames = Array.from(
    new Set(
      [
        song.fileName,
        targetFileName,
        song.filePath ? song.filePath.split(/[/\\]/).pop() : undefined,
        rawTitle ? `${rawTitle}.cho` : undefined,
        rawTitle ? `${rawTitle}.txt` : undefined,
        rawArtist && rawTitle ? `${rawArtist} - ${rawTitle}.cho` : undefined,
        rawArtist && rawTitle ? `${rawArtist} - ${rawTitle}.txt` : undefined,
      ].filter(Boolean) as string[]
    )
  );

  // 2. Quick check in root folder for candidates
  for (const name of candidateNames) {
    try {
      const fh = await dirHandle.getFileHandle(name, { create: false });
      if (fh) return { fileHandle: fh, relativePath: fh.name };
    } catch {
      // ignore
    }
  }

  // 3. Scan directory and subdirectories with high-to-low matching priority
  let bestCandidate: { fileHandle: any; relativePath: string; priority: number } | null = null;

  async function scan(currentDir: any, currentRelPath: string): Promise<boolean> {
    for await (const entry of currentDir.values()) {
      if (entry.kind === 'file') {
        const entryName = entry.name;
        const entryLower = entryName.toLowerCase();
        const entryExt = entryLower.substring(entryLower.lastIndexOf('.'));
        const isMusicExt = validExts.includes(entryExt);
        const entryBase = entryName.replace(/\.[^/.]+$/, '').toLowerCase();
        const entryNorm = entryBase.replace(/[^a-z0-9]/g, '');
        const relPath = currentRelPath ? `${currentRelPath}/${entryName}` : entryName;

        // Exact filename match (Priority 10)
        if (candidateNames.some((c) => c.toLowerCase() === entryLower)) {
          bestCandidate = { fileHandle: entry, relativePath: relPath, priority: 10 };
          return true; // Stop immediately on exact match
        }

        // Base name match ignoring extension (Priority 8)
        if (candidateNames.some((c) => c.replace(/\.[^/.]+$/, '').toLowerCase() === entryBase)) {
          if (!bestCandidate || bestCandidate.priority < 8) {
            bestCandidate = { fileHandle: entry, relativePath: relPath, priority: 8 };
          }
        }

        // Normalized alphanumeric match (Priority 6)
        if (isMusicExt && normTitle && (entryNorm === normTitle || entryNorm === `${normArtist}${normTitle}` || entryNorm === `${normTitle}${normArtist}`)) {
          if (!bestCandidate || bestCandidate.priority < 6) {
            bestCandidate = { fileHandle: entry, relativePath: relPath, priority: 6 };
          }
        }

        // Substring title match with valid music extension (Priority 4)
        if (isMusicExt && normTitle.length >= 4 && entryNorm.includes(normTitle)) {
          if (!bestCandidate || bestCandidate.priority < 4) {
            bestCandidate = { fileHandle: entry, relativePath: relPath, priority: 4 };
          }
        }
      } else if (entry.kind === 'directory') {
        try {
          const nextRel = currentRelPath ? `${currentRelPath}/${entry.name}` : entry.name;
          const foundExact = await scan(entry, nextRel);
          if (foundExact) return true;
        } catch {
          // ignore unreadable
        }
      }
    }
    return false;
  }

  await scan(dirHandle, '');
  if (bestCandidate) {
    return { fileHandle: (bestCandidate as any).fileHandle, relativePath: (bestCandidate as any).relativePath };
  }

  return null;
}

/**
 * Save song to IndexedDB/LocalStorage, and if repository is 'local-drive' (Master Repository),
 * overwrite the physical .cho / .txt file on disk via the File System Access API.
 * In 'github-url' or 'bundled' mode, the source file is NOT updated.
 */
export async function saveSongWithDiskOverwrite(
  song: Song,
  repoConfig: RepositoryConfig
): Promise<SaveSongResult> {
  // 1. Always update IndexedDB & LocalStorage immediately so changes reflect in the app
  await saveSong(song);

  // Also update source songs cache for current repository
  const currentSource = repoConfig.sourceType || 'local-drive';
  const cachedSongs = loadSourceSongs(currentSource) || [];
  const idx = cachedSongs.findIndex((s) => s.id === song.id);
  if (idx >= 0) {
    cachedSongs[idx] = song;
  } else {
    cachedSongs.unshift(song);
  }
  saveSourceSongs(currentSource, cachedSongs);

  const targetFileName = song.fileName || `${song.artist ? `${song.artist} - ` : ''}${song.title || 'Untitled'}.cho`;

  // 2. Rule: In 'github-url' or 'bundled' mode, physical source files are NOT updated
  if (currentSource !== 'local-drive') {
    const repoLabel = currentSource === 'github-url' ? 'GitHub Shared Repository' : 'Bundled SongBook (/public/SongBook/)';
    return {
      success: true,
      diskUpdated: false,
      fileName: targetFileName,
      message: `Song saved to app database! Source file in ${repoLabel} is read-only and was not modified.`,
    };
  }

  // 3. In Master Repository ('local-drive'): attempt to overwrite physical file on disk
  let dirHandle = getDirectoryHandle();
  if (!dirHandle) {
    dirHandle = await restoreActiveDirectoryHandle();
  }

  const isIframe = typeof window !== 'undefined' && window.self !== window.top;

  // If handle is missing and browser supports showDirectoryPicker, prompt user to select master folder
  if (!dirHandle && typeof window !== 'undefined' && 'showDirectoryPicker' in window && !isIframe) {
    try {
      dirHandle = await (window as any).showDirectoryPicker({
        id: 'chordpro-repo-picker',
        mode: 'readwrite',
      });
      if (dirHandle) {
        setDirectoryHandle(dirHandle);
      }
    } catch (pickerErr: any) {
      console.warn('Folder picker was dismissed or denied:', pickerErr);
    }
  }

  if (!dirHandle) {
    let guidance = 'Connect your master folder to enable direct disk overwrites.';
    if (isIframe) {
      guidance = 'Browsers block direct disk writing inside embedded preview iframes. Please open SongScroll in a new browser tab to connect your local or Google Drive folder.';
    } else if (typeof window !== 'undefined' && !('showDirectoryPicker' in window)) {
      guidance = 'Your browser does not support the File System Access API (Chrome or Edge is recommended for direct disk overwrites).';
    } else {
      guidance = 'Please select your master folder via "Select Master Folder" in Repo Source or click "Connect Folder" in the editor banner.';
    }

    return {
      success: true,
      diskUpdated: false,
      fileName: targetFileName,
      message: `Saved to app database! ${guidance}`,
    };
  }

  try {
    // Request/verify write permissions
    if (typeof dirHandle.queryPermission === 'function') {
      let permission = await dirHandle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        permission = await dirHandle.requestPermission({ mode: 'readwrite' });
      }
      if (permission !== 'granted') {
        return {
          success: true,
          diskUpdated: false,
          fileName: targetFileName,
          message: `Saved to app database. Write permission for master folder "${dirHandle.name}" was not granted.`,
        };
      }
    }

    // Helper to resolve exact existing file handle on disk
    const matched = await resolveFileHandleForSong(dirHandle, song, targetFileName);
    let fileHandle: any;

    if (matched) {
      fileHandle = matched.fileHandle;
    } else {
      // Create new file directly in the master folder root
      fileHandle = await dirHandle.getFileHandle(targetFileName, { create: true });
    }

    // Explicitly truncate and physically overwrite file content on disk
    const writable = await fileHandle.createWritable({ keepExistingData: false });
    await writable.write(song.rawChordPro);
    await writable.close();

    // Keep song object synchronized with exact disk filename and path
    song.fileName = fileHandle.name;
    if (matched?.relativePath) {
      song.filePath = `${dirHandle.name}/${matched.relativePath}`;
    }

    return {
      success: true,
      diskUpdated: true,
      fileName: fileHandle.name,
      message: `Success! Overwrote "${fileHandle.name}" in Master Repository folder (${dirHandle.name}) and updated app database.`,
    };
  } catch (err: any) {
    console.error('Error overwriting physical file on master drive:', err);
    return {
      success: true,
      diskUpdated: false,
      fileName: targetFileName,
      message: `Saved to app database. Could not write to disk file: ${err.message || 'Access error'}`,
    };
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
