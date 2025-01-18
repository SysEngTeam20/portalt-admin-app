import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

export async function POST(
  req: NextRequest,
  context: { params: { documentId: string } }
) {
  try {
    const { orgId } = getAuth(req);
    if (!orgId) return new NextResponse("Unauthorized", { status: 401 });

    const params = await context.params;
    const { activityId } = await req.json();

    const client = await clientPromise;
    const db = client.db("cluster0");

    // Update document with new activityId
    await db.collection("documents").updateOne(
      { _id: new ObjectId(params.documentId), orgId },
      { $addToSet: { activityIds: activityId } }
    );

    // Update activity with new documentId
    await db.collection("activities").updateOne(
      { _id: new ObjectId(activityId), orgId },
      { $addToSet: { documentIds: params.documentId } }
    );

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    console.error("[DOCUMENT_LINK_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}