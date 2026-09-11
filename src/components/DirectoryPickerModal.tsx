import React, { useState } from 'react';
import { 
  Folder, 
  FolderOpen, 
  HardDrive, 
  Upload, 
  Check, 
  RefreshCw, 
  X, 
  AlertCircle, 
  Sparkles, 
  Share2, 
  Copy, 
  Github,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Key,
  Lock,
  Eye,
  EyeOff,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';
import { RepositoryConfig, RepositorySourceType, Song } from '../types';
import { 
  parseUploadedFiles, 
  resetToDefaultSongs, 
  saveRepositoryConfig, 
  setDirectoryHandle, 
  syncSongsFromDirectoryHandle,
  replaceActiveSongs,
  loadSourceSongs,
  clearAllSongs,
  isMasterFolderConnected,
  getConnectedFolderName,
  restoreActiveDirectoryHandle
} from '../utils/storage';
import { parseGitHubUrl, syncBundledSongBook, syncSongsFromGitHubUrl, uploadAndCommitSongsToGitHub } from '../utils/githubSync';

interface DirectoryPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: RepositoryConfig;
  onConfigChange: (newConfig: RepositoryConfig) => void;
  onSongsUpdated: (songs: Song[]) => void;
  currentSongCount: number;
}

export const DirectoryPickerModal: React.FC<DirectoryPickerModalProps> = ({
  isOpen,
  onClose,
  config,
  onConfigChange,
  onSongsUpdated,
  currentSongCount,
}) => {
  const getInitialTab = (): 'master-local' | 'master-github' | 'github' | 'bundled' => {
    if (config.sourceType === 'bundled') return 'bundled';
    if (config.sourceType === 'github-url') return 'github';
    if (config.sourceType === 'github-master') return 'master-github';
    return 'master-local';
  };

  const [activeTab, setActiveTab] = useState<'master-local' | 'master-github' | 'github' | 'bundled'>(getInitialTab);
  const [customPath, setCustomPath] = useState(
    config.sourceType === 'local-drive' ? config.directoryPath : 'D:/Songbook/'
  );
  const [masterGithubUrl, setMasterGithubUrl] = useState(
    config.masterGithubUrl || (config.sourceType === 'github-master' ? config.directoryPath : 'https://github.com/gitongsy28/mastersongbook')
  );
  const [masterGithubToken, setMasterGithubToken] = useState(
    config.masterGithubToken || config.githubToken || ''
  );
  const [showMasterToken, setShowMasterToken] = useState(false);
  const [showMasterTokenHelp, setShowMasterTokenHelp] = useState(false);

  const [githubUrl, setGithubUrl] = useState(
    config.githubUrl || 'https://github.com/gitongsy28/gigsongbook'
  );
  const [githubToken, setGithubToken] = useState(config.githubToken || '');
  const [showToken, setShowToken] = useState(false);
  const [showTokenHelp, setShowTokenHelp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  // Explicitly activate and switch repository source (clears out previous source songs)
  const handleSwitchToSource = async (targetSource: RepositorySourceType) => {
    setIsLoading(true);
    setStatusMessage({ text: `Switching to ${targetSource === 'bundled' ? '/public/SongBook/' : targetSource === 'github-url' ? 'GitHub URL' : 'Local Drive'}...`, type: 'info' });

    try {
      if (targetSource === 'bundled') {
        const bundledSongs = await syncBundledSongBook();
        const saved = await replaceActiveSongs(bundledSongs, 'bundled');
        onSongsUpdated(saved);

        const updatedConfig: RepositoryConfig = {
          ...config,
          sourceType: 'bundled',
          directoryPath: '/public/SongBook/',
          directoryName: 'Bundled /public/SongBook/',
          lastSyncedAt: Date.now(),
          totalFilesFound: saved.length,
        };
        saveRepositoryConfig(updatedConfig);
        onConfigChange(updatedConfig);
        setStatusMessage({
          text: `Switched to /public/SongBook/ (${saved.length} songs loaded without duplicates).`,
          type: 'success',
        });
      } else if (targetSource === 'github-url') {
        const trimmedUrl = githubUrl.trim();
        const trimmedToken = githubToken.trim();
        const cached = loadSourceSongs('github-url');

        if (cached && cached.length > 0) {
          const saved = await replaceActiveSongs(cached, 'github-url');
          onSongsUpdated(saved);
          const updatedConfig: RepositoryConfig = {
            ...config,
            sourceType: 'github-url',
            githubUrl: trimmedUrl,
            githubToken: trimmedToken,
            directoryPath: trimmedUrl,
            directoryName: 'GitHub SongBook',
            totalFilesFound: saved.length,
          };
          saveRepositoryConfig(updatedConfig);
          onConfigChange(updatedConfig);
          setStatusMessage({
            text: `Switched to GitHub Repository (${saved.length} cached songs loaded). Click "Sync Songs" to refresh.`,
            type: 'success',
          });
        } else if (trimmedUrl) {
          const { songs, message } = await syncSongsFromGitHubUrl(trimmedUrl, trimmedToken);
          const saved = await replaceActiveSongs(songs, 'github-url');
          onSongsUpdated(saved);
          const parsed = parseGitHubUrl(trimmedUrl);
          const updatedConfig: RepositoryConfig = {
            ...config,
            sourceType: 'github-url',
            githubUrl: trimmedUrl,
            githubToken: trimmedToken,
            directoryPath: trimmedUrl,
            directoryName: parsed ? `${parsed.owner}/${parsed.repo}${parsed.path ? `/${parsed.path}` : ''}` : 'GitHub SongBook',
            lastSyncedAt: Date.now(),
            totalFilesFound: saved.length,
          };
          saveRepositoryConfig(updatedConfig);
          onConfigChange(updatedConfig);
          setStatusMessage({ text: message, type: 'success' });
        } else {
          await clearAllSongs();
          onSongsUpdated([]);
          const updatedConfig: RepositoryConfig = {
            ...config,
            sourceType: 'github-url',
            githubToken: trimmedToken,
            totalFilesFound: 0,
          };
          saveRepositoryConfig(updatedConfig);
          onConfigChange(updatedConfig);
          setStatusMessage({ text: 'Switched to GitHub source. Enter a URL and click Sync Songs.', type: 'info' });
        }
      } else if (targetSource === 'github-master') {
        const trimmedUrl = masterGithubUrl.trim() || 'https://github.com/gitongsy28/mastersongbook';
        const trimmedToken = masterGithubToken.trim();
        const cached = loadSourceSongs('github-master');

        if (cached && cached.length > 0) {
          const saved = await replaceActiveSongs(cached, 'github-master');
          onSongsUpdated(saved);
          const parsed = parseGitHubUrl(trimmedUrl);
          const updatedConfig: RepositoryConfig = {
            ...config,
            sourceType: 'github-master',
            masterSubtype: 'github',
            masterGithubUrl: trimmedUrl,
            masterGithubToken: trimmedToken,
            githubToken: trimmedToken,
            directoryPath: trimmedUrl,
            directoryName: parsed ? `Master: ${parsed.owner}/${parsed.repo}` : 'Master GitHub SongBook',
            totalFilesFound: saved.length,
          };
          saveRepositoryConfig(updatedConfig);
          onConfigChange(updatedConfig);
          setStatusMessage({
            text: `Switched to Master GitHub Repository (${saved.length} cached songs loaded). Click "Sync Master Songs" to refresh.`,
            type: 'success',
          });
        } else if (trimmedUrl) {
          const { songs, message } = await syncSongsFromGitHubUrl(trimmedUrl, trimmedToken);
          const saved = await replaceActiveSongs(songs, 'github-master');
          onSongsUpdated(saved);
          const parsed = parseGitHubUrl(trimmedUrl);
          const updatedConfig: RepositoryConfig = {
            ...config,
            sourceType: 'github-master',
            masterSubtype: 'github',
            masterGithubUrl: trimmedUrl,
            masterGithubToken: trimmedToken,
            githubToken: trimmedToken,
            directoryPath: trimmedUrl,
            directoryName: parsed ? `Master: ${parsed.owner}/${parsed.repo}` : 'Master GitHub SongBook',
            lastSyncedAt: Date.now(),
            totalFilesFound: saved.length,
          };
          saveRepositoryConfig(updatedConfig);
          onConfigChange(updatedConfig);
          setStatusMessage({ text: `Master GitHub Connected! ${message}`, type: 'success' });
        } else {
          await clearAllSongs();
          onSongsUpdated([]);
          const updatedConfig: RepositoryConfig = {
            ...config,
            sourceType: 'github-master',
            masterSubtype: 'github',
            masterGithubUrl: trimmedUrl,
            masterGithubToken: trimmedToken,
            githubToken: trimmedToken,
            directoryPath: trimmedUrl,
            totalFilesFound: 0,
          };
          saveRepositoryConfig(updatedConfig);
          onConfigChange(updatedConfig);
          setStatusMessage({ text: 'Switched to Master GitHub source. Enter a URL and click Sync Master Songs.', type: 'info' });
        }
      } else if (targetSource === 'local-drive') {
        const cached = loadSourceSongs('local-drive');
        if (cached && cached.length > 0) {
          const saved = await replaceActiveSongs(cached, 'local-drive');
          onSongsUpdated(saved);
          const updatedConfig: RepositoryConfig = {
            ...config,
            sourceType: 'local-drive',
            directoryPath: customPath || 'D:/Songbook/',
            directoryName: 'Local Drive Repository',
            totalFilesFound: saved.length,
          };
          saveRepositoryConfig(updatedConfig);
          onConfigChange(updatedConfig);
          setStatusMessage({
            text: `Switched to Local Drive (${saved.length} songs loaded).`,
            type: 'success',
          });
        } else {
          await clearAllSongs();
          onSongsUpdated([]);
          const updatedConfig: RepositoryConfig = {
            ...config,
            sourceType: 'local-drive',
            directoryPath: customPath || 'D:/Songbook/',
            directoryName: 'Local Drive Repository',
            totalFilesFound: 0,
          };
          saveRepositoryConfig(updatedConfig);
          onConfigChange(updatedConfig);
          setStatusMessage({
            text: 'Switched to Local Drive. Select a folder or upload ChordPro files to load your songs.',
            type: 'info',
          });
        }
      }
    } catch (err: any) {
      setStatusMessage({ text: `Failed to switch source: ${err.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle native File System Access directory picker (e.g. D:\Songbook)
  const handlePickNativeDirectory = async () => {
    if (!('showDirectoryPicker' in window)) {
      setStatusMessage({
        text: 'File System Directory Picker is not natively supported in this browser. Please use the Folder / File Upload option below.',
        type: 'info'
      });
      return;
    }

    try {
      setIsLoading(true);
      setStatusMessage({ text: 'Opening local file system directory picker...', type: 'info' });

      const dirHandle = await (window as any).showDirectoryPicker({
        id: 'chordpro-repo-picker',
        mode: 'readwrite',
      });

      setDirectoryHandle(dirHandle);

      const pathName = `${dirHandle.name}`;
      setCustomPath(pathName);

      const syncedSongs = await syncSongsFromDirectoryHandle(dirHandle, pathName);

      if (syncedSongs.length > 0) {
        // Replace active songs completely (no appending or duplicates)
        const saved = await replaceActiveSongs(syncedSongs, 'local-drive');
        onSongsUpdated(saved);

        const updatedConfig: RepositoryConfig = {
          ...config,
          sourceType: 'local-drive',
          directoryPath: pathName,
          directoryName: dirHandle.name,
          hasDirectoryHandle: true,
          lastSyncedAt: Date.now(),
          totalFilesFound: saved.length,
        };

        saveRepositoryConfig(updatedConfig);
        onConfigChange(updatedConfig);

        setStatusMessage({
          text: `Successfully synced ${saved.length} ChordPro song(s) from local folder "${dirHandle.name}"!`,
          type: 'success'
        });
      } else {
        setStatusMessage({
          text: `Connected to folder "${dirHandle.name}". No .cho or .txt ChordPro files found yet.`,
          type: 'info'
        });
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setStatusMessage({
          text: `Error accessing directory: ${err.message || 'Permission denied'}`,
          type: 'error'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle standard folder or multi-file upload
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setIsLoading(true);
      setStatusMessage({ text: `Parsing ${files.length} ChordPro file(s)...`, type: 'info' });

      const parsedSongs = await parseUploadedFiles(files, customPath);

      if (parsedSongs.length > 0) {
        // Replace active songs completely (no appending or duplicates)
        const saved = await replaceActiveSongs(parsedSongs, 'local-drive');
        onSongsUpdated(saved);

        const updatedConfig: RepositoryConfig = {
          ...config,
          sourceType: 'local-drive',
          directoryPath: customPath,
          lastSyncedAt: Date.now(),
          totalFilesFound: saved.length,
        };

        saveRepositoryConfig(updatedConfig);
        onConfigChange(updatedConfig);

        setStatusMessage({
          text: `Successfully loaded ${saved.length} song(s) into Local Drive repository!`,
          type: 'success'
        });
      } else {
        setStatusMessage({
          text: 'No valid ChordPro files (.cho, .crd, .chopro, .txt) were detected.',
          type: 'error'
        });
      }
    } catch (err: any) {
      setStatusMessage({
        text: `Import failed: ${err.message}`,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Save customized local path
  const handleSavePath = () => {
    const trimmed = customPath.trim() || 'D:/Songbook/';
    const updatedConfig: RepositoryConfig = {
      ...config,
      sourceType: 'local-drive',
      directoryPath: trimmed,
    };
    saveRepositoryConfig(updatedConfig);
    onConfigChange(updatedConfig);
    setStatusMessage({
      text: `Repository path updated to "${trimmed}"`,
      type: 'success'
    });
  };

  // Sync songs from Master GitHub repository (Two-Way Cloud Overwrite)
  const handleSyncMasterGitHub = async () => {
    const trimmedUrl = masterGithubUrl.trim() || 'https://github.com/gitongsy28/mastersongbook';
    const trimmedToken = masterGithubToken.trim();

    if (!trimmedUrl) {
      setStatusMessage({ text: 'Please enter a valid Master GitHub repository URL.', type: 'error' });
      return;
    }

    try {
      setIsLoading(true);
      setStatusMessage({ text: 'Connecting to Master GitHub repository and fetching ChordPro files...', type: 'info' });

      const { songs, message } = await syncSongsFromGitHubUrl(trimmedUrl, trimmedToken);

      if (songs.length > 0) {
        const saved = await replaceActiveSongs(songs, 'github-master');
        onSongsUpdated(saved);

        const parsed = parseGitHubUrl(trimmedUrl);
        const updatedConfig: RepositoryConfig = {
          ...config,
          sourceType: 'github-master',
          masterSubtype: 'github',
          masterGithubUrl: trimmedUrl,
          masterGithubToken: trimmedToken,
          githubToken: trimmedToken,
          directoryPath: trimmedUrl,
          directoryName: parsed ? `Master: ${parsed.owner}/${parsed.repo}${parsed.path ? `/${parsed.path}` : ''}` : 'Master GitHub SongBook',
          lastSyncedAt: Date.now(),
          totalFilesFound: saved.length,
        };

        saveRepositoryConfig(updatedConfig);
        onConfigChange(updatedConfig);

        setStatusMessage({
          text: `Master GitHub Synced: ${message}`,
          type: 'success'
        });
      } else {
        setStatusMessage({
          text: 'Connected to Master GitHub, but no .cho or .txt files were found in the branch.',
          type: 'info'
        });
      }
    } catch (err: any) {
      setStatusMessage({
        text: `Master GitHub Sync Failed: ${err.message}`,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle uploading and committing ChordPro files directly to Master GitHub
  const handleMasterGitHubUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const trimmedUrl = masterGithubUrl.trim() || 'https://github.com/gitongsy28/mastersongbook';
    const trimmedToken = masterGithubToken.trim();

    if (!trimmedToken) {
      setStatusMessage({
        text: 'A GitHub Personal Access Token with "repo" write permission is required to commit files to Master GitHub.',
        type: 'error',
      });
      return;
    }

    try {
      setIsLoading(true);
      setStatusMessage({
        text: `Uploading & committing ${files.length} file(s) directly to Master GitHub (${trimmedUrl})...`,
        type: 'info',
      });

      const uploadResult = await uploadAndCommitSongsToGitHub(files, trimmedUrl, trimmedToken);

      if (uploadResult.successCount > 0) {
        // Fetch all songs from GitHub to refresh complete library state
        const { songs } = await syncSongsFromGitHubUrl(trimmedUrl, trimmedToken);
        const saved = await replaceActiveSongs(songs, 'github-master');
        onSongsUpdated(saved);

        const parsed = parseGitHubUrl(trimmedUrl);
        const updatedConfig: RepositoryConfig = {
          ...config,
          sourceType: 'github-master',
          masterSubtype: 'github',
          masterGithubUrl: trimmedUrl,
          masterGithubToken: trimmedToken,
          githubToken: trimmedToken,
          directoryPath: trimmedUrl,
          directoryName: parsed ? `Master: ${parsed.owner}/${parsed.repo}` : 'Master GitHub SongBook',
          lastSyncedAt: Date.now(),
          totalFilesFound: saved.length,
        };
        saveRepositoryConfig(updatedConfig);
        onConfigChange(updatedConfig);

        setStatusMessage({
          text: `Successfully committed ${uploadResult.successCount} ChordPro file(s) directly to Master GitHub! Library updated.`,
          type: 'success',
        });
      } else {
        setStatusMessage({
          text: `Upload failed: ${uploadResult.errors.join('; ')}`,
          type: 'error',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        text: `Master GitHub Upload Failed: ${err.message}`,
        type: 'error',
      });
    } finally {
      setIsLoading(false);
      // Reset input value so same files can be re-selected if needed
      e.target.value = '';
    }
  };

  // Sync songs from GitHub URL
  const handleSyncFromGitHub = async () => {
    const trimmedUrl = githubUrl.trim();
    const trimmedToken = githubToken.trim();

    if (!trimmedUrl) {
      setStatusMessage({ text: 'Please enter a valid GitHub repository URL.', type: 'error' });
      return;
    }

    try {
      setIsLoading(true);
      setStatusMessage({ text: 'Connecting to GitHub repository and downloading ChordPro files...', type: 'info' });

      const { songs, message } = await syncSongsFromGitHubUrl(trimmedUrl, trimmedToken);

      if (songs.length > 0) {
        // Replace active songs completely (no appending or duplicates)
        const saved = await replaceActiveSongs(songs, 'github-url');
        onSongsUpdated(saved);

        const parsed = parseGitHubUrl(trimmedUrl);
        const updatedConfig: RepositoryConfig = {
          ...config,
          sourceType: 'github-url',
          githubUrl: trimmedUrl,
          githubToken: trimmedToken,
          directoryPath: trimmedUrl,
          directoryName: parsed ? `${parsed.owner}/${parsed.repo}${parsed.path ? `/${parsed.path}` : ''}` : 'GitHub SongBook',
          lastSyncedAt: Date.now(),
          totalFilesFound: saved.length,
        };

        saveRepositoryConfig(updatedConfig);
        onConfigChange(updatedConfig);

        setStatusMessage({
          text: message,
          type: 'success'
        });
      }
    } catch (err: any) {
      setStatusMessage({
        text: `GitHub Sync Failed: ${err.message}`,
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Sync from bundled /public/SongBook/
  const handleSyncBundled = async () => {
    try {
      setIsLoading(true);
      setStatusMessage({ text: 'Loading bundled songs from /public/SongBook/...', type: 'info' });

      const songs = await syncBundledSongBook();
      if (songs.length > 0) {
        // Replace active songs completely (no appending or duplicates)
        const saved = await replaceActiveSongs(songs, 'bundled');
        onSongsUpdated(saved);

        const updatedConfig: RepositoryConfig = {
          ...config,
          sourceType: 'bundled',
          directoryPath: '/public/SongBook/',
          directoryName: 'Bundled /public/SongBook/',
          lastSyncedAt: Date.now(),
          totalFilesFound: saved.length,
        };

        saveRepositoryConfig(updatedConfig);
        onConfigChange(updatedConfig);

        setStatusMessage({
          text: `Loaded ${saved.length} bundled songs from /public/SongBook/!`,
          type: 'success'
        });
      }
    } catch (err: any) {
      setStatusMessage({ text: `Failed to load bundled songs: ${err.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Reset to default sample library
  const handleResetSampleSongs = async () => {
    if (confirm('Reset song repository to default ChordPro library? This will replace your active songs.')) {
      setIsLoading(true);
      try {
        const samples = await resetToDefaultSongs();
        onSongsUpdated(samples);
        const updatedConfig: RepositoryConfig = {
          ...config,
          sourceType: 'bundled',
          directoryPath: '/public/SongBook/',
          directoryName: 'Bundled /public/SongBook/',
          lastSyncedAt: Date.now(),
          totalFilesFound: samples.length,
        };
        saveRepositoryConfig(updatedConfig);
        onConfigChange(updatedConfig);
        setStatusMessage({
          text: `Restored ${samples.length} standard ChordPro songs.`,
          type: 'success'
        });
      } catch (err: any) {
        setStatusMessage({ text: 'Failed to reset songs.', type: 'error' });
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Copy shareable link
  const handleCopyShareLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('repo', githubUrl.trim());
    navigator.clipboard.writeText(url.toString());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const isLocalActive = config.sourceType === 'local-drive';
  const isMasterGithubActive = config.sourceType === 'github-master';
  const isMasterActive = isLocalActive || isMasterGithubActive;
  const isGithubActive = config.sourceType === 'github-url';
  const isBundledActive = config.sourceType === 'bundled';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        id="directory-picker-modal"
        className="w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">SongBook Repository Source</h2>
              <p className="text-xs text-slate-400">Master Repositories (Local / GitHub Overwrite) & Shared Sources</p>
            </div>
          </div>
          <button
            id="close-dir-modal"
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source Navigation: 4 Panels in a Single Row */}
        <div className="grid grid-cols-4 gap-2 border-b border-slate-800 bg-slate-950/60 p-2.5 sm:p-3 px-3 sm:px-4 text-xs">
          {/* First Button: Master Local (Read & Write) */}
          <div
            className={`p-1 sm:p-1.5 rounded-xl border flex flex-col justify-between transition-all ${
              activeTab === 'master-local'
                ? 'bg-slate-900 border-amber-500/60 shadow-md ring-1 ring-amber-500/30'
                : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <button
              id="tab-master-local"
              type="button"
              onClick={() => setActiveTab('master-local')}
              className={`w-full py-2 px-1 rounded-lg flex flex-col items-center justify-center text-center transition-all ${
                activeTab === 'master-local'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <div className="flex items-center gap-1 font-bold text-xs sm:text-sm leading-tight">
                <HardDrive className="w-3.5 h-3.5 shrink-0" />
                <span>Master Local</span>
              </div>
              <span className={`text-[10px] sm:text-[11px] leading-tight mt-0.5 ${
                activeTab === 'master-local' ? 'text-slate-950/85 font-semibold' : 'text-slate-400'
              }`}>
                (Read & Write)
              </span>
              {isLocalActive && (
                <span className={`mt-1.5 text-[8.5px] font-black px-1.5 py-0.5 rounded-full tracking-wider uppercase ${
                  activeTab === 'master-local'
                    ? 'bg-slate-950 text-emerald-400'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}>
                  ACTIVE
                </span>
              )}
            </button>
            <div 
              title={customPath || 'D:/Songbook/'}
              className="mt-1.5 px-1.5 py-1 bg-slate-950/90 border border-slate-800/80 rounded text-[9.5px] text-slate-400 font-mono text-center break-all leading-snug max-h-[38px] overflow-y-auto"
            >
              {customPath || 'D:/Songbook/'}
            </div>
          </div>

          {/* Second Button: Master GitHub (Read & Write) */}
          <div
            className={`p-1 sm:p-1.5 rounded-xl border flex flex-col justify-between transition-all ${
              activeTab === 'master-github'
                ? 'bg-slate-900 border-amber-500/60 shadow-md ring-1 ring-amber-500/30'
                : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <button
              id="tab-master-github"
              type="button"
              onClick={() => setActiveTab('master-github')}
              className={`w-full py-2 px-1 rounded-lg flex flex-col items-center justify-center text-center transition-all ${
                activeTab === 'master-github'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <div className="flex items-center gap-1 font-bold text-xs sm:text-sm leading-tight">
                <Github className="w-3.5 h-3.5 shrink-0" />
                <span>Master GitHub</span>
              </div>
              <span className={`text-[10px] sm:text-[11px] leading-tight mt-0.5 ${
                activeTab === 'master-github' ? 'text-slate-950/85 font-semibold' : 'text-slate-400'
              }`}>
                (Read & Write)
              </span>
              {isMasterGithubActive && (
                <span className={`mt-1.5 text-[8.5px] font-black px-1.5 py-0.5 rounded-full tracking-wider uppercase ${
                  activeTab === 'master-github'
                    ? 'bg-slate-950 text-emerald-400'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}>
                  ACTIVE
                </span>
              )}
            </button>
            <div 
              title={masterGithubUrl}
              className="mt-1.5 px-1.5 py-1 bg-slate-950/90 border border-slate-800/80 rounded text-[9.5px] text-slate-400 font-mono text-center break-all leading-snug max-h-[38px] overflow-y-auto"
            >
              {masterGithubUrl}
            </div>
          </div>

          {/* Third Button: Shared GitHub (Read Only) */}
          <div
            className={`p-1 sm:p-1.5 rounded-xl border flex flex-col justify-between transition-all ${
              activeTab === 'github'
                ? 'bg-slate-900 border-amber-500/60 shadow-md ring-1 ring-amber-500/30'
                : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <button
              id="tab-shared-github"
              type="button"
              onClick={() => setActiveTab('github')}
              className={`w-full py-2 px-1 rounded-lg flex flex-col items-center justify-center text-center transition-all ${
                activeTab === 'github'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <div className="flex items-center gap-1 font-bold text-xs sm:text-sm leading-tight">
                <Github className="w-3.5 h-3.5 shrink-0" />
                <span>Shared GitHub</span>
              </div>
              <span className={`text-[10px] sm:text-[11px] leading-tight mt-0.5 ${
                activeTab === 'github' ? 'text-slate-950/85 font-semibold' : 'text-slate-400'
              }`}>
                (Read Only)
              </span>
              {isGithubActive && (
                <span className={`mt-1.5 text-[8.5px] font-black px-1.5 py-0.5 rounded-full tracking-wider uppercase ${
                  activeTab === 'github'
                    ? 'bg-slate-950 text-emerald-400'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}>
                  ACTIVE
                </span>
              )}
            </button>
            <div 
              title={githubUrl}
              className="mt-1.5 px-1.5 py-1 bg-slate-950/90 border border-slate-800/80 rounded text-[9.5px] text-slate-400 font-mono text-center break-all leading-snug max-h-[38px] overflow-y-auto"
            >
              {githubUrl}
            </div>
          </div>

          {/* Fourth Button: Bundled (Read Only) */}
          <div
            className={`p-1 sm:p-1.5 rounded-xl border flex flex-col justify-between transition-all ${
              activeTab === 'bundled'
                ? 'bg-slate-900 border-amber-500/60 shadow-md ring-1 ring-amber-500/30'
                : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <button
              id="tab-bundled"
              type="button"
              onClick={() => setActiveTab('bundled')}
              className={`w-full py-2 px-1 rounded-lg flex flex-col items-center justify-center text-center transition-all ${
                activeTab === 'bundled'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <div className="flex items-center gap-1 font-bold text-xs sm:text-sm leading-tight">
                <Folder className="w-3.5 h-3.5 shrink-0" />
                <span>Bundled</span>
              </div>
              <span className={`text-[10px] sm:text-[11px] leading-tight mt-0.5 ${
                activeTab === 'bundled' ? 'text-slate-950/85 font-semibold' : 'text-slate-400'
              }`}>
                (Read Only)
              </span>
              {isBundledActive && (
                <span className={`mt-1.5 text-[8.5px] font-black px-1.5 py-0.5 rounded-full tracking-wider uppercase ${
                  activeTab === 'bundled'
                    ? 'bg-slate-950 text-emerald-400'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}>
                  ACTIVE
                </span>
              )}
            </button>
            <div 
              title="/public/SongBook/"
              className="mt-1.5 px-1.5 py-1 bg-slate-950/90 border border-slate-800/80 rounded text-[9.5px] text-slate-400 font-mono text-center break-all leading-snug max-h-[38px] overflow-y-auto"
            >
              /public/SongBook/
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm text-slate-300">
          
          {/* TAB 2: MASTER GITHUB (TWO-WAY CLOUD OVERWRITE) */}
          {activeTab === 'master-github' && (
            <div className="space-y-4">
                  {/* Switcher Banner if not currently active */}
                  {!isMasterGithubActive && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3">
                      <div className="text-xs text-amber-200">
                        Currently viewing another repository source.
                      </div>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleSwitchToSource('github-master')}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 transition-colors shrink-0"
                      >
                        Switch to Master GitHub
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Master GitHub Overwrite Feature Card */}
                  <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-emerald-300">
                        <Github className="w-4 h-4 text-emerald-400" />
                        <span>Master GitHub Repository (Two-Way Cloud Overwrite)</span>
                      </div>
                      {masterGithubToken.trim() ? (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                          <ShieldCheck className="w-3 h-3" />
                          Write Token Ready
                        </span>
                      ) : (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold px-2 py-0.5 rounded-md shrink-0">
                          Token Required to Write
                        </span>
                      )}
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Treat your GitHub repository (e.g. <code className="text-amber-300 font-mono">https://github.com/gitongsy28/mastersongbook</code>) as your <strong>Master Repository</strong>.
                    </p>
                    <div className="text-[11px] text-emerald-200/90 pt-1 flex items-center gap-1.5 font-medium">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>When you edit a song, clicking <strong>"Save Song"</strong> directly commits and overwrites the <code className="text-amber-300 font-mono">.cho</code> / <code className="text-amber-300 font-mono">.txt</code> file in your Master GitHub repository!</span>
                    </div>
                  </div>

                  {/* Active Status Badge if currently selected */}
                  {isMasterGithubActive && (
                    <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 text-emerald-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                        <span>
                          <strong className="text-emerald-300">Master GitHub Active:</strong> {config.directoryName || 'mastersongbook'}
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-300 font-semibold bg-emerald-900/60 px-2.5 py-1 rounded-lg border border-emerald-500/40 shrink-0">
                        Cloud Overwrites Active
                      </span>
                    </div>
                  )}

                  {/* Master GitHub Repository URL */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Github className="w-3.5 h-3.5 text-emerald-400" />
                        Master GitHub Repository URL
                      </span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="master-github-repo-url-input"
                        type="text"
                        value={masterGithubUrl}
                        onChange={(e) => setMasterGithubUrl(e.target.value)}
                        placeholder="https://github.com/gitongsy28/mastersongbook"
                        className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-400 transition-colors"
                      />
                      <button
                        id="sync-master-github-btn"
                        type="button"
                        disabled={isLoading}
                        onClick={handleSyncMasterGitHub}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-50 shadow-md"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        Sync Master Songs
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5 text-[11px] text-slate-400">
                      <span>
                        Enter URL (e.g. <code className="text-emerald-300 font-mono">https://github.com/gitongsy28/mastersongbook</code>) or shorthand (<code className="text-emerald-300 font-mono">gitongsy28/mastersongbook</code>).
                      </span>
                      {!masterGithubUrl.includes('mastersongbook') && (
                        <button
                          type="button"
                          onClick={() => setMasterGithubUrl('https://github.com/gitongsy28/mastersongbook')}
                          className="text-[10px] text-emerald-400 hover:text-emerald-300 underline font-mono"
                        >
                          Use "mastersongbook"
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Master GitHub Token Input */}
                  <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Key className="w-3.5 h-3.5 text-emerald-400" />
                        GitHub Personal Access Token (PAT)
                        <span className="text-[10px] text-slate-400 font-normal">(Required for Commits & Overwrites)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowMasterTokenHelp(!showMasterTokenHelp)}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium transition-colors"
                      >
                        <HelpCircle className="w-3 h-3" />
                        <span>{showMasterTokenHelp ? 'Hide Guide' : 'How to get a Token?'}</span>
                      </button>
                    </div>

                    <div className="relative flex items-center">
                      <div className="absolute left-3 text-slate-500 pointer-events-none">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                      <input
                        id="master-github-token-input"
                        type={showMasterToken ? 'text' : 'password'}
                        value={masterGithubToken}
                        onChange={(e) => setMasterGithubToken(e.target.value)}
                        placeholder="ghp_... or github_pat_... (requires 'repo' scope for writing)"
                        className="w-full pl-9 pr-20 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-400 transition-colors"
                      />
                      <div className="absolute right-2 flex items-center gap-1">
                        {masterGithubToken && (
                          <button
                            type="button"
                            onClick={() => setMasterGithubToken('')}
                            title="Clear token"
                            className="p-1 text-slate-400 hover:text-slate-200 text-xs"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowMasterToken(!showMasterToken)}
                          title={showMasterToken ? 'Hide token' : 'Show token'}
                          className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          {showMasterToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {showMasterTokenHelp && (
                      <div className="p-3 bg-slate-900/90 border border-slate-700/80 rounded-lg text-[11px] text-slate-300 space-y-1.5 leading-relaxed">
                        <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-emerald-400" />
                          How to create a GitHub Token with write/commit access:
                        </div>
                        <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-1">
                          <li>
                            Visit <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" className="text-emerald-400 underline font-medium inline-flex items-center gap-0.5">GitHub Settings &gt; Developer Settings &gt; Personal access tokens <ExternalLink className="w-2.5 h-2.5" /></a>
                          </li>
                          <li>
                            Select <strong>Tokens (classic)</strong> &gt; <strong>Generate new token (classic)</strong>.
                          </li>
                          <li>
                            Give it a Note (e.g. <code className="text-amber-300 font-mono">SongScroll-Master</code>) and check the <strong className="text-emerald-300">repo</strong> checkbox (gives write and commit access).
                          </li>
                          <li>
                            Click <strong>Generate token</strong>, copy the key (starts with <code className="text-amber-300 font-mono">ghp_</code>), and paste it above.
                          </li>
                        </ol>
                      </div>
                    )}
                  </div>

                  {/* Upload ChordPro Files directly to Master GitHub */}
                  <div className="p-3.5 bg-slate-800/60 border border-slate-700 rounded-xl flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-300 font-semibold text-xs">
                        <Upload className="w-4 h-4 text-emerald-400" />
                        <span>Upload Master Local ChordPro Files to Master GitHub <span className="text-red-500 font-extrabold">(Overwrite!)</span></span>
                      </div>
                      <span className="text-[10px] text-slate-400">Direct GitHub Commit</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      Select <code className="text-amber-300 font-mono">.cho</code>, <code className="text-amber-300 font-mono">.crd</code>, or <code className="text-amber-300 font-mono">.txt</code> files from your device. SongScroll will commit them directly to <code className="text-emerald-300 font-mono">{masterGithubUrl.replace('https://github.com/', '')}</code> on GitHub!
                    </p>
                    <label className="mt-1 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl cursor-pointer text-xs flex items-center justify-center gap-2 transition-colors shadow-sm text-center">
                      <Upload className="w-4 h-4" />
                      <span>Select Master Local ChordPro Files to copy/overwrite in Master GitHub</span>
                      <input
                        type="file"
                        multiple
                        accept=".cho,.crd,.chopro,.chordpro,.pro,.txt"
                        onChange={handleMasterGitHubUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}

          {/* TAB 1: MASTER LOCAL (LOCAL DRIVE / SYNCED FOLDER) */}
          {activeTab === 'master-local' && (
            <div className="space-y-4">
                  {/* Active Switcher Banner */}
                  {!isLocalActive && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3">
                      <div className="text-xs text-amber-200">
                        Currently viewing another repository source.
                      </div>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleSwitchToSource('local-drive')}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 transition-colors shrink-0"
                      >
                        Switch to Local Master Repo
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Master Repository Explanation Card */}
                  <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-xs space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-emerald-300">
                      <HardDrive className="w-4 h-4 text-emerald-400" />
                      <span>Local Drive Master (Physical Disk Overwrite Enabled)</span>
                    </div>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      Treat this as your <strong>Local Master Repository</strong>. It can be a local drive path (e.g. <code className="text-amber-300 font-mono">D:/Songbook/</code>) or a cloud-synced shared folder (such as <strong>Google Drive for Desktop</strong>, <strong>OneDrive</strong>, or a local URL shared drive).
                    </p>
                    <div className="text-[11px] text-emerald-200/90 pt-1 flex items-center gap-1.5 font-medium">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>When in Master Repository, clicking <strong>"Save Song"</strong> physically overwrites the <code className="text-amber-300 font-mono">.cho</code> / <code className="text-amber-300 font-mono">.txt</code> file on disk and updates the app database immediately!</span>
                    </div>
                  </div>

                  {/* Master Folder Physical Access Status Banner */}
                  {isMasterFolderConnected() ? (
                    <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 text-emerald-200">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                        <span>
                          <strong className="text-emerald-300">Drive Folder Connected:</strong> "{getConnectedFolderName()}"
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-300 font-semibold bg-emerald-900/60 px-2.5 py-1 rounded-lg border border-emerald-500/40 shrink-0">
                        Disk Overwrites Active
                      </span>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-amber-950/50 border border-amber-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200">
                      <div className="space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-amber-300">
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                          One-Time Step: Connect Your Master Folder
                        </div>
                        <p className="text-[11px] text-slate-300 leading-snug">
                          Browsers require a one-time permission grant to save files directly to your hard drive. Click <strong>"Select Master Folder"</strong> to grant write access.
                        </p>
                        {typeof window !== 'undefined' && window.self !== window.top && (
                          <p className="text-[10px] text-amber-300/90 font-medium">
                            (Note: Embedded preview windows block disk writing. Open SongScroll in a new tab to link your drive.)
                          </p>
                        )}
                      </div>
                      {typeof window !== 'undefined' && window.self !== window.top ? (
                        <a
                          href={window.location.href}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 transition-colors shrink-0 self-start sm:self-center"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Open in New Tab
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={handlePickNativeDirectory}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 transition-colors shrink-0 self-start sm:self-center"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          Connect Folder Now
                        </button>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Folder className="w-3.5 h-3.5 text-amber-400" />
                      Master Repository Folder or URL Path
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="custom-repo-path-input"
                        type="text"
                        value={customPath}
                        onChange={(e) => setCustomPath(e.target.value)}
                        placeholder="D:/Songbook/ or G:/My Drive/SongBook/ or OneDrive/SongBook/"
                        className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400 transition-colors"
                      />
                      <button
                        id="save-repo-path-btn"
                        type="button"
                        onClick={handleSavePath}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium text-xs flex items-center gap-1 transition-colors border border-slate-700 shrink-0"
                      >
                        <Check className="w-3.5 h-3.5 text-green-400" />
                        Save Path
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Configure your primary directory or synced Google Drive / OneDrive path.
                    </p>
                  </div>

                  {/* Local Action Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Pick Directory via File System Access API */}
                    <button
                      id="pick-native-directory-btn"
                      type="button"
                      disabled={isLoading}
                      onClick={handlePickNativeDirectory}
                      className="p-3.5 bg-gradient-to-br from-emerald-500/10 to-amber-500/10 hover:from-emerald-500/20 hover:to-amber-500/20 border border-emerald-500/30 rounded-xl text-left flex flex-col gap-1.5 transition-all group active:scale-98"
                    >
                      <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                        <FolderOpen className="w-4 h-4" />
                        Select Master Folder (Drive / Cloud)
                      </div>
                      <span className="text-[11px] text-slate-400 group-hover:text-slate-300 leading-snug">
                        Connect local folder or synced cloud drive folder to enable <strong>direct file overwrite</strong> upon saving.
                      </span>
                    </button>

                    {/* Folder / Files Multi-Import */}
                    <label
                      id="upload-folder-label"
                      className="p-3.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 rounded-xl cursor-pointer text-left flex flex-col gap-1.5 transition-all group active:scale-98"
                    >
                      <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs">
                        <Upload className="w-4 h-4" />
                        Upload ChordPro Files to Local
                      </div>
                      <span className="text-[11px] text-slate-400 group-hover:text-slate-300 leading-snug">
                        Upload <code className="text-sky-300 font-mono">.cho</code>, <code className="text-sky-300 font-mono">.crd</code>, or <code className="text-sky-300 font-mono">.txt</code> files for this local repository.
                      </span>
                      <input
                        id="file-upload-input"
                        type="file"
                        multiple
                        accept=".cho,.crd,.chopro,.chordpro,.pro,.txt"
                        onChange={handleFileInputChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              )}

          {/* TAB 2: GITHUB / SHARED URL */}
          {activeTab === 'github' && (
            <div className="space-y-4">
              {/* Active Switcher Banner */}
              {!isGithubActive && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3">
                  <div className="text-xs text-amber-200">
                    Currently viewing another repository source.
                  </div>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleSwitchToSource('github-url')}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 transition-colors shrink-0"
                  >
                    Switch to GitHub
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* GitHub Read-Only Notice Card */}
              <div className="p-3.5 bg-sky-950/30 border border-sky-500/30 rounded-xl text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-sky-300">
                    <Github className="w-4 h-4 text-sky-400" />
                    <span>GitHub Repository (Public & Private Repositories Supported)</span>
                  </div>
                  {githubToken.trim() ? (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                      <ShieldCheck className="w-3 h-3" />
                      Private Access Ready
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-md shrink-0">
                      Public or Private
                    </span>
                  )}
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Songs are synchronized over the web from GitHub. When you edit and click <strong>"Save Song"</strong>, changes are saved to your local device database. Both public and private repositories are fully supported!
                </p>
              </div>

              {/* URL Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Github className="w-3.5 h-3.5 text-amber-400" />
                    GitHub Repository URL or Shorthand
                  </span>
                </label>
                <div className="flex gap-2">
                  <input
                    id="github-repo-url-input"
                    type="text"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/gitongsy28/gigsongbook"
                    className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400 transition-colors"
                  />
                  <button
                    id="sync-github-btn"
                    type="button"
                    disabled={isLoading}
                    onClick={handleSyncFromGitHub}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-50 shadow-md"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    Sync Songs
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5 text-[11px] text-slate-400">
                  <span>
                    Paste repository URL (e.g. <code className="text-sky-300 font-mono">https://github.com/gitongsy28/gigsongbook</code>) or shorthand (<code className="text-sky-300 font-mono">owner/repo</code>).
                  </span>
                  {/* Quick-fill button for gigsongbook if not already there */}
                  {!githubUrl.includes('gigsongbook') && (
                    <button
                      type="button"
                      onClick={() => setGithubUrl('https://github.com/gitongsy28/gigsongbook')}
                      className="text-[10px] text-amber-400 hover:text-amber-300 underline font-mono"
                    >
                      Use "gigsongbook"
                    </button>
                  )}
                </div>
              </div>

              {/* Private Repository Personal Access Token (PAT) Card */}
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    GitHub Personal Access Token
                    <span className="text-[10px] text-slate-400 font-normal">(Required for Private Repositories)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowTokenHelp(!showTokenHelp)}
                    className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium transition-colors"
                  >
                    <HelpCircle className="w-3 h-3" />
                    <span>{showTokenHelp ? 'Hide Guide' : 'How to get a Token?'}</span>
                  </button>
                </div>

                <div className="relative flex items-center">
                  <div className="absolute left-3 text-slate-500 pointer-events-none">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    id="github-token-input"
                    type={showToken ? 'text' : 'password'}
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_... or github_pat_... (leave empty for public repos)"
                    className="w-full pl-9 pr-20 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400 transition-colors"
                  />
                  <div className="absolute right-2 flex items-center gap-1">
                    {githubToken && (
                      <button
                        type="button"
                        onClick={() => setGithubToken('')}
                        title="Clear token"
                        className="p-1 text-slate-400 hover:text-slate-200 text-xs"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      title={showToken ? 'Hide token' : 'Show token'}
                      className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Token Instructions Help Accordion */}
                {showTokenHelp && (
                  <div className="p-3 bg-slate-900/90 border border-slate-700/80 rounded-lg text-[11px] text-slate-300 space-y-1.5 leading-relaxed">
                    <div className="font-bold text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      How to create a free GitHub Token (1-minute setup):
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-slate-300 pl-1">
                      <li>
                        On GitHub, go to <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer" className="text-sky-400 underline font-medium inline-flex items-center gap-0.5">Settings &gt; Developer Settings &gt; Personal access tokens <ExternalLink className="w-2.5 h-2.5" /></a>
                      </li>
                      <li>
                        Select <strong>Tokens (classic)</strong> &gt; <strong>Generate new token (classic)</strong>.
                      </li>
                      <li>
                        Give it a Note (e.g. <code className="text-amber-300 font-mono">SongScroll</code>) and check the <strong className="text-emerald-300">repo</strong> scope checkbox (Full control of private repositories).
                      </li>
                      <li>
                        Click <strong>Generate token</strong>, copy the key (starts with <code className="text-amber-300 font-mono">ghp_</code>), and paste it above.
                      </li>
                    </ol>
                    <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                      🔒 Your token is saved only in your personal browser's local storage and is sent directly to GitHub's secure API.
                    </p>
                  </div>
                )}
              </div>

              {/* Shareable link box */}
              <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Share2 className="w-3.5 h-3.5 text-sky-400" />
                    Share with Bandmates / Devices
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors border border-slate-700"
                  >
                    {copiedLink ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                    {copiedLink ? 'Link Copied!' : 'Copy Share Link'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Opening this link automatically sets this GitHub song collection upon launch.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: BUNDLED /public/SongBook/ */}
          {activeTab === 'bundled' && (
            <div className="space-y-4">
              {/* Active Switcher Banner */}
              {!isBundledActive && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3">
                  <div className="text-xs text-amber-200">
                    Currently viewing another repository source.
                  </div>
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleSwitchToSource('bundled')}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 transition-colors shrink-0"
                  >
                    Switch to /public/SongBook/
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Bundled Read-Only Notice Card */}
              <div className="p-3.5 bg-slate-950/40 border border-slate-700/60 rounded-xl text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <Folder className="w-4 h-4 text-amber-400" />
                  <span>Bundled SongBook (Read-Only Static Source)</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Songs are read statically from the application's built-in files. When you edit and click <strong>"Save Song"</strong>, changes are saved to your local device database only — the bundled static files are not modified.
                </p>
              </div>

              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-200 font-semibold text-xs">
                    <Folder className="w-4 h-4 text-amber-400" />
                    Bundled <code className="text-amber-300 font-mono">/public/SongBook/</code> Directory
                  </div>
                  {isBundledActive && (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Active Source
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Files stored inside the web app's <code className="text-sky-300 font-mono">/public/SongBook/</code> folder are served directly with the application (including custom added files).
                </p>
                <div className="pt-1 flex gap-2">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleSyncBundled}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    Sync from /public/SongBook/
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Status feedback message */}
          {statusMessage && (
            <div
              id="directory-status-message"
              className={`p-3 rounded-xl flex items-start gap-2.5 text-xs ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-300'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-950/60 border border-rose-800/80 text-rose-300'
                  : 'bg-slate-800/80 border border-slate-700 text-slate-300'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed whitespace-pre-line">{statusMessage.text}</span>
            </div>
          )}

          {/* Repository summary */}
          <div className="bg-slate-950/60 rounded-xl p-3.5 border border-slate-800 text-xs space-y-1.5">
            <div className="flex justify-between items-center text-slate-400">
              <span>Active Songs in Library:</span>
              <span className="font-semibold text-slate-200 font-mono">{currentSongCount} songs loaded</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Active Storage Source:</span>
              <span className="font-mono text-amber-300/90 truncate max-w-[280px]">
                {config.sourceType === 'bundled'
                  ? '/public/SongBook/'
                  : config.sourceType === 'github-url'
                  ? (config.githubUrl || config.directoryPath)
                  : (config.directoryPath || 'D:/Songbook/')}
              </span>
            </div>
            {config.lastSyncedAt && (
              <div className="flex justify-between items-center text-slate-400">
                <span>Last Synced:</span>
                <span className="text-slate-300 font-mono">
                  {new Date(config.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs">
          <button
            id="reset-sample-songs-btn"
            type="button"
            onClick={handleResetSampleSongs}
            disabled={isLoading}
            className="text-slate-400 hover:text-amber-300 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Reload Sample Songbook
          </button>

          <button
            id="done-dir-modal-btn"
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold rounded-xl transition-colors shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
