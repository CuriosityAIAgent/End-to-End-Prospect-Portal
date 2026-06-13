// Shared motion system for the SoW tool.
//
// Keep motion restrained and institutional: short, eased fades and small
// vertical lifts — nothing bouncy. All animation is wrapped at the app root in
// <MotionConfig reducedMotion="user"> (see App.tsx), so when the visitor has
// "prefers-reduced-motion: reduce" set, Framer Motion automatically drops the
// transform/position changes and only opacity remains. These variants are
// authored so they still read correctly in that reduced state.

import type { Variants, Transition } from "framer-motion";

/** Default easing — a calm, slightly decelerating curve. */
export const EASE_OUT: Transition["ease"] = [0.22, 1, 0.36, 1];

export const DURATION = {
  fast: 0.18,
  base: 0.32,
  slow: 0.5,
} as const;

/** Simple opacity fade. */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DURATION.base, ease: EASE_OUT } },
};

/** Fade combined with a small upward lift. */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
};

/** Fade with a gentle scale — for cards and panels. */
export const fadeInScale: Variants = {
  hidden: { opacity: 0, scale: 0.985 },
  show: { opacity: 1, scale: 1, transition: { duration: DURATION.base, ease: EASE_OUT } },
};

/**
 * Container that staggers its children in sequence. Pair with `fadeInUp` (or
 * any item variant) on the children.
 */
export const staggerContainer = (stagger = 0.06, delayChildren = 0): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren: stagger, delayChildren },
  },
});

/** Convenience props for a one-shot entrance on mount. */
export const entrance = (variants: Variants = fadeInUp) => ({
  initial: "hidden" as const,
  animate: "show" as const,
  variants,
});

/** Convenience props for an entrance triggered when scrolled into view. */
export const entranceInView = (variants: Variants = fadeInUp) => ({
  initial: "hidden" as const,
  whileInView: "show" as const,
  viewport: { once: true, margin: "-60px" },
  variants,
});
