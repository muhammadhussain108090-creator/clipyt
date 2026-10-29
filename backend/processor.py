#!/usr/bin/env python3
"""
ClipForge AI - Core Video & Audio Processing Engine
Features:
- YouTube downloading via yt-dlp with friendly fallback
- Duration and video metadata extraction via ffprobe
- Local speech recognition via faster-whisper (no paid API)
- Timestamped transcript generation and formatting
- FFmpeg precision clipping, aspect ratio reframing (9:16, 1:1, 16:9) with blurred background
- Styled subtitle burning (SRT / ASS) with custom fonts, colors, and outlines
"""

import os
import sys
import json
import subprocess
import argparse
from pathlib import Path

# Ensure paths
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parent
BIN_YT_DLP = ROOT_DIR / "bin" / "yt-dlp"

def get_yt_dlp_cmd():
    """Return command path for yt-dlp."""
    if BIN_YT_DLP.exists() and os.access(BIN_YT_DLP, os.X_OK):
        return str(BIN_YT_DLP)
    return "yt-dlp"

def get_video_info(video_path):
    """Extract metadata from video file using ffprobe."""
    video_path = str(video_path)
    if not os.path.exists(video_path):
        return {"error": f"File not found: {video_path}"}
    
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration,size,bit_rate:stream=width,height,codec_name,codec_type,avg_frame_rate",
        "-of", "json",
        video_path
    ]
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        data = json.loads(res.stdout)
        duration = float(data.get("format", {}).get("duration", 0))
        video_stream = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"), None)
        has_audio = any(s.get("codec_type") == "audio" for s in data.get("streams", []))
        
        width = int(video_stream.get("width", 1920)) if video_stream else 1920
        height = int(video_stream.get("height", 1080)) if video_stream else 1080

        return {
            "success": True,
            "duration": duration,
            "width": width,
            "height": height,
            "aspectRatio": round(width / max(height, 1), 2),
            "hasAudio": has_audio,
            "sizeBytes": int(data.get("format", {}).get("size", 0)),
            "codec": video_stream.get("codec_name", "unknown") if video_stream else "unknown"
        }
    except Exception as e:
        return {"error": str(e), "success": False}

def download_youtube(url, output_dir):
    """Download video from YouTube using yt-dlp."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    out_template = str(output_dir / "source_%(id)s.%(ext)s")
    
    yt_cmd = get_yt_dlp_cmd()
    
    # First, probe metadata without downloading
    probe_cmd = [
        yt_cmd,
        "--dump-json",
        "--no-playlist",
        "--skip-download",
        url
    ]
    
    try:
        probe_res = subprocess.run(probe_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=30)
        if probe_res.returncode != 0:
            err = probe_res.stderr.strip()
            # Catch known YouTube challenges
            if "Sign in to confirm" in err or "bot" in err.lower():
                return {
                    "success": False,
                    "error": "YouTube requires sign-in authentication or bot verification for this video. Please upload your video file directly using the 'Upload Video' tab."
                }
            if "Private video" in err:
                return {"success": False, "error": "This YouTube video is private."}
            if "Video unavailable" in err:
                return {"success": False, "error": "This video is unavailable or restricted."}
            return {"success": False, "error": f"YouTube download failed: {err}"}
        
        meta = json.loads(probe_res.stdout)
        duration = meta.get("duration", 0)
        title = meta.get("title", "YouTube Video")
        uploader = meta.get("uploader", "Unknown Creator")
        thumbnail = meta.get("thumbnail", "")

        # Limit to 20 minutes to prevent resource exhaustion
        if duration > 1200:
            return {
                "success": False,
                "error": f"Video duration ({duration}s) exceeds the free processing limit of 20 minutes (1200s). Please upload or submit a shorter video."
            }

        # Download best mp4 video+audio
        dl_cmd = [
            yt_cmd,
            "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            "--merge-output-format", "mp4",
            "--no-playlist",
            "-o", out_template,
            url
        ]
        
        dl_res = subprocess.run(dl_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=180)
        if dl_res.returncode != 0:
            return {"success": False, "error": f"Failed downloading media streams: {dl_res.stderr.strip()}"}

        # Find downloaded file
        files = list(output_dir.glob("source_*.mp4"))
        if not files:
            files = list(output_dir.glob("source_*.*"))
            
        if not files:
            return {"success": False, "error": "Could not locate downloaded video file."}

        target_file = files[0]
        return {
            "success": True,
            "filePath": str(target_file),
            "title": title,
            "uploader": uploader,
            "duration": duration,
            "thumbnail": thumbnail
        }

    except subprocess.TimeoutExpired:
        return {"success": False, "error": "YouTube download timed out. Please upload the file directly."}
    except Exception as e:
        return {"success": False, "error": str(e)}

def extract_audio(video_path, output_wav):
    """Extract audio from video to 16kHz mono WAV for faster-whisper."""
    cmd = [
        "ffmpeg", "-y",
        "-i", str(video_path),
        "-vn",
        "-ar", "16000",
        "-ac", "1",
        "-c:a", "pcm_s16le",
        str(output_wav)
    ]
    subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)

def transcribe_audio(video_path, model_size="tiny"):
    """
    Transcribe video speech locally using faster-whisper.
    Returns:
      segments: list of {start, end, text, words: [...]}
      full_transcript: string
    """
    from faster_whisper import WhisperModel
    
    wav_path = Path(video_path).with_suffix(".temp_audio.wav")
    try:
        extract_audio(video_path, wav_path)
    except Exception as e:
        return {"success": False, "error": f"Failed to extract audio track: {str(e)}"}

    try:
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        segments_gen, info = model.transcribe(str(wav_path), beam_size=3, word_timestamps=True)
        
        segments = []
        full_text_list = []
        for s in segments_gen:
            words = []
            if s.words:
                for w in s.words:
                    words.append({
                        "word": w.word.strip(),
                        "start": round(w.start, 2),
                        "end": round(w.end, 2),
                        "probability": round(w.probability, 2)
                    })
            text = s.text.strip()
            if text:
                segments.append({
                    "start": round(s.start, 2),
                    "end": round(s.end, 2),
                    "text": text,
                    "words": words
                })
                full_text_list.append(text)

        # Cleanup temp audio
        if wav_path.exists():
            wav_path.unlink()

        return {
            "success": True,
            "language": info.language,
            "language_probability": round(info.language_probability, 2),
            "duration": round(info.duration, 2),
            "segments": segments,
            "full_transcript": " ".join(full_text_list)
        }

    except Exception as e:
        if wav_path.exists():
            wav_path.unlink()
        return {"success": False, "error": f"Whisper transcription failed: {str(e)}"}

def format_timestamp_srt(seconds):
    """Format seconds into 00:00:00,000 for SRT."""
    millis = int(round((seconds - int(seconds)) * 1000))
    secs = int(seconds) % 60
    mins = (int(seconds) // 60) % 60
    hours = int(seconds) // 3600
    return f"{hours:02d}:{mins:02d}:{secs:02d},{millis:03d}"

def format_timestamp_ass(seconds):
    """Format seconds into 0:00:00.00 for ASS."""
    centis = int(round((seconds - int(seconds)) * 100))
    secs = int(seconds) % 60
    mins = (int(seconds) // 60) % 60
    hours = int(seconds) // 3600
    return f"{hours:01d}:{mins:02d}:{secs:02d}.{centis:02d}"

def create_srt_for_clip(clip_segments, output_srt_path, clip_start_time):
    """
    Create an SRT file re-based so clip_start_time is 0.0s.
    """
    lines = []
    idx = 1
    for seg in clip_segments:
        # Re-base
        rel_start = max(0.0, seg["start"] - clip_start_time)
        rel_end = max(rel_start + 0.3, seg["end"] - clip_start_time)
        text = seg["text"].strip()
        if not text:
            continue
        lines.append(str(idx))
        lines.append(f"{format_timestamp_srt(rel_start)} --> {format_timestamp_srt(rel_end)}")
        lines.append(text)
        lines.append("")
        idx += 1
    
    with open(output_srt_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return output_srt_path

def create_ass_for_clip(clip_segments, output_ass_path, clip_start_time, style_name="viral_yellow", font_size=28, position="bottom"):
    """
    Create an ASS subtitle file with custom styling and readable outlines.
    Styles:
    - viral_yellow: Bold yellow text, heavy black outline (MrBeast style)
    - cyber_purple: Neon purple/magenta, cyan glow outline
    - clean_white: Crisp white, elegant subtle drop shadow
    - boxed_dark: White text inside semi-transparent dark box
    """
    # ASS Colors in &HAABBGGRR format
    if style_name == "viral_yellow":
        primary = "&H0000FFFF"  # Yellow in BGR: R=FF, G=FF, B=00 -> 00FFFF
        outline = "&H00000000"  # Black
        border_style = 1
        outline_width = 3
        shadow_depth = 2
    elif style_name == "cyber_purple":
        primary = "&H00FF00FF"  # Magenta/Purple
        outline = "&H00FFFF00"  # Cyan outline
        border_style = 1
        outline_width = 3
        shadow_depth = 2
    elif style_name == "boxed_dark":
        primary = "&H00FFFFFF"  # White
        outline = "&H80000000"  # Translucent black box
        border_style = 3         # Opaque box
        outline_width = 4
        shadow_depth = 0
    else:  # clean_white
        primary = "&H00FFFFFF"
        outline = "&H00111111"
        border_style = 1
        outline_width = 2
        shadow_depth = 1

    alignment = "2" if position == "bottom" else ("8" if position == "top" else "5")
    margin_v = 80 if position == "bottom" else (60 if position == "top" else 0)

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ClipStyle,Liberation Sans,{font_size},{primary},&H000000FF,{outline},&H80000000,-1,0,0,0,100,100,1,0,{border_style},{outline_width},{shadow_depth},{alignment},60,60,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    for seg in clip_segments:
        rel_start = max(0.0, seg["start"] - clip_start_time)
        rel_end = max(rel_start + 0.3, seg["end"] - clip_start_time)
        text = seg["text"].strip().upper()
        if not text:
            continue
        events.append(f"Dialogue: 0,{format_timestamp_ass(rel_start)},{format_timestamp_ass(rel_end)},ClipStyle,,0,0,0,,{text}")

    with open(output_ass_path, "w", encoding="utf-8") as f:
        f.write(header + "\n".join(events) + "\n")
    return output_ass_path

def cut_and_reframe(
    input_video,
    output_video,
    start_time,
    end_time,
    aspect_ratio="9:16",
    subtitles_path=None,
    burn_subtitles=True
):
    """
    Cut video from start_time to end_time, reframe to aspect_ratio, and burn subtitles.
    """
    duration = max(1.0, end_time - start_time)
    
    # Base filter graph for aspect ratio reframing
    if aspect_ratio == "9:16":
        # Dual layer blur background (1080x1920)
        vf_base = "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:5[bg];[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2"
    elif aspect_ratio == "1:1":
        # Dual layer blur background (1080x1080)
        vf_base = "[0:v]scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080,boxblur=20:5[bg];[0:v]scale=1080:1080:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2"
    else:  # 16:9
        vf_base = "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black"

    # Add subtitle burning if requested
    if burn_subtitles and subtitles_path and os.path.exists(subtitles_path):
        # Escape path for FFmpeg subtitles filter
        escaped_sub_path = str(subtitles_path).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
        if subtitles_path.endswith(".ass"):
            vf_complete = f"{vf_base}[v_framed];[v_framed]ass='{escaped_sub_path}'[v]"
        else:
            vf_complete = f"{vf_base}[v_framed];[v_framed]subtitles='{escaped_sub_path}'[v]"
    else:
        vf_complete = f"{vf_base}[v]"

    cmd = [
        "ffmpeg", "-y",
        "-ss", str(start_time),
        "-t", str(duration),
        "-i", str(input_video),
        "-filter_complex", vf_complete,
        "-map", "[v]",
        "-map", "0:a?",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "22",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        str(output_video)
    ]

    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        return {"success": True, "outputVideo": str(output_video)}
    except subprocess.CalledProcessError as e:
        return {"success": False, "error": f"FFmpeg error: {e.stderr}"}

def generate_thumbnail(video_path, output_thumb_path, time_offset=1.0):
    """Generate JPG thumbnail from video."""
    cmd = [
        "ffmpeg", "-y",
        "-ss", str(time_offset),
        "-i", str(video_path),
        "-vframes", "1",
        "-q:v", "2",
        str(output_thumb_path)
    ]
    try:
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        return True
    except Exception:
        return False

# CLI Dispatcher
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ClipForge Video Processor")
    subparsers = parser.add_subparsers(dest="action", required=True)

    # Info
    info_p = subparsers.add_parser("video-info")
    info_p.add_argument("path")

    # YouTube Download
    yt_p = subparsers.add_parser("download-youtube")
    yt_p.add_argument("url")
    yt_p.add_argument("output_dir")

    # Transcribe
    tr_p = subparsers.add_parser("transcribe")
    tr_p.add_argument("path")
    tr_p.add_argument("--model", default="tiny")

    # Render Clip
    rc_p = subparsers.add_parser("render-clip")
    rc_p.add_argument("--config", required=True, help="Path to JSON config file")

    args = parser.parse_args()

    if args.action == "video-info":
        res = get_video_info(args.path)
        print(json.dumps(res))

    elif args.action == "download-youtube":
        res = download_youtube(args.url, args.output_dir)
        print(json.dumps(res))

    elif args.action == "transcribe":
        res = transcribe_audio(args.path, model_size=args.model)
        print(json.dumps(res))

    elif args.action == "render-clip":
        with open(args.config, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        
        input_vid = cfg["inputVideo"]
        output_vid = cfg["outputVideo"]
        start_t = float(cfg["startTime"])
        end_t = float(cfg["endTime"])
        aspect = cfg.get("aspectRatio", "9:16")
        segments = cfg.get("segments", [])
        burn_subs = cfg.get("burnSubtitles", True)
        style = cfg.get("captionStyle", "viral_yellow")
        font_size = int(cfg.get("fontSize", 28))
        position = cfg.get("captionPosition", "bottom")

        # Generate SRT
        srt_path = str(Path(output_vid).with_suffix(".srt"))
        create_srt_for_clip(segments, srt_path, start_t)

        # Generate ASS for styled burn
        ass_path = str(Path(output_vid).with_suffix(".ass"))
        create_ass_for_clip(segments, ass_path, start_t, style_name=style, font_size=font_size, position=position)

        res = cut_and_reframe(
            input_video=input_vid,
            output_video=output_vid,
            start_time=start_t,
            end_time=end_t,
            aspect_ratio=aspect,
            subtitles_path=ass_path,
            burn_subtitles=burn_subs
        )

        # Also generate thumbnail
        thumb_path = str(Path(output_vid).with_suffix(".jpg"))
        generate_thumbnail(output_vid, thumb_path, time_offset=min(1.0, max(0.1, (end_t - start_t)/2)))

        res["srtPath"] = srt_path
        res["assPath"] = ass_path
        res["thumbPath"] = thumb_path
        print(json.dumps(res))
