import { Song } from '../types';
import { createSongFromChordPro } from './chordpro';

export interface GitHubSourceInfo {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  isGitHub: boolean;
}

/**
 * Parse any GitHub URL (web link, tree link, or raw link) into its components
 * Examples:
 * - https://github.com/gitongsy28/SongScroll/tree/main/public/SongBook/
 * - https://github.com/gitongsy28/SongScroll/tree/main/SongBook
 * - https://github.com/owner/repo
 */
export function parseGitHubUrl(urlStr: string): GitHubSourceInfo | null {
  try {
    const trimmed = urlStr.trim();
    if (!trimmed.toLowerCase().includes('github.com')) {
      return null;
    }

    // Replace backslashes
    const normalized = trimmed.replace(/\\/g, '/');
    const url = new URL(normalized.startsWith('http') ? normalized : `https://${normalized}`);
    
    // Path looks like /owner/repo/tree/branch/subpath...
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;

    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/, '');
    let branch = 'main';
    let path = '';

    if (parts.length >= 4 && parts[2] === 'tree') {
      branch = parts[3];
      path = parts.slice(4).join('/');
    } else if (parts.length > 2) {
      path = parts.slice(2).join('/');
    }

    // Clean trailing slash
    path = path.replace(/\/+$/, '');

    return {
      owner,
      repo,
      branch,
      path,
      isGitHub: true,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch all ChordPro songs from a GitHub repository directory
 */
export async function syncSongsFromGitHubUrl(githubUrl: string): Promise<{ songs: Song[]; message: string }> {
  const info = parseGitHubUrl(githubUrl);
  if (!info) {
    throw new Error('Invalid GitHub URL. Example format: https://github.com/owner/repo/tree/main/public/SongBook/');
  }

  const { owner, repo, branch, path } = info;
  
  // 1. Call GitHub API to list files in directory
  const apiPath = path ? `/${path}` : '';
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents${apiPath}?ref=${branch}`;

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });
  } catch (err: any) {
    throw new Error(`Network error connecting to GitHub: ${err.message}`);
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Directory or branch not found on GitHub (${owner}/${repo}/${branch}/${path || 'root'}). Please verify repository name, branch, and folder path.`);
    }
    if (response.status === 403) {
      // Rate limit or private repo
      throw new Error('GitHub API rate limit reached or repository is private. Please ensure the repository is Public.');
    }
    throw new Error(`GitHub API error (${response.status}): ${response.statusText}`);
  }

  const items = await response.json();
  if (!Array.isArray(items)) {
    throw new Error('GitHub URL points to a single file, not a directory folder.');
  }

  // Filter for valid ChordPro and text song files
  const validExtensions = ['.cho', '.crd', '.chopro', '.chordpro', '.pro', '.txt'];
  const songFiles = items.filter((item: any) => {
    if (item.type !== 'file') return false;
    const name = (item.name || '').toLowerCase();
    return validExtensions.some((ext) => name.endsWith(ext));
  });

  if (songFiles.length === 0) {
    throw new Error(`Connected to GitHub repository, but no ChordPro files (.cho, .crd, .txt) were found in "${path || '/'}"`);
  }

  // Fetch all song files concurrently (up to 15 at once)
  const fetchedSongs: Song[] = [];
  const errors: string[] = [];

  for (const file of songFiles) {
    try {
      // Use download_url or raw GitHub CDN
      const rawUrl = file.download_url || `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path ? `${path}/` : ''}${file.name}`;
      const res = await fetch(rawUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      
      const song = createSongFromChordPro(
        text,
        `https://github.com/${owner}/${repo}/blob/${branch}/${path ? `${path}/` : ''}${file.name}`,
        file.name
      );
      fetchedSongs.push(song);
    } catch (err: any) {
      errors.push(`${file.name}: ${err.message}`);
    }
  }

  if (fetchedSongs.length === 0) {
    throw new Error(`Failed to download song files: ${errors.join(', ')}`);
  }

  return {
    songs: fetchedSongs,
    message: `Successfully synced ${fetchedSongs.length} song(s) from GitHub (${owner}/${repo}/${path || ''})`,
  };
}

/**
 * Fetch bundled songs from the web app's /public/SongBook/ directory
 */
export async function syncBundledSongBook(): Promise<Song[]> {
  const baseUrl = import.meta.env.BASE_URL || './';
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const manifestUrl = `${cleanBase}SongBook/manifest.json`;

  const res = await fetch(manifestUrl);
  if (!res.ok) {
    throw new Error('Bundled /SongBook/manifest.json not accessible.');
  }

  const manifest = await res.json();
  const files: string[] = manifest.files || [];
  const songs: Song[] = [];

  for (const filename of files) {
    try {
      const songUrl = `${cleanBase}SongBook/${encodeURIComponent(filename)}`;
      const fileRes = await fetch(songUrl);
      if (fileRes.ok) {
        const text = await fileRes.text();
        const song = createSongFromChordPro(text, `/SongBook/${filename}`, filename);
        songs.push(song);
      }
    } catch (e) {
      console.warn('Failed to load bundled song:', filename, e);
    }
  }

  return songs;
}
