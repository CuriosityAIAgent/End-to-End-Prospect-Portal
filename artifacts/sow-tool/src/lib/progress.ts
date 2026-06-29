import { sowRequiredFieldIds } from "./sowCatalog";

type AssessmentData = Record<string, unknown>;

// Completion now tracks only the Source of Wealth statement — the post-convert
// page's single job. The categories / source-of-funds / plausibility / red-flag
// / sign-off sections were retired (the bank's Connect tool already covers them).
export function calculateProgress(
  data: AssessmentData | undefined,
  opts?: { complete?: boolean },
): { answered: number; total: number; percentage: number } {
  if (!data) return { answered: 0, total: 1, percentage: 0 };

  // A banker-signed-off assessment is 100% by definition — even legacy records
  // that predate the meeting-note step (keeps the bar in step with the rail).
  if (opts?.complete) return { answered: 1, total: 1, percentage: 100 };

  let total = 0;
  let answered = 0;

  sowRequiredFieldIds.forEach((fieldId) => {
    total++;
    const v = data[fieldId];
    if (typeof v === "string" ? v.trim().length > 0 : !!v) answered++;
  });

  // The meeting note is the input the statement is drafted from — still required
  // work on this page, so count it (keeps the bar in step with the journey rail).
  total++;
  const note = (data.fileNote as { note?: string } | undefined)?.note;
  if (typeof note === "string" && note.trim().length > 0) answered++;

  const percentage = total === 0 ? 0 : Math.round((answered / total) * 100);
  return { answered, total, percentage };
}
