import React, { useState, useEffect } from 'react';
import { Check, Info, X, AlertTriangle, Download, FolderOpen } from 'lucide-react';
import { RepositoryConfig, Song, ViewerSettings } from './types';
import { 
  deleteSong, 
  loadAllSongs, 
  loadRepositoryConfig, 
  loadViewerSettings, 
  restoreActiveDirectoryHandle,
  saveMultipleSongs,
  saveRepositoryConfig,
  saveSongWithDiskOverwrite,
  saveViewerSettings,
  downloadSongFile
} from './utils/storage';
import { syncSongsFromGitHubUrl } from './utils/githubSync';
import { SongList } from './components/SongList';
import { SongViewer } from './components/SongViewer';
import { DirectoryPickerModal } from './components/DirectoryPickerModal';
import { ChordEditorModal } from './components/ChordEditorModal';
import { AndroidInstallModal } from './components/AndroidInstallModal';

export default function App() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [startInSummaryMode, setStartInSummaryMode] = useState<boolean>(false);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [repoConfig, setRepoConfig] = useState<RepositoryConfig>(loadRepositoryConfig());
  const [viewerSettings, setViewerSettings] = useState<ViewerSettings>(loadViewerSettings());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals state
  const [isDirectoryModalOpen, setIsDirectoryModalOpen] = useState<boolean>(false);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState<boolean>(false);
  const [isAndroidModalOpen, setIsAndroidModalOpen] = useState<boolean>(false);
  const [songToEdit, setSongToEdit] = useState<Song | null>(null);
  const [saveToast, setSaveToast] = useState<{ 
    message: string; 
    type: 'success' | 'info' | 'warning'; 
    diskUpdated?: boolean;
    song?: Song;
  } | null>(null);

  // Load songs on startup & check for shared ?repo= URL parameter
  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        // Restore local directory handle if permitted
        await restoreActiveDirectoryHandle();

        // Check for ?repo= or ?source= in query params
        const urlParams = new URLSearchParams(window.location.search);
        const sharedRepoUrl = urlParams.get('repo') || urlParams.get('source');

        if (sharedRepoUrl) {
          try {
            const { songs: syncedSongs } = await syncSongsFromGitHubUrl(sharedRepoUrl);
            if (syncedSongs.length > 0) {
              await saveMultipleSongs(syncedSongs);
              setSongs(syncedSongs);
              const updatedConfig: RepositoryConfig = {
                ...repoConfig,
                sourceType: 'github-url',
                githubUrl: sharedRepoUrl,
                directoryPath: sharedRepoUrl,
                directoryName: 'Shared GitHub SongBook',
                lastSyncedAt: Date.now(),
                totalFilesFound: syncedSongs.length,
              };
              saveRepositoryConfig(updatedConfig);
              setRepoConfig(updatedConfig);
              setIsLoading(false);
              return;
            }
          } catch (syncErr) {
            console.warn('Auto-sync from URL failed:', syncErr);
          }
        }

        const loaded = await loadAllSongs();
        setSongs(loaded);
      } catch (err) {
        console.error('Failed to load songs:', err);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Update viewer settings
  const handleUpdateSettings = (newSettings: Partial<ViewerSettings>) => {
    setViewerSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      saveViewerSettings(updated);
      return updated;
    });
  };

  // Song selection
  const handleSelectSong = (song: Song, summaryMode = false) => {
    setStartInSummaryMode(summaryMode);
    setSelectedSong(song);
  };

  // Add / Edit Song
  const handleOpenNewSong = () => {
    setSongToEdit(null);
    setIsEditorModalOpen(true);
  };

  const handleEditSong = (song: Song) => {
    setSongToEdit(song);
    setIsEditorModalOpen(true);
  };

  const handleSaveSong = async (savedSong: Song) => {
    const result = await saveSongWithDiskOverwrite(savedSong, repoConfig);
    setSongs((prev) => {
      const index = prev.findIndex((s) => s.id === savedSong.id);
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = savedSong;
        return copy;
      }
      return [savedSong, ...prev];
    });

    // If currently viewing this song, update active song
    if (selectedSong && selectedSong.id === savedSong.id) {
      setSelectedSong(savedSong);
    }

    const isMaster = repoConfig.sourceType === 'local-drive';

    setSaveToast({
      message: result.message,
      type: result.diskUpdated ? 'success' : (isMaster ? 'warning' : 'info'),
      diskUpdated: result.diskUpdated,
      song: savedSong,
    });
    setTimeout(() => setSaveToast(null), result.diskUpdated ? 5000 : 10000);
  };

  // Delete Song
  const handleDeleteSong = async (songId: string) => {
    await deleteSong(songId);
    setSongs((prev) => prev.filter((s) => s.id !== songId));
    if (selectedSong && selectedSong.id === songId) {
      setSelectedSong(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-200">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 animate-pulse flex items-center justify-center mb-4">
          <div className="w-4 h-4 rounded-full bg-amber-400 animate-ping" />
        </div>
        <p className="font-mono text-xs text-amber-400 font-semibold tracking-wider uppercase">
          Loading ChordPro Repository...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 font-sans">
      {selectedSong ? (
        <SongViewer
          song={selectedSong}
          onBack={() => setSelectedSong(null)}
          settings={viewerSettings}
          onUpdateSettings={handleUpdateSettings}
          onEditSong={handleEditSong}
          onDeleteSong={handleDeleteSong}
          initialSummaryMode={startInSummaryMode}
        />
      ) : (
        <SongList
          songs={songs}
          onSelectSong={handleSelectSong}
          onOpenDirectoryConfig={() => setIsDirectoryModalOpen(true)}
          onOpenNewSongModal={handleOpenNewSong}
          onEditSong={handleEditSong}
          onDeleteSong={handleDeleteSong}
          onOpenAndroidModal={() => setIsAndroidModalOpen(true)}
          repoConfig={repoConfig}
        />
      )}

      {/* Local Drive Directory Settings Modal */}
      <DirectoryPickerModal
        isOpen={isDirectoryModalOpen}
        onClose={() => setIsDirectoryModalOpen(false)}
        config={repoConfig}
        onConfigChange={(newCfg) => setRepoConfig(newCfg)}
        onSongsUpdated={(updatedSongs) => setSongs(updatedSongs)}
        currentSongCount={songs.length}
      />

      {/* Add / Edit ChordPro Modal */}
      <ChordEditorModal
        isOpen={isEditorModalOpen}
        onClose={() => {
          setIsEditorModalOpen(false);
          setSongToEdit(null);
        }}
        songToEdit={songToEdit}
        onSaveSong={handleSaveSong}
        defaultDirPath={repoConfig.directoryPath}
        repoConfig={repoConfig}
      />

      {/* Android & PWA Installation Modal */}
      <AndroidInstallModal
        isOpen={isAndroidModalOpen}
        onClose={() => setIsAndroidModalOpen(false)}
      />

      {/* Save Song Status Toast */}
      {saveToast && (
        <div 
          id="save-song-feedback-toast"
          className={`fixed bottom-5 right-5 z-50 max-w-md p-4 rounded-xl shadow-2xl border flex items-start gap-3 backdrop-blur-md transition-all ${
            saveToast.type === 'success' 
              ? 'bg-emerald-950/95 border-emerald-500/60 text-emerald-100 shadow-emerald-950/50' 
              : saveToast.type === 'warning'
              ? 'bg-amber-950/95 border-amber-500/60 text-amber-100 shadow-amber-950/50'
              : 'bg-slate-900/95 border-sky-500/60 text-slate-100 shadow-slate-950/60'
          }`}
        >
          <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
            saveToast.type === 'success' 
              ? 'bg-emerald-500/20 text-emerald-300' 
              : saveToast.type === 'warning'
              ? 'bg-amber-500/20 text-amber-300'
              : 'bg-sky-500/20 text-sky-300'
          }`}>
            {saveToast.type === 'success' ? (
              <Check className="w-4 h-4" />
            ) : saveToast.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <Info className="w-4 h-4" />
            )}
          </div>
          <div className="flex-1 text-xs">
            <div className="font-bold text-sm mb-0.5">
              {saveToast.type === 'success' 
                ? 'Master Drive Overwrite' 
                : saveToast.type === 'warning'
                ? 'Disk Overwrite Not Connected'
                : 'Song Saved'}
            </div>
            <p className="leading-relaxed opacity-90">{saveToast.message}</p>

            {/* Quick Actions if disk write couldn't proceed */}
            {saveToast.type === 'warning' && (
              <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-amber-500/20">
                <button
                  type="button"
                  onClick={() => {
                    setIsDirectoryModalOpen(true);
                    setSaveToast(null);
                  }}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Connect Folder
                </button>
                {saveToast.song && (
                  <button
                    type="button"
                    onClick={() => {
                      if (saveToast.song) downloadSongFile(saveToast.song);
                    }}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg text-xs flex items-center gap-1.5 transition-colors border border-slate-700"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-400" />
                    Download .cho
                  </button>
                )}
              </div>
            )}
          </div>
          <button 
            type="button" 
            onClick={() => setSaveToast(null)}
            className="text-slate-400 hover:text-slate-200 p-0.5 ml-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
