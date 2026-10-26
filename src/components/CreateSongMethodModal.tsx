import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  FileEdit, 
  Search, 
  Music, 
  Video, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Radio, 
  Layers 
} from 'lucide-react';

interface CreateSongMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectManual: () => void;
  onAutoSongCreated: (rawChordPro: string, title: string, artist: string) => void;
}

export const CreateSongMethodModal: React.FC<CreateSongMethodModalProps> = ({
  isOpen,
  onClose,
  onSelectManual,
  onAutoSongCreated,
}) => {
  const [method, setMethod] = useState<'auto' | 'manual'>('auto');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (method === 'manual') {
      onClose();
      onSelectManual();
      return;
    }

    // Auto method
    if (!title.trim()) {
      setError('Please enter a song title');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auto-create-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          artist: artist.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to search and generate song');
      }

      onClose();
      onAutoSongCreated(data.chordPro, title.trim(), artist.trim());
    } catch (err: any) {
      console.error('Error auto-creating song:', err);
      setError(err.message || 'Error auto-generating song. Please check connection or try manual mode.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="create-song-method-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 animate-in zoom-in-95 duration-150 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Music className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Add New Song
              </h2>
              <p className="text-xs text-slate-400">
                Choose creation method
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-40"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Method Selection Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Auto Card */}
            <div
              onClick={() => !isLoading && setMethod('auto')}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative ${
                method === 'auto'
                  ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10'
                  : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className={`p-2 rounded-lg ${method === 'auto' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  method === 'auto' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-400'
                }`}>
                  Auto
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-100 mb-1">
                Auto Search & Fetch
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Fetches chords in original key, 4 YouTube audio backtracks, and syncs LRC timestamps.
              </p>
            </div>

            {/* Manual Card */}
            <div
              onClick={() => !isLoading && setMethod('manual')}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative ${
                method === 'manual'
                  ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10'
                  : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className={`p-2 rounded-lg ${method === 'manual' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
                  <FileEdit className="w-4 h-4" />
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  method === 'manual' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-400'
                }`}>
                  Manual
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-100 mb-1">
                Manual Template
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Start with a blank ChordPro template and edit chords, lyrics, and directives manually.
              </p>
            </div>
          </div>

          {/* If Auto method: inputs for Title and Artist */}
          {method === 'auto' && (
            <div className="space-y-3.5 pt-2 border-t border-slate-800/80 animate-in fade-in">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Song Title <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Hotel California, Stand by Me, Hallelujah"
                    disabled={isLoading}
                    autoFocus
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Artist / Performer <span className="text-slate-400 text-[11px]">(Recommended for best accuracy)</span>
                </label>
                <input
                  type="text"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  placeholder="e.g. Eagles, Ben E. King, Leonard Cohen"
                  disabled={isLoading}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* Feature Highlights Checklist */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs text-slate-300 space-y-1.5">
                <div className="text-[11px] font-bold text-amber-400/90 uppercase tracking-wide flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto-Generated Song Components</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Original key chords & lyrics</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>LRC timestamped scrolling</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>Full Song audio/video link</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span>Karaoke & backing tracks (1-4)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isLoading || (method === 'auto' && !title.trim())}
            onClick={handleConfirm}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 shadow-md shadow-amber-500/20 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Searching & Creating...</span>
              </>
            ) : method === 'auto' ? (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Search & Create</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Open Blank Template</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
