import type { NextApiRequest, NextApiResponse } from 'next';
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET method
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifyLLMToken(token);
    
    if (!payload?.activityId) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const client = await clientPromise;
    const db = client.db("cluster0");

    // Get the activity and verify RAG is enabled
    const activity = await db.collection<Activity>("activities").findOne({
      _id: new ObjectId(payload.activityId as string),
      ragEnabled: true
    });

    if (!activity) {
      return res.status(404).json({ message: "Activity not found or RAG not enabled" });
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

    return res.status(200).json(documentsWithUrls);
  } catch (error) {
    console.error("[LLM_DOCUMENTS_GET]", error);
    return res.status(500).json({ message: "Internal Error" });
  }
}