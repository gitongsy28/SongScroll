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
  Globe, 
  Share2, 
  Copy, 
  ExternalLink,
  Github
} from 'lucide-react';
import { RepositoryConfig, RepositorySourceType, Song } from '../types';
import { 
  parseUploadedFiles, 
  resetToDefaultSongs, 
  saveMultipleSongs, 
  saveRepositoryConfig, 
  setDirectoryHandle, 
  syncSongsFromDirectoryHandle 
} from '../utils/storage';
import { parseGitHubUrl, syncBundledSongBook, syncSongsFromGitHubUrl } from '../utils/githubSync';

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
  const [activeTab, setActiveTab] = useState<'local' | 'github' | 'bundled'>('local');
  const [customPath, setCustomPath] = useState(config.directoryPath || 'D:/Songbook/');
  const [githubUrl, setGithubUrl] = useState(
    config.githubUrl || 'https://github.com/gitongsy28/SongScroll/tree/main/public/SongBook/'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

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
        await saveMultipleSongs(syncedSongs);
        onSongsUpdated(syncedSongs);

        const updatedConfig: RepositoryConfig = {
          ...config,
          sourceType: 'local-drive',
          directoryPath: pathName,
          directoryName: dirHandle.name,
          hasDirectoryHandle: true,
          lastSyncedAt: Date.now(),
          totalFilesFound: syncedSongs.length,
        };

        saveRepositoryConfig(updatedConfig);
        onConfigChange(updatedConfig);

        setStatusMessage({
          text: `Successfully synced ${syncedSongs.length} ChordPro song(s) from local folder "${dirHandle.name}"!`,
          type: 'success'
        });
      } else {
        setStatusMessage({
          text: `Connected to folder "${dirHandle.name}". No .cho or .txt ChordPro files found yet. You can add songs here.`,
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
        await saveMultipleSongs(parsedSongs);
        onSongsUpdated(parsedSongs);

        const updatedConfig: RepositoryConfig = {
          ...config,
          sourceType: 'local-drive',
          directoryPath: customPath,
          lastSyncedAt: Date.now(),
          totalFilesFound: parsedSongs.length,
        };

        saveRepositoryConfig(updatedConfig);
        onConfigChange(updatedConfig);

        setStatusMessage({
          text: `Successfully imported ${parsedSongs.length} song(s) into repository!`,
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

  // Sync songs from GitHub URL
  const handleSyncFromGitHub = async () => {
    const trimmedUrl = githubUrl.trim();
    if (!trimmedUrl) {
      setStatusMessage({ text: 'Please enter a valid GitHub repository folder URL.', type: 'error' });
      return;
    }

    try {
      setIsLoading(true);
      setStatusMessage({ text: 'Connecting to GitHub repository and downloading ChordPro files...', type: 'info' });

      const { songs, message } = await syncSongsFromGitHubUrl(trimmedUrl);

      if (songs.length > 0) {
        await saveMultipleSongs(songs);
        onSongsUpdated(songs);

        const parsed = parseGitHubUrl(trimmedUrl);
        const updatedConfig: RepositoryConfig = {
          ...config,
          sourceType: 'github-url',
          githubUrl: trimmedUrl,
          directoryPath: trimmedUrl,
          directoryName: parsed ? `${parsed.owner}/${parsed.repo}/${parsed.path}` : 'GitHub SongBook',
          lastSyncedAt: Date.now(),
          totalFilesFound: songs.length,
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
        await saveMultipleSongs(songs);
        onSongsUpdated(songs);

        const updatedConfig: RepositoryConfig = {
          ...config,
          sourceType: 'bundled',
          directoryPath: '/public/SongBook/',
          directoryName: 'Bundled SongBook',
          lastSyncedAt: Date.now(),
          totalFilesFound: songs.length,
        };

        saveRepositoryConfig(updatedConfig);
        onConfigChange(updatedConfig);

        setStatusMessage({
          text: `Loaded ${songs.length} bundled songs from /public/SongBook/!`,
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
    if (confirm('Reset song repository to default ChordPro library?')) {
      setIsLoading(true);
      try {
        const samples = await resetToDefaultSongs();
        onSongsUpdated(samples);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        id="directory-picker-modal"
        className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">SongBook Repository Source</h2>
              <p className="text-xs text-slate-400">Configure local drive storage (e.g. D:/Songbook/) or shared GitHub URL</p>
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

        {/* Source Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1.5 gap-1.5 px-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('local')}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
              activeTab === 'local'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            Local Drive (D:/, Folder)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('github')}
            className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
              activeTab === 'github'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Github className="w-3.5 h-3.5" />
            GitHub / Shared URL
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('bundled')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'bundled'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="/public/SongBook/"
          >
            <Folder className="w-3.5 h-3.5" />
            /public/SongBook
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm text-slate-300">
          
          {/* TAB 1: LOCAL DRIVE / FOLDER */}
          {activeTab === 'local' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-amber-400" />
                  Local Drive Path
                </label>
                <div className="flex gap-2">
                  <input
                    id="custom-repo-path-input"
                    type="text"
                    value={customPath}
                    onChange={(e) => setCustomPath(e.target.value)}
                    placeholder="D:/Songbook/ or C:\Songs\ChordPro or /Music/ChordPro/"
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
                  Configure your primary local drive location (e.g. <code className="text-amber-300 font-mono">D:/Songbook/</code> or <code className="text-amber-300 font-mono">/Music/ChordPro/</code>).
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
                  className="p-3.5 bg-gradient-to-br from-amber-500/10 to-amber-600/5 hover:from-amber-500/20 hover:to-amber-600/15 border border-amber-500/30 rounded-xl text-left flex flex-col gap-1.5 transition-all group active:scale-98"
                >
                  <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                    <FolderOpen className="w-4 h-4" />
                    Select Folder on Drive
                  </div>
                  <span className="text-[11px] text-slate-400 group-hover:text-slate-300 leading-snug">
                    Select a local folder on <code className="text-amber-300">D:</code> or any drive to sync all songs directly.
                  </span>
                </button>

                {/* Folder / Files Multi-Import */}
                <label
                  id="upload-folder-label"
                  className="p-3.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 rounded-xl cursor-pointer text-left flex flex-col gap-1.5 transition-all group active:scale-98"
                >
                  <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs">
                    <Upload className="w-4 h-4" />
                    Upload ChordPro Files
                  </div>
                  <span className="text-[11px] text-slate-400 group-hover:text-slate-300 leading-snug">
                    Import one or multiple <code className="text-sky-300 font-mono">.cho</code>, <code className="text-sky-300 font-mono">.crd</code>, or <code className="text-sky-300 font-mono">.txt</code> files.
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
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Github className="w-3.5 h-3.5 text-amber-400" />
                    Shared GitHub Directory URL
                  </span>
                </label>
                <div className="flex gap-2">
                  <input
                    id="github-repo-url-input"
                    type="text"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/gitongsy28/SongScroll/tree/main/public/SongBook/"
                    className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400 transition-colors"
                  />
                  <button
                    id="sync-github-btn"
                    type="button"
                    disabled={isLoading}
                    onClick={handleSyncFromGitHub}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    Sync Songs
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Paste your public GitHub folder link (e.g. <code className="text-amber-300 font-mono">https://github.com/gitongsy28/SongScroll/tree/main/public/SongBook/</code>). All <code className="text-sky-300 font-mono">.cho</code> files will be fetched and synced.
                </p>
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
                  Anyone who opens this link will automatically load and sync your GitHub song collection upon opening the app.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: BUNDLED /public/SongBook/ */}
          {activeTab === 'bundled' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-slate-200 font-semibold text-xs">
                  <Folder className="w-4 h-4 text-amber-400" />
                  Bundled <code className="text-amber-300 font-mono">/public/SongBook/</code> Directory
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Files placed inside the web app's <code className="text-sky-300 font-mono">/public/SongBook/</code> folder are served with the app and can be restored or synced at any time.
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
              <span className="leading-relaxed">{statusMessage.text}</span>
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
                {config.directoryPath || 'D:/Songbook/'}
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
