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
      allDocuments.map(async (doc: Document) => {
        let url;
        try {
          console.log("[LLM_DOCUMENTS_GET] Processing document URL:", doc.url);
          
          // Check if the URL starts with "documents/" or "uploads/" which indicates it's a key
          if (doc.url.startsWith('documents/') || doc.url.startsWith('uploads/')) {
            // This is a COS key, generate signed URL
            url = await getSignedUrl(doc.url, 900); // 15 minutes expiry
            console.log("[LLM_DOCUMENTS_GET] Generated signed URL from key");
          } 
          // Check if it's a full URL with hostname and protocol
          else if (doc.url.startsWith('http')) {
            // If it already contains a signature (has query params), use as-is
            if (doc.url.includes('?X-Amz-Algorithm=')) {
              console.log("[LLM_DOCUMENTS_GET] Using existing signed URL");
              url = doc.url;
            } else {
              // It's a regular URL without signature, extract the key part
              try {
                const urlObj = new URL(doc.url);
                const pathParts = urlObj.pathname.split('/');
                // The key is everything after the bucket name in the path
                const key = pathParts.slice(2).join('/');
                console.log("[LLM_DOCUMENTS_GET] Extracted key from URL:", key);
                url = await getSignedUrl(key, 900); // 15 minutes expiry
              } catch (urlError) {
                console.error("[LLM_DOCUMENTS_GET] Error parsing URL:", urlError);
                url = doc.url; // Fallback to original URL
              }
            }
          } else {
            // Assume it's a key if it doesn't match other patterns
            url = await getSignedUrl(doc.url, 900);
            console.log("[LLM_DOCUMENTS_GET] Treated as key by default");
          }
          
          console.log("[LLM_DOCUMENTS_GET] Final URL:", url.substring(0, 50) + "...");
        } catch (error) {
          console.error("[LLM_DOCUMENTS_GET] Error generating URL for document:", doc._id, error);
          url = doc.url; // Fallback to the original URL
        }
        
        return {
          id: doc._id,
          name: doc.filename,
          url: url,
          metadata: doc.metadata
        };
      })
    );

    console.log("[LLM_DOCUMENTS_GET] Successfully generated signed URLs for", documentsWithUrls.length, "documents");
    
    return res.status(200).json(documentsWithUrls);
  } catch (error) {
    console.error("[LLM_DOCUMENTS_GET]", error);
    return res.status(500).json({ message: "Internal Error" });
  }
}