import { useState } from "react";
import { useVoiceRecorder } from "@workspace/integrations-openai-ai-react";
import { useTranscribeAudio } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mic, Square, Loader2, AlertCircle } from "lucide-react";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // readAsDataURL yields "data:<mime>;base64,<data>" — strip the prefix.
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** "audio/webm;codecs=opus" -> "webm"; falls back to "webm". */
function formatFromMime(type: string): string {
  return type.split("/")[1]?.split(";")[0]?.trim().toLowerCase() || "webm";
}

/**
 * A mic button that records a voice note, transcribes it server-side, and hands
 * the resulting text to `onTranscript`. Designed to sit beside a textarea.
 */
export function VoiceInput({
  onTranscript,
  disabled,
  className,
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const { state, startRecording, stopRecording } = useVoiceRecorder();
  const transcribe = useTranscribeAudio();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRecording = state === "recording";
  const isTranscribing = transcribe.isPending || busy;

  const handleStart = async () => {
    setError(null);
    try {
      await startRecording();
    } catch {
      setError("Microphone access was blocked. Check your browser permissions.");
    }
  };

  const handleStop = async () => {
    setBusy(true);
    setError(null);
    try {
      const blob = await stopRecording();
      if (blob.size === 0) {
        setError("Nothing was recorded. Try again.");
        return;
      }
      const audio = await blobToBase64(blob);
      const result = await transcribe.mutateAsync({
        data: { audio, format: formatFromMime(blob.type) },
      });
      const text = result.text.trim();
      if (text.length === 0) {
        setError("The recording could not be transcribed. Try again.");
        return;
      }
      onTranscript(text);
    } catch {
      setError("The recording could not be transcribed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {isRecording ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleStop}
          className="rounded-md border-destructive/50 text-destructive hover:bg-destructive/5 h-8"
        >
          <Square className="w-3.5 h-3.5 mr-2 fill-current" /> Stop &amp; transcribe
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleStart}
          disabled={disabled || isTranscribing}
          className="rounded-md border-border hover:bg-secondary h-8"
        >
          {isTranscribing ? (
            <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Transcribing…</>
          ) : (
            <><Mic className="w-3.5 h-3.5 mr-2" /> Dictate</>
          )}
        </Button>
      )}
      {isRecording && (
        <span className="text-xs text-destructive flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-destructive" />
          Recording…
        </span>
      )}
      {error && (
        <span className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </span>
      )}
    </div>
  );
}
