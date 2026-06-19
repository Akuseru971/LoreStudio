import { NextResponse } from "next/server";
import { saveBookAsset } from "@/lib/bookStore";

export const runtime = "nodejs";

type UploadAssetBody = {
  accessToken?: string;
  pageNumber?: number;
  assetType?: "image" | "audio";
  assetRef?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UploadAssetBody;
    const accessToken = body.accessToken?.trim();
    const pageNumber = Number(body.pageNumber);
    const assetType = body.assetType;
    const assetRef = body.assetRef?.trim();

    if (!accessToken || !Number.isFinite(pageNumber) || pageNumber < 1 || !assetType || !assetRef) {
      return NextResponse.json({ error: "Invalid asset upload payload." }, { status: 400 });
    }

    if (assetType !== "image" && assetType !== "audio") {
      return NextResponse.json({ error: "Invalid asset type." }, { status: 400 });
    }

    await saveBookAsset(accessToken, pageNumber, assetType, assetRef);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to upload book asset.", error);
    const message = error instanceof Error ? error.message : "Unable to upload book asset.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
