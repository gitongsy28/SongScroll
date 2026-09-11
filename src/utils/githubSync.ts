import { Song } from '../types';
import { createSongFromChordPro } from './chordpro';

export interface GitHubSourceInfo {
  owner: string;
  repo: string;
  branch: string;
  path: string;
  isGitHub: boolean;
  hasExplicitBranch: boolean;
}

/**
 * Parse any GitHub URL (web link, tree link, blob link, shorthand or raw link) into its components
 * Examples:
 * - https://github.com/gitongsy28/gigsongbook
 * - https://github.com/gitongsy28/gigsongbook/tree/main
 * - https://github.com/gitongsy28/SongScroll/tree/main/public/SongBook/
 * - github.com/owner/repo
 * - owner/repo
 */
export function parseGitHubUrl(urlStr: string): GitHubSourceInfo | null {
  try {
    let trimmed = urlStr.trim().replace(/\\/g, '/');
    if (!trimmed) return null;

    // Handle shorthand "owner/repo" format (e.g. "gitongsy28/gigsongbook")
    if (!trimmed.includes('github.com') && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      const slashParts = trimmed.split('/').filter(Boolean);
      if (slashParts.length >= 2) {
        trimmed = `https://github.com/${trimmed}`;
      } else {
        return null;
      }
    }

    if (!trimmed.toLowerCase().includes('github.com')) {
      return null;
    }

    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;

    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/, '');
    let branch = '';
    let path = '';
    let hasExplicitBranch = false;

    if (parts.length >= 4 && (parts[2] === 'tree' || parts[2] === 'blob')) {
      hasExplicitBranch = true;
      branch = parts[3];
      path = parts.slice(4).join('/');
    } else if (parts.length === 3 && (parts[2] === 'tree' || parts[2] === 'blob')) {
      hasExplicitBranch = false;
      path = '';
    } else if (parts.length > 2) {
      path = parts.slice(2).join('/');
    }

    // Clean trailing slashes
    path = path.replace(/\/+$/, '');

    return {
      owner,
      repo,
      branch,
      path,
      isGitHub: true,
      hasExplicitBranch,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch raw file text from GitHub API with optional auth token
 */
async function fetchFileContent(file: any, token?: string): Promise<string> {
  const cleanToken = token?.trim();
  const rawHeaders: Record<string, string> = {
    Accept: 'application/vnd.github.v3.raw',
  };
  if (cleanToken) {
    rawHeaders['Authorization'] = `Bearer ${cleanToken}`;
  }

  // 1. Primary: Use the official contents API endpoint with vnd.github.v3.raw
  // This works reliably for both Public and Private repositories
  if (file.url) {
    try {
      const res = await fetch(file.url, { headers: rawHeaders });
      if (res.ok) {
        return await res.text();
      }
    } catch {
      // Fall through to download_url
    }
  }

  // 2. Fallback: Use download_url if available
  if (file.download_url) {
    const downloadHeaders: Record<string, string> = {};
    if (cleanToken) {
      downloadHeaders['Authorization'] = `Bearer ${cleanToken}`;
    }
    const res = await fetch(file.download_url, { headers: downloadHeaders });
    if (res.ok) {
      return await res.text();
    }
  }

  throw new Error(`Failed to download ${file.name}`);
}

/**
 * Fetch all ChordPro songs from a GitHub repository directory, supporting both Public & Private Repositories
 */
export async function syncSongsFromGitHubUrl(
  githubUrl: string,
  token?: string
): Promise<{ songs: Song[]; message: string }> {
  const info = parseGitHubUrl(githubUrl);
  if (!info) {
    throw new Error('Invalid GitHub URL. Example format: https://github.com/owner/repo or https://github.com/owner/repo/tree/main/SongBook');
  }

  const { owner, repo, branch, path, hasExplicitBranch } = info;
  const cleanToken = token?.trim();

  const authHeaders: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (cleanToken) {
    authHeaders['Authorization'] = `Bearer ${cleanToken}`;
  }

  // Helper to fetch directory contents from GitHub API
  async function fetchDirectoryContents(targetPath: string, targetBranch?: string): Promise<{ items: any[]; status: number; errorMsg?: string }> {
    const apiPath = targetPath ? `/${encodeURIComponent(targetPath).replace(/%2F/g, '/')}` : '';
    const refParam = targetBranch ? `?ref=${encodeURIComponent(targetBranch)}` : '';
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents${apiPath}${refParam}`;

    try {
      const response = await fetch(apiUrl, { headers: authHeaders });
      if (response.ok) {
        const data = await response.json();
        return { items: Array.isArray(data) ? data : [data], status: response.status };
      }
      return { items: [], status: response.status, errorMsg: response.statusText };
    } catch (err: any) {
      return { items: [], status: 0, errorMsg: err.message };
    }
  }

  // Attempt 1: Fetch with explicit branch or default branch
  let result = await fetchDirectoryContents(path, hasExplicitBranch ? branch : undefined);

  // Attempt 2: If 404 and user had an explicit branch (e.g. 'main'), try without branch (GitHub defaults to default branch like 'master')
  if (result.status === 404 && hasExplicitBranch) {
    result = await fetchDirectoryContents(path, undefined);
  }

  // Attempt 3: If still 404 and branch was not explicit, try 'main' and then 'master'
  if (result.status === 404 && !hasExplicitBranch) {
    result = await fetchDirectoryContents(path, 'main');
    if (result.status === 404) {
      result = await fetchDirectoryContents(path, 'master');
    }
  }

  // Handle errors
  if (result.status !== 200 || result.items.length === 0) {
    if (result.status === 404) {
      if (!cleanToken) {
        throw new Error(
          `Directory or repository not found (${owner}/${repo}${path ? `/${path}` : ''}).\n\n` +
          `• If this is a PRIVATE repository, GitHub hides it with a 404 error unless a GitHub Personal Access Token is provided. Please enter your GitHub Token below.\n` +
          `• If this is a PUBLIC repository, please check that the repository name and folder path are spelled correctly.`
        );
      } else {
        throw new Error(
          `Directory or repository not found on GitHub (${owner}/${repo}${path ? `/${path}` : ''}).\n\n` +
          `Please check that your Personal Access Token has "Contents" read permissions for this repository, and that the repository name is spelled correctly.`
        );
      }
    }

    if (result.status === 401) {
      throw new Error('GitHub Personal Access Token is invalid or expired. Please check your token.');
    }

    if (result.status === 403) {
      throw new Error(
        cleanToken
          ? 'GitHub token lacks read permissions for this repository.'
          : 'GitHub API rate limit reached or repository is private. Please provide a GitHub Personal Access Token below.'
      );
    }

    if (result.errorMsg) {
      throw new Error(`GitHub connection error: ${result.errorMsg}`);
    }
  }

  const validExtensions = ['.cho', '.crd', '.chopro', '.chordpro', '.pro', '.txt'];

  // Collect song files in the directory
  let songFiles = result.items.filter((item: any) => {
    if (item.type !== 'file') return false;
    const name = (item.name || '').toLowerCase();
    return validExtensions.some((ext) => name.endsWith(ext));
  });

  // If no songs found directly in this folder, check if there are subdirectories (e.g. /songs, /SongBook, /chords)
  if (songFiles.length === 0) {
    const subdirs = result.items.filter((item: any) => item.type === 'dir');
    for (const subdir of subdirs.slice(0, 5)) {
      const subResult = await fetchDirectoryContents(subdir.path, hasExplicitBranch ? branch : undefined);
      if (subResult.status === 200 && subResult.items.length > 0) {
        const nestedSongs = subResult.items.filter((item: any) => {
          if (item.type !== 'file') return false;
          const name = (item.name || '').toLowerCase();
          return validExtensions.some((ext) => name.endsWith(ext));
        });
        songFiles.push(...nestedSongs);
      }
    }
  }

  if (songFiles.length === 0) {
    throw new Error(
      `Connected to GitHub repository (${owner}/${repo}), but no ChordPro files (.cho, .crd, .txt) were found in "${path || 'root'}".`
    );
  }

  // Download all song files
  const fetchedSongs: Song[] = [];
  const errors: string[] = [];

  for (const file of songFiles) {
    try {
      const text = await fetchFileContent(file, cleanToken);
      const song = createSongFromChordPro(
        text,
        file.html_url || `https://github.com/${owner}/${repo}/blob/${branch || 'main'}/${file.path}`,
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
    message: `Successfully synced ${fetchedSongs.length} song(s) from GitHub (${owner}/${repo}${path ? `/${path}` : ''})!`,
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

/**
 * Safely convert UTF-8 string to Base64 (supporting Unicode, accented chars, emojis)
 */
function utf8ToBase64(str: string): string {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
}

export interface CommitSongResult {
  success: boolean;
  committed: boolean;
  fileName: string;
  commitUrl?: string;
  message: string;
}

/**
 * Commit and overwrite a single ChordPro file directly to a GitHub repository (Master Repo Two-Way Write)
 * Uses the GitHub Contents API: PUT /repos/{owner}/{repo}/contents/{path}
 */
export async function commitSongFileToGitHub(options: {
  repoUrl: string;
  token: string;
  fileName: string;
  fileContent: string;
  commitMessage?: string;
}): Promise<CommitSongResult> {
  const { repoUrl, token, fileName, fileContent, commitMessage } = options;
  const cleanToken = (token || '').trim();

  if (!cleanToken) {
    return {
      success: false,
      committed: false,
      fileName,
      message: 'GitHub Personal Access Token is required to commit changes to Master GitHub repository.',
    };
  }

  const info = parseGitHubUrl(repoUrl);
  if (!info) {
    return {
      success: false,
      committed: false,
      fileName,
      message: `Invalid GitHub repository URL: "${repoUrl}".`,
    };
  }

  const { owner, repo, branch, path } = info;
  const cleanFileName = fileName.trim();
  const repoFilePath = path ? `${path}/${cleanFileName}` : cleanFileName;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${cleanToken}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // 1. Check if file already exists to obtain its blob SHA (GitHub requires sha for updates)
  let existingSha: string | undefined = undefined;
  const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(repoFilePath)}${branch ? `?ref=${encodeURIComponent(branch)}` : ''}`;

  try {
    const getRes = await fetch(getUrl, { headers });
    if (getRes.status === 200) {
      const data = await getRes.json();
      if (data && data.sha) {
        existingSha = data.sha;
      }
    } else if (getRes.status === 401) {
      return {
        success: false,
        committed: false,
        fileName: cleanFileName,
        message: 'GitHub Token is invalid or expired. Please verify your Personal Access Token in Master Repo settings.',
      };
    } else if (getRes.status === 403) {
      return {
        success: false,
        committed: false,
        fileName: cleanFileName,
        message: 'GitHub Token lacks permission. Please generate a token with the "repo" scope (read/write access).',
      };
    }
  } catch (err: any) {
    console.warn('Could not inspect existing file sha on GitHub:', err);
  }

  // 2. Base64 encode file content
  const base64Content = utf8ToBase64(fileContent);

  const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(repoFilePath)}`;
  const body: Record<string, any> = {
    message: commitMessage || `Update ${cleanFileName} via SongScroll Master Repo`,
    content: base64Content,
  };

  if (existingSha) {
    body.sha = existingSha;
  }
  if (branch) {
    body.branch = branch;
  }

  try {
    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (putRes.status === 200 || putRes.status === 201) {
      const putData = await putRes.json();
      const commitUrl = putData?.commit?.html_url;
      return {
        success: true,
        committed: true,
        fileName: cleanFileName,
        commitUrl,
        message: `Committed & overwrote "${cleanFileName}" in Master GitHub (${owner}/${repo})!`,
      };
    }

    const errData = await putRes.json().catch(() => ({}));
    const errMsg = errData.message || `HTTP ${putRes.status}`;

    if (putRes.status === 403 || putRes.status === 401) {
      return {
        success: false,
        committed: false,
        fileName: cleanFileName,
        message: `GitHub write permission denied: ${errMsg}. Please ensure your token has "repo" (Contents: Read and write) permission.`,
      };
    }

    return {
      success: false,
      committed: false,
      fileName: cleanFileName,
      message: `Failed to commit to GitHub: ${errMsg}`,
    };
  } catch (err: any) {
    return {
      success: false,
      committed: false,
      fileName: cleanFileName,
      message: `Network error committing to GitHub: ${err.message}`,
    };
  }
}

/**
 * Upload multiple ChordPro files and commit each directly to Master GitHub repository
 */
export async function uploadAndCommitSongsToGitHub(
  files: FileList | File[],
  repoUrl: string,
  token: string
): Promise<{
  successCount: number;
  failedCount: number;
  songs: Song[];
  errors: string[];
}> {
  const fileArray = Array.from(files);
  const validExtensions = ['.cho', '.crd', '.chopro', '.chordpro', '.pro', '.txt'];
  const validFiles = fileArray.filter((file) => {
    const name = file.name.toLowerCase();
    return validExtensions.some((ext) => name.endsWith(ext));
  });

  if (validFiles.length === 0) {
    return {
      successCount: 0,
      failedCount: 0,
      songs: [],
      errors: ['No valid ChordPro files (.cho, .crd, .txt) were found in selection.'],
    };
  }

  const songs: Song[] = [];
  const errors: string[] = [];
  let successCount = 0;
  let failedCount = 0;

  for (const file of validFiles) {
    try {
      const text = await file.text();
      const commitResult = await commitSongFileToGitHub({
        repoUrl,
        token,
        fileName: file.name,
        fileContent: text,
        commitMessage: `Add ${file.name} to Master Songbook via SongScroll`,
      });

      if (commitResult.committed) {
        successCount++;
        const song = createSongFromChordPro(
          text,
          commitResult.commitUrl || `${repoUrl}/${file.name}`,
          file.name
        );
        songs.push(song);
      } else {
        failedCount++;
        errors.push(`${file.name}: ${commitResult.message}`);
      }
    } catch (err: any) {
      failedCount++;
      errors.push(`${file.name}: ${err.message}`);
    }
  }

  return {
    successCount,
    failedCount,
    songs,
    errors,
  };
}

