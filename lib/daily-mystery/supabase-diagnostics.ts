import "server-only";

export function logSupabaseSchemaError(error: unknown, table: string) {
  const message = error instanceof Error ? error.message : String(error);
  const errorCode =
    error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : undefined;

  if (
    !message.includes("schema cache") &&
    errorCode !== "PGRST204" &&
    errorCode !== "42P01" &&
    !message.includes("Could not find the table") &&
    !message.includes("column")
  ) {
    return;
  }

  const missingColumnMatch = message.match(/column ['"]?([^'"\s]+)['"]?/i);
  console.info("[DAILY_MYSTERY_SCHEMA_ERROR]", {
    table,
    missingColumn: missingColumnMatch?.[1] ?? null,
    errorCode: errorCode ?? null,
  });
}
