import { useState } from "react";
import { Info, Play, FileText } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getHelp } from "@/lib/helpCatalog";
import { getVideo } from "@/lib/videoManifest";

/**
 * The per-section "i" helper. Always shows authored guidance text for the given
 * help id; when a video is registered in the manifest for the same id, it also
 * offers a "Watch" toggle that swaps the body for an inline player. With no
 * manifest entry (the default), it is a clean text-only popover.
 */
export function SectionInfo({ id, className = "" }: { id: string; className?: string }) {
  const help = getHelp(id);
  const video = getVideo(id);
  const [showVideo, setShowVideo] = useState(false);

  // Nothing authored for this id — render nothing rather than an empty button.
  if (!help) return null;

  return (
    <Popover onOpenChange={(open) => !open && setShowVideo(false)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`About ${help.title}`}
          className={`inline-flex items-center justify-center w-6 h-6 rounded-full border border-border text-muted-foreground hover:text-primary hover:border-primary/60 transition-colors print:hidden ${className}`}
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[340px] rounded-none border-border bg-card p-0"
      >
        <div className="border-b border-border px-4 py-3 flex items-center justify-between gap-2">
          <h4 className="font-serif text-base text-foreground">{help.title}</h4>
          {video && (
            <button
              type="button"
              onClick={() => setShowVideo((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline shrink-0"
            >
              {showVideo ? (
                <>
                  <FileText className="w-3.5 h-3.5" /> Read
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" /> Watch
                </>
              )}
            </button>
          )}
        </div>

        <div className="px-4 py-3">
          {showVideo && video ? (
            <video
              controls
              playsInline
              poster={video.posterUrl}
              className="w-full bg-black"
              src={video.videoUrl}
            >
              Your browser does not support embedded video.
            </video>
          ) : (
            <div className="space-y-2.5">
              {help.body.map((para, i) => (
                <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                  {para}
                </p>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
