export const CLARITY_SCHEMA_VERSION = "2026-10-15.v3";

export const ANALYSIS_QUESTIONS = [
  { key: "what_changes", label: "What actually changes?" },
  { key: "who_benefits", label: "Who benefits?" },
  { key: "who_pays", label: "Who pays or carries risk?" },
  { key: "support_opposition", label: "Who is backing or opposing it?" },
  { key: "legal_exposure", label: "What could be challenged?" },
  { key: "uncertainty", label: "What remains uncertain?" },
] as const;

export function normalizeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function slugify(value: string) {
  return normalizeName(value).replace(/\s+/g, "-") || "unknown";
}

export function publicEntityType(value: string) {
  return value.replaceAll("_", "-");
}

export function databaseEntityType(value: string | null) {
  return value?.replaceAll("-", "_") ?? null;
}

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const cause =
    error instanceof Error && error.cause instanceof Error
      ? error.cause.message
      : "";
  const combined = `${message}\n${cause}`;

  if (combined.includes("no such table")) {
    return "The civic database migration has not been applied yet.";
  }
  if (combined.includes("D1 binding")) {
    return "The civic database binding is unavailable.";
  }
  // Drizzle's top-level message contains SQL and bound values, while the cause
  // identifies the actual D1 failure. Keep diagnostics useful and bounded.
  return cause ? `Database operation failed: ${cause}` : message;
}
