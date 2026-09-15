import React, { useState } from 'react';
import { 
  Play, 
  ExternalLink, 
  Music, 
  Video, 
  HardDrive, 
  AlertCircle, 
  X, 
  Check, 
  Copy, 
  Edit3,
  Globe,
  Radio,
  Tv,
  Plus,
  Trash2,
  Save
} from 'lucide-react';
import { BackTrackItem, Song } from '../types';
import { detectBackTrackType, isValidBackTrack, parseChordPro } from '../utils/chordpro';

interface BackTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song;
  backtracks?: BackTrackItem[];
  onSelectTrack: (track: BackTrackItem, launchMode?: 'browser' | 'pip') => void;
  onUpdateBackTracks?: (updatedTracks: BackTrackItem[]) => void;
  onEditSong?: () => void;
  activeTrackId?: string | null;
}

interface EditTrackFormState {
  isNew: boolean;
  index: number;
  description: string;
  url: string;
  originalId?: string;
}

export const BackTrackModal: React.FC<BackTrackModalProps> = ({
  isOpen,
  onClose,
  song,
  backtracks: externalBacktracks,
  onSelectTrack,
  onUpdateBackTracks,
  onEditSong,
  activeTrackId,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingState, setEditingState] = useState<EditTrackFormState | null>(null);

  if (!isOpen) return null;

  // Extract and filter valid backtracks
  const allTracks: BackTrackItem[] = externalBacktracks || song.backtracks || song.parsed?.backtracks || parseChordPro(song.rawChordPro).backtracks || [];
  const validTracks = allTracks.filter(isValidBackTrack);

  const handleCopyPath = (track: BackTrackItem, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(track.url);
    setCopiedId(track.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const getTrackIcon = (type: BackTrackItem['type']) => {
    switch (type) {
      case 'youtube':
        return <Video className="w-4 h-4 text-red-400" />;
      case 'github':
        return <Radio className="w-4 h-4 text-purple-400" />;
      case 'audio-url':
        return <Music className="w-4 h-4 text-emerald-400" />;
      case 'local':
        return <HardDrive className="w-4 h-4 text-amber-400" />;
      default:
        return <Globe className="w-4 h-4 text-sky-400" />;
    }
  };

  const getTrackTypeBadge = (type: BackTrackItem['type']) => {
    switch (type) {
      case 'youtube':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-300 border border-red-500/30">
            YouTube
          </span>
        );
      case 'github':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            GitHub Audio
          </span>
        );
      case 'audio-url':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            Audio Stream
          </span>
        );
      case 'local':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            Local Drive
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
            Web Link
          </span>
        );
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingState || !editingState.url.trim()) return;

    const trimmedUrl = editingState.url.trim();
    const type = detectBackTrackType(trimmedUrl);

    if (editingState.isNew) {
      const nextIndex = validTracks.length + 1;
      const newTrack: BackTrackItem = {
        id: `BackTrack${nextIndex}`,
        index: nextIndex,
        description: editingState.description.trim() || `BackTrack ${nextIndex}`,
        url: trimmedUrl,
        type,
      };
      const updated = [...validTracks, newTrack].slice(0, 5).map((t, idx) => ({
        ...t,
        index: idx + 1,
        id: `BackTrack${idx + 1}`,
      }));
      onUpdateBackTracks?.(updated);
    } else {
      const updated = validTracks.map((t) => {
        if (t.id === editingState.originalId || t.index === editingState.index) {
          return {
            ...t,
            description: editingState.description.trim() || t.description,
            url: trimmedUrl,
            type,
          };
        }
        return t;
      });
      onUpdateBackTracks?.(updated);
    }

    setEditingState(null);
  };

  const handleDeleteTrack = (trackId?: string, trackIndex?: number) => {
    if (!trackId && trackIndex === undefined) return;
    const updated = validTracks
      .filter((t) => t.id !== trackId && t.index !== trackIndex)
      .map((t, idx) => ({
        ...t,
        index: idx + 1,
        id: `BackTrack${idx + 1}`,
      }));
    onUpdateBackTracks?.(updated);
    setEditingState(null);
  };

  return (
    <div
      id="backtrack-picker-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setEditingState(null);
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 animate-in zoom-in-95 duration-150 flex flex-col max-h-[70vh] sm:max-h-[65vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 sm:p-2 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30">
              <Play className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight flex items-center gap-2">
                Song BackTracks
                <span className="px-2 py-0.2 rounded-full text-[11px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {validTracks.length}/5
                </span>
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-[280px] sm:max-w-md">
                {song.title} {song.artist ? `• ${song.artist}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingState(null);
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 flex-1">
          {editingState ? (
            /* Edit / Add New Form */
            <form onSubmit={handleSaveEdit} className="p-4 bg-slate-950/70 border border-purple-500/40 rounded-xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-bold text-slate-100">
                    {editingState.isNew ? `Add New BackTrack (${validTracks.length + 1}/5)` : `Edit ${editingState.originalId || `BackTrack ${editingState.index}`}`}
                  </span>
                </div>
                {!editingState.isNew && (
                  <button
                    type="button"
                    onClick={() => handleDeleteTrack(editingState.originalId, editingState.index)}
                    className="px-2 py-1 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 border border-rose-800/40 text-xs font-semibold flex items-center gap-1 transition-colors"
                    title="Delete this backtrack"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description / Title:
                </label>
                <input
                  type="text"
                  required
                  value={editingState.description}
                  onChange={(e) => setEditingState({ ...editingState, description: e.target.value })}
                  placeholder="e.g. Babe BackTrack No Vocal (Standard Key)"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-purple-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Link / URL or Local Path:
                </label>
                <input
                  type="text"
                  required
                  value={editingState.url}
                  onChange={(e) => setEditingState({ ...editingState, url: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=... or audio URL"
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-purple-400"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Supports YouTube videos, audio streams (.mp3, .wav, .m4a), GitHub audio, or local drive paths.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingState(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editingState.url.trim()}
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Track</span>
                </button>
              </div>
            </form>
          ) : validTracks.length === 0 ? (
            /* Empty State: No valid BackTrack found */
            <div 
              id="backtrack-empty-state"
              className="text-center py-6 px-4 bg-slate-950/50 border border-dashed border-slate-800 rounded-2xl space-y-3"
            >
              <div className="w-10 h-10 mx-auto rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-200">
                  No accompaniment backtracks yet.
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 max-w-sm mx-auto leading-relaxed">
                  Add up to 5 accompaniment tracks (YouTube, MP3/WAV links, or audio streams).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingState({ isNew: true, index: 1, description: '', url: '' })}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-900/30 transition-all active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First BackTrack</span>
              </button>
            </div>
          ) : (
            /* Valid BackTracks Listing: Clean horizontal rows to save vertical height */
            <div className="space-y-2">
              {validTracks.map((track) => {
                const isActive = activeTrackId === track.id;

                return (
                  <div
                    key={track.id}
                    className={`group relative rounded-xl border p-2.5 sm:px-3.5 sm:py-2.5 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${
                      isActive
                        ? 'bg-purple-950/40 border-purple-500/60 shadow-lg shadow-purple-950/40'
                        : 'bg-slate-950/60 border-slate-800 hover:border-purple-500/40 hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Left: Icon, Description, and Badges */}
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 shrink-0">
                        {getTrackIcon(track.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-white leading-snug truncate">
                          {track.description}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono font-semibold text-slate-400">
                            {track.id}
                          </span>
                          {getTrackTypeBadge(track.type)}
                          {isActive && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Active
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: [Open in Floating Player] [Open in Browser] [Edit Icon] */}
                    <div className="flex items-center gap-1.5 shrink-0 justify-end flex-wrap sm:flex-nowrap">
                      {/* Button 1: Open in Floating Player */}
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTrack(track, 'pip');
                          onClose();
                        }}
                        className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                        title="Open in floating audio/video player"
                      >
                        <Tv className="w-3.5 h-3.5" />
                        <span className="whitespace-nowrap">Open in Floating Player</span>
                      </button>

                      {/* Button 2: Open in Browser */}
                      <button
                        type="button"
                        onClick={() => {
                          onSelectTrack(track, 'browser');
                          onClose();
                        }}
                        className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-all active:scale-95"
                        title="Open link directly in new browser tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="whitespace-nowrap">Open in Browser</span>
                      </button>

                      {/* Button 3: Edit Button (Edit Icon) */}
                      <button
                        type="button"
                        onClick={() => setEditingState({
                          isNew: false,
                          index: track.index,
                          description: track.description,
                          url: track.url,
                          originalId: track.id,
                        })}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 hover:text-amber-300 border border-slate-700 transition-colors"
                        title="Edit BackTrack description and link"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info banner */}
        <div className="px-5 py-2.5 border-t border-slate-800 bg-slate-950/80 text-[11px] text-slate-400 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {!editingState && (
              <button
                type="button"
                disabled={validTracks.length >= 5}
                onClick={() => setEditingState({
                  isNew: true,
                  index: validTracks.length + 1,
                  description: '',
                  url: '',
                })}
                className="px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                title={validTracks.length >= 5 ? 'Maximum 5 backtracks limit reached' : 'Add new accompaniment backtrack'}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New</span>
                <span className="text-[10px] opacity-80">
                  {validTracks.length >= 5 ? '(Max 5)' : `(${validTracks.length}/5)`}
                </span>
              </button>
            )}
            <span className="text-slate-500 hidden sm:inline text-[11px]">
              Edits saved in memory until &quot;Save changes to File?&quot; on exit
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingState(null);
              onClose();
            }}
            className="px-3.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-xs text-slate-200 font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
