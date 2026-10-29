# ClipForge AI ⚡

> **AI Video Clip & Shorts Generator** — Convert long YouTube videos and file uploads into viral vertical shorts (9:16, 1:1, 16:9) with AI highlight detection, local Whisper transcription, and burned-in subtitles.

Inspired by industry tools like Opus Clip and EveryGen AI Wizard, ClipForge AI is a full-stack, production-ready application that performs real video processing using local FFmpeg, faster-whisper, and Google Gemini.

---

## 🌟 Key Features

- **Multi-Source Ingestion**:
  - Direct YouTube URL input with automatic audio/video stream download via `yt-dlp`.
  - Drag-and-drop local file upload (`.mp4`, `.mov`, `.webm`, `.mkv`).
  - Built-in curated demo videos for instant 1-click testing.
- **Local Speech Recognition (Free-First)**:
  - Powered by local `faster-whisper` (`tiny` or `base` model running efficiently on CPU).
  - Generates synchronized word-level timestamps without paid third-party transcription APIs.
- **AI Highlight Detection (Google Gemini)**:
  - Analyzes full transcripts to pinpoint the highest-retention hooks, shocking revelations, story climaxes, and educational insights.
  - Returns structured clip boundaries with virality scores (60-99) and editorial reasoning.
- **Pro Video Reframing & Subtitling (FFmpeg)**:
  - **9:16 Vertical Shorts**: Dual-layer Gaussian blur background pillarboxing for professional mobile playback.
  - **1:1 Square & 16:9 Landscape**: Adaptive framing with center focus.
  - **Burned-In Subtitles**: Styled captions with heavy outline (Viral Yellow / MrBeast style, Cyber Purple, Clean White, Boxed Minimal).
  - **Subtitle Customization**: Change font size, position (bottom, center, top), and edit text in-browser with live re-rendering.
- **Export & Delivery**:
  - Individual MP4 download per clip.
  - Individual standard `.srt` subtitle file download.
  - **Download All as ZIP**: Package all generated clips, subtitles, and metadata in one click.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│                   ClipForge AI Frontend                 │
│         (React 19 + TypeScript + Tailwind CSS)         │
└───────────────────────────┬────────────────────────────┘
                            │ REST API / Events
┌───────────────────────────▼────────────────────────────┐
│                    Express / FastAPI                    │
│   • Video probe (ffprobe)                              │
│   • YouTube downloader (yt-dlp)                        │
│   • Local transcription (faster-whisper CPU)           │
│   • AI highlight detection (@google/genai Gemini 3.8)  │
│   • Video cutting & subtitle burning (FFmpeg)          │
│   • Zip archiver & media streaming                     │
└────────────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Python 3.10+
- FFmpeg (with `libass` and `libx264`)
- Google Gemini API key (`GEMINI_API_KEY`)

### 1. Environment Setup

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Add your Gemini API key:
```env
GEMINI_API_KEY="your-gemini-api-key"
PORT=3000
```

### 2. Install Dependencies

```bash
# Node dependencies
npm install

# Python dependencies
pip install -r requirements.txt
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🐳 Docker Deployment

Build the self-contained container:

```bash
docker build -t clipforge-ai .
docker run -p 3000:3000 -e GEMINI_API_KEY="your-gemini-api-key" clipforge-ai
```

### Deploying to Render

1. Create a new **Web Service** on [Render.com](https://render.com).
2. Connect your Git repository.
3. Select **Docker** as the runtime environment.
4. In the **Environment Variables** panel, add:
   - `GEMINI_API_KEY`: Your private Google Gemini API key.
5. Click **Deploy**.

---

## 🔒 Security & Privacy

- `GEMINI_API_KEY` is exclusively consumed on the backend and is never sent to the browser or client bundle.
- Temporary files and rendered clips are organized under unique job folders with sanitization.
- Size and duration constraints are enforced to prevent resource abuse.

---

## 📄 License

Apache-2.0
