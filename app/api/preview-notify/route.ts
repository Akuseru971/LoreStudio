import { NextResponse } from "next/server";
import { getBookByAccessToken, savePreviewNotificationRequest } from "@/lib/bookStore";
import { hasPremiumAccess } from "@/lib/paymentVerification";
import { getSafeApiErrorMessage } from "@/lib/supabaseErrors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
