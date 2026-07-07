export function isSupabaseSchemaError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  return (
    normalized.includes("schema cache") ||
    normalized.includes("could not find the") ||
    (normalized.includes("column") && normalized.includes("does not exist"))
  );
}

export function getSupabaseSchemaErrorMessage() {
  return "Database schema is out of date. Apply the latest Supabase migrations, including 013_preview_ready_email.sql for preview notification emails.";
}

export function getSafeApiErrorMessage(error: unknown, fallback: string) {
  if (isSupabaseSchemaError(error)) {
    return getSupabaseSchemaErrorMessage();
  }

  return error instanceof Error ? error.message : fallback;
}
