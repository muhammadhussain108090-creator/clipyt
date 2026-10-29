/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Zap,
  ArrowRight,
  RefreshCw,
  Video,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  Layers,
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { SourceInput, type SampleVideo } from './components/SourceInput';
import { ClipSettings, type GenerationSettings } from './components/ClipSettings';
import { ProcessingProgress } from './components/ProcessingProgress';
import { ResultsGallery, type GeneratedClipItem } from './components/ResultsGallery';
import { SubtitleEditorModal } from './components/SubtitleEditorModal';
import { ArchitectureModal } from './components/ArchitectureModal';

export default function App() {
  // Source Selection
  const [sourceMode, setSourceMode] = useState<'youtube' | 'upload' | 'sample'>('sample');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState('sample_ai_growth');
  const [samples, setSamples] = useState<SampleVideo[]>([]);

  // Clip Settings
  const [settings, setSettings] = useState<GenerationSettings>({
    clipDuration: 30,
    clipCount: 3,
    aspectRatio: '9:16',
    captionStyle: 'viral_yellow',
    fontSize: 28,
    captionPosition: 'bottom',
    burnSubtitles: true,
  });

  // Job State
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<
    'idle' | 'queued' | 'downloading' | 'transcribing' | 'analyzing' | 'rendering' | 'completed' | 'failed'
  >('idle');
  const [progress, setProgress] = useState(0);
  const [stageMessage, setStageMessage] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [jobError, setJobError] = useState<string | null>(null);
  const [generatedClips, setGeneratedClips] = useState<GeneratedClipItem[]>([]);
  const [sourceTitle, setSourceTitle] = useState<string>('');

  // Modals
  const [editingClip, setEditingClip] = useState<GeneratedClipItem | null>(null);
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load active job from URL or localStorage on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlJobId = params.get('jobId') || localStorage.getItem('clipforge_last_job');
    if (urlJobId) {
      setActiveJobId(urlJobId);
      setJobStatus('queued');
    }
  }, []);

  // Sync activeJobId to URL and localStorage
  useEffect(() => {
    if (activeJobId) {
      localStorage.setItem('clipforge_last_job', activeJobId);
      const url = new URL(window.location.href);
      url.searchParams.set('jobId', activeJobId);
      window.history.replaceState(null, '', url.toString());
    } else {
      localStorage.removeItem('clipforge_last_job');
      const url = new URL(window.location.href);
      url.searchParams.delete('jobId');
      window.history.replaceState(null, '', url.toString());
    }
  }, [activeJobId]);

  // Fetch available built-in samples on mount
  useEffect(() => {
    fetch('/api/samples')
      .then((res) => res.json())
      .then((data) => {
        if (data.samples && data.samples.length > 0) {
          setSamples(data.samples);
          if (!selectedSampleId) {
            setSelectedSampleId(data.samples[0].id);
          }
        }
      })
      .catch(() => {
        // Fallback default sample metadata
        setSamples([
          {
            id: 'sample_ai_growth',
            title: 'The Micro-Hook Playbook (Viral Video Secrets)',
            author: 'Alex Vance',
            duration: 29,
            description: 'Keynote presentation on short-form video hooks, audience retention, and the first 2 seconds.',
            videoUrl: '/api/media/samples/sample_ai_growth.mp4',
            tags: ['Viral Hooks', 'Content Strategy'],
          },
          {
            id: 'sample_tech_debate',
            title: 'The 10x Developer Paradox (Tech Insights)',
            author: 'Marcus Chen',
            duration: 24,
            description: 'A deep dive into software leverage, code deletion, and high-output engineering.',
            videoUrl: '/api/media/samples/sample_tech_debate.mp4',
            tags: ['Tech Debate', 'Software Engineering'],
          },
        ]);
      });
  }, []);

  // Poll Job Status
  useEffect(() => {
    if (!activeJobId || jobStatus === 'completed' || jobStatus === 'failed') {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    const pollJob = async () => {
      try {
        const res = await fetch(`/api/jobs/${activeJobId}`);
        if (!res.ok) return;
        const data = await res.json();

        setJobStatus(data.status);
        setProgress(data.progress || 0);
        setStageMessage(data.stageMessage || '');
        setLogs(data.logs || []);

        if (data.source?.title) {
          setSourceTitle(data.source.title);
        }

        if (data.status === 'completed') {
          setGeneratedClips(data.clips || []);
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        } else if (data.status === 'failed') {
          setJobError(data.error || 'Job processing failed.');
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        }
      } catch (err) {
        console.error('Error polling job:', err);
      }
    };

    pollJob();
    pollIntervalRef.current = setInterval(pollJob, 1500);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [activeJobId, jobStatus]);

  // Form submission: Start clip generation
  const handleGenerateClips = async () => {
    setIsSubmitting(true);
    setJobError(null);

    try {
      const formData = new FormData();
      formData.append('clipDuration', String(settings.clipDuration));
      formData.append('clipCount', String(settings.clipCount));
      formData.append('aspectRatio', settings.aspectRatio);
      formData.append('captionStyle', settings.captionStyle);
      formData.append('fontSize', String(settings.fontSize));
      formData.append('captionPosition', settings.captionPosition);
      formData.append('burnSubtitles', String(settings.burnSubtitles));

      if (sourceMode === 'youtube') {
        if (!youtubeUrl.trim()) {
          throw new Error('Please enter a YouTube video URL.');
        }
        formData.append('youtubeUrl', youtubeUrl.trim());
      } else if (sourceMode === 'upload') {
        if (!selectedFile) {
          throw new Error('Please upload a video file.');
        }
        formData.append('videoFile', selectedFile);
      } else {
        if (!selectedSampleId) {
          throw new Error('Please select a sample video.');
        }
        formData.append('sampleId', selectedSampleId);
      }

      const res = await fetch('/api/jobs', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit generation job.');
      }

      setActiveJobId(data.jobId);
      setJobStatus('queued');
      setProgress(5);
      setStageMessage('Job submitted to background queue...');
      setLogs(['[00:00:00] Job created and sent to processing worker']);

      // Smooth scroll to progress section
      window.scrollTo({ top: 380, behavior: 'smooth' });
    } catch (err: any) {
      setJobError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setActiveJobId(null);
    setJobStatus('idle');
    setProgress(0);
    setStageMessage('');
    setLogs([]);
    setJobError(null);
    setGeneratedClips([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClipUpdated = (updatedClip: GeneratedClipItem) => {
    setGeneratedClips((prev) =>
      prev.map((c) => (c.id === updatedClip.id ? updatedClip : c))
    );
  };

  const isProcessing =
    jobStatus === 'queued' ||
    jobStatus === 'downloading' ||
    jobStatus === 'transcribing' ||
    jobStatus === 'analyzing' ||
    jobStatus === 'rendering';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Navigation */}
      <Navbar onOpenDocs={() => setShowDocsModal(true)} onReset={handleReset} />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-10">
        {/* Hero Section */}
        {jobStatus === 'idle' && (
          <div className="text-center max-w-3xl mx-auto space-y-4 pt-4 pb-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-950/60 border border-purple-500/30 text-xs font-semibold text-purple-300 shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              <span>Next-Gen AI Video Clipper & Shorts Forge</span>
            </div>

            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Turn Long Videos into{' '}
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
                Viral Shorts
              </span>{' '}
              in Seconds
            </h1>

            <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Paste a YouTube link or upload your video. ClipForge AI extracts speech with local Whisper, analyzes viral hooks with Google Gemini, reframes to 9:16 vertical, and burns synchronized captions.
            </p>
          </div>
        )}

        {/* Input & Settings (Visible when idle or configuring) */}
        {jobStatus === 'idle' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Step 1: Input source */}
            <SourceInput
              mode={sourceMode}
              setMode={setSourceMode}
              youtubeUrl={youtubeUrl}
              setYoutubeUrl={setYoutubeUrl}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              selectedSampleId={selectedSampleId}
              setSelectedSampleId={setSelectedSampleId}
              samples={samples}
              disabled={isSubmitting}
            />

            {/* Step 2: Settings & Customization */}
            <ClipSettings
              settings={settings}
              onChange={setSettings}
              disabled={isSubmitting}
            />

            {/* Error Message */}
            {jobError && (
              <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs font-medium">
                {jobError}
              </div>
            )}

            {/* Generate Action Button */}
            <div className="flex justify-center pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleGenerateClips}
                className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:via-pink-500 hover:to-indigo-500 text-white font-extrabold text-base shadow-xl shadow-purple-600/30 hover:shadow-purple-600/50 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Preparing Video Stream...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 text-yellow-300 group-hover:rotate-12 transition-transform" />
                    <span>Generate AI Video Clips</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Real Processing Progress (Visible when processing or failed) */}
        {activeJobId && isProcessing && (
          <ProcessingProgress
            status={jobStatus as any}
            progress={progress}
            stageMessage={stageMessage}
            logs={logs}
            error={jobError || undefined}
            onRetry={handleReset}
          />
        )}

        {/* Failed View with Logs */}
        {activeJobId && jobStatus === 'failed' && (
          <ProcessingProgress
            status="failed"
            progress={progress}
            stageMessage={stageMessage}
            logs={logs}
            error={jobError || undefined}
            onRetry={handleReset}
          />
        )}

        {/* Results Gallery (Visible when completed) */}
        {activeJobId && jobStatus === 'completed' && (
          <ResultsGallery
            jobId={activeJobId}
            clips={generatedClips}
            sourceTitle={sourceTitle}
            aspectRatio={settings.aspectRatio}
            onEditSubtitles={(clip) => setEditingClip(clip)}
            onReset={handleReset}
          />
        )}
      </main>

      {/* Subtitle Editor Modal */}
      {editingClip && activeJobId && (
        <SubtitleEditorModal
          jobId={activeJobId}
          clip={editingClip}
          onClose={() => setEditingClip(null)}
          onClipUpdated={handleClipUpdated}
        />
      )}

      {/* Architecture Documentation Modal */}
      {showDocsModal && <ArchitectureModal onClose={() => setShowDocsModal(false)} />}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-8 text-center text-xs text-slate-500 space-y-2">
        <div className="flex items-center justify-center gap-2">
          <span className="font-bold text-slate-400">ClipForge AI</span>
          <span>•</span>
          <span>Faster-Whisper (CPU)</span>
          <span>•</span>
          <span>Google Gemini 3.8 Flash</span>
          <span>•</span>
          <span>FFmpeg Dual-Layer Reframe</span>
        </div>
        <p className="text-[11px] text-slate-600">
          Free-first architecture. No paid transcription APIs or third-party subscriptions required.
        </p>
      </footer>
    </div>
  );
}
