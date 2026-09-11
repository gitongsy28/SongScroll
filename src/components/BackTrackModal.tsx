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
  Tv
} from 'lucide-react';
import { BackTrackItem, Song } from '../types';
import { isValidBackTrack, parseChordPro } from '../utils/chordpro';

interface BackTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song;
  onSelectTrack: (track: BackTrackItem, launchMode?: 'browser' | 'pip') => void;
  onEditSong?: () => void;
  activeTrackId?: string | null;
}

export const BackTrackModal: React.FC<BackTrackModalProps> = ({
  isOpen,
  onClose,
  song,
  onSelectTrack,
  onEditSong,
  activeTrackId,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Extract and filter valid backtracks
  const allTracks: BackTrackItem[] = song.backtracks || song.parsed?.backtracks || parseChordPro(song.rawChordPro).backtracks || [];
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

  return (
    <div
      id="backtrack-picker-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30">
              <Play className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight flex items-center gap-2">
                Song BackTracks
                {validTracks.length > 0 && (
                  <span className="px-2 py-0.2 rounded-full text-[11px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    {validTracks.length}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-[280px]">
                {song.title} {song.artist ? `• ${song.artist}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          {validTracks.length === 0 ? (
            /* Empty State: No valid BackTrack found */
            <div 
              id="backtrack-empty-state"
              className="text-center py-6 px-4 bg-slate-950/50 border border-dashed border-slate-800 rounded-2xl space-y-3"
            >
              <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-200">
                  No valid Backtrack link/ file found.
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
                  You can define up to 5 accompaniment tracks in your ChordPro file using the metadata directive format:
                </p>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-left font-mono text-xs text-purple-300/90 overflow-x-auto select-all">
                {`{meta: BackTrack1 : <Description> : <URL/Mp3/Mp4/Wav/etc> : }`}
              </div>

              {onEditSong && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditSong();
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-900/30 transition-all active:scale-95"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Open Song in Editor</span>
                </button>
              )}
            </div>
          ) : (
            /* Valid BackTracks Listing: Description only shown */
            <div className="space-y-2.5">
              <p className="text-xs text-slate-400 mb-2">
                Select a backing track to launch in browser or play:
              </p>

              {validTracks.map((track) => {
                const isActive = activeTrackId === track.id;
                const isYouTube = track.type === 'youtube';
                const isGitHubOrAudio = track.type === 'github' || track.type === 'audio-url';
                const isLocal = track.type === 'local';

                return (
                  <div
                    key={track.id}
                    className={`group relative rounded-xl border p-3.5 transition-all flex flex-col gap-2.5 ${
                      isActive
                        ? 'bg-purple-950/40 border-purple-500/60 shadow-lg shadow-purple-950/40'
                        : 'bg-slate-950/60 border-slate-800 hover:border-purple-500/40 hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Header Row: Description & Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 shrink-0 mt-0.5">
                          {getTrackIcon(track.type)}
                        </div>
                        <div className="min-w-0">
                          {/* ONLY BackTrack Description is displayed */}
                          <div className="text-sm font-bold text-slate-100 group-hover:text-white leading-snug break-words">
                            {track.description}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
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
                    </div>

                    {/* Action Buttons Row */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-end flex-wrap gap-2">
                      {isYouTube ? (
                        <>
                          {/* Floating Mini-Player Option for YouTube */}
                          <button
                            type="button"
                            onClick={() => {
                              onSelectTrack(track, 'pip');
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                            title="Play in Floating Mini-Player inside app (Best for iPad/mobile so video keeps playing while chords scroll)"
                          >
                            <Tv className="w-3.5 h-3.5" />
                            <span>Play in Floating Player</span>
                          </button>

                          {/* Launch in Browser Tab */}
                          <button
                            type="button"
                            onClick={() => {
                              onSelectTrack(track, 'browser');
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-all active:scale-95"
                            title="Open YouTube in a new browser tab"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Open in Browser</span>
                          </button>
                        </>
                      ) : isGitHubOrAudio ? (
                        <>
                          {/* Play in In-App Audio Bar */}
                          <button
                            type="button"
                            onClick={() => {
                              onSelectTrack(track, 'pip');
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                            title="Play audio directly in the Song Viewer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Play Audio</span>
                          </button>

                          {/* Open File / URL */}
                          <button
                            type="button"
                            onClick={() => {
                              onSelectTrack(track, 'browser');
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-all active:scale-95"
                            title="Open direct audio file in browser"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Open Link</span>
                          </button>
                        </>
                      ) : isLocal ? (
                        <>
                          <button
                            type="button"
                            onClick={(e) => handleCopyPath(track, e)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700 transition-all active:scale-95"
                            title="Copy local drive path to clipboard"
                          >
                            {copiedId === track.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="text-emerald-300">Path Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy File Path</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              onSelectTrack(track, 'browser');
                              onClose();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                            title="Launch local file in default application / browser"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Launch Player</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectTrack(track, 'browser');
                            onClose();
                          }}
                          className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Launch Web Link</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info banner */}
        <div className="px-5 py-2.5 border-t border-slate-800 bg-slate-950/80 text-[11px] text-slate-400 flex items-center justify-between">
          <span className="truncate">
            Tip: Use floating player on iPad/mobile to scroll chords without pausing video.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-200 font-medium shrink-0 ml-2"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
