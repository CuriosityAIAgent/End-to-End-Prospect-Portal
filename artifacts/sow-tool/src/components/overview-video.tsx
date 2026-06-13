import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, ChevronUp, ChevronDown, X } from "lucide-react";
import { getVideo, OVERVIEW_VIDEO_KEY } from "@/lib/videoManifest";
import { fadeInUp } from "@/lib/motion";

const DISMISS_KEY = "sow.overviewVideo.dismissed";

/**
 * Journey-home explainer player. Reads the special "overview" key from the
 * committed video manifest. When no overview video is registered it renders
 * nothing, so the home page is clean until a real asset exists. When present it
 * is collapsible and dismissible, never autoplays, and never plays sound until
 * the banker presses play (native controls, no `autoPlay`).
 */
export function OverviewVideo() {
  const video = getVideo(OVERVIEW_VIDEO_KEY);
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && window.localStorage.getItem(DISMISS_KEY) === "1",
  );
  const [collapsed, setCollapsed] = useState(false);

  // Graceful fallback: no video registered, or the banker dismissed it.
  if (!video || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore storage failures
    }
  };

  return (
    <motion.section
      initial="hidden"
      animate="show"
      variants={fadeInUp}
      className="border border-border bg-card"
    >
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <Play className="w-4 h-4 text-primary shrink-0" />
          <h2 className="font-serif text-base text-foreground truncate">{video.title}</h2>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand video" : "Collapse video"}
            className="inline-flex items-center justify-center w-7 h-7 text-muted-foreground hover:text-foreground transition-colors"
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss video"
            className="inline-flex items-center justify-center w-7 h-7 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="p-5">
              <video
                controls
                playsInline
                preload="metadata"
                poster={video.posterUrl}
                className="w-full bg-black"
                src={video.videoUrl}
              >
                Your browser does not support embedded video.
              </video>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
