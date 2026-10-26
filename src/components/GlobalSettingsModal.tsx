import React from 'react';
import { 
  Settings, 
  X, 
  Monitor, 
  Guitar, 
  Play, 
  RotateCcw, 
  Check, 
  Minus, 
  Plus, 
  Columns, 
  Music, 
  FileText
} from 'lucide-react';
import { ViewerSettings, VisualTheme } from '../types';
import { DEFAULT_VIEWER_SETTINGS } from '../utils/storage';

interface GlobalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ViewerSettings;
  onUpdateSettings: (newSettings: Partial<ViewerSettings>) => void;
}

export const GlobalSettingsModal: React.FC<GlobalSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  const currentTheme = settings.theme || 'stage-dark';
  const currentFontSize = settings.fontSize || 18;
  const currentInstrument = settings.instrument || 'guitar';
  const currentMeasureWidth = settings.measureInsertWidth || 20;
  const currentTabWrapMode = settings.tabWrapMode || 'fit';

  // Display toggles defaults
  const showChordDiagrams = settings.showChordDiagrams ?? true;
  const showTabDiagrams = settings.showTabDiagrams ?? true;
  const showChordNames = settings.showChordNames ?? true;
  const showSummaryOnly = settings.showSummaryOnly ?? false;

  const handleResetDefaults = () => {
    if (confirm('Reset all global default settings back to factory system defaults?')) {
      onUpdateSettings(DEFAULT_VIEWER_SETTINGS);
    }
  };

  return (
    <div
      id="global-settings-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="global-settings-modal"
        className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Settings className="w-5 h-5 animate-[spin_12s_linear_infinite]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight flex items-center gap-2">
                <span>System Settings & Global Defaults</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Default configuration for Stage, Display, Instruments & Tablature
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Close Settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 max-h-[75vh] overflow-y-auto p-5 space-y-6 text-xs sm:text-sm divide-y divide-slate-800/80">
          
          {/* SECTION 1: Stage and Display Setting */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-xs">
              <Monitor className="w-4 h-4" />
              <span>Stage & Display Setting</span>
            </div>

            {/* Display Mode Feature-by-Feature Toggles */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-white text-xs block">
                    Display Mode (Default Features to Show)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Choose which elements are displayed by default when loading songs
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {/* [D] Chord Diagram */}
                <div 
                  onClick={() => onUpdateSettings({ showChordDiagrams: !showChordDiagrams })}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                    showChordDiagrams
                      ? 'bg-amber-500/15 border-amber-500/50 text-white'
                      : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-amber-400 text-slate-950 font-black flex items-center justify-center font-mono text-xs shrink-0">
                      D
                    </span>
                    <div>
                      <div className="font-bold text-xs text-white">Chord Diagram [D]</div>
                      <div className="text-[10px] text-slate-400">Compact guitar fretboard grids above chords</div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                    showChordDiagrams ? 'bg-amber-400 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {showChordDiagrams ? 'ON' : 'OFF'}
                  </span>
                </div>

                {/* [T] TAB Diagram */}
                <div 
                  onClick={() => onUpdateSettings({ showTabDiagrams: !showTabDiagrams })}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                    showTabDiagrams
                      ? 'bg-amber-500/15 border-amber-500/50 text-white'
                      : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-amber-400 text-slate-950 font-black flex items-center justify-center font-mono text-xs shrink-0">
                      T
                    </span>
                    <div>
                      <div className="font-bold text-xs text-white">TAB Diagram [T]</div>
                      <div className="text-[10px] text-slate-400">Guitar & instrument tablature sections</div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                    showTabDiagrams ? 'bg-amber-400 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {showTabDiagrams ? 'ON' : 'OFF'}
                  </span>
                </div>

                {/* [C] Chord Name */}
                <div 
                  onClick={() => onUpdateSettings({ showChordNames: !showChordNames })}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                    showChordNames
                      ? 'bg-amber-500/15 border-amber-500/50 text-white'
                      : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-amber-400 text-slate-950 font-black flex items-center justify-center font-mono text-xs shrink-0">
                      C
                    </span>
                    <div>
                      <div className="font-bold text-xs text-white">Chord Name [C]</div>
                      <div className="text-[10px] text-slate-400">Chord letters positioned on top of lyrics</div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                    showChordNames ? 'bg-amber-400 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {showChordNames ? 'ON' : 'OFF'}
                  </span>
                </div>

                {/* [S] Summary 'Hint' Lyrics Only */}
                <div 
                  onClick={() => onUpdateSettings({ showSummaryOnly: !showSummaryOnly })}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                    showSummaryOnly
                      ? 'bg-purple-500/20 border-purple-500/50 text-white ring-1 ring-purple-400/40'
                      : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-purple-400 text-slate-950 font-black flex items-center justify-center font-mono text-xs shrink-0">
                      S
                    </span>
                    <div>
                      <div className="font-bold text-xs text-white">Summary 'Hint' Lyrics [S]</div>
                      <div className="text-[10px] text-slate-400">Section outline & 3-word reminder (overrides others)</div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                    showSummaryOnly ? 'bg-purple-400 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {showSummaryOnly ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
            </div>

            {/* Text & Chord Size */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs">Text & Chord Size:</span>
                <span className="font-mono text-amber-400 font-bold text-xs">{currentFontSize} px</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ fontSize: Math.max(13, currentFontSize - 1) })}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg cursor-pointer"
                  title="Decrease size"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="range"
                  min="13"
                  max="32"
                  value={currentFontSize}
                  onChange={(e) => onUpdateSettings({ fontSize: parseInt(e.target.value, 10) })}
                  className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ fontSize: Math.min(32, currentFontSize + 1) })}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg cursor-pointer"
                  title="Increase size"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Live Preview Box */}
              <div 
                className="mt-2 p-2.5 bg-slate-900 border border-slate-800 rounded-lg font-mono"
                style={{ fontSize: `${currentFontSize}px` }}
              >
                <div className="text-amber-400 font-bold leading-none mb-1">Am       G        C</div>
                <div className="text-slate-200 leading-none">Welcome to the hotel California</div>
              </div>
            </div>

            {/* Stage Theme */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <span className="font-bold text-white text-xs block">Default Stage Theme:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'stage-dark', label: 'Stage Dark', previewBg: 'bg-slate-950 text-slate-100', border: 'border-slate-700' },
                  { id: 'paper-light', label: 'Paper Light', previewBg: 'bg-stone-100 text-stone-900', border: 'border-stone-300' },
                  { id: 'amoled-black', label: 'AMOLED Black', previewBg: 'bg-black text-emerald-400', border: 'border-zinc-800' },
                  { id: 'vintage-sepia', label: 'Vintage Sepia', previewBg: 'bg-[#f4ecd8] text-[#433422]', border: 'border-[#cbb390]' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onUpdateSettings({ theme: t.id as VisualTheme })}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      currentTheme === t.id
                        ? 'border-amber-400 ring-2 ring-amber-400/50 shadow-md'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className={`w-full h-8 rounded-lg mb-1.5 flex items-center justify-center font-bold text-[11px] ${t.previewBg} ${t.border} border`}>
                      Abc
                    </div>
                    <span className={`text-xs font-semibold ${currentTheme === t.id ? 'text-amber-300' : 'text-slate-400'}`}>
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Layout Columns */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
              <div>
                <span className="font-bold text-white text-xs block">Default Column Layout</span>
                <span className="text-[11px] text-slate-400">Single scroll column or side-by-side 2-column view</span>
              </div>
              <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ columnCount: 1 })}
                  className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                    settings.columnCount !== 2 ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  1 Column
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ columnCount: 2 })}
                  className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                    settings.columnCount === 2 ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  2 Columns
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 2: Tab and Instrument Preset */}
          <div className="pt-4 space-y-4">
            <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-xs">
              <Guitar className="w-4 h-4" />
              <span>Tab and Instrument Preset</span>
            </div>

            {/* Default Instrument Strings */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <span className="font-bold text-white text-xs block">Instrument (Default Tuning Preset):</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'guitar', label: 'Guitar', desc: '6 Strings (e, B, G, D, A, E)' },
                  { id: 'ukulele', label: 'Ukulele', desc: '4 Strings (a, E, C, g)' },
                  { id: 'bass', label: 'Bass', desc: '4 Strings (G, D, A, E)' },
                ].map((inst) => (
                  <button
                    key={inst.id}
                    type="button"
                    onClick={() => onUpdateSettings({ instrument: inst.id as any })}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      currentInstrument === inst.id
                        ? 'bg-amber-500/15 border-amber-400 text-white ring-1 ring-amber-400/40'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="font-bold text-xs capitalize text-white flex items-center justify-between">
                      <span>{inst.label}</span>
                      {currentInstrument === inst.id && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{inst.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Measure Insert Width */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-white text-xs block">Measure Insert Width:</span>
                  <span className="text-[11px] text-slate-400">
                    Number of character columns to generate per newly inserted measure
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-amber-400 font-bold text-xs bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                  <span>{currentMeasureWidth}</span>
                  <span className="text-slate-400 text-[10px]">cols</span>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="range"
                  min="8"
                  max="40"
                  step="1"
                  value={currentMeasureWidth}
                  onChange={(e) => onUpdateSettings({ measureInsertWidth: parseInt(e.target.value, 10) || 20 })}
                  className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>
            </div>

            {/* TAB Layout Mode */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <span className="font-bold text-white text-xs block">TAB Layout Mode:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ tabWrapMode: 'fit' })}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    currentTabWrapMode === 'fit'
                      ? 'bg-amber-500/15 border-amber-400 text-white ring-1 ring-amber-400/40'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-xs text-white flex items-center justify-between">
                    <span>Resize to Fit</span>
                    {currentTabWrapMode === 'fit' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Auto-scales the TAB diagram font to fit screen width on a single line without wrapping.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdateSettings({ tabWrapMode: 'wrap' })}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    currentTabWrapMode === 'wrap'
                      ? 'bg-amber-500/15 border-amber-400 text-white ring-1 ring-amber-400/40'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="font-bold text-xs text-white flex items-center justify-between">
                    <span>Wrap Measures</span>
                    {currentTabWrapMode === 'wrap' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Concatenates measures on the same row until screen width is reached, then wraps down.
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 3: Auto-Scroll Defaults */}
          <div className="pt-4 space-y-4">
            <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-xs">
              <Play className="w-4 h-4" />
              <span>Auto-Scroll Defaults</span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-white text-xs block">Default Global Scroll Speed:</span>
                  <span className="text-[11px] text-slate-400">
                    Fallback speed for songs without a specific &#123;meta: ScrollSpeed&#125; or scrollSpeed tag
                  </span>
                </div>
                <div className="font-mono text-amber-400 font-bold text-xs bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                  {settings.scrollSpeed || 30} px/s
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="range"
                  min="5"
                  max="120"
                  step="1"
                  value={settings.scrollSpeed || 30}
                  onChange={(e) => onUpdateSettings({ scrollSpeed: parseInt(e.target.value, 10) || 30 })}
                  className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-rose-300 hover:bg-rose-950/30 border border-slate-800 hover:border-rose-900/50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reset to factory settings"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Defaults</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-slate-950 font-bold text-xs transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
