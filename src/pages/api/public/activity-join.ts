import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbClient } from "@/lib/db";
import { ObjectId } from 'mongodb';

interface JoinCodeDocument {
  _id: string;
  activityId: string;
  joinCode: string;
  createdAt: Date;
  expiresAt: Date;
}

interface ActivityDocument {
  _id: string;
  title: string;
  description?: string;
  format: string;
  platform: string;
  scenes?: SceneDocument[];
  bannerUrl?: string;
  orgId: string;
  createdAt: string;
  updatedAt: string;
  documentIds?: string[];
  ragEnabled?: boolean;
}

interface SceneDocument {
  id: string;
  name: string;
  order: number;
  config: any;
}

interface SceneConfigurationDocument {
  _id: string;
  scene_id: string;
  objects: any[];
  orgId: string;
  createdAt: Date;
  updatedAt: Date;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log("[PUBLIC_JOIN_API] Starting request");
    const { joinCode } = req.query;

    if (!joinCode || typeof joinCode !== 'string') {
      return res.status(400).json({ message: "Join code is required" });
    }

    console.log("[PUBLIC_JOIN_API] Join code:", joinCode);

    const client = getDbClient();
    console.log("[PUBLIC_JOIN_API] Got DB client");
    
    const db = client.db("cluster0");
    console.log("[PUBLIC_JOIN_API] Got DB");

    const joinCodesCollection = db.collection<JoinCodeDocument>("joinCodes");
    console.log("[PUBLIC_JOIN_API] Got joinCodes collection");

    // Find valid join code
    const joinCodes = await joinCodesCollection.find({
      joinCode
    });
    console.log("[PUBLIC_JOIN_API] Found join codes:", joinCodes);

    const joinCodeDoc = joinCodes.find(code => 
      new Date(code.expiresAt) > new Date()
    );

    if (!joinCodeDoc) {
      console.log("[PUBLIC_JOIN_API] No valid join code found");
      return res.status(404).json({ message: "Invalid or expired join code" });
    }

    console.log("[PUBLIC_JOIN_API] Found valid join code:", joinCodeDoc);

    const activitiesCollection = db.collection<ActivityDocument>("activities");
    console.log("[PUBLIC_JOIN_API] Got activities collection");

    // Get activity
    const activity = await activitiesCollection.findOne({
      _id: joinCodeDoc.activityId
    });

    console.log("[PUBLIC_JOIN_API] Looking for activity:", joinCodeDoc.activityId);
    console.log("[PUBLIC_JOIN_API] Found activity:", activity);

    if (!activity) {
      console.log("[PUBLIC_JOIN_API] Activity not found");
      return res.status(404).json({ message: "Activity not found" });
    }

    // Get first scene from activity document
    const firstScene = activity.scenes?.find(scene => scene.order === 0) || activity.scenes?.[0];
    console.log("[PUBLIC_JOIN_API] Found first scene:", firstScene);

    if (!firstScene) {
      console.log("[PUBLIC_JOIN_API] No scenes found");
      return res.status(404).json({ message: "No scenes found for this activity" });
    }

    const scenesConfigCollection = db.collection<SceneConfigurationDocument>("scenes_configuration");
    console.log("[PUBLIC_JOIN_API] Got scenes_configuration collection");

    // Get scene configuration
    const sceneConfig = await scenesConfigCollection.findOne({
      scene_id: firstScene.id
    });

    if (!sceneConfig) {
      console.log("[PUBLIC_JOIN_API] No scene configuration found");
      return res.status(404).json({ message: "No scene configuration found for this scene" });
    }

    console.log("[PUBLIC_JOIN_API] Successfully found all data");
    return res.status(200).json(sceneConfig);
  } catch (error) {
    console.error("[PUBLIC_JOIN_API] Error:", error);
    return res.status(500).json({ message: "Internal Error" });
  }
} 