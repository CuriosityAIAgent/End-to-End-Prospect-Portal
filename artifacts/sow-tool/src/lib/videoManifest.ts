// Committed, typed registry of explainer videos.
//
// Each entry maps a stable key (a section/topic id, or the special "overview"
// key used by the Journey home player) to a hosted video asset. Videos are
// produced manually via the video-js artifact (export is a preview-pane action),
// uploaded to object storage, and then served from
// `GET /api/storage/public-objects/<path>`. Until a real asset exists for a key,
// that key is simply absent — every consumer (overview player, per-section "i"
// helpers) degrades gracefully to text-only when `getVideo` returns undefined.
//
// To add a video once exported + uploaded:
//   overview: {
//     title: "How the Source of Wealth journey works",
//     videoUrl: "/api/storage/public-objects/videos/overview.mp4",
//     posterUrl: "/api/storage/public-objects/videos/overview-poster.jpg",
//   }

export interface VideoEntry {
  /** Human-readable title shown in the player chrome. */
  title: string;
  /** Playable video URL (typically a public-objects path or absolute URL). */
  videoUrl: string;
  /** Optional poster frame shown before playback. */
  posterUrl?: string;
}

/**
 * The manifest. Intentionally empty until real, exportable video assets are
 * produced and uploaded. Keys are catalog/section ids plus the special
 * "overview" key.
 */
export const videoManifest: Record<string, VideoEntry> = {};

/** The Journey-home overview player reads this key. */
export const OVERVIEW_VIDEO_KEY = "overview";

/** Returns the video entry for a key, or undefined when none is registered. */
export function getVideo(id: string): VideoEntry | undefined {
  return videoManifest[id];
}

/** Whether a real, playable video exists for a key. */
export function hasVideo(id: string): boolean {
  return !!videoManifest[id]?.videoUrl;
}
