export type MysteryErrorCode =
  | "MYSTERY_NO_APPROVED_CONTENT"
  | "MYSTERY_SUPABASE_NOT_CONFIGURED"
  | "MYSTERY_SCHEDULE_UNAVAILABLE"
  | "MYSTERY_BOOTSTRAP_FAILED";

export class MysteryServiceError extends Error {
  readonly code: MysteryErrorCode;
  readonly publicMessage: string;

  constructor(code: MysteryErrorCode, message: string, publicMessage: string) {
    super(message);
    this.name = "MysteryServiceError";
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

export const MYSTERY_PUBLIC_UNAVAILABLE =
  "The Chronicle is being prepared. Please return shortly.";
