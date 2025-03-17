import { getDbClient } from "@/lib/db";
import { getAuth } from "@clerk/nextjs/server";
import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { orgId } = getAuth(req);
  const sceneId = req.query.sceneId as string;

  // Skip auth check for GET requests
  if (req.method !== 'GET' && !orgId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const client = getDbClient();
  const collection = client.db("cluster0").collection<{
    _id?: string;
    scene_id: string;
    objects?: any[];
    orgId?: string;
    createdAt: Date;
    updatedAt: Date;
  }>("scenes_configuration");

  try {
    switch (req.method) {
      case 'GET':
        const config = await collection.findOne({ scene_id: sceneId });
        if (!config) {
          // Create neutral config without orgId
          const newConfig = {
            scene_id: sceneId,
            objects: [],
            createdAt: new Date(),
            updatedAt: new Date()
          };
          await collection.insertOne(newConfig);
          return res.status(200).json(newConfig);
        }
        return res.status(200).json(config);

      case 'PUT':
        console.log("[SCENE_CONFIG_API] PUT request body:", req.body);
        const existing = await collection.findOne({ scene_id: sceneId });
        console.log("[SCENE_CONFIG_API] Existing config:", existing);
        
        if (!existing) {
          const newConfig = {
            scene_id: sceneId,
            ...req.body,
            orgId,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          console.log("[SCENE_CONFIG_API] Creating new config:", newConfig);
          await collection.insertOne(newConfig);
          return res.status(200).json(newConfig);
        } else {
          const updatedConfig = {
            ...existing,
            ...req.body,
            updatedAt: new Date()
          };
          console.log("[SCENE_CONFIG_API] Updating config:", updatedConfig);
          const result = await collection.updateOne(
            { scene_id: sceneId },
            { $set: updatedConfig }
          );
          console.log("[SCENE_CONFIG_API] Update result:", result);
          return res.status(200).json(updatedConfig);
        }

      default:
        return res.status(405).json({ message: "Method not allowed" });
    }
  } catch (error) {
    console.error("[SCENE_CONFIG_API] Detailed error:", error);
    return res.status(500).json({ 
      message: "Internal server error",
      error: error instanceof Error ? error.message : String(error)
    });
  }
} 