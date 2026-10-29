import React, { useState } from 'react';
import {
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Terminal,
  Download,
  Mic,
  Sparkles,
  Scissors,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ProcessingProgressProps {
  status: 'queued' | 'downloading' | 'transcribing' | 'analyzing' | 'rendering' | 'completed' | 'failed';
  progress: number;
  stageMessage: string;
  logs: string[];
  error?: string;
  onRetry?: () => void;
}

export const ProcessingProgress: React.FC<ProcessingProgressProps> = ({
  status,
  progress,
  stageMessage,
  logs,
  error,
  onRetry,
}) => {
  const [showLogs, setShowLogs] = useState(false);

  const steps = [
    {
      id: 'downloading',
      label: 'Acquire Video',
      icon: Download,
      desc: 'Download YouTube streams or load upload',
    },
    {
      id: 'transcribing',
      label: 'Whisper Audio',
      icon: Mic,
      desc: 'Transcribe speech with timestamps on CPU',
    },
    {
      id: 'analyzing',
      label: 'Gemini AI Hooks',
      icon: Sparkles,
      desc: 'Detect viral moments and scoring',
    },
    {
      id: 'rendering',
      label: 'FFmpeg Render',
      icon: Scissors,
      desc: 'Reframe 9:16 & burn synchronized subtitles',
    },
  ];

  const getStepState = (stepId: string) => {
    const stepOrder = ['queued', 'downloading', 'transcribing', 'analyzing', 'rendering', 'completed'];
    const currentIdx = stepOrder.indexOf(status);
    const stepIdx = stepOrder.indexOf(stepId);

    if (status === 'failed') return 'failed';
    if (status === 'completed' || currentIdx > stepIdx) return 'completed';
    if (currentIdx === stepIdx) return 'active';
    return 'pending';
  };

  return (
    <div className="bg-slate-900/90 border border-purple-900/40 rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-md space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {status === 'failed' ? (
              <span className="p-1 rounded-full bg-red-500/20 text-red-400">
                <AlertTriangle className="w-5 h-5" />
              </span>
            ) : status === 'completed' ? (
              <span className="p-1 rounded-full bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </span>
            ) : (
              <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
            )}
            <h3 className="text-lg font-bold text-white">
              {status === 'completed'
                ? 'Clips Generation Complete!'
                : status === 'failed'
                ? 'Processing Halted'
                : 'Forging Your Video Clips...'}
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {stageMessage || 'Analyzing audio and video streams...'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-2xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            {progress}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            status === 'failed'
              ? 'bg-red-500'
              : 'bg-gradient-to-r from-purple-600 via-pink-500 to-indigo-500'
          }`}
          style={{ width: `${Math.max(4, Math.min(100, progress))}%` }}
        />
      </div>

      {/* Steps Visual Tracker */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
        {steps.map((step) => {
          const state = getStepState(step.id);
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              className={`p-3.5 rounded-xl border flex flex-col gap-2 transition-all ${
                state === 'completed'
                  ? 'bg-purple-950/20 border-purple-500/30 text-purple-200'
                  : state === 'active'
                  ? 'bg-purple-900/40 border-purple-500 ring-1 ring-purple-500/50 shadow-lg shadow-purple-950/40 text-white'
                  : 'bg-slate-950/50 border-slate-800 text-slate-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    state === 'active'
                      ? 'bg-purple-500 text-white animate-pulse'
                      : state === 'completed'
                      ? 'bg-purple-500/20 text-purple-300'
                      : 'bg-slate-900 text-slate-600'
                  }`}
                >
                  {state === 'completed' ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                {state === 'active' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400 animate-pulse">
                    Running
                  </span>
                )}
              </div>

              <div>
                <p className="text-xs font-bold leading-tight">{step.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Error Banner */}
      {status === 'failed' && error && (
        <div className="p-4 rounded-xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs space-y-2">
          <p className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            {error}
          </p>
          <div className="flex items-center gap-3 pt-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold cursor-pointer transition"
              >
                Try Again
              </button>
            )}
            <span className="text-slate-400 text-[11px]">
              Tip: If YouTube downloads encounter access checks, upload your MP4 file directly for guaranteed processing.
            </span>
          </div>
        </div>
      )}

      {/* Terminal Logs Collapsible */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/90">
        <button
          type="button"
          onClick={() => setShowLogs(!showLogs)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-mono text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-purple-400" />
            Live Execution Logs ({logs.length} events)
          </span>
          {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showLogs && (
          <div className="p-3 bg-black/60 font-mono text-[11px] text-slate-300 max-h-48 overflow-y-auto space-y-1 border-t border-slate-800/80">
            {logs.map((log, idx) => (
              <div key={idx} className="leading-relaxed">
                <span className="text-purple-400">{log.substring(0, 10)}</span>
                <span className="text-slate-300">{log.substring(10)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
