import React, { useState, useEffect } from 'react';
import { RepositoryConfig, Song, ViewerSettings } from './types';
import { 
  deleteSong, 
  loadAllSongs, 
  loadRepositoryConfig, 
  loadViewerSettings, 
  saveSong, 
  saveViewerSettings 
} from './utils/storage';
import { SongList } from './components/SongList';
import { SongViewer } from './components/SongViewer';
import { DirectoryPickerModal } from './components/DirectoryPickerModal';
import { ChordEditorModal } from './components/ChordEditorModal';
import { AndroidInstallModal } from './components/AndroidInstallModal';

export default function App() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [repoConfig, setRepoConfig] = useState<RepositoryConfig>(loadRepositoryConfig());
  const [viewerSettings, setViewerSettings] = useState<ViewerSettings>(loadViewerSettings());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals state
  const [isDirectoryModalOpen, setIsDirectoryModalOpen] = useState<boolean>(false);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState<boolean>(false);
  const [isAndroidModalOpen, setIsAndroidModalOpen] = useState<boolean>(false);
  const [songToEdit, setSongToEdit] = useState<Song | null>(null);

  // Load songs on startup
  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
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
  const handleSelectSong = (song: Song) => {
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
    await saveSong(savedSong);
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
      />

      {/* Android & PWA Installation Modal */}
      <AndroidInstallModal
        isOpen={isAndroidModalOpen}
        onClose={() => setIsAndroidModalOpen(false)}
      />
    </div>
  );
}
