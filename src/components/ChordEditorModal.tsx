import React, { useState, useEffect } from 'react';
import { Edit3, Plus, Save, X, Eye, FileText, Check, Music } from 'lucide-react';
import { Song } from '../types';
import { createSongFromChordPro, parseChordPro } from '../utils/chordpro';

interface ChordEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  songToEdit?: Song | null;
  onSaveSong: (savedSong: Song) => void;
  defaultDirPath: string;
}

const TEMPLATE_CHORDPRO = `{title: My New Song}
{artist: Artist Name}
{tempo: 100}
{time: 4/4}
{key: G}
{capo: 0}

{comment: Verse 1}
[G]Here are the [C]lyrics with [D]chords above
[Em]Singing out [C]loud with [D]all your love

{start_of_chorus}
[G]This is the [D]chorus line
[C]Everything will be [G]fine
{end_of_chorus}

{comment: Verse 2}
[G]Second verse [C]playing along [D]today
[Em]Keep on strumming [C]all the [D]way
`;

export const ChordEditorModal: React.FC<ChordEditorModalProps> = ({
  isOpen,
  onClose,
  songToEdit,
  onSaveSong,
  defaultDirPath,
}) => {
  const [content, setContent] = useState('');
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    if (songToEdit) {
      setContent(songToEdit.rawChordPro);
    } else {
      setContent(TEMPLATE_CHORDPRO);
    }
  }, [songToEdit, isOpen]);

  if (!isOpen) return null;

  const parsed = parseChordPro(content);

  const handleInsertDirective = (snippet: string) => {
    setContent((prev) => prev + (prev.endsWith('\n') ? '' : '\n') + snippet + '\n');
  };

  const handleSave = () => {
    const fileName = `${parsed.artist} - ${parsed.title}.cho`;
    const filePath = songToEdit?.filePath || `${defaultDirPath}/${fileName}`;
    
    const updated: Song = {
      id: songToEdit?.id || ('song_' + Math.random().toString(36).substring(2, 9)),
      title: parsed.title || 'Untitled Song',
      artist: parsed.artist || 'Unknown Artist',
      subtitle: parsed.subtitle,
      key: parsed.key,
      era: parsed.era,
      tempo: parsed.tempo || 100,
      timeSignature: parsed.timeSignature || '4/4',
      capo: parsed.capo,
      duration: parsed.duration,
      rawChordPro: content,
      parsed,
      filePath,
      fileName,
      dateAdded: songToEdit?.dateAdded || Date.now(),
      updatedAt: Date.now(),
    };

    onSaveSong(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        id="chord-editor-modal"
        className="w-full max-w-4xl h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">
                {songToEdit ? `Edit: ${songToEdit.title}` : 'Add New ChordPro Song'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {parsed.title} &bull; {parsed.artist} {parsed.key ? `&bull; Key ${parsed.key}` : ''} &bull; {parsed.tempo} BPM
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="toggle-preview-mode"
              type="button"
              onClick={() => setPreviewMode(!previewMode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                previewMode
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              {previewMode ? 'Edit Source' : 'Live Preview'}
            </button>

            <button
              id="save-chordpro-btn"
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Save Song
            </button>

            <button
              id="close-chord-editor"
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Toolbar for Directives */}
        {!previewMode && (
          <div className="px-5 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px] mr-1 shrink-0">
              Quick Insert:
            </span>
            <button
              type="button"
              onClick={() => handleInsertDirective('{title: Title}')}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono shrink-0"
            >
              {'{title}'}
            </button>
            <button
              type="button"
              onClick={() => handleInsertDirective('{artist: Artist}')}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono shrink-0"
            >
              {'{artist}'}
            </button>
            <button
              type="button"
              onClick={() => handleInsertDirective('{era: 90s}')}
              className="px-2 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 rounded font-mono shrink-0"
            >
              {'{era: 90s}'}
            </button>
            <button
              type="button"
              onClick={() => handleInsertDirective('{key: G}')}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono shrink-0"
            >
              {'{key}'}
            </button>
            <button
              type="button"
              onClick={() => handleInsertDirective('{tempo: 120}')}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono shrink-0"
            >
              {'{tempo}'}
            </button>
            <button
              type="button"
              onClick={() => handleInsertDirective('{capo: 2}')}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded font-mono shrink-0"
            >
              {'{capo}'}
            </button>
            <button
              type="button"
              onClick={() => handleInsertDirective('{comment: Verse}')}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300/90 rounded font-mono shrink-0"
            >
              {'{comment}'}
            </button>
            <button
              type="button"
              onClick={() => handleInsertDirective('{start_of_chorus}\n[G]Chorus line\n{end_of_chorus}')}
              className="px-2 py-1 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 rounded font-mono shrink-0"
            >
              {'{Chorus}'}
            </button>
            <button
              type="button"
              onClick={() => handleInsertDirective('[G]')}
              className="px-2 py-1 bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 rounded font-mono shrink-0"
            >
              Chord [G]
            </button>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {!previewMode ? (
            <textarea
              id="chordpro-raw-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter ChordPro text format here..."
              className="w-full h-full p-5 bg-slate-950 font-mono-chord text-xs sm:text-sm text-slate-200 resize-none focus:outline-none focus:ring-0 leading-relaxed selection:bg-amber-500/30"
              spellCheck={false}
            />
          ) : (
            <div 
              id="chordpro-editor-preview"
              className="w-full h-full p-6 bg-slate-950 overflow-y-auto space-y-4"
            >
              <div className="border-b border-slate-800 pb-3">
                <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  {parsed.title}
                  {parsed.era && (
                    <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-md text-xs font-mono font-bold">
                      {parsed.era}
                    </span>
                  )}
                </h1>
                <p className="text-sm text-slate-400">{parsed.artist}</p>
                <div className="flex gap-3 mt-2 text-xs font-mono text-amber-400">
                  {parsed.era && <span>Era: {parsed.era}</span>}
                  {parsed.key && <span>Key: {parsed.key}</span>}
                  <span>Tempo: {parsed.tempo} BPM</span>
                  <span>Time: {parsed.timeSignature}</span>
                  {parsed.capo ? <span>Capo: Fret {parsed.capo}</span> : null}
                </div>
              </div>

              <div className="space-y-2 font-mono-chord text-sm leading-relaxed">
                {parsed.lines.map((line, idx) => {
                  if (line.type === 'empty') {
                    return <div key={idx} className="h-3" />;
                  }
                  if (line.type === 'comment') {
                    return (
                      <div key={idx} className="font-bold text-amber-400 text-xs uppercase tracking-wider mt-3">
                        [{line.text}]
                      </div>
                    );
                  }
                  if (line.type === 'chorus_start') {
                    return (
                      <div key={idx} className="font-bold text-amber-300 text-xs uppercase border-l-2 border-amber-400 pl-2 mt-3">
                        Chorus:
                      </div>
                    );
                  }
                  if (line.type === 'lyrics' && line.segments) {
                    return (
                      <div key={idx} className="flex flex-wrap items-end my-1">
                        {line.segments.map((seg, sIdx) => (
                          <div key={sIdx} className="inline-flex flex-col mr-1">
                            <span className="text-sky-400 font-bold text-xs h-4">
                              {seg.chord || '\u00A0'}
                            </span>
                            <span className="text-slate-200">
                              {seg.lyrics || '\u00A0'}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
