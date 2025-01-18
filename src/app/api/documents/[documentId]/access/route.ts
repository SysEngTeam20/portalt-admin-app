import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { getSignedUrl } from "@/lib/cos";

export async function GET(
  req: NextRequest,
  context: { params: { documentId: string } }
) {
  try {
    const { orgId } = getAuth(req);
    if (!orgId) return new NextResponse("Unauthorized", { status: 401 });

    const params = await context.params;
    const client = await clientPromise;
    const db = client.db("cluster0");

    // Verify document exists and belongs to organization
    const document = await db.collection("documents").findOne({
      _id: new ObjectId(params.documentId),
      orgId,
    });

    if (!document) {
      return new NextResponse("Document not found", { status: 404 });
    }

    // Generate short-lived signed URL
    const signedUrl = await getSignedUrl(document.url, 3600); // 1 hour expiry

    return NextResponse.json({ url: signedUrl });
  } catch (error) {
    console.error("[DOCUMENT_ACCESS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}