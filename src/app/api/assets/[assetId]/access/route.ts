// app/api/assets/[assetId]/access/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { getSignedUrl } from "@/lib/cos";

function toObjectId(id: string) {
  try {
    return new ObjectId(id);
  } catch (error) {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  context: { params: { assetId: string } }
) {
  try {
    const { orgId } = getAuth(req);
    if (!orgId) return new NextResponse("Unauthorized", { status: 401 });

    const params = await context.params;
    const objectId = toObjectId(params.assetId);
    if (!objectId) {
      return new NextResponse("Invalid asset ID", { status: 400 });
    }
    
    const client = await clientPromise;
    const db = client.db("cluster0");

    // Try finding in assets collection first
    let item = await db.collection("assets").findOne({
      _id: objectId,
      orgId
    });

    // If not found in assets, try documents collection
    if (!item) {
      item = await db.collection("documents").findOne({
        _id: objectId,
        orgId
      });
    }

    if (!item) {
      return new NextResponse("Asset not found", { status: 404 });
    }

    // Generate short-lived signed URL (15 minutes)
    const signedUrl = await getSignedUrl(item.url, 900);

    return NextResponse.json({ url: signedUrl });
  } catch (error) {
    console.error("[ASSET_ACCESS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}