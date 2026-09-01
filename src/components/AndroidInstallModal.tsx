import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Download, 
  CheckCircle, 
  ExternalLink, 
  X, 
  Shield, 
  Sparkles, 
  Copy, 
  Check, 
  Terminal, 
  Package, 
  PlaySquare, 
  Info
} from 'lucide-react';

interface AndroidInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidInstallModal: React.FC<AndroidInstallModalProps> = ({ isOpen, onClose }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [activeTab, setActiveTab] = useState<'direct' | 'apk' | 'cli'>('direct');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPreUrl, setCopiedPreUrl] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [copiedManifest, setCopiedManifest] = useState(false);

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';
  // Derive public pre/shared URL if currently on dev URL
  const publicShareUrl = currentUrl.replace('ais-dev-', 'ais-pre-');

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert('To install directly on Android:\n1. Open your browser menu (3 vertical dots ⋮ in top right)\n2. Tap "Install app" or "Add to Home screen"\n3. The app icon will appear on your phone home screen ready for offline gig use!');
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const bubblewrapCommand = `npm i -g @bubblewrap/cli\nbubblewrap init --manifest="${currentUrl}/manifest.json"\nbubblewrap build`;

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(bubblewrapCommand);
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        id="android-install-modal"
        className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Android & APK Installation</h2>
              <p className="text-xs text-slate-400">Install on your phone, tablet, or generate standalone .apk</p>
            </div>
          </div>
          <button
            id="close-android-modal"
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('direct')}
            className={`flex-1 py-2 px-2.5 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'direct'
                ? 'bg-slate-800 text-emerald-300 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Direct Phone Install</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('apk')}
            className={`flex-1 py-2 px-2.5 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'apk'
                ? 'bg-slate-800 text-amber-300 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Download APK Package</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cli')}
            className={`flex-1 py-2 px-2.5 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'cli'
                ? 'bg-slate-800 text-sky-300 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>CLI / Build Tool</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-300">
          {activeTab === 'direct' && (
            <div className="space-y-4">
              {/* Quick Install Banner */}
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-300 text-sm flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Recommended: 1-Click Instant Install
                  </span>
                  <span className="text-[10px] bg-emerald-900/60 text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                    Native PWA
                  </span>
                </div>
                <p className="text-slate-300 text-[11.5px] leading-relaxed">
                  No need to manually download or sideload bulky APK files. This installs directly to your Android launcher as a standalone app with hardware wake-lock, offline caching, and fullscreen auto-scroll.
                </p>
                <button
                  id="install-pwa-btn"
                  type="button"
                  onClick={handleInstallClick}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 text-xs"
                >
                  <Download className="w-4 h-4" />
                  {isInstalled ? 'App Already Installed!' : 'Install on Android / Tablet'}
                </button>
              </div>

              {/* Android Browser Steps */}
              <div className="space-y-2">
                <h3 className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <PlaySquare className="w-3.5 h-3.5 text-amber-400" />
                  Step-by-Step for Chrome / Samsung Internet / Brave
                </h3>
                <ol className="space-y-2 text-[11.5px] text-slate-300 list-decimal list-inside bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                  <li className="leading-relaxed">
                    Open this app on your Android phone/tablet in Google Chrome or Samsung Internet.
                  </li>
                  <li className="leading-relaxed">
                    Tap the browser <span className="font-bold text-slate-100">Three Dots Menu (⋮)</span> in the top right.
                  </li>
                  <li className="leading-relaxed">
                    Select <span className="font-bold text-emerald-400">"Install app"</span> or <span className="font-bold text-emerald-400">"Add to Home Screen"</span>.
                  </li>
                  <li className="leading-relaxed">
                    Tap <span className="font-bold text-slate-100">Add / Install</span>. The SongScroll icon will now launch directly from your home screen without URL bars.
                  </li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'apk' && (
            <div className="space-y-4">
              <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-amber-300 text-sm flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-amber-400" />
                    Package with PWABuilder (Web to Android APK)
                  </span>
                  <span className="text-[10px] bg-amber-900/60 text-amber-200 px-2 py-0.5 rounded-full font-medium">
                    Recommended
                  </span>
                </div>
                
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-200/90 leading-relaxed space-y-1.5">
                  <p className="font-semibold text-amber-300 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5" />
                    Important: Why PWABuilder needs the Public URL
                  </p>
                  <p>
                    Development URLs starting with <code className="text-amber-300 font-mono">ais-dev-</code> are private sandboxes protected by Google AI Studio authentication, so external crawlers cannot read their files and fall back to the host URL.
                  </p>
                  <p>
                    Use the <strong>Public Shared URL</strong> below (<code className="text-emerald-400 font-mono">ais-pre-</code>) or click <strong>"Manifest Options"</strong> in PWABuilder to paste the manifest directly.
                  </p>
                </div>

                {/* Public URL Box */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 flex items-center justify-between">
                    <span>1. Public App URL (paste into PWABuilder):</span>
                    <span className="text-emerald-400/80 font-normal">Public & Crawlable</span>
                  </label>
                  <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-emerald-500/30">
                    <input 
                      type="text" 
                      readOnly 
                      value={publicShareUrl} 
                      className="bg-transparent text-emerald-300 font-mono text-[11px] w-full outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(publicShareUrl);
                        setCopiedPreUrl(true);
                        setTimeout(() => setCopiedPreUrl(false), 2000);
                      }}
                      className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 rounded-lg flex items-center gap-1 text-[11px] font-medium transition-colors shrink-0"
                    >
                      {copiedPreUrl ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Public URL</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Direct Action Link */}
                <a
                  href={`https://www.pwabuilder.com?url=${encodeURIComponent(publicShareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 text-xs inline-block text-center"
                >
                  <ExternalLink className="w-4 h-4 inline-block -mt-0.5" />
                  Open PWABuilder with Public URL
                </a>
              </div>

              {/* PWABuilder Manifest Values Reference */}
              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
                    <Info className="w-3.5 h-3.5 text-sky-400" />
                    Manifest Data (or paste in Manifest Editor)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const manifestSnippet = JSON.stringify({
                        name: "Remix SongScroll - Auto-Scroll Lyric & Chord Reader",
                        short_name: "SongScroll",
                        description: "SongScroll music lyrics and chord player with auto-scroll, half-step transposition, top-right animated metronome, and local drive repository directory support.",
                        start_url: "/",
                        id: "/",
                        scope: "/",
                        display: "standalone",
                        background_color: "#020617",
                        theme_color: "#0f172a",
                        icons: [
                          { src: `${publicShareUrl}/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
                          { src: `${publicShareUrl}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
                          { src: `${publicShareUrl}/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
                          { src: `${publicShareUrl}/icon.svg`, sizes: "512x512", type: "image/svg+xml", purpose: "any" }
                        ]
                      }, null, 2);
                      navigator.clipboard.writeText(manifestSnippet);
                      setCopiedManifest(true);
                      setTimeout(() => setCopiedManifest(false), 2000);
                    }}
                    className="text-[10px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors flex items-center gap-1 border border-slate-700"
                  >
                    {copiedManifest ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied JSON</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy Complete Manifest JSON</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[10.5px] font-mono">
                  <div className="bg-slate-900 p-2 rounded border border-slate-800/80">
                    <span className="text-slate-400 block text-[9px] uppercase">Name</span>
                    <span className="text-amber-300 font-sans font-medium text-xs">Remix SongScroll</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800/80">
                    <span className="text-slate-400 block text-[9px] uppercase">Short Name</span>
                    <span className="text-amber-300 font-sans font-medium text-xs">SongScroll</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800/80">
                    <span className="text-slate-400 block text-[9px] uppercase">Start URL / Scope</span>
                    <span className="text-emerald-400 font-mono">/</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800/80">
                    <span className="text-slate-400 block text-[9px] uppercase">Icons</span>
                    <span className="text-sky-300 font-sans text-xs">192px + 512px + Maskable</span>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="space-y-2">
                <h4 className="font-semibold text-slate-200">How to package APK in PWABuilder:</h4>
                <ol className="space-y-1.5 text-[11px] text-slate-300 list-decimal list-inside bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <li>Open PWABuilder using the <span className="font-bold text-emerald-400">Public Shared URL</span> above.</li>
                  <li>If prompted with manifest options, click <span className="font-bold text-amber-300">"Manifest Options"</span> or verify the details match.</li>
                  <li>Click <span className="font-bold text-amber-300">"Package for Stores"</span> &rarr; select <span className="font-bold text-amber-300">Android</span>.</li>
                  <li>Click <span className="font-bold text-emerald-400">"Generate APK / Package"</span> to download your installable package.</li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'cli' && (
            <div className="space-y-3">
              <div className="bg-sky-950/30 border border-sky-500/30 rounded-xl p-3.5 space-y-2.5">
                <span className="font-semibold text-sky-300 text-sm flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-sky-400" />
                  Google Bubblewrap CLI (Official TWA)
                </span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Build a production-grade Trusted Web Activity (TWA) APK or AAB locally using Google's official Bubblewrap tool:
                </p>
                <div className="relative bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-200">
                  <pre className="overflow-x-auto whitespace-pre-wrap">{bubblewrapCommand}</pre>
                  <button
                    type="button"
                    onClick={handleCopyCommand}
                    className="absolute top-2 right-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                    title="Copy commands"
                  >
                    {copiedCommand ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1.5 text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
                  <Info className="w-3.5 h-3.5 text-amber-400" />
                  Capacitor / Android Studio Native Project
                </div>
                <p className="leading-relaxed">
                  You can also export this project's code via the AI Studio top-right menu (Export ZIP / GitHub), then add Capacitor with <code className="text-slate-200">npx cap add android</code> to compile directly in Android Studio.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-900 border-t border-slate-800 flex justify-end">
          <button
            id="close-android-dialog-btn"
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl transition-colors text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

