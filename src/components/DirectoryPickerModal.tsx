import React, { useState } from 'react';
import { Folder, FolderOpen, HardDrive, Upload, Check, RefreshCw, X, AlertCircle, Sparkles } from 'lucide-react';
import { RepositoryConfig, Song } from '../types';
import { 
  parseUploadedFiles, 
  resetToDefaultSongs, 
  saveMultipleSongs, 
  saveRepositoryConfig, 
  setDirectoryHandle, 
  syncSongsFromDirectoryHandle 
} from '../utils/storage';

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
  const [customPath, setCustomPath] = useState(config.directoryPath);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'info' | 'success' | 'error' } | null>(null);

  if (!isOpen) return null;

  // Handle native File System Access directory picker
  const handlePickNativeDirectory = async () => {
    if (!('showDirectoryPicker' in window)) {
      setStatusMessage({
        text: 'File System Directory Picker is not natively supported in this browser. Please use the Folder Upload option below.',
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

      const pathName = `/${dirHandle.name}/ChordPro`;
      setCustomPath(pathName);

      const syncedSongs = await syncSongsFromDirectoryHandle(dirHandle, pathName);

      if (syncedSongs.length > 0) {
        await saveMultipleSongs(syncedSongs);
        onSongsUpdated(syncedSongs);

        const updatedConfig: RepositoryConfig = {
          ...config,
          directoryPath: pathName,
          directoryName: dirHandle.name,
          hasDirectoryHandle: true,
          lastSyncedAt: Date.now(),
          totalFilesFound: syncedSongs.length,
        };

        saveRepositoryConfig(updatedConfig);
        onConfigChange(updatedConfig);

        setStatusMessage({
          text: `Successfully synced ${syncedSongs.length} ChordPro song(s) from "${dirHandle.name}"!`,
          type: 'success'
        });
      } else {
        setStatusMessage({
          text: `Connected to directory "${dirHandle.name}". No .cho or .txt ChordPro files found yet. You can add songs here.`,
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

  // Save customized path
  const handleSavePath = () => {
    const updatedConfig: RepositoryConfig = {
      ...config,
      directoryPath: customPath.trim() || '/Music/ChordPro/',
    };
    saveRepositoryConfig(updatedConfig);
    onConfigChange(updatedConfig);
    setStatusMessage({
      text: `Repository path updated to "${updatedConfig.directoryPath}"`,
      type: 'success'
    });
  };

  // Reset to default sample library
  const handleResetSampleSongs = async () => {
    if (confirm('Reset song repository to the default sample ChordPro library?')) {
      setIsLoading(true);
      try {
        const samples = await resetToDefaultSongs();
        onSongsUpdated(samples);
        setStatusMessage({
          text: `Restored ${samples.length} standard ChordPro sample songs.`,
          type: 'success'
        });
      } catch (err: any) {
        setStatusMessage({ text: 'Failed to reset songs.', type: 'error' });
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        id="directory-picker-modal"
        className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Local Repository Directory</h2>
              <p className="text-xs text-slate-400">Configure your local drive storage location for ChordPro files</p>
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

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm text-slate-300">
          {/* Custom Path Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-amber-400" />
              Repository Directory Path
            </label>
            <div className="flex gap-2">
              <input
                id="custom-repo-path-input"
                type="text"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                placeholder="/Music/ChordPro/ or C:\Songs\ChordPro"
                className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400 transition-colors"
              />
              <button
                id="save-repo-path-btn"
                type="button"
                onClick={handleSavePath}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-medium text-xs flex items-center gap-1 transition-colors border border-slate-700"
              >
                <Check className="w-3.5 h-3.5 text-green-400" />
                Save
              </button>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              Custom local path tag for organizing, naming, and exporting your ChordPro song collection.
            </p>
          </div>

          {/* Action options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
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
                Select Local Folder
              </div>
              <span className="text-[11px] text-slate-400 group-hover:text-slate-300 leading-snug">
                Pick a folder from your local hard drive or SD card to sync all ChordPro files.
              </span>
            </button>

            {/* Folder / Files Multi-Import */}
            <label
              id="upload-folder-label"
              className="p-3.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700 rounded-xl cursor-pointer text-left flex flex-col gap-1.5 transition-all group active:scale-98"
            >
              <div className="flex items-center gap-2 text-sky-400 font-semibold text-xs">
                <Upload className="w-4 h-4" />
                Import ChordPro Files
              </div>
              <span className="text-[11px] text-slate-400 group-hover:text-slate-300 leading-snug">
                Upload one or multiple <code className="text-sky-300 font-mono">.cho</code>, <code className="text-sky-300 font-mono">.crd</code>, or <code className="text-sky-300 font-mono">.txt</code> files.
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
              <span>Active Repository Songs:</span>
              <span className="font-semibold text-slate-200 font-mono">{currentSongCount} songs loaded</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Supported Formats:</span>
              <span className="font-mono text-amber-300/80">.cho, .crd, .chopro, .chordpro, .txt</span>
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
