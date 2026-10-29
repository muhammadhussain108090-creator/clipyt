import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function main() {
  const samplesDir = path.resolve("storage/samples");
  fs.mkdirSync(samplesDir, { recursive: true });

  const sampleVideoPath = path.join(samplesDir, "sample_ai_growth.mp4");
  if (fs.existsSync(sampleVideoPath)) {
    console.log("Sample video already exists:", sampleVideoPath);
    return;
  }

  console.log("Generating realistic sample audio with Gemini TTS...");
  const speechScript = 
    "Here is the brutal truth about building content in 2026. " +
    "Ninety-five percent of creators fail because they treat every platform the exact same way. " +
    "If you want to explode your reach, you must master the micro-hook. " +
    "The first two seconds decide whether someone watches your video or scrolls forever. " +
    "Stop wasting time on slow introductions. Hit them with a bold statement, deliver immediate value, " +
    "and end with an open loop that keeps them wanting more.";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash-lite-tts",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: speechScript,
              speechMetadata: {
                style: "Energetic, clear, authoritative keynote speaker",
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Puck" },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio returned from Gemini TTS");
    }

    const wavPath = path.join(samplesDir, "speech.wav");
    fs.writeFileSync(wavPath, Buffer.from(base64Audio, "base64"));
    console.log("Saved speech.wav, duration checking...");

    // Get duration of the audio
    const durationStr = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${wavPath}"`
    ).toString().trim();
    const duration = parseFloat(durationStr) || 28.0;
    console.log("Audio duration:", duration, "seconds");

    // Generate high-resolution 1920x1080 video with modern purple-dark gradient & animated elements
    console.log("Generating visual video track with ffmpeg...");
    const cmd = `ffmpeg -y -f lavfi -i "gradients=s=1920x1080:r=30:c0=0x180b38:c1=0x4c1d95:x0=0:y0=0:x1=1920:y1=1080:speed=0.005" -i "${wavPath}" -t ${duration} -filter_complex "[0:v]drawbox=x=80:y=80:w=1760:h=920:color=0x8b5cf6@0.15:t=fill,drawbox=x=80:y=80:w=1760:h=920:color=0xc084fc@0.4:t=3,drawtext=text='CLIPFORGE AI MASTERCLASS':fontcolor=0xa855f7:fontsize=36:x=120:y=120,drawtext=text='The Micro-Hook Playbook for 2026':fontcolor=white:fontsize=64:x=120:y=180,drawtext=text='Alex Vance • Viral Growth Strategist':fontcolor=0x94a3b8:fontsize=32:x=120:y=270,drawbox=x=120:y=340:w=1680:h=4:color=0x8b5cf6@0.5:t=fill,drawtext=text='Mastering Short-Form Retention & Visual Hooks':fontcolor=0xe2e8f0:fontsize=44:x=(w-text_w)/2:y=(h-text_h)/2+60[v]" -map "[v]" -map 1:a -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac "${sampleVideoPath}"`;

    execSync(cmd, { stdio: "inherit" });
    console.log("Sample video generated successfully at:", sampleVideoPath);

    // Save metadata
    fs.writeFileSync(
      path.join(samplesDir, "sample_ai_growth.json"),
      JSON.stringify(
        {
          id: "sample_ai_growth",
          title: "The Micro-Hook Playbook (Viral Growth)",
          author: "Alex Vance",
          duration: Math.round(duration),
          description: "Keynote presentation on short-form video hooks, audience retention, and the first 2 seconds.",
          transcript: speechScript,
        },
        null,
        2
      )
    );
  } catch (err) {
    console.error("Error creating sample with TTS:", err);
    // Fallback: create sample with synthesized sine tone and spoken audio fallback if needed
  }
}

main();
