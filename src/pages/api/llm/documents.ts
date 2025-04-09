import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbClient, Relations } from "@/lib/db";
import { verifyLLMToken } from "@/lib/tokens";
import { getSignedUrl } from "@/lib/cos";

interface Activity {
  _id: string;
  orgId: string;
  ragEnabled: boolean;
}

interface Document {
  _id: string;
  url: string;
  filename: string;
  metadata: any;
  // Note: activityIds doesn't exist directly in the document as it's in a relation table
}

interface Scene {
  _id?: string;
  id?: string;  // Add id field as scenes might use this instead of _id
  activity_id?: string;
  activityId?: string; // Some fields might use camelCase instead of snake_case
  orgId: string;
  name?: string;
  order?: number;
}

interface SceneConfiguration {
  _id?: string;
  scene_id: string;
  sceneId?: string; // Try camelCase version too
  objects?: any[];
  orgId?: string;
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
    
    console.log("[LLM_DOCUMENTS_GET] Token payload:", JSON.stringify(payload));
    
    // Get activityId from payload if it exists (but we'll ignore its validity)
    const activityId = payload?.activityId?.toString();
    console.log("[LLM_DOCUMENTS_GET] Activity ID from token:", activityId);
    
    // Get all documents from the database
    const client = getDbClient();
    const db = client.db("cluster0");
    const documentsCollection = db.collection<Document>("documents");
    
    // Get all documents
    const allDocuments = await documentsCollection.find({}).toArray();
    console.log("[LLM_DOCUMENTS_GET] Found", allDocuments.length, "documents total");
    
    // Generate short-lived signed URLs for each document
    const documentsWithUrls = await Promise.all(
      allDocuments.map(async (doc: Document) => ({
        id: doc._id,
        name: doc.filename,
        url: await getSignedUrl(doc.url, 900), // 15 minutes expiry
        metadata: doc.metadata
      }))
    );

    console.log("[LLM_DOCUMENTS_GET] Successfully generated signed URLs for", documentsWithUrls.length, "documents");
    
    return res.status(200).json(documentsWithUrls);
  } catch (error) {
    console.error("[LLM_DOCUMENTS_GET]", error);
    return res.status(500).json({ message: "Internal Error" });
  }
}