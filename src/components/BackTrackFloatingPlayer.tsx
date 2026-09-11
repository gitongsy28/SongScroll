import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  X, 
  Minimize2, 
  Maximize2, 
  Volume2, 
  VolumeX, 
  ExternalLink,
  Music,
  Video,
  Radio,
  HardDrive
} from 'lucide-react';
import { BackTrackItem } from '../types';
import { extractYouTubeId, getStreamableAudioUrl } from '../utils/chordpro';

interface BackTrackFloatingPlayerProps {
  track: BackTrackItem | null;
  onClose: () => void;
  onOpenInBrowser: (track: BackTrackItem) => void;
}

export const BackTrackFloatingPlayer: React.FC<BackTrackFloatingPlayerProps> = ({
  track,
  onClose,
  onOpenInBrowser,
}) => {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Reset states when track changes
  useEffect(() => {
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(0);
  }, [track?.id, track?.url]);

  if (!track) return null;

  const isYouTube = track.type === 'youtube';
  const ytVideoId = isYouTube ? extractYouTubeId(track.url) : null;
  const isAudio = track.type === 'github' || track.type === 'audio-url';
  const streamableAudioUrl = isAudio ? getStreamableAudioUrl(track.url) : '';

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleAudioPlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleAudioSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const handleToggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  return (
    <div
      id="backtrack-floating-player"
      className="fixed z-40 bottom-16 sm:bottom-14 right-2 sm:right-5 transition-all duration-200"
    >
      {/* Minimized Pill */}
      {isMinimized ? (
        <div className="flex items-center gap-2 bg-slate-900/95 border border-purple-500/50 backdrop-blur-md rounded-full shadow-2xl px-3 py-1.5 text-xs text-slate-200 animate-in fade-in">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-purple-300 truncate max-w-[180px] sm:max-w-[240px]">
            {track.description}
          </span>

          {isAudio && (
            <button
              type="button"
              onClick={handleAudioPlayPause}
              className="p-1 rounded-full bg-purple-600 text-white hover:bg-purple-500"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="p-1 rounded-full text-slate-400 hover:text-white"
            title="Expand player"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-red-400"
            title="Close player"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        /* Expanded Floating Card */
        <div className="w-[300px] sm:w-[360px] bg-slate-900/95 border border-purple-500/50 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden text-slate-100 animate-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-3.5 py-2 border-b border-slate-800/80 bg-slate-950/70 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {isYouTube ? (
                <Video className="w-4 h-4 text-red-400 shrink-0" />
              ) : isAudio ? (
                <Music className="w-4 h-4 text-purple-400 shrink-0" />
              ) : (
                <HardDrive className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span className="text-xs font-bold text-slate-200 truncate">
                {track.description}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onOpenInBrowser(track)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded"
                title="Open in new browser tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded"
                title="Minimize player"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-red-400 rounded"
                title="Close player"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* YouTube Video Embed */}
          {isYouTube && ytVideoId ? (
            <div className="relative w-full aspect-video bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${ytVideoId}?autoplay=1&playsinline=1&enablejsapi=1`}
                title={track.description}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : isYouTube ? (
            <div className="p-4 text-center text-xs text-slate-400">
              <p>YouTube Link: {track.description}</p>
              <button
                type="button"
                onClick={() => onOpenInBrowser(track)}
                className="mt-2 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5 mx-auto"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Launch in YouTube</span>
              </button>
            </div>
          ) : null}

          {/* Audio Player Controls */}
          {isAudio && (
            <div className="p-3 space-y-2">
              <audio
                ref={audioRef}
                src={streamableAudioUrl}
                autoPlay
                onTimeUpdate={() => {
                  if (audioRef.current) {
                    setCurrentTime(audioRef.current.currentTime);
                  }
                }}
                onLoadedMetadata={() => {
                  if (audioRef.current) {
                    setDuration(audioRef.current.duration);
                  }
                }}
                onEnded={() => setIsPlaying(false)}
              />

              {/* Progress Slider */}
              <div className="space-y-1">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleAudioSeek}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAudioPlayPause}
                    className="p-2 rounded-full bg-purple-600 hover:bg-purple-500 text-white shadow-md transition-all active:scale-95"
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                  </button>
                  <span className="text-xs text-slate-300 font-medium">
                    {isPlaying ? 'Playing Audio' : 'Paused'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Local File Notice */}
          {!isYouTube && !isAudio && (
            <div className="p-3 text-xs text-slate-300 space-y-2">
              <p className="text-slate-400">
                Target: <span className="font-mono text-[11px] text-amber-300 break-all">{track.url}</span>
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onOpenInBrowser(track)}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Launch File</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
