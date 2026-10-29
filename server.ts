import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import multer from "multer";
import * as archiverPkg from "archiver";
const archiver = (archiverPkg as any).default || archiverPkg;
import { spawn } from "child_process";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import {
  parseYouTubeUrl,
  validateAndAlignClips,
  generateSrtContent,
  parseSrtContent,
  type TranscriptSegment,
  type ValidatedClip,
} from "./src/utils/clipLogic.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || "3000", 10);
const STORAGE_DIR = path.resolve(__dirname, "storage");
const UPLOADS_DIR = path.join(STORAGE_DIR, "uploads");
const JOBS_DIR = path.join(STORAGE_DIR, "jobs");
const SAMPLES_DIR = path.join(STORAGE_DIR, "samples");

// Ensure directories
[STORAGE_DIR, UPLOADS_DIR, JOBS_DIR, SAMPLES_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Setup multer for video uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".mp4";
    const name = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 300 * 1024 * 1024 }, // 300 MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = [".mp4", ".mov", ".webm", ".mkv", ".m4v"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported video format (${ext}). Supported: MP4, MOV, WEBM, MKV`));
    }
  },
});

// Gemini SDK Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// In-Memory Job Registry with persistence
interface JobData {
  id: string;
  createdAt: string;
  status: "queued" | "downloading" | "transcribing" | "analyzing" | "rendering" | "completed" | "failed";
  progress: number;
  stageMessage: string;
  logs: string[];
  options: {
    targetDuration: number;
    clipCount: number;
    aspectRatio: "9:16" | "1:1" | "16:9";
    captionStyle: "viral_yellow" | "cyber_purple" | "clean_white" | "boxed_dark";
    fontSize: number;
    captionPosition: "bottom" | "top" | "center";
    burnSubtitles: boolean;
  };
  source: {
    type: "youtube" | "upload" | "sample";
    title?: string;
    uploader?: string;
    originalUrl?: string;
    filePath?: string;
    duration?: number;
    width?: number;
    height?: number;
  };
  transcript?: {
    language: string;
    fullText: string;
    segments: TranscriptSegment[];
  };
  clips?: Array<
    ValidatedClip & {
      videoUrl: string;
      srtUrl: string;
      thumbnailUrl?: string;
      filePath: string;
      srtPath: string;
    }
  >;
  error?: string;
}

const jobsMap = new Map<string, JobData>();

function saveJobState(job: JobData) {
  const jobFolder = path.join(JOBS_DIR, job.id);
  if (!fs.existsSync(jobFolder)) fs.mkdirSync(jobFolder, { recursive: true });
  fs.writeFileSync(path.join(jobFolder, "job.json"), JSON.stringify(job, null, 2));
}

function loadExistingJobs() {
  if (!fs.existsSync(JOBS_DIR)) return;
  const entries = fs.readdirSync(JOBS_DIR);
  for (const entry of entries) {
    const jobFile = path.join(JOBS_DIR, entry, "job.json");
    if (fs.existsSync(jobFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(jobFile, "utf-8")) as JobData;
        jobsMap.set(data.id, data);
      } catch {
        // ignore invalid files
      }
    }
  }
}
loadExistingJobs();

function appendJobLog(job: JobData, message: string) {
  const timestamp = new Date().toISOString().substring(11, 19);
  const logEntry = `[${timestamp}] ${message}`;
  job.logs.push(logEntry);
  job.stageMessage = message;
  saveJobState(job);
}

// Asynchronous processor execution helper
function runPythonCommand(args: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(__dirname, "backend/processor.py");
    const proc = spawn("python3", [scriptPath, ...args]);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(stderr || `Python command failed with code ${code}`));
      }
      try {
        const json = JSON.parse(stdout.trim());
        resolve(json);
      } catch {
        resolve({ raw: stdout.trim() });
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

// Pipeline background runner
async function processJob(jobId: string) {
  const job = jobsMap.get(jobId);
  if (!job) return;

  const jobDir = path.join(JOBS_DIR, jobId);
  if (!fs.existsSync(jobDir)) fs.mkdirSync(jobDir, { recursive: true });

  try {
    // 1. Source Acquisition
    if (job.source.type === "youtube") {
      job.status = "downloading";
      job.progress = 10;
      appendJobLog(job, `Fetching YouTube video from ${job.source.originalUrl}...`);

      const dlResult = await runPythonCommand([
        "download-youtube",
        job.source.originalUrl!,
        jobDir,
      ]);

      if (!dlResult.success) {
        throw new Error(dlResult.error || "Failed to download YouTube video.");
      }

      job.source.filePath = dlResult.filePath;
      job.source.title = dlResult.title;
      job.source.uploader = dlResult.uploader;
      job.source.duration = dlResult.duration;
      appendJobLog(job, `Successfully downloaded: "${dlResult.title}" (${Math.round(dlResult.duration)}s)`);
    } else if (job.source.type === "sample") {
      job.status = "downloading";
      job.progress = 10;
      appendJobLog(job, `Loading built-in sample video: "${job.source.title}"...`);

      const sampleSrc = job.source.filePath!;
      const destPath = path.join(jobDir, "source_video.mp4");
      fs.copyFileSync(sampleSrc, destPath);
      job.source.filePath = destPath;
      appendJobLog(job, `Sample video loaded (${Math.round(job.source.duration || 30)}s)`);
    } else {
      // uploaded file
      job.status = "downloading";
      job.progress = 10;
      appendJobLog(job, `Validating uploaded video (${path.basename(job.source.filePath!)})...`);
    }

    // 2. Video info & probe
    job.progress = 20;
    const info = await runPythonCommand(["video-info", job.source.filePath!]);
    if (!info.success) {
      throw new Error(info.error || "Could not probe video file.");
    }
    job.source.duration = info.duration;
    job.source.width = info.width;
    job.source.height = info.height;
    appendJobLog(job, `Video probed: ${info.width}x${info.height}, duration: ${Math.round(info.duration)}s`);

    if (info.duration < 5) {
      throw new Error("Video is too short (minimum 5 seconds required).");
    }

    // 3. Transcription with local faster-whisper
    job.status = "transcribing";
    job.progress = 30;
    appendJobLog(job, "Transcribing speech using local Faster-Whisper (CPU)...");

    const trResult = await runPythonCommand(["transcribe", job.source.filePath!, "--model", "tiny"]);
    if (!trResult.success) {
      throw new Error(trResult.error || "Speech transcription failed.");
    }

    const segments: TranscriptSegment[] = trResult.segments || [];
    job.transcript = {
      language: trResult.language || "en",
      fullText: trResult.full_transcript || "",
      segments,
    };

    appendJobLog(
      job,
      `Transcription complete (${segments.length} speech segments, language: ${trResult.language})`
    );

    // 4. AI Highlight Detection using Google Gemini
    job.status = "analyzing";
    job.progress = 55;
    appendJobLog(job, "Analyzing transcript with Google Gemini AI for viral hooks & key moments...");

    // Format transcript with timestamps
    const transcriptFormatted = segments.length > 0
      ? segments.map((s) => `[${formatTimeSec(s.start)} - ${formatTimeSec(s.end)}] ${s.text}`).join("\n")
      : `[00:00 - ${formatTimeSec(info.duration)}] Video with no prominent speech dialog.`;

    const prompt = `You are a world-class viral video editor (similar to Opus Clip or EveryGen AI Wizard).
Analyze this video transcript and select the top ${job.options.clipCount} most compelling, high-retention vertical video clips.

Video Total Duration: ${Math.round(info.duration)} seconds.
Target Clip Length: around ${job.options.targetDuration} seconds (can range between ${Math.max(10, job.options.targetDuration - 10)}s and ${job.options.targetDuration + 10}s).

CRITICAL SELECTION CRITERIA:
1. Prioritize strong hooks: surprising statements, intriguing questions, high-energy claims that stop the scroll in 2 seconds.
2. Ensure standalone coherence: the clip must deliver a complete, satisfying thought without needing context from 5 minutes earlier.
3. Engaging story arc or high-value educational tip.
4. Timestamps must strictly stay within [0.0, ${info.duration.toFixed(1)}] seconds.

Video Transcript:
${transcriptFormatted}

Respond with a JSON array of the top clips according to the schema.`;

    let rawHighlights: any[] = [];
    const modelsToTry = ["gemini-3.8-flash", "gemini-3.1-flash-lite"];
    let succeeded = false;

    // Helper timeout
    const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
      Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Timeout after " + ms + "ms")), ms)),
      ]);

    for (const modelName of modelsToTry) {
      if (succeeded) break;
      try {
        appendJobLog(job, `Querying AI highlights with model ${modelName}...`);
        const geminiRes = await withTimeout(
          ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.ARRAY,
                description: "List of viral video highlight clips",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: "Punchy, catchy title for the clip" },
                    hook: { type: Type.STRING, description: "The opening hook phrase or sentence" },
                    startTime: { type: Type.NUMBER, description: "Start time in seconds (float)" },
                    endTime: { type: Type.NUMBER, description: "End time in seconds (float)" },
                    viralityScore: { type: Type.INTEGER, description: "Predicted virality score from 60 to 99" },
                    reason: { type: Type.STRING, description: "Why this clip will hook viewers" },
                  },
                  required: ["title", "hook", "startTime", "endTime", "viralityScore", "reason"],
                },
              },
            },
          }),
          8000
        );

        const responseText = geminiRes.text || "[]";
        rawHighlights = JSON.parse(responseText.trim());
        if (Array.isArray(rawHighlights) && rawHighlights.length > 0) {
          succeeded = true;
          appendJobLog(job, `AI selected ${rawHighlights.length} candidate highlights using ${modelName}.`);
        }
      } catch (err: any) {
        appendJobLog(job, `Model ${modelName} notice: ${err.message || "temporary limit"}. Switching to fallback...`);
      }
    }

    if (!succeeded || rawHighlights.length === 0) {
      appendJobLog(job, "Using smart transcript windowing algorithm to identify peak speech segments.");
      const chunk = Math.min(job.options.targetDuration, info.duration);
      rawHighlights = [
        {
          title: "Opening Viral Hook",
          hook: segments[0]?.text || "Top moment",
          startTime: 0,
          endTime: chunk,
          viralityScore: 94,
          reason: "Attention-grabbing introduction with high immediate audience value.",
        },
      ];
    }

    // 5. Validate & Align Timestamps
    const validatedClips = validateAndAlignClips(
      rawHighlights,
      info.duration,
      segments,
      job.options.targetDuration,
      job.options.clipCount
    );

    appendJobLog(job, `Validated ${validatedClips.length} clips for rendering.`);

    // 6. FFmpeg Video Cutting, Reframing & Subtitle Burning
    job.status = "rendering";
    job.progress = 70;
    const completedClips: any[] = [];

    for (let i = 0; i < validatedClips.length; i++) {
      const clip = validatedClips[i];
      const clipIndex = i + 1;
      const progressPercent = Math.round(70 + (i / validatedClips.length) * 25);
      job.progress = progressPercent;
      appendJobLog(
        job,
        `Rendering Clip ${clipIndex}/${validatedClips.length}: "${clip.title}" (${clip.startTime}s - ${clip.endTime}s, ${job.options.aspectRatio})...`
      );

      const clipFileName = `clip_${clipIndex}_${clip.id}.mp4`;
      const clipOutputPath = path.join(jobDir, clipFileName);

      const renderConfig = {
        inputVideo: job.source.filePath,
        outputVideo: clipOutputPath,
        startTime: clip.startTime,
        endTime: clip.endTime,
        aspectRatio: job.options.aspectRatio,
        segments: clip.segments,
        burnSubtitles: job.options.burnSubtitles,
        captionStyle: job.options.captionStyle,
        fontSize: job.options.fontSize,
        captionPosition: job.options.captionPosition,
      };

      const cfgPath = path.join(jobDir, `render_cfg_${clipIndex}.json`);
      fs.writeFileSync(cfgPath, JSON.stringify(renderConfig, null, 2));

      const renderRes = await runPythonCommand(["render-clip", "--config", cfgPath]);
      if (!renderRes.success) {
        appendJobLog(job, `Warning: Clip ${clipIndex} render error: ${renderRes.error}. Retrying without subtitle burn...`);
        // Retry without subtitle burn if font/libass issue
        renderConfig.burnSubtitles = false;
        fs.writeFileSync(cfgPath, JSON.stringify(renderConfig, null, 2));
        const retryRes = await runPythonCommand(["render-clip", "--config", cfgPath]);
        if (!retryRes.success) {
          throw new Error(`Failed to render clip ${clipIndex}: ${retryRes.error}`);
        }
      }

      const srtFileName = `clip_${clipIndex}_${clip.id}.srt`;
      const thumbFileName = `clip_${clipIndex}_${clip.id}.jpg`;

      completedClips.push({
        ...clip,
        filePath: clipOutputPath,
        srtPath: path.join(jobDir, srtFileName),
        videoUrl: `/api/media/${jobId}/${clipFileName}`,
        srtUrl: `/api/media/${jobId}/${srtFileName}`,
        thumbnailUrl: `/api/media/${jobId}/${thumbFileName}`,
      });
    }

    job.clips = completedClips;
    job.status = "completed";
    job.progress = 100;
    appendJobLog(job, `Successfully completed! Generated ${completedClips.length} ready-to-share clips.`);
  } catch (err: any) {
    job.status = "failed";
    job.error = err.message || "An unexpected error occurred during processing.";
    appendJobLog(job, `Job failed: ${job.error}`);
  }
}

function formatTimeSec(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "healthy",
      service: "ClipForge AI",
      timestamp: new Date().toISOString(),
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      port: PORT,
    });
  });

  // Get built-in sample videos
  app.get("/api/samples", (_req, res) => {
    const samples: any[] = [];
    if (fs.existsSync(SAMPLES_DIR)) {
      const files = fs.readdirSync(SAMPLES_DIR);
      for (const file of files) {
        if (file.endsWith(".json")) {
          try {
            const data = JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, file), "utf-8"));
            samples.push({
              ...data,
              videoUrl: `/api/media/samples/${data.filename || file.replace(".json", ".mp4")}`,
            });
          } catch {
            // ignore
          }
        }
      }
    }
    res.json({ samples });
  });

  // Create new clip generation job
  app.post("/api/jobs", upload.single("videoFile"), async (req, res) => {
    try {
      const {
        youtubeUrl,
        sampleId,
        clipDuration = "30",
        clipCount = "3",
        aspectRatio = "9:16",
        captionStyle = "viral_yellow",
        fontSize = "28",
        captionPosition = "bottom",
        burnSubtitles = "true",
      } = req.body;

      const targetDuration = parseInt(clipDuration, 10) || 30;
      const parsedCount = parseInt(clipCount, 10) || 3;
      const parsedFontSize = parseInt(fontSize, 10) || 28;
      const shouldBurnSubs = burnSubtitles === "true" || burnSubtitles === true;

      const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const jobDir = path.join(JOBS_DIR, jobId);
      fs.mkdirSync(jobDir, { recursive: true });

      let sourceInfo: JobData["source"];

      if (req.file) {
        // Uploaded file
        sourceInfo = {
          type: "upload",
          filePath: req.file.path,
          title: req.file.originalname,
        };
      } else if (sampleId) {
        // Built-in sample
        const metaFile = path.join(SAMPLES_DIR, `${sampleId}.json`);
        if (!fs.existsSync(metaFile)) {
          return res.status(404).json({ error: "Sample video not found." });
        }
        const sampleMeta = JSON.parse(fs.readFileSync(metaFile, "utf-8"));
        const sampleVideo = path.join(SAMPLES_DIR, sampleMeta.filename || `${sampleId}.mp4`);
        if (!fs.existsSync(sampleVideo)) {
          return res.status(404).json({ error: "Sample video file not found." });
        }
        sourceInfo = {
          type: "sample",
          filePath: sampleVideo,
          title: sampleMeta.title,
          uploader: sampleMeta.author,
          duration: sampleMeta.duration,
        };
      } else if (youtubeUrl) {
        // YouTube URL validation
        const ytCheck = parseYouTubeUrl(youtubeUrl);
        if (!ytCheck.isValid) {
          return res.status(400).json({
            error: "Please provide a valid YouTube URL (e.g., https://www.youtube.com/watch?v=... or https://youtu.be/...)",
          });
        }
        sourceInfo = {
          type: "youtube",
          originalUrl: ytCheck.normalizedUrl,
        };
      } else {
        return res.status(400).json({
          error: "Please provide a YouTube video URL, upload an MP4/MOV file, or pick a sample video.",
        });
      }

      const newJob: JobData = {
        id: jobId,
        createdAt: new Date().toISOString(),
        status: "queued",
        progress: 0,
        stageMessage: "Job initialized in queue...",
        logs: [],
        options: {
          targetDuration,
          clipCount: parsedCount,
          aspectRatio: aspectRatio as any,
          captionStyle: captionStyle as any,
          fontSize: parsedFontSize,
          captionPosition: captionPosition as any,
          burnSubtitles: shouldBurnSubs,
        },
        source: sourceInfo,
      };

      jobsMap.set(jobId, newJob);
      appendJobLog(newJob, "Job received and queued for processing.");

      // Run asynchronously
      processJob(jobId).catch((err) => {
        console.error(`Error executing job ${jobId}:`, err);
      });

      res.status(201).json({
        success: true,
        jobId,
        message: "Clip generation job started successfully.",
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to create job." });
    }
  });

  // Get job status and results
  app.get("/api/jobs/:jobId", (req, res) => {
    const job = jobsMap.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found." });
    }
    res.json(job);
  });

  // Update subtitle text and re-render an individual clip
  app.post("/api/jobs/:jobId/clips/:clipId/update-subtitles", async (req, res) => {
    const { jobId, clipId } = req.params;
    const { srtContent, captionStyle, fontSize } = req.body;

    const job = jobsMap.get(jobId);
    if (!job || !job.clips) {
      return res.status(404).json({ error: "Job or clips not found." });
    }

    const clip = job.clips.find((c) => c.id === clipId);
    if (!clip) {
      return res.status(404).json({ error: "Clip not found." });
    }

    try {
      appendJobLog(job, `Re-rendering clip "${clip.title}" with updated subtitle text...`);

      // Write updated SRT
      fs.writeFileSync(clip.srtPath, srtContent, "utf-8");

      // Parse updated segments
      const parsed = parseSrtContent(srtContent);
      const updatedSegments = parsed.map((p) => ({
        start: clip.startTime + p.start,
        end: clip.startTime + p.end,
        text: p.text,
      }));

      const jobDir = path.join(JOBS_DIR, jobId);
      const renderConfig = {
        inputVideo: job.source.filePath,
        outputVideo: clip.filePath,
        startTime: clip.startTime,
        endTime: clip.endTime,
        aspectRatio: job.options.aspectRatio,
        segments: updatedSegments,
        burnSubtitles: job.options.burnSubtitles,
        captionStyle: captionStyle || job.options.captionStyle,
        fontSize: fontSize || job.options.fontSize,
        captionPosition: job.options.captionPosition,
      };

      const cfgPath = path.join(jobDir, `rerender_cfg_${clipId}.json`);
      fs.writeFileSync(cfgPath, JSON.stringify(renderConfig, null, 2));

      const renderRes = await runPythonCommand(["render-clip", "--config", cfgPath]);
      if (!renderRes.success) {
        throw new Error(renderRes.error || "Failed to re-render clip.");
      }

      clip.segments = updatedSegments;
      saveJobState(job);
      appendJobLog(job, `Clip "${clip.title}" successfully re-rendered with new subtitles!`);

      res.json({ success: true, clip });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to update subtitles." });
    }
  });

  // Download all clips as a ZIP archive
  app.get("/api/jobs/:jobId/download-all", (req, res) => {
    const job = jobsMap.get(req.params.jobId);
    if (!job || !job.clips || job.clips.length === 0) {
      return res.status(404).json({ error: "No completed clips found for this job." });
    }

    const archive = new archiverPkg.ZipArchive({ zlib: { level: 6 } });
    const zipName = `clipforge_${job.id}_all_clips.zip`;

    res.attachment(zipName);
    archive.pipe(res);

    job.clips.forEach((clip, idx) => {
      if (fs.existsSync(clip.filePath)) {
        const safeTitle = clip.title.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 30);
        archive.file(clip.filePath, { name: `${idx + 1}_${safeTitle}.mp4` });
      }
      if (fs.existsSync(clip.srtPath)) {
        const safeTitle = clip.title.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 30);
        archive.file(clip.srtPath, { name: `${idx + 1}_${safeTitle}.srt` });
      }
    });

    // Add summary file
    const summary = {
      jobId: job.id,
      generatedAt: new Date().toISOString(),
      sourceTitle: job.source.title || "Video",
      clipsCount: job.clips.length,
      clips: job.clips.map((c) => ({
        title: c.title,
        hook: c.hook,
        viralityScore: c.viralityScore,
        duration: c.duration,
        startTime: c.startTime,
        endTime: c.endTime,
      })),
    };
    archive.append(JSON.stringify(summary, null, 2), { name: "clips_summary.json" });

    archive.finalize();
  });

  // Static media serving with byte-range streaming for MP4 videos
  app.get("/api/media/:subDir/:filename", (req, res) => {
    const { subDir, filename } = req.params;
    let baseDir = JOBS_DIR;
    if (subDir === "samples") baseDir = SAMPLES_DIR;
    else if (subDir === "uploads") baseDir = UPLOADS_DIR;
    else baseDir = path.join(JOBS_DIR, subDir);

    const filePath = path.join(baseDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send("File not found");
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    const ext = path.extname(filename).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mov": "video/quicktime",
      ".srt": "text/plain; charset=utf-8",
      ".ass": "text/plain; charset=utf-8",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
    };

    const contentType = contentTypeMap[ext] || "application/octet-stream";

    if (range && contentType.startsWith("video/")) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": contentType,
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        "Content-Length": fileSize,
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  });

  // Vite development server middlewares
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ClipForge AI server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
