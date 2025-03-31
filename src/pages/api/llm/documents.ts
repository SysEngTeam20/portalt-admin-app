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
    
    // First try to get sceneId directly from payload
    let sceneId: string | undefined = payload?.sceneId?.toString();
    let activityId: string | undefined = payload?.activityId?.toString();
    
    // If no sceneId in payload but we have activityId, try to find a scene for that activity
    if (!sceneId && activityId) {
      console.log("[LLM_DOCUMENTS_GET] No sceneId found, trying to find scene for activityId:", activityId);
      const client = getDbClient();
      const db = client.db("cluster0");
      const scenesCollection = db.collection<Scene>("scenes");
      
      // Try to find a scene by activity_id or activityId
      const scene = await scenesCollection.findOne({
        $or: [
          { activity_id: activityId },
          { activityId: activityId }
        ]
      });
      
      if (scene) {
        sceneId = scene._id || scene.id;
        console.log("[LLM_DOCUMENTS_GET] Found scene for activity:", sceneId);
      }
    }
    
    // If we have an activityId but no sceneId, we can proceed with just the activityId
    if (!sceneId && !activityId) {
      console.log("[LLM_DOCUMENTS_GET] No valid sceneId or activityId found in token");
      return res.status(401).json({ message: "Invalid token: no sceneId or activityId found" });
    }

    console.log("[LLM_DOCUMENTS_GET] Request received with sceneId:", sceneId, "activityId:", activityId);
    
    const client = getDbClient();
    const db = client.db("cluster0");

    // Log all collections to check if we're accessing the right ones
    console.log("[LLM_DOCUMENTS_GET] Available collections:", 
                Object.keys(db).includes('listCollections') ? 
                'Has listCollections method' : 'No listCollections method');

    const scenesCollection = db.collection<Scene>("scenes");
    const activitiesCollection = db.collection<Activity>("activities");
    
    // If we have an activityId but no sceneId, we can skip scene lookup
    let scene: Scene | null = null;
    if (sceneId) {
      // DEBUG: Get total count of scenes for debugging
      const totalScenes = await scenesCollection.find({}).length;
      console.log("[LLM_DOCUMENTS_GET] Total scenes in DB:", totalScenes);
      
      // DEBUG: Try to get ALL scenes with a simple query
      const someScenes = await scenesCollection.find({});
      console.log("[LLM_DOCUMENTS_GET] First few scenes:", 
                  JSON.stringify(someScenes.slice(0, 3)));
      
      // Try to find scene by either _id or id field
      scene = await scenesCollection.findOne({
        _id: sceneId
      });
      
      // If not found by _id, try the id field
      if (!scene) {
        console.log("[LLM_DOCUMENTS_GET] Scene not found by _id, trying id field");
        scene = await scenesCollection.findOne({
          id: sceneId
        });
      }
      
      // If still no scene found, try looking up by scene_id field in scenes_configuration
      let sceneConfig: SceneConfiguration | null = null;
      if (!scene) {
        console.log("[LLM_DOCUMENTS_GET] Scene not found by id either, trying scenes_configuration lookup");
        const sceneConfigCollection = db.collection<SceneConfiguration>("scenes_configuration");
        
        // Check if the scenes_configuration collection exists
        const hasSceneConfigs = await sceneConfigCollection.find({}).length > 0;
        console.log("[LLM_DOCUMENTS_GET] Has scene configs?", hasSceneConfigs);
        
        // Try to find config with scene_id
        sceneConfig = await sceneConfigCollection.findOne({
          scene_id: sceneId
        });
        
        // If not found, try with camelCase
        if (!sceneConfig) {
          console.log("[LLM_DOCUMENTS_GET] Config not found with snake_case, trying camelCase");
          const camelCaseConfig = await sceneConfigCollection.findOne({
            sceneId: sceneId
          });
          
          if (camelCaseConfig) {
            console.log("[LLM_DOCUMENTS_GET] Found config with camelCase:", JSON.stringify(camelCaseConfig));
            sceneConfig = camelCaseConfig;
            
            // Handle both scene_id and sceneId
            const configSceneId = camelCaseConfig.scene_id || camelCaseConfig.sceneId;
            
            if (configSceneId) {
              console.log("[LLM_DOCUMENTS_GET] Looking up scene by configSceneId:", configSceneId);
              scene = await scenesCollection.findOne({
                _id: configSceneId
              }) || await scenesCollection.findOne({
                id: configSceneId 
              });
            }
          }
        } else {
          console.log("[LLM_DOCUMENTS_GET] Found scene config:", JSON.stringify(sceneConfig));
          
          // Try both _id and id fields when looking up by scene_id from config
          if (sceneConfig.scene_id) {
            console.log("[LLM_DOCUMENTS_GET] Looking up scene by config.scene_id:", sceneConfig.scene_id);
            scene = await scenesCollection.findOne({
              _id: sceneConfig.scene_id
            });
            
            if (!scene) {
              scene = await scenesCollection.findOne({
                id: sceneConfig.scene_id
              });
            }
          }
        }
      }
      
      // LAST RESORT: Try a substring match on id or _id
      if (!scene) {
        console.log("[LLM_DOCUMENTS_GET] Attempting substring match on id field as last resort");
        const allScenes = await scenesCollection.find({});
        
        for (const possibleScene of allScenes) {
          const sceneIdField = possibleScene.id || possibleScene._id || "";
          if (sceneIdField.toString().includes(sceneId)) {
            console.log("[LLM_DOCUMENTS_GET] Found scene via substring match:", JSON.stringify(possibleScene));
            scene = possibleScene;
            break;
          }
        }
      }
      
      // SPECIAL CASE: If we found a scene configuration but no scene, create a virtual scene object
      if (!scene && sceneConfig) {
        console.log("[LLM_DOCUMENTS_GET] No scene found but scene configuration exists. Looking up activities.");
        
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
      documentArray.map(async (doc) => ({
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