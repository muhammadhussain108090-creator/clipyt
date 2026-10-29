import React from 'react';
import {
  Download,
  FileText,
  Edit3,
  Sparkles,
  Share2,
  FolderArchive,
  Clock,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import type { ValidatedClip } from '../utils/clipLogic';

export interface GeneratedClipItem extends ValidatedClip {
  videoUrl: string;
  srtUrl: string;
  thumbnailUrl?: string;
  filePath: string;
  srtPath: string;
}

interface ResultsGalleryProps {
  jobId: string;
  clips: GeneratedClipItem[];
  sourceTitle?: string;
  aspectRatio: string;
  onEditSubtitles: (clip: GeneratedClipItem) => void;
  onReset: () => void;
}

export const ResultsGallery: React.FC<ResultsGalleryProps> = ({
  jobId,
  clips,
  sourceTitle,
  aspectRatio,
  onEditSubtitles,
  onReset,
}) => {
  const downloadAllUrl = `/api/jobs/${jobId}/download-all`;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-900/60 via-slate-900/80 to-pink-900/60 border border-purple-500/40 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-300 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Generation Complete • {clips.length} Clips Forged</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white">
            {sourceTitle || 'Finished Video Clips'}
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Re-framed in {aspectRatio} with synchronized burnt-in subtitles and SRT tracks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href={downloadAllUrl}
            download={`clipforge_${jobId}_all.zip`}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-sm shadow-lg shadow-purple-600/30 transition-transform active:scale-95 cursor-pointer"
          >
            <FolderArchive className="w-4 h-4" />
            <span>Download All (.ZIP)</span>
          </a>

          <button
            onClick={onReset}
            className="px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-semibold text-sm transition cursor-pointer"
          >
            Process New Video
          </button>
        </div>
      </div>

      {/* Grid of Video Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clips.map((clip, idx) => {
          const isVertical = aspectRatio === '9:16';

          return (
            <div
              key={clip.id}
              className="bg-slate-900/90 border border-slate-800 hover:border-purple-500/50 rounded-2xl overflow-hidden shadow-xl transition-all duration-300 flex flex-col group"
            >
              {/* Video Player Container */}
              <div
                className={`relative bg-black flex items-center justify-center overflow-hidden ${
                  isVertical ? 'aspect-[9/16] max-h-[520px]' : 'aspect-video'
                }`}
              >
                <video
                  src={clip.videoUrl}
                  poster={clip.thumbnailUrl}
                  controls
                  preload="metadata"
                  className="w-full h-full object-contain"
                />

                {/* Virality score badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-purple-500/40 text-[11px] font-bold text-purple-300 shadow-md">
                  <Flame className="w-3.5 h-3.5 text-pink-400" />
                  <span>{clip.viralityScore}/100 Virality</span>
                </div>

                {/* Duration Badge */}
                <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md border border-slate-700 text-[11px] font-medium text-slate-300">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{clip.duration}s</span>
                </div>
              </div>

              {/* Clip Metadata & Actions */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Clip #{idx + 1}</span>
                    <span className="font-mono text-purple-300">
                      {formatTimeDisplay(clip.startTime)} - {formatTimeDisplay(clip.endTime)}
                    </span>
                  </div>

                  <h3 className="font-extrabold text-white text-base leading-snug group-hover:text-purple-300 transition-colors">
                    {clip.title}
                  </h3>

                  <div className="mt-2 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80">
                    <p className="text-[11px] font-semibold text-pink-300 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Hook: &ldquo;{clip.hook}&rdquo;
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                      {clip.reason}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Download MP4 */}
                    <a
                      href={clip.videoUrl}
                      download={`clip_${idx + 1}_${clip.title.replace(/\s+/g, '_')}.mp4`}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>MP4 Video</span>
                    </a>

                    {/* Download SRT */}
                    <a
                      href={clip.srtUrl}
                      download={`clip_${idx + 1}.srt`}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border border-slate-700 transition cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-pink-400" />
                      <span>SRT Subs</span>
                    </a>
                  </div>

                  {/* Edit Subtitles */}
                  <button
                    type="button"
                    onClick={() => onEditSubtitles(clip)}
                    className="w-full py-1.5 px-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] font-medium text-slate-300 hover:text-white flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                    <span>Edit Subtitle Text & Re-Render</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function formatTimeDisplay(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
