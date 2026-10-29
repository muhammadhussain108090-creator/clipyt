import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseYouTubeUrl,
  validateAndAlignClips,
  formatSrtTime,
  generateSrtContent,
  parseSrtContent,
  parseSrtTimestamp,
} from './clipLogic';

test('parseYouTubeUrl parses standard, short, and embed URLs correctly', () => {
  const watchUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  const watchRes = parseYouTubeUrl(watchUrl);
  assert.equal(watchRes.isValid, true);
  assert.equal(watchRes.videoId, 'dQw4w9WgXcQ');
  assert.equal(watchRes.normalizedUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

  const shortUrl = 'https://youtu.be/dQw4w9WgXcQ?t=10';
  const shortRes = parseYouTubeUrl(shortUrl);
  assert.equal(shortRes.isValid, true);
  assert.equal(shortRes.videoId, 'dQw4w9WgXcQ');

  const shortsUrl = 'https://www.youtube.com/shorts/dQw4w9WgXcQ';
  const shortsRes = parseYouTubeUrl(shortsUrl);
  assert.equal(shortsRes.isValid, true);
  assert.equal(shortsRes.videoId, 'dQw4w9WgXcQ');

  const invalidUrl = 'https://example.com/video/12345';
  const invalidRes = parseYouTubeUrl(invalidUrl);
  assert.equal(invalidRes.isValid, false);
});

test('validateAndAlignClips clamps out-of-bounds timestamps and aligns segments', () => {
  const videoDuration = 60.0;
  const rawHighlights = [
    {
      title: 'Opening Insight',
      hook: 'Why 90% of creators fail',
      startTime: -5, // Negative start
      endTime: 25,
      viralityScore: 95,
      reason: 'Strong hook',
    },
    {
      title: 'Closing Masterclass',
      hook: 'Final takeaway',
      startTime: 50,
      endTime: 90, // Exceeds 60s duration
      viralityScore: 88,
      reason: 'Actionable conclusion',
    },
  ];

  const segments = [
    { start: 0, end: 10, text: 'Hello everyone.' },
    { start: 10, end: 25, text: 'Why 90% of creators fail.' },
    { start: 50, end: 60, text: 'Final takeaway message.' },
  ];

  const validated = validateAndAlignClips(rawHighlights, videoDuration, segments, 30, 2);
  assert.equal(validated.length, 2);

  // Clip 1 start clamped to >= 0
  assert.equal(validated[0].startTime, 0);
  assert.equal(validated[0].endTime, 25);
  assert.equal(validated[0].duration, 25);
  assert.equal(validated[0].segments.length, 2);

  // Clip 2 end clamped to <= 60
  assert.equal(validated[1].startTime, 50);
  assert.equal(validated[1].endTime, 60);
  assert.equal(validated[1].duration, 10);
  assert.equal(validated[1].segments.length, 1);
});

test('validateAndAlignClips produces sensible fallback when AI returns empty highlights', () => {
  const videoDuration = 45.0;
  const segments = [
    { start: 0, end: 15, text: 'Welcome to the presentation.' },
  ];

  const validated = validateAndAlignClips([], videoDuration, segments, 30, 1);
  assert.equal(validated.length, 1);
  assert.equal(validated[0].startTime, 0);
  assert.equal(validated[0].duration, 30);
  assert.equal(validated[0].segments.length, 1);
});

test('formatSrtTime correctly formats seconds to standard SRT timestamps', () => {
  assert.equal(formatSrtTime(0), '00:00:00,000');
  assert.equal(formatSrtTime(1.25), '00:00:01,250');
  assert.equal(formatSrtTime(65.5), '00:01:05,500');
  assert.equal(formatSrtTime(3661.123), '01:01:01,123');
});

test('generateSrtContent and parseSrtContent round-trip accurately', () => {
  const segments = [
    { start: 10.0, end: 14.5, text: 'First subtitle line' },
    { start: 15.0, end: 20.0, text: 'Second subtitle line' },
  ];
  const clipStart = 10.0;

  const srt = generateSrtContent(segments, clipStart);
  assert.match(srt, /00:00:00,000 --> 00:00:04,500/);
  assert.match(srt, /First subtitle line/);

  const parsed = parseSrtContent(srt);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].start, 0.0);
  assert.equal(parsed[0].end, 4.5);
  assert.equal(parsed[0].text, 'First subtitle line');
  assert.equal(parsed[1].start, 5.0);
  assert.equal(parsed[1].end, 10.0);
});
