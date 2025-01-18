import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@clerk/nextjs/server";
import { ObjectId, Document } from "mongodb";
import clientPromise from "@/lib/mongodb";

interface Activity {
  _id: ObjectId;
  orgId: string;
  documentIds: string[];
}

interface DocumentType extends Document {
  activityIds: string[];
  orgId: string;
}

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
  
      // Remove activityId from document
      await db.collection<DocumentType>("documents").updateOne(
        { _id: new ObjectId(params.documentId), orgId },
        { $pull: { activityIds: activityId } }
      );
  
      // Remove documentId from activity
      await db.collection<Activity>("activities").updateOne(
        { _id: new ObjectId(activityId), orgId },
        { $pull: { documentIds: params.documentId } }
      );
  
      return new NextResponse(null, { status: 200 });
    } catch (error) {
      console.error("[DOCUMENT_UNLINK_POST]", error);
      return new NextResponse("Internal Error", { status: 500 });
    }
  }
  