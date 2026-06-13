import {
  sowRequiredFieldIds,
  wealthCategories,
  sourceOfFundsQuestions,
  sourceOfFundsDocuments,
  plausibilityChecks,
  redFlags,
  signOffFields,
} from "./sowCatalog";

type AssessmentData = Record<string, unknown>;

export function calculateProgress(data: AssessmentData | undefined): { answered: number; total: number; percentage: number } {
  if (!data) return { answered: 0, total: 1, percentage: 0 };

  let total = 0;
  let answered = 0;

  // 1. Source of Wealth statement (required narrative spine only; the per-mode
  // sections are conditional and intentionally left uncounted so 100% stays
  // reachable when a mode does not apply).
  sowRequiredFieldIds.forEach((fieldId) => {
    total++;
    const v = data[fieldId];
    if (typeof v === "string" ? v.trim().length > 0 : !!v) answered++;
  });

  // 2. Wealth categories
  const applicableCategories = (data["applicableCategories"] as string[]) || [];
  wealthCategories.forEach((cat) => {
    if (applicableCategories.includes(cat.id)) {
      cat.questions.forEach((q) => {
        total++;
        if (data[q.id]) answered++;
      });
      cat.documents.forEach((d) => {
        total++;
        if (data[d.id]) answered++; // Document state selected
      });
    }
  });

  // 3. SOF
  sourceOfFundsQuestions.forEach((q) => {
    total++;
    if (data[q.id]) answered++;
  });
  sourceOfFundsDocuments.forEach((d) => {
    total++;
    if (data[d.id]) answered++;
  });

  // 4. Plausibility
  plausibilityChecks.forEach((c) => {
    total++;
    if (data[c.id]) answered++;
  });

  // 5. Red Flags
  redFlags.forEach((f) => {
    total++;
    if (data[f.id]) answered++;
  });

  // 6. Sign-off
  signOffFields.forEach((f) => {
    total++;
    if (data[f.id]) answered++;
  });

  const percentage = total === 0 ? 0 : Math.round((answered / total) * 100);
  return { answered, total, percentage };
}
