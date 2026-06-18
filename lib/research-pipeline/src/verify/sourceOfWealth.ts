// ============================================================================
// Source-of-Wealth verifier
//
// Thin wrapper over the generic section verifier (verify/sections): maps the
// six SoW statement keys into sections and checks them against the source
// material the writer was given. Cross-model on purpose — when Claude writes,
// OpenAI verifies here.
// ============================================================================

import type { SourceOfWealthVerification } from "../types";
import { verifySections } from "./sections";

const SECTION_KEYS = [
  "overview",
  "employment",
  "compensation",
  "assetGrowth",
  "wealthEvents",
  "plausibility",
] as const;

export async function verifySourceOfWealth(args: {
  /** The six drafted sections, keyed bare (overview, employment, …). */
  statement: Record<string, string>;
  /** The exact source text the writer was given (note + coverage + briefing). */
  sourceText: string;
}): Promise<SourceOfWealthVerification | undefined> {
  const sections = SECTION_KEYS.map((key) => ({
    key,
    text: args.statement[key] ?? "",
  }));
  return verifySections(sections, args.sourceText);
}
