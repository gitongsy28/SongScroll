import React, { useState, useMemo } from 'react';
import { 
  Music, 
  Search, 
  Plus, 
  Folder, 
  HardDrive, 
  Play, 
  Edit, 
  Trash2, 
  Download, 
  SlidersHorizontal, 
  Smartphone, 
  ChevronRight,
  Filter,
  X,
  ListFilter,
  LayoutGrid,
  List
} from 'lucide-react';
import { RepositoryConfig, Song } from '../types';
import { downloadSongFile } from '../utils/storage';

interface SongListProps {
  songs: Song[];
  onSelectSong: (song: Song) => void;
  onOpenDirectoryConfig: () => void;
  onOpenNewSongModal: () => void;
  onEditSong: (song: Song) => void;
  onDeleteSong: (songId: string) => void;
  onOpenAndroidModal: () => void;
  repoConfig: RepositoryConfig;
}

export const SongList: React.FC<SongListProps> = ({
  songs,
  onSelectSong,
  onOpenDirectoryConfig,
  onOpenNewSongModal,
  onEditSong,
  onDeleteSong,
  onOpenAndroidModal,
  repoConfig,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKeyFilter, setSelectedKeyFilter] = useState<string>('ALL');
  const [selectedEraFilter, setSelectedEraFilter] = useState<string>('ALL');
  const [selectedLetter, setSelectedLetter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'artist' | 'title' | 'era' | 'tempo-asc' | 'tempo-desc' | 'recent'>('artist');

  // Extract all unique musical keys
  const availableKeys = useMemo(() => {
    const keys = new Set<string>();
    songs.forEach((s) => {
      if (s.key) keys.add(s.key);
    });
    return Array.from(keys).sort();
  }, [songs]);

  // Extract all unique eras
  const availableEras = useMemo(() => {
    const eras = new Set<string>();
    songs.forEach((s) => {
      if (s.era) eras.add(s.era);
    });
    return Array.from(eras).sort();
  }, [songs]);

  // Extract available starting letters (A-Z)
  const availableLetters = useMemo(() => {
    const letters = new Set<string>();
    songs.forEach((s) => {
      const first = (s.artist || s.title || '').trim().charAt(0).toUpperCase();
      if (first && /[A-Z]/.test(first)) {
        letters.add(first);
      }
    });
    return Array.from(letters).sort();
  }, [songs]);

  // Total unique artists
  const uniqueArtistsCount = useMemo(() => {
    const artists = new Set<string>();
    songs.forEach((s) => {
      if (s.artist) artists.add(s.artist);
    });
    return artists.size;
  }, [songs]);

  // Filtered and sorted songs
  const filteredSongs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return songs
      .filter((song) => {
        const matchesQuery =
          !q ||
          song.title.toLowerCase().includes(q) ||
          song.artist.toLowerCase().includes(q) ||
          (song.era && song.era.toLowerCase().includes(q)) ||
          (song.key && song.key.toLowerCase().includes(q));

        const matchesKey = selectedKeyFilter === 'ALL' || song.key === selectedKeyFilter;
        const matchesEra = selectedEraFilter === 'ALL' || song.era === selectedEraFilter;

        const targetLetter = (sortBy === 'title' ? song.title : song.artist || song.title)
          .trim()
          .charAt(0)
          .toUpperCase();
        const matchesLetter = selectedLetter === 'ALL' || targetLetter === selectedLetter;

        return matchesQuery && matchesKey && matchesEra && matchesLetter;
      })
      .sort((a, b) => {
        if (sortBy === 'artist') {
          const artistComp = a.artist.localeCompare(b.artist);
          return artistComp !== 0 ? artistComp : a.title.localeCompare(b.title);
        }
        if (sortBy === 'title') {
          return a.title.localeCompare(b.title);
        }
        if (sortBy === 'era') {
          const eraA = a.era || '';
          const eraB = b.era || '';
          return eraA.localeCompare(eraB) || a.title.localeCompare(b.title);
        }
        if (sortBy === 'tempo-asc') {
          return (a.tempo || 0) - (b.tempo || 0);
        }
        if (sortBy === 'tempo-desc') {
          return (b.tempo || 0) - (a.tempo || 0);
        }
        if (sortBy === 'recent') {
          return b.updatedAt - a.updatedAt;
        }
        return 0;
      });
  }, [songs, searchQuery, selectedKeyFilter, selectedEraFilter, selectedLetter, sortBy]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950">
      {/* Top Banner / Repository Path Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80 shadow-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
          {/* Logo & Branding */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-md font-black">
              <Music className="w-4 h-4 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold text-slate-100 tracking-tight">
                  SongScroll
                </h1>
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md">
                  Auto-Scroll
                </span>
              </div>
              <button
                id="header-repo-dir-btn"
                type="button"
                onClick={onOpenDirectoryConfig}
                className="group flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-300 transition-colors"
                title="Click to customize local repository directory"
              >
                <HardDrive className="w-2.5 h-2.5 text-amber-400/80 group-hover:text-amber-300" />
                <span className="font-mono truncate max-w-[180px] sm:max-w-[300px]">
                  {repoConfig.directoryPath}
                </span>
                <span className="text-[10px] text-slate-500 group-hover:text-amber-400">
                  (Change)
                </span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              id="header-android-btn"
              type="button"
              onClick={onOpenAndroidModal}
              className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
              title="Android app & APK options"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Android / APK</span>
            </button>

            <button
              id="header-repo-config-btn"
              type="button"
              onClick={onOpenDirectoryConfig}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <Folder className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Repo Folder</span>
            </button>

            <button
              id="header-add-song-btn"
              type="button"
              onClick={onOpenNewSongModal}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Song</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 space-y-3">
        {/* Search, Filter & Quick-Jump Toolbar */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-md space-y-2.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="songbook-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by artist or song name..."
                className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filters: Key, Era, Sort */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Key Filter */}
              <div className="relative shrink-0">
                <select
                  id="key-filter-select"
                  value={selectedKeyFilter}
                  onChange={(e) => setSelectedKeyFilter(e.target.value)}
                  className="px-2.5 py-2 pr-7 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg text-xs text-slate-300 focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="ALL">All Keys</option>
                  {availableKeys.map((k) => (
                    <option key={k} value={k}>
                      Key {k}
                    </option>
                  ))}
                </select>
                <Filter className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Era Filter */}
              {availableEras.length > 0 && (
                <div className="relative shrink-0">
                  <select
                    id="era-filter-select"
                    value={selectedEraFilter}
                    onChange={(e) => setSelectedEraFilter(e.target.value)}
                    className="px-2.5 py-2 pr-7 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg text-xs text-slate-300 focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value="ALL">All Eras</option>
                    {availableEras.map((era) => (
                      <option key={era} value={era}>
                        Era: {era}
                      </option>
                    ))}
                  </select>
                  <Filter className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              )}

              {/* Sort Dropdown */}
              <div className="relative shrink-0">
                <select
                  id="songbook-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-2.5 py-2 pr-7 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg text-xs text-slate-300 focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="artist">Sort: Artist (A-Z)</option>
                  <option value="title">Sort: Title (A-Z)</option>
                  <option value="era">Sort: Era</option>
                  <option value="tempo-asc">Sort: Tempo (Slow to Fast)</option>
                  <option value="tempo-desc">Sort: Tempo (Fast to Slow)</option>
                  <option value="recent">Sort: Recently Added</option>
                </select>
                <SlidersHorizontal className="w-3 h-3 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Quick Alphabetical Filter Bar & Count */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
            <div className="flex items-center gap-1 overflow-x-auto py-0.5 scrollbar-none">
              <span className="text-slate-400 font-semibold uppercase text-[10px] mr-1 shrink-0">
                Jump:
              </span>
              <button
                type="button"
                onClick={() => setSelectedLetter('ALL')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors shrink-0 ${
                  selectedLetter === 'ALL'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                ALL
              </button>
              {['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'].map((letter) => {
                const hasSongs = availableLetters.includes(letter);
                return (
                  <button
                    key={letter}
                    type="button"
                    disabled={!hasSongs}
                    onClick={() => setSelectedLetter(letter)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors shrink-0 ${
                      selectedLetter === letter
                        ? 'bg-amber-500 text-slate-950'
                        : hasSongs
                        ? 'bg-slate-950 text-slate-300 hover:text-amber-300 hover:bg-slate-800'
                        : 'text-slate-600 cursor-not-allowed opacity-40'
                    }`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>

            <div className="text-slate-400 shrink-0 font-mono text-[11px]">
              <span className="text-amber-300 font-bold">{filteredSongs.length}</span> of {songs.length} songs
            </div>
          </div>
        </section>

        {/* 1 Song Per Row List */}
        {filteredSongs.length > 0 ? (
          <div 
            id="songs-list-table"
            className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-md divide-y divide-slate-800/80"
          >
            {filteredSongs.map((song, index) => (
              <div
                key={song.id}
                id={`song-row-${song.id}`}
                onClick={() => onSelectSong(song)}
                className="px-3.5 sm:px-4 py-3 flex items-center justify-between hover:bg-slate-800/70 active:bg-slate-800 cursor-pointer transition-colors group gap-3"
              >
                {/* Left: Number & Play Icon + Artist & Title */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 group-hover:border-amber-500/50 group-hover:bg-amber-500/10 flex items-center justify-center shrink-0 transition-colors">
                    <span className="text-xs font-mono font-bold text-slate-400 group-hover:hidden">
                      {index + 1}
                    </span>
                    <Play className="w-3.5 h-3.5 text-amber-400 fill-amber-400 hidden group-hover:block" />
                  </div>

                  <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center sm:gap-6">
                    {/* Artist Name */}
                    <div className="sm:w-56 shrink-0 truncate">
                      <span className="text-xs sm:text-sm font-semibold text-slate-400 group-hover:text-amber-200/90 transition-colors">
                        {song.artist || 'Unknown Artist'}
                      </span>
                    </div>

                    {/* Song Title & Era */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <h3 className="text-sm sm:text-base font-bold text-slate-100 group-hover:text-amber-300 truncate transition-colors">
                        {song.title}
                      </h3>
                      {song.era && (
                        <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded text-[10px] sm:text-xs font-mono font-bold shrink-0">
                          {song.era}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Key, Tempo, Actions, Chevron */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                  {song.key && (
                    <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 text-sky-300 rounded-md text-[11px] font-mono font-semibold">
                      Key {song.key}
                    </span>
                  )}
                  {song.tempo && (
                    <span className="hidden sm:inline-block px-2 py-0.5 bg-slate-950 border border-slate-800 text-amber-300 rounded-md text-[11px] font-mono">
                      {song.tempo} BPM
                    </span>
                  )}

                  <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => downloadSongFile(song)}
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Download .cho file"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditSong(song)}
                      className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Edit ChordPro"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete "${song.title}"?`)) onDeleteSong(song.id);
                      }}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Delete song"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div 
            id="empty-songs-state"
            className="text-center py-12 bg-slate-900/40 border border-slate-800 rounded-xl p-6 space-y-3"
          >
            <div className="w-10 h-10 mx-auto rounded-xl bg-slate-800/80 flex items-center justify-center text-slate-400">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-200">No songs found</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                No songs match "{searchQuery || selectedLetter || selectedKeyFilter}".
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedKeyFilter('ALL');
                  setSelectedLetter('ALL');
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
              >
                Clear Filters
              </button>
              <button
                type="button"
                onClick={onOpenNewSongModal}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-bold"
              >
                Add ChordPro Song
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

