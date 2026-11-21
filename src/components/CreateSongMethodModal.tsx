import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  FileEdit, 
  Music, 
  CheckCircle2, 
  AlertCircle, 
  ClipboardCopy,
  Check
} from 'lucide-react';

interface CreateSongMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectManual: () => void;
  onAutoSongCreated: (rawChordPro: string, title: string, artist: string) => void;
}

function buildSongPromptTemplate(songTitle: string, songArtist: string): string {
  const s = songTitle.trim();
  const a = songArtist.trim();
  return `Create a lyric template with guitar chords (in original key) (chords placed in same line of lyrics at correct chord change position) in ChordPro (.cho) format for
the titled "${s}" by artist "${a}".

Include lyric line timestamp: [mm:ss.xx] inserted at the beginning of the Lyric text (Based on LRC timestamp format standard)
• mm: minutes (two or more digits)
• ss: seconds (00–59)
• xx: hundredths of a second / centiseconds (00–99)
This timestamp should ideally be based on the original performance/recording.

The result template should include Title of the song, artist name. tempo. time(signature), key and capo position, as in sample format below:

SAMPLE FORMAT BEGIN>>>

{title: ?}
{artist: ?}
{key: ?}
{Year: ?}
{capo: ?}
{tempo: ?}
{time: ?}
{duration: ?}

{comment: Verse 1}
[00:27.12][G]Here are the [C]lyrics with [D]chords above
[00:30.12][Em]Singing out [C]loud with [D]all your love

{start_of_chorus}
[00:34.12][G]This is the [D]chorus line
[00:39.12][C]Everything will be [G]fine
{end_of_chorus}

{comment: Verse 2}
[00:45.12][G]Second verse [C]playing along [D]today
[00:46.12][Em]Keep on strumming [C]all the [D]way

>SAMPLE FORMAT END:

ORIGINAL LYRICS AS BELOW :- `;
}

async function copyTextToBuffer(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to execCommand fallback
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export const CreateSongMethodModal: React.FC<CreateSongMethodModalProps> = ({
  isOpen,
  onClose,
  onSelectManual,
  onAutoSongCreated,
}) => {
  const [method, setMethod] = useState<'auto' | 'manual' | 'prompt'>('auto');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [promptCopied, setPromptCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setGeneratedPrompt('');
      setPromptCopied(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectMethod = (nextMethod: 'auto' | 'manual' | 'prompt') => {
    if (isLoading) return;
    setMethod(nextMethod);
    setError(null);
    setPromptCopied(false);
  };

  const handleConfirm = async () => {
    if (method === 'manual') {
      onClose();
      onSelectManual();
      return;
    }

    if (!title.trim()) {
      setError('Please enter a song title');
      return;
    }

    if (method === 'prompt') {
      if (!artist.trim()) {
        setError('Please enter the Artist / Performer name');
        return;
      }
      setError(null);
      const promptText = buildSongPromptTemplate(title, artist);
      setGeneratedPrompt(promptText);
      const copied = await copyTextToBuffer(promptText);
      if (copied) {
        setPromptCopied(true);
      } else {
        setPromptCopied(false);
        setError('Could not access clipboard automatically — select and copy the generated prompt below.');
      }
      return;
    }

    // Auto method
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch('/api/auto-create-song', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          artist: artist.trim(),
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      let data: any = null;

      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error('Non-JSON response from /api/auto-create-song:', response.status, text.slice(0, 300));
        throw new Error(
          response.status === 404
            ? 'API service is starting up. Please try again or switch to Manual template.'
            : `Server returned unexpected response (${response.status}). Please try again or switch to Manual template.`
        );
      }

      if (!response.ok || !data || data.error) {
        throw new Error(data?.error || `Failed to search and generate song (${response.status})`);
      }

      if (!data.chordPro) {
        throw new Error('No song content was returned by the generator');
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

  const needsSongDetails = method === 'auto' || method === 'prompt';

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
        className="w-full max-w-2xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 animate-in zoom-in-95 duration-150 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between shrink-0">
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
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Method Selection Cards (3 options) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Auto Card */}
            <div
              onClick={() => handleSelectMethod('auto')}
              className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer relative ${
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
                Auto Search &amp; Fetch
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Fetches chords in original key, 4 YouTube audio backtracks, and syncs LRC timestamps.
              </p>
            </div>

            {/* Manual Card */}
            <div
              onClick={() => handleSelectMethod('manual')}
              className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer relative ${
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

            {/* Generate Prompt Card */}
            <div
              id="create-method-generate-prompt-btn"
              onClick={() => handleSelectMethod('prompt')}
              className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer relative ${
                method === 'prompt'
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
                  : 'border-slate-800 bg-slate-950/40 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className={`p-2 rounded-lg ${method === 'prompt' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
                  <ClipboardCopy className="w-4 h-4" />
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  method === 'prompt' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                }`}>
                  Prompt
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-100 mb-1">
                Generate Prompt
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Builds a ChordPro + LRC prompt for your song &amp; artist and copies it to clipboard.
              </p>
            </div>
          </div>

          {/* Inputs for Title and Artist (Auto & Generate Prompt) */}
          {needsSongDetails && (
            <div className="space-y-3.5 pt-2 border-t border-slate-800/80 animate-in fade-in">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Song Title <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setPromptCopied(false);
                  }}
                  placeholder="e.g. Hotel California, Stand by Me, Hallelujah"
                  disabled={isLoading}
                  autoFocus
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Artist / Performer{' '}
                  {method === 'prompt' ? (
                    <span className="text-amber-400">*</span>
                  ) : (
                    <span className="text-slate-400 text-[11px]">(Recommended for best accuracy)</span>
                  )}
                </label>
                <input
                  type="text"
                  value={artist}
                  onChange={(e) => {
                    setArtist(e.target.value);
                    setPromptCopied(false);
                  }}
                  placeholder="e.g. Eagles, Ben E. King, Leonard Cohen"
                  disabled={isLoading}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {method === 'auto' && (
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs text-slate-300 space-y-1.5">
                  <div className="text-[11px] font-bold text-amber-400/90 uppercase tracking-wide flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto-Generated Song Components</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Original key chords &amp; lyrics</span>
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
                      <span>Karaoke &amp; backing tracks (1-4)</span>
                    </div>
                  </div>
                </div>
              )}

              {method === 'prompt' && generatedPrompt && (
                <div className="space-y-2 animate-in fade-in">
                  {promptCopied && (
                    <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2 font-semibold">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Prompt generated and copied to clipboard buffer! You can paste it directly into your query.</span>
                    </div>
                  )}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-slate-400">
                        Generated Prompt Preview
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await copyTextToBuffer(generatedPrompt);
                          if (ok) setPromptCopied(true);
                        }}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <ClipboardCopy className="w-3 h-3" />
                        <span>Copy Again</span>
                      </button>
                    </div>
                    <textarea
                      readOnly
                      value={generatedPrompt}
                      rows={7}
                      onFocus={(e) => e.currentTarget.select()}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-300 leading-relaxed focus:outline-none focus:border-emerald-500 resize-y"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMethod('manual');
                }}
                className="shrink-0 px-2.5 py-1 bg-rose-900/60 hover:bg-rose-800/80 text-rose-200 border border-rose-700/60 rounded-lg text-[11px] font-semibold transition-colors"
              >
                Use Manual
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            {method === 'prompt' && promptCopied ? 'Done' : 'Cancel'}
          </button>
          <button
            type="button"
            disabled={
              isLoading ||
              (method === 'auto' && !title.trim()) ||
              (method === 'prompt' && (!title.trim() || !artist.trim()))
            }
            onClick={handleConfirm}
            className={`px-5 py-2 rounded-xl text-xs font-bold shadow-md flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              method === 'prompt'
                ? 'bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 shadow-emerald-500/20'
                : 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 shadow-amber-500/20'
            }`}
          >
            {isLoading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Searching &amp; Creating...</span>
              </>
            ) : method === 'auto' ? (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Search &amp; Create</span>
              </>
            ) : method === 'prompt' ? (
              <>
                {promptCopied ? <Check className="w-3.5 h-3.5" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
                <span>{promptCopied ? 'Copied to Clipboard!' : 'Generate & Copy Prompt'}</span>
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
