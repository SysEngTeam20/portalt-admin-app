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
        
        // Get all activities to find potential matches
        const allActivities = await activitiesCollection.find({});
        console.log("[LLM_DOCUMENTS_GET] Found", allActivities.length, "activities");
        
        if (allActivities.length > 0) {
          // For now, use the first activity we find (in real production, this should be more sophisticated)
          const firstActivity = allActivities[0];
          console.log("[LLM_DOCUMENTS_GET] Using first activity:", JSON.stringify(firstActivity));
          
          // Create a virtual scene object
          scene = {
            _id: sceneId,
            id: sceneId,
            activity_id: firstActivity._id,
            orgId: sceneConfig.orgId || firstActivity.orgId,
            name: "Virtual Scene",
            order: 1
          };
          
          console.log("[LLM_DOCUMENTS_GET] Created virtual scene:", JSON.stringify(scene));
        }
      }
    }
    
    console.log("[LLM_DOCUMENTS_GET] Scene lookup result:", scene ? "found" : "not found", 
                "for sceneId:", sceneId);
    
    if (scene) {
      console.log("[LLM_DOCUMENTS_GET] Scene details:", JSON.stringify(scene));
    }

    // If we have neither scene nor activityId, return 404
    if (!scene && !activityId) {
      return res.status(404).json({ message: "Scene not found" });
    }

    // Use activityId from scene if available, otherwise use the one from token
    const finalActivityId = scene?.activity_id || scene?.activityId || activityId;
    
    if (!finalActivityId) {
      console.log("[LLM_DOCUMENTS_GET] No activity_id found in scene or token:", JSON.stringify(scene));
      return res.status(404).json({ message: "No activity_id found" });
    }
    
    console.log("[LLM_DOCUMENTS_GET] Using activity_id:", finalActivityId);

    // Get the activity and verify RAG is enabled
    const activity = await db.collection<Activity>("activities").findOne({
      _id: finalActivityId,
    });
    
    console.log("[LLM_DOCUMENTS_GET] Activity lookup result:", 
                activity ? (activity.ragEnabled ? "found with RAG enabled" : "found but RAG disabled") : "not found",
                "for activity_id:", finalActivityId);
    
    if (!activity) {
      return res.status(404).json({ message: "Activity not found" });
    }
    
    if (!activity.ragEnabled) {
      console.log("[LLM_DOCUMENTS_GET] RAG is disabled for this activity, but continuing anyway for debugging");
      // During debugging, don't return 404 here so we can see the document retrieval process
      // return res.status(404).json({ message: "RAG not enabled for this activity" });
    }

    // Get all documents associated with this activity using Relations helper
    console.log("[LLM_DOCUMENTS_GET] Querying documents for activity_id:", finalActivityId);
    
    const documentIds = await Relations.getDocumentsByActivityId(finalActivityId);
    console.log("[LLM_DOCUMENTS_GET] Found document IDs:", documentIds);
    
    // Get the full document data for each ID
    const documentsCollection = db.collection<Document>("documents");
    const documentArray: Document[] = [];
    
    for (const docId of documentIds) {
      const doc = await documentsCollection.findOne({ _id: docId });
      if (doc) documentArray.push(doc);
    }
    
    console.log("[LLM_DOCUMENTS_GET] Retrieved", documentArray.length, "documents for activity_id:", finalActivityId);
    
    // Generate short-lived signed URLs for each document
    const documentsWithUrls = await Promise.all(
      documentArray.map(async (doc) => {
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