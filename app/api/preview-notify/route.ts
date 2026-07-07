import { NextResponse } from "next/server";
import { getBookByAccessToken, savePreviewNotificationRequest } from "@/lib/bookStore";
import { resumeFreePreviewGeneration } from "@/lib/resumeFreePreviewGeneration";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import { getSafeApiErrorMessage } from "@/lib/supabaseErrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getAppBaseUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (appUrl) {
    return appUrl;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

function scheduleBackgroundFreePreviewResume(accessToken: string) {
  const fulfillmentSecret = process.env.INTERNAL_FULFILLMENT_SECRET;
  const baseUrl = getAppBaseUrl();

  if (!fulfillmentSecret) {
    console.warn("[PREVIEW_NOTIFY_BACKGROUND_RESUME_FALLBACK_INLINE]", { accessToken });
    void resumeFreePreviewGeneration(accessToken).catch((error) => {
      console.error("[PREVIEW_NOTIFY_BACKGROUND_RESUME_ERROR]", { accessToken, error });
    });
    return;
  }

  void fetch(`${baseUrl}/api/internal/resume-free-preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-fulfillment-secret": fulfillmentSecret,
    },
    body: JSON.stringify({ accessToken }),
  })
    .then(async (response) => {
      const result = await response.json().catch(() => ({}));
      console.log("[PREVIEW_NOTIFY_BACKGROUND_RESUME_DISPATCHED]", {
        accessToken,
        ok: response.ok,
        status: response.status,
        result,
      });
    })
    .catch((error) => {
      console.error("[PREVIEW_NOTIFY_BACKGROUND_RESUME_DISPATCH_ERROR]", { accessToken, error });
    });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { accessToken?: string; email?: string };
    const accessToken = body.accessToken?.trim();

    if (!accessToken) {
      return NextResponse.json({ error: "Missing access token." }, { status: 400 });
    }

    const storedBook = await getBookByAccessToken(accessToken);
    if (!storedBook) {
      return NextResponse.json({ error: "Book not found." }, { status: 404 });
    }

    if (hasPremiumAccess(storedBook.status)) {
      return NextResponse.json({ error: "Preview notification is only available for free previews." }, { status: 400 });
    }

    const email = (body.email?.trim() || storedBook.preview_notification_email || storedBook.email || "").toLowerCase();
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    const updatedBook = await savePreviewNotificationRequest(storedBook.id, email);

    console.log("[PREVIEW_NOTIFY_REQUESTED]", {
      bookId: updatedBook.id,
      hasEmail: true,
    });

    scheduleBackgroundFreePreviewResume(accessToken);

    return NextResponse.json({
      success: true,
      previewNotifyRequested: updatedBook.preview_notify_requested,
    });
  } catch (error) {
    console.error("[PREVIEW_NOTIFY_REQUEST_FAILED]", error);
    return NextResponse.json(
      { error: getSafeApiErrorMessage(error, "Unable to save preview notification request.") },
      { status: 500 },
    );
  }
}
