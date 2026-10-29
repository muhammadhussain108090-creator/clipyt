import React, { useState, useRef } from 'react';
import { Youtube, UploadCloud, Film, CheckCircle2, AlertCircle, X, Sparkles, Play } from 'lucide-react';
import { parseYouTubeUrl } from '../utils/clipLogic';

export interface SampleVideo {
  id: string;
  title: string;
  author: string;
  duration: number;
  description: string;
  videoUrl: string;
  tags?: string[];
}

interface SourceInputProps {
  mode: 'youtube' | 'upload' | 'sample';
  setMode: (m: 'youtube' | 'upload' | 'sample') => void;
  youtubeUrl: string;
  setYoutubeUrl: (url: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  selectedSampleId: string;
  setSelectedSampleId: (id: string) => void;
  samples: SampleVideo[];
  disabled?: boolean;
}

export const SourceInput: React.FC<SourceInputProps> = ({
  mode,
  setMode,
  youtubeUrl,
  setYoutubeUrl,
  selectedFile,
  setSelectedFile,
  selectedSampleId,
  setSelectedSampleId,
  samples,
  disabled = false,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ytValidation = parseYouTubeUrl(youtubeUrl);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setYoutubeUrl(text.trim());
      }
    } catch {
      // clipboard read restricted
    }
  };

  const validateAndSetFile = (file: File) => {
    setFileError(null);
    const validExts = ['.mp4', '.mov', '.webm', '.mkv'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExts.includes(ext)) {
      setFileError(`Invalid format "${ext}". Supported: MP4, MOV, WEBM, MKV.`);
      return;
    }

    if (file.size > 300 * 1024 * 1024) {
      setFileError('File size exceeds the 300MB limit.');
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl backdrop-blur-sm">
      {/* Mode Selector Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/80 border border-slate-800/80 mb-6">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setMode('youtube')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
            mode === 'youtube'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Youtube className="w-4 h-4 text-red-400" />
          <span>YouTube URL</span>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => setMode('upload')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
            mode === 'upload'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <UploadCloud className="w-4 h-4 text-purple-400" />
          <span>Upload Video</span>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => setMode('sample')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
            mode === 'sample'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Film className="w-4 h-4 text-pink-400" />
          <span>Instant Demo</span>
          <span className="hidden sm:inline-block text-[10px] bg-pink-500/20 text-pink-300 px-1.5 py-0.2 rounded border border-pink-500/30">
            Fast
          </span>
        </button>
      </div>

      {/* Tab 1: YouTube URL */}
      {mode === 'youtube' && (
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Paste YouTube Video or Shorts URL
          </label>
          <div className="relative flex items-center">
            <div className="absolute left-3.5 pointer-events-none text-slate-400">
              <Youtube className="w-5 h-5 text-red-500" />
            </div>

            <input
              type="url"
              disabled={disabled}
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
              className="w-full pl-11 pr-24 py-3.5 rounded-xl bg-slate-950 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
            />

            <div className="absolute right-2 flex items-center gap-1.5">
              {youtubeUrl ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setYoutubeUrl('')}
                  className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-850 rounded-lg cursor-pointer"
                  title="Clear"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={handlePaste}
                  className="px-2.5 py-1 text-xs font-medium text-purple-300 hover:text-white bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/30 rounded-lg transition cursor-pointer"
                >
                  Paste
                </button>
              )}
            </div>
          </div>

          {/* Validation Feedback */}
          {youtubeUrl.length > 5 && (
            <div className="flex items-center gap-2 text-xs pt-1">
              {ytValidation.isValid ? (
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Valid YouTube Video (ID: {ytValidation.videoId})
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-amber-400">
                  <AlertCircle className="w-4 h-4" />
                  Invalid YouTube link format. Please check the URL.
                </span>
              )}
            </div>
          )}

          <p className="text-[11px] text-slate-400">
            Supports standard YouTube videos and Shorts up to 20 minutes. Note: If YouTube imposes bot authentication on this video, you can switch to the direct "Upload Video" tab.
          </p>
        </div>
      )}

      {/* Tab 2: Upload Video File */}
      {mode === 'upload' && (
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Upload Video File (MP4, MOV, WEBM)
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
            className="hidden"
            disabled={disabled}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                validateAndSetFile(e.target.files[0]);
              }
            }}
          />

          {!selectedFile ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => !disabled && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-purple-400 bg-purple-950/30'
                  : 'border-slate-750 hover:border-purple-500/60 bg-slate-950/60 hover:bg-slate-950'
              }`}
            >
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 mx-auto flex items-center justify-center mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-200">
                Click to browse or drag and drop your video
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports MP4, MOV, WEBM or MKV (up to 300MB)
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950 border border-purple-500/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center">
                  <Film className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white truncate max-w-[220px] sm:max-w-md">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB • Ready for processing
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={disabled}
                onClick={() => setSelectedFile(null)}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-900 rounded-lg cursor-pointer"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {fileError && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              {fileError}
            </p>
          )}
        </div>
      )}

      {/* Tab 3: Built-in Sample Videos */}
      {mode === 'sample' && (
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Select a Demo Video to Test Instantly
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {samples.map((sample) => {
              const isSelected = selectedSampleId === sample.id;
              return (
                <div
                  key={sample.id}
                  onClick={() => !disabled && setSelectedSampleId(sample.id)}
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'border-purple-500 bg-purple-950/40 ring-1 ring-purple-500/50 shadow-lg shadow-purple-900/20'
                      : 'border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-950'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-white leading-tight">
                      {sample.title}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 whitespace-nowrap">
                      {sample.duration}s
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                    {sample.description}
                  </p>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-purple-300 font-medium">By {sample.author}</span>
                    <span
                      className={`flex items-center gap-1 font-semibold ${
                        isSelected ? 'text-purple-400' : 'text-slate-500'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                          Selected
                        </>
                      ) : (
                        'Click to select'
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-400">
            Built-in high-quality masterclass videos with clean speech audio. Tests transcription, Gemini highlight detection, and 9:16 vertical reframe in ~15-20 seconds.
          </p>
        </div>
      )}
    </div>
  );
};
