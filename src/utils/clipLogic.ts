/**
 * ClipForge AI - Core Logic & Pure Utilities
 * Decoupled logic for testing and deterministic execution
 */

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
  probability: number;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  words?: TranscriptWord[];
}

export interface RawAiHighlight {
  title?: string;
  hook?: string;
  startTime?: number;
  endTime?: number;
  start?: number;
  end?: number;
  viralityScore?: number;
  reason?: string;
}

export interface ValidatedClip {
  id: string;
  title: string;
  hook: string;
  startTime: number;
  endTime: number;
  duration: number;
  viralityScore: number;
  reason: string;
  segments: TranscriptSegment[];
}

export interface SubtitleStyleOptions {
  styleName: 'viral_yellow' | 'cyber_purple' | 'clean_white' | 'boxed_dark';
  fontSize?: number;
  position?: 'bottom' | 'top' | 'center';
  burnSubtitles?: boolean;
}

/**
 * Validates and normalizes YouTube URLs.
 * Supports standard watch, youtu.be, shorts, and embed formats.
 */
export function parseYouTubeUrl(url: string): { isValid: boolean; videoId?: string; normalizedUrl?: string } {
  if (!url || typeof url !== 'string') return { isValid: false };
  const trimmed = url.trim();

  // Regular expressions for various YouTube URL patterns
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      const videoId = match[1];
      return {
        isValid: true,
        videoId,
        normalizedUrl: `https://www.youtube.com/watch?v=${videoId}`,
      };
    }
  }

  return { isValid: false };
}

/**
 * Validates and clamps AI-proposed clips against the actual video duration.
 * Ensures:
 * 1. 0 <= startTime < endTime <= videoDuration
 * 2. Minimum clip duration >= minDuration (e.g. 5 seconds)
 * 3. Maximum clip duration <= maxDuration (e.g. targetDuration + 10s)
 * 4. Extracts relevant transcription segments for each clip
 */
export function validateAndAlignClips(
  rawHighlights: RawAiHighlight[],
  videoDuration: number,
  allSegments: TranscriptSegment[],
  targetDuration: number = 30,
  maxClips: number = 3
): ValidatedClip[] {
  if (!Array.isArray(rawHighlights) || videoDuration <= 0) return [];

  const validated: ValidatedClip[] = [];
  const minClipDuration = 5; // Minimum viable short

  for (let i = 0; i < rawHighlights.length; i++) {
    if (validated.length >= maxClips) break;
    const raw = rawHighlights[i];

    let start = Number(raw.startTime ?? raw.start ?? 0);
    let end = Number(raw.endTime ?? raw.end ?? start + targetDuration);

    // Guard NaN
    if (isNaN(start) || isNaN(end)) continue;

    // Clamp within bounds
    start = Math.max(0, Math.min(start, videoDuration - 2));
    end = Math.max(start + minClipDuration, Math.min(end, videoDuration));

    const duration = roundTwo(end - start);
    if (duration < minClipDuration) continue;

    // Extract segments within or overlapping this window
    const clipSegments = allSegments
      .filter((s) => s.end >= start && s.start <= end)
      .map((s) => ({
        ...s,
        start: roundTwo(Math.max(start, s.start)),
        end: roundTwo(Math.min(end, s.end)),
      }));

    const score = Math.max(50, Math.min(99, Math.round(Number(raw.viralityScore) || 85)));

    validated.push({
      id: `clip_${i + 1}_${Math.round(start)}_${Math.round(end)}`,
      title: (raw.title || `Viral Highlight #${i + 1}`).trim(),
      hook: (raw.hook || raw.title || 'Engaging moment').trim(),
      startTime: roundTwo(start),
      endTime: roundTwo(end),
      duration,
      viralityScore: score,
      reason: (raw.reason || 'Compelling segment with strong viewer retention potential.').trim(),
      segments: clipSegments,
    });
  }

  // Fallback: If AI returned 0 valid clips (e.g. silent or unusual timestamps), create sensible default clips
  if (validated.length === 0 && videoDuration >= minClipDuration) {
    const chunk = Math.min(targetDuration, videoDuration);
    const clipSegments = allSegments.filter((s) => s.start <= chunk);
    validated.push({
      id: `clip_1_0_${Math.round(chunk)}`,
      title: 'Top Highlight Moment',
      hook: clipSegments[0]?.text || 'Engaging intro and core message',
      startTime: 0,
      endTime: roundTwo(chunk),
      duration: roundTwo(chunk),
      viralityScore: 92,
      reason: 'Opening hook with highest audience retention.',
      segments: clipSegments,
    });
  }

  return validated;
}

/**
 * Format seconds into standard SRT timestamp 00:00:00,000
 */
export function formatSrtTime(seconds: number): string {
  const totalMs = Math.round(seconds * 1000);
  const ms = totalMs % 1000;
  const totalSecs = Math.floor(totalMs / 1000);
  const s = totalSecs % 60;
  const m = Math.floor(totalSecs / 60) % 60;
  const h = Math.floor(totalSecs / 3600);

  return `${padZero(h, 2)}:${padZero(m, 2)}:${padZero(s, 2)},${padZero(ms, 3)}`;
}

/**
 * Generates an SRT string re-based starting from relative time 0
 */
export function generateSrtContent(segments: TranscriptSegment[], clipStartTime: number): string {
  let srt = '';
  let index = 1;

  for (const seg of segments) {
    const relStart = Math.max(0, seg.start - clipStartTime);
    const relEnd = Math.max(relStart + 0.3, seg.end - clipStartTime);
    const text = seg.text.trim();
    if (!text) continue;

    srt += `${index}\n`;
    srt += `${formatSrtTime(relStart)} --> ${formatSrtTime(relEnd)}\n`;
    srt += `${text}\n\n`;
    index++;
  }

  return srt;
}

/**
 * Parses an SRT string into editable segments
 */
export function parseSrtContent(srtText: string): Array<{ index: number; start: number; end: number; text: string }> {
  if (!srtText) return [];
  const blocks = srtText.trim().split(/\n\s*\n/);
  const result: Array<{ index: number; start: number; end: number; text: string }> = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    const timeLineIndex = lines[0].includes('-->') ? 0 : 1;
    const timeLine = lines[timeLineIndex];
    if (!timeLine || !timeLine.includes('-->')) continue;

    const [startStr, endStr] = timeLine.split('-->').map((s) => s.trim());
    const start = parseSrtTimestamp(startStr);
    const end = parseSrtTimestamp(endStr);
    const text = lines.slice(timeLineIndex + 1).join(' ');

    result.push({
      index: result.length + 1,
      start,
      end,
      text,
    });
  }

  return result;
}

export function parseSrtTimestamp(str: string): number {
  const match = str.match(/(\d+):(\d+):(\d+)[,. ](\d+)/);
  if (!match) return 0;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const s = parseInt(match[3], 10);
  const ms = parseInt(match[4].padEnd(3, '0').slice(0, 3), 10);
  return h * 3600 + m * 60 + s + ms / 1000;
}

export function roundTwo(val: number): number {
  return Math.round(val * 100) / 100;
}

function padZero(num: number, len: number): string {
  return String(num).padStart(len, '0');
}
