import { Router, type IRouter } from "express";
import { speechToText } from "@workspace/integrations-openai-ai-server";
import { TranscribeAudioBody, TranscribeAudioResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// gpt-4o-mini-transcribe accepts these container/extensions. The browser
// MediaRecorder typically yields webm (Chrome/Firefox) or mp4 (Safari).
const ALLOWED_FORMATS = new Set([
  "webm",
  "mp4",
  "m4a",
  "wav",
  "mp3",
  "mpeg",
  "mpga",
  "ogg",
  "oga",
  "aac",
  "flac",
]);

// The transcription model rejects files larger than 25 MB; reject early so we
// never ship an oversized buffer to the provider.
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

router.post("/transcription", async (req, res): Promise<void> => {
  const parsed = TranscribeAudioBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid transcription body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const rawFormat = parsed.data.format.toLowerCase().replace(/[^a-z0-9]/g, "");
  const format = ALLOWED_FORMATS.has(rawFormat) ? rawFormat : "webm";

  let buffer: Buffer;
  try {
    buffer = Buffer.from(parsed.data.audio, "base64");
  } catch {
    res.status(400).json({ error: "The audio clip could not be decoded." });
    return;
  }

  if (buffer.length === 0) {
    res.status(400).json({ error: "The audio clip was empty." });
    return;
  }

  if (buffer.length > MAX_AUDIO_BYTES) {
    res.status(413).json({ error: "The audio clip is too large to transcribe." });
    return;
  }

  try {
    // speechToText only uses `format` to name the upload file's extension; the
    // model infers the container from it. The lib's type union is narrower than
    // the formats the model actually accepts, hence the cast.
    const text = (await speechToText(buffer, format as "webm")).trim();

    if (text.length === 0) {
      req.log.error("Transcription returned empty text");
      res.status(502).json({ error: "The recording could not be transcribed. Please try again." });
      return;
    }

    res.json(TranscribeAudioResponse.parse({ text }));
  } catch (err) {
    req.log.error({ err }, "Audio transcription failed");
    res.status(502).json({ error: "The recording could not be transcribed. Please try again." });
  }
});

export default router;
