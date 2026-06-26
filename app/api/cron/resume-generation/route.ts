import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

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

function isAuthorizedCronRequest(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    return false;
  }

  const authorization = request.headers.get("authorization");
  if (authorization === `Bearer ${expectedSecret}`) {
    return true;
  }

  const { searchParams } = new URL(request.url);
  return searchParams.get("secret") === expectedSecret;
}

export async function GET(request: Request) {
  console.log("[CRON_RESUME_GENERATION_HIT]");

  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fulfillmentSecret = process.env.INTERNAL_FULFILLMENT_SECRET;
  if (!fulfillmentSecret) {
    console.error("[CRON_RESUME_GENERATION_ERROR]", "INTERNAL_FULFILLMENT_SECRET is not configured.");
    return NextResponse.json({ error: "Internal fulfillment secret is not configured." }, { status: 503 });
  }

  try {
    console.log("[CRON_RESUME_GENERATION_CALL_WATCHDOG_START]");

    const response = await fetch(`${getAppBaseUrl()}/api/internal/resume-stuck-books`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-fulfillment-secret": fulfillmentSecret,
      },
      body: JSON.stringify({}),
    });

    const result = await response.json().catch(() => ({
      error: "Unable to parse watchdog response.",
    }));

    console.log("[CRON_RESUME_GENERATION_CALL_WATCHDOG_DONE]", result);

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      result,
    });
  } catch (error) {
    console.error("[CRON_RESUME_GENERATION_ERROR]", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Cron resume generation failed.",
      },
      { status: 500 },
    );
  }
}
