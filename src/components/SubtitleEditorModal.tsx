import React, { useState, useEffect } from 'react';
import { X, Save, RefreshCw, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import type { GeneratedClipItem } from './ResultsGallery';

interface SubtitleEditorModalProps {
  jobId: string;
  clip: GeneratedClipItem | null;
  onClose: () => void;
  onClipUpdated: (updatedClip: GeneratedClipItem) => void;
}

export const SubtitleEditorModal: React.FC<SubtitleEditorModalProps> = ({
  jobId,
  clip,
  onClose,
  onClipUpdated,
}) => {
  const [srtText, setSrtText] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!clip) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    fetch(clip.srtUrl)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load subtitle file.');
        return res.text();
      })
      .then((text) => {
        setSrtText(text);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [clip]);

  if (!clip) return null;

  const handleSaveAndRerender = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`/api/jobs/${jobId}/clips/${clip.id}/update-subtitles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          srtContent: srtText,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update subtitles.');
      }

      setSuccess(true);
      onClipUpdated({
        ...clip,
        ...data.clip,
        // Bust browser cache for re-rendered video
        videoUrl: `${clip.videoUrl.split('?')[0]}?t=${Date.now()}`,
      });

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'An error occurred during re-rendering.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="font-bold text-white text-base">Edit Subtitles</h3>
              <p className="text-xs text-slate-400">Clip: {clip.title}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice */}
        <p className="text-xs text-slate-300">
          Modify the subtitle text lines or timestamps below. When you click <strong>Save & Re-Render</strong>, FFmpeg will burn the updated captions directly into the video!
        </p>

        {/* Editor Body */}
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 text-purple-400 animate-spin" />
            <p className="text-xs text-slate-400">Loading subtitle transcript...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              value={srtText}
              onChange={(e) => setSrtText(e.target.value)}
              rows={12}
              className="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-purple-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent leading-relaxed"
              placeholder="1&#10;00:00:00,000 --> 00:00:02,500&#10;First caption line..."
            />
          </div>
        )}

        {/* Feedback Messages */}
        {error && (
          <div className="p-3 rounded-lg bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Clip re-rendered successfully with new subtitles!</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={saving || loading}
            onClick={handleSaveAndRerender}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Re-Rendering with FFmpeg...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save & Re-Render Clip</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
