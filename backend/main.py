"""
ClipForge AI - Standalone FastAPI Production Backend
Deployable directly to Render, Railway, Fly.io, or any Docker container.
"""

import os
import shutil
import zipfile
import json
from pathlib import Path
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from processor import (
    get_video_info,
    download_youtube,
    transcribe_audio,
    cut_and_reframe,
    create_srt_for_clip,
    create_ass_for_clip,
    generate_thumbnail
)

app = FastAPI(title="ClipForge AI Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = BASE_DIR / "storage"
JOBS_DIR = STORAGE_DIR / "jobs"
UPLOADS_DIR = STORAGE_DIR / "uploads"
SAMPLES_DIR = STORAGE_DIR / "samples"

for d in [STORAGE_DIR, JOBS_DIR, UPLOADS_DIR, SAMPLES_DIR]:
    d.mkdir(parents=True, exist_ok=True)

class ClipRequest(BaseModel):
    youtube_url: Optional[str] = None
    sample_id: Optional[str] = None
    clip_duration: int = 30
    clip_count: int = 3
    aspect_ratio: str = "9:16"
    caption_style: str = "viral_yellow"
    font_size: int = 28
    caption_position: str = "bottom"
    burn_subtitles: bool = True

@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "ClipForge AI Python Backend",
        "has_gemini_key": bool(os.getenv("GEMINI_API_KEY"))
    }

@app.get("/api/samples")
def get_samples():
    samples = []
    if SAMPLES_DIR.exists():
        for f in SAMPLES_DIR.glob("*.json"):
            try:
                with open(f, "r") as fp:
                    data = json.load(fp)
                    data["videoUrl"] = f"/api/media/samples/{data.get('filename', f.stem + '.mp4')}"
                    samples.append(data)
            except Exception:
                pass
    return {"samples": samples}

@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    job_file = JOBS_DIR / job_id / "job.json"
    if not job_file.exists():
        raise HTTPException(status_code=404, detail="Job not found")
    with open(job_file, "r") as f:
        return json.load(f)

@app.get("/api/jobs/{job_id}/download-all")
def download_all(job_id: str):
    job_file = JOBS_DIR / job_id / "job.json"
    if not job_file.exists():
        raise HTTPException(status_code=404, detail="Job not found")
    
    zip_path = JOBS_DIR / job_id / f"clipforge_{job_id}_all.zip"
    if not zip_path.exists():
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for p in (JOBS_DIR / job_id).glob("*.mp4"):
                zipf.write(p, arcname=p.name)
            for p in (JOBS_DIR / job_id).glob("*.srt"):
                zipf.write(p, arcname=p.name)
                
    return FileResponse(zip_path, filename=f"clipforge_{job_id}_clips.zip", media_type="application/zip")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
