import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { verifyLLMToken } from "@/lib/tokens";
import { getSignedUrl } from "@/lib/cos";

interface Activity {
  _id: ObjectId;
  orgId: string;
  ragEnabled: boolean;
}

interface Document {
  _id: ObjectId;
  url: string;
  filename: string;
  metadata: any;
  activityIds: string[];
}

export async function GET(req: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new NextResponse("Invalid token", { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifyLLMToken(token);
    
    if (!payload?.activityId) {
      return new NextResponse("Invalid token", { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("cluster0");

    // Get the activity and verify RAG is enabled
    const activity = await db.collection<Activity>("activities").findOne({
      _id: new ObjectId(payload.activityId as string),
      ragEnabled: true
    });

    if (!activity) {
      return new NextResponse("Activity not found or RAG not enabled", { status: 404 });
    }

    // Get all documents associated with this activity
    const documents = await db.collection<Document>("documents")
      .find({
        activityIds: payload.activityId as string
      })
      .toArray();

    // Generate short-lived signed URLs for each document
    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => {
        const signedUrl = await getSignedUrl(doc.url, 900); // 15 minutes expiry
        return {
          id: doc._id,
          name: doc.filename,
          url: signedUrl,
          metadata: doc.metadata
        };
      })
    );

    return NextResponse.json(documentsWithUrls);
  } catch (error) {
    console.error("[LLM_DOCUMENTS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}