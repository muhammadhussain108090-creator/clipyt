import React from 'react';
import { X, Cpu, Sparkles, Scissors, ShieldCheck, Download, Code2, Zap } from 'lucide-react';

interface ArchitectureModalProps {
  onClose: () => void;
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full p-6 md:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-pink-400" />
            <div>
              <h3 className="font-extrabold text-white text-lg">ClipForge AI Architecture</h3>
              <p className="text-xs text-slate-400">Production-Grade, Free-First Video Processing</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
              <Cpu className="w-4 h-4" />
              <span>Free Local Speech Recognition</span>
            </div>
            <p className="text-xs text-slate-300">
              Uses local <strong>Faster-Whisper</strong> on CPU. Generates high-precision word timestamps without incurring third-party API subscription costs.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 text-pink-400 font-bold text-xs">
              <Sparkles className="w-4 h-4" />
              <span>Google Gemini 3.8 Flash</span>
            </div>
            <p className="text-xs text-slate-300">
              Analyzes transcripts for strong opening hooks, emotional crescendos, and self-contained insights with predicted virality scores.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
              <Scissors className="w-4 h-4" />
              <span>Dual-Layer FFmpeg Reframe</span>
            </div>
            <p className="text-xs text-slate-300">
              Reframes landscape sources into 9:16 vertical shorts with Gaussian blurred background pillarboxing, similar to Opus Clip.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
              <Download className="w-4 h-4" />
              <span>Complete Export Suite</span>
            </div>
            <p className="text-xs text-slate-300">
              Individual MP4 downloads, synchronized .SRT subtitle files, and instant one-click ZIP packaging of all clips.
            </p>
          </div>
        </div>

        {/* Deployment Info */}
        <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-2 text-xs text-slate-300">
          <p className="font-semibold text-purple-200 flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-purple-400" />
            Deployment & Environment
          </p>
          <p>
            The project includes a self-contained <code>Dockerfile</code>, <code>requirements.txt</code>, and standalone <code>backend/main.py</code> for 1-click hosting on Render, Railway, or Fly.io. Simply set <code>GEMINI_API_KEY</code> in your private environment settings.
          </p>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition cursor-pointer"
          >
            Got it, Let&apos;s Create
          </button>
        </div>
      </div>
    </div>
  );
};
