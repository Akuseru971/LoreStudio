export type PreviewNotifyAnalyticsContext = {
  bookId?: string | null;
  generationStatus?: string | null;
  freePreviewReady?: boolean;
  elapsedSecondsSinceGenerationStart?: number | null;
  hasPreviewNotificationEmail?: boolean;
  page1Ready?: boolean;
  page2Ready?: boolean;
  previewCoverReady?: boolean;
  reason?: string | null;
};

export function toPreviewNotifyAnalyticsProps(context?: PreviewNotifyAnalyticsContext) {
  const properties: Record<string, string | number | boolean> = {};

  if (context?.bookId) {
    properties.bookId = context.bookId;
  }

  if (context?.generationStatus) {
    properties.generationStatus = context.generationStatus;
  }

  if (context?.freePreviewReady !== undefined) {
    properties.freePreviewReady = context.freePreviewReady;
  }

  if (context?.elapsedSecondsSinceGenerationStart != null) {
    properties.elapsedSecondsSinceGenerationStart = context.elapsedSecondsSinceGenerationStart;
  }

  if (context?.hasPreviewNotificationEmail !== undefined) {
    properties.hasPreviewNotificationEmail = context.hasPreviewNotificationEmail;
  }

  if (context?.page1Ready !== undefined) {
    properties.page1Ready = context.page1Ready;
  }

  if (context?.page2Ready !== undefined) {
    properties.page2Ready = context.page2Ready;
  }

  if (context?.previewCoverReady !== undefined) {
    properties.previewCoverReady = context.previewCoverReady;
  }

  if (context?.reason) {
    properties.reason = context.reason;
  }

  return properties;
}

export function classifyPreviewNotifyEmailFailureReason(errorMessage: string) {
  const normalized = errorMessage.toLowerCase();

  if (normalized.includes("valid email")) {
    return "invalid_email";
  }

  if (normalized.includes("schema")) {
    return "schema_error";
  }

  return "backend_error";
}
